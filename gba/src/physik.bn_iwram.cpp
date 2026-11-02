// Flugmodell – Zeile für Zeile aus physik.js übersetzt (Kommentare und Reihenfolge wie dort).
// Dateiname .bn_iwram.cpp: Butano übersetzt die Datei als ARM-Code in den schnellen IWRAM.
// Wichtig: Die Reihenfolge der Zufallsaufrufe muss genau wie in physik.js bleiben,
// sonst weichen die Würfe von den Referenzwürfen ab.

// Butano baut mit -ffast-math; hier soll aber genau nach IEEE gerechnet werden,
// damit GBA, PC-Test und JavaScript dieselben Zahlen liefern.
#pragma GCC optimize("no-fast-math")

#include "physik.h"
#include "mathe.h"
#include "gen_einstellungen.h"

// Große Tabellen auf dem GBA in den großen Arbeitsspeicher (EWRAM, 256 KB) statt in den
// schnellen, aber kleinen IWRAM (32 KB) – wie BN_DATA_EWRAM_BSS in Butano.
#if defined(__arm__) && ! defined(__linux__)
    #define PHYSIK_EWRAM __attribute__((section(".sbss")))
#else
    #define PHYSIK_EWRAM
#endif

namespace physik
{
    namespace
    {
        einstellungen werte = {
            gen::einstellungen::winkel, gen::einstellungen::turn, gen::einstellungen::fade,
            gen::einstellungen::weite, gen::einstellungen::streuung, gen::einstellungen::wind,
            gen::einstellungen::kick, gen::einstellungen::baum_abprallen, gen::einstellungen::baum_bremsen,
        };

        zufall* aktueller_zufall = nullptr;

        // wie Math.random(): 0 <= x < 1
        double zufallszahl()
        {
            return aktueller_zufall->naechste() / 4294967296.0;
        }

        using mathe::clamp;

        double abstand(punkt a, punkt b)
        {
            return mathe::hypot(a.x - b.x, a.y - b.y);
        }

        // Quadrat des Abstands. Für Vergleiche "Abstand < r" genügt  d² < r²  – gleiches Ergebnis wie
        // in physik.js, aber ohne Wurzel (auf dem GBA ohne Gleitkomma-Hardware sehr teuer).
        double abstand2(punkt a, punkt b)
        {
            double dx = a.x - b.x, dy = a.y - b.y;
            return dx * dx + dy * dy;
        }

        // Bäume einer Bahn als double, einmal je Wurf umgerechnet (statt in jedem Flugschritt)
        struct baum_cache
        {
            double x, y, r2, h;
            int x0, x1, y0, y1;     // ganze Meter um die Krone: schneller Ausschluss ohne Gleitkomma
            bool am_abwurf;         // steht direkt am Abwurfpunkt (< 5 m): ganz ignorieren
        };

        PHYSIK_EWRAM baum_cache baeume_cache[256];

        int abrunden(double v)
        {
            int i = int(v);
            return (double(i) > v) ? i - 1 : i;
        }

        // Werte, die nur vom Flugschritt i abhängen (für alle Würfe gleich): einmal berechnet
        constexpr int N = 160;

        struct schritt_tabelle
        {
            bool fertig = false;
            double f[N + 1], wT[N + 1], wF[N + 1], sin_pi_u[N + 1];
        };

        PHYSIK_EWRAM schritt_tabelle tab;

        void fuelle_tabelle()
        {
            if(tab.fertig) { return; }
            for(int i = 0; i <= N; ++i)
            {
                const double u = double(i) / N;
                tab.f[i] = 2 * u - u * u;   // zurückgelegter Anteil bei linearer Abbremsung
                tab.wT[i] = u < 0.75 ? mathe::sin(mathe::pi * u / 0.75) : 0;
                tab.sin_pi_u[i] = mathe::sin(mathe::pi * u);
            }
            // Fade-Gewicht wie physik.js: ab fade_start, mit fade_rund nach Strecke statt Zeit gewichtet, Summe 0,22·N
            const double fs = mathe::clamp(gen::einstellungen::fade_start, 0.05, 0.95);
            const double rund = mathe::clamp(gen::einstellungen::fade_rund, 0, 1);
            double summe = 0;
            tab.wF[0] = 0;
            for(int i = 1; i <= N; ++i)
            {
                const double u1 = double(i) / N;
                const double form = u1 > fs ? mathe::potenz((u1 - fs) / (1 - fs), 1.5 - 0.8 * rund) : 0;
                const double w = form * ((1 - rund) + rund * 2 * (1 - u1 + 0.5 / N));
                tab.wF[i] = w;
                summe += w;
            }
            for(int i = 1; i <= N; ++i) { tab.wF[i] *= summe > 0 ? 0.22 * N / summe : 0; }
            tab.fertig = true;
        }

        bool im_rechteck(punkt p, const daten::ob_zone& r)
        {
            double x = zahl(r.x), y = zahl(r.y);
            return p.x >= x && p.x <= x + zahl(r.w) && p.y >= y && p.y <= y + zahl(r.h);
        }

        bool im_polygon(punkt p, const daten::punkt* poly, int n)
        {
            bool drin = false;
            for(int i = 0, j = n - 1; i < n; j = i++)
            {
                double xi = zahl(poly[i].x), yi = zahl(poly[i].y), xj = zahl(poly[j].x), yj = zahl(poly[j].y);
                if((yi > p.y) != (yj > p.y) && p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi) { drin = ! drin; }
            }
            return drin;
        }

        // Seite einer Linie: Vorzeichen bezogen auf das nächstgelegene Linienstück
        // (null in JS = keine_seite: jenseits der Linienenden gilt die Linie nicht)
        constexpr int keine_seite = 2;

        int seite_von_linie(punkt p, const daten::punkt* linie, int n)
        {
            double best = 1e300;
            int seite = 0;
            for(int i = 0; i < n - 1; i++)
            {
                double ax = zahl(linie[i].x), ay = zahl(linie[i].y), bx = zahl(linie[i + 1].x), by = zahl(linie[i + 1].y);
                double dx = bx - ax, dy = by - ay;
                double nenner = dx * dx + dy * dy;
                if(nenner == 0) { nenner = 1; }
                double t = clamp(((p.x - ax) * dx + (p.y - ay) * dy) / nenner, 0, 1);
                double ex = p.x - ax - t * dx, ey = p.y - ay - t * dy;
                double d = ex * ex + ey * ey;   // Quadrat genügt zum Vergleichen
                bool am_ende = (i == 0 && t == 0) || (i == n - 2 && t == 1);
                if(d < best) { best = d; seite = am_ende ? keine_seite : int(mathe::vorzeichen(dx * (p.y - ay) - dy * (p.x - ax))); }
            }
            return seite;
        }

        // OB-Zonen: Rechteck, Polygon, Grenzlinie oder Inselgrün
        const daten::ob_zone* ob_zone(punkt p, const daten::bahn& bahn)
        {
            for(int k = 0; k < bahn.ob_anzahl; ++k)
            {
                const daten::ob_zone& o = bahn.ob[k];
                bool treffer;
                switch(o.art)
                {
                case daten::ob_art::insel:
                    treffer = p.x >= zahl(o.ab) && ! im_polygon(p, o.punkte, o.anzahl);
                    break;
                case daten::ob_art::polygon:
                    treffer = im_polygon(p, o.punkte, o.anzahl);
                    break;
                case daten::ob_art::rechteck:
                    treffer = im_rechteck(p, o);
                    break;
                default:
                {
                    int sp = seite_von_linie(p, o.punkte, o.anzahl);
                    int innen = seite_von_linie(zu_punkt(o.innen), o.punkte, o.anzahl);
                    treffer = sp != keine_seite && innen != keine_seite && sp != innen;
                    break;
                }
                }
                if(treffer) { return &o; }
            }
            return nullptr;
        }

        struct mando_kreuzung
        {
            bool gefunden, ok;
            int index;
        };

        // Wo kreuzt der Flug die Mando-Linie? ok: in der Lücke; gefunden = false: nicht erreicht
        mando_kreuzung kreuze_mando(const daten::bahn& bahn, const ergebnis& e, punkt start)
        {
            mando_kreuzung r = { false, false, -1 };
            if(! bahn.hat_mando) { return r; }
            double ax = zahl(bahn.m.a.x), ay = zahl(bahn.m.a.y), bx = zahl(bahn.m.b.x), by = zahl(bahn.m.b.y);
            double dx = bx - ax, dy = by - ay;
            auto seite = [&](double px, double py) { return dx * (py - ay) - dy * (px - ax); };
            double s0 = seite(zahl(bahn.abwurf.x), zahl(bahn.abwurf.y));
            if(seite(start.x, start.y) * s0 <= 0) { return r; }   // schon jenseits der Mando
            for(int k = 1; k < e.pfad_laenge; k++)
            {
                const pfadpunkt& p1 = e.pfad[k - 1];
                const pfadpunkt& p2 = e.pfad[k];
                double s1 = seite(p1.x, p1.y), s2 = seite(p2.x, p2.y);
                if(s2 * s0 > 0) { continue; }
                double nenner = s1 - s2;
                if(nenner == 0) { nenner = 1; }
                double f = s1 / nenner, x = p1.x + (p2.x - p1.x) * f, y = p1.y + (p2.y - p1.y) * f;
                double u = ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy);
                r.gefunden = true;
                r.ok = u >= 0 && u <= 1;
                r.index = k;
                return r;
            }
            return r;
        }

        struct mauer_treffer
        {
            bool gefunden;
            double t, x, y;
            punkt normal;
        };

        // Schneidet die Strecke a→b eine Mauer (unterhalb ihrer Höhe)? Treffpunkt (etwas davor) und Normale zur Seite von a
        // mit_hoehe = false entspricht z === undefined in JS
        mauer_treffer treffe_mauer(const daten::bahn& bahn, punkt a, punkt b, bool mit_hoehe, double z)
        {
            mauer_treffer best = { false, 0, 0, 0, { 0, 0 } };
            for(int mi = 0; mi < bahn.mauern_anzahl; ++mi)
            {
                const daten::mauer& m = bahn.mauern[mi];
                double h = zahl(m.h);
                if(h == 0) { h = 1.2; }
                if(mit_hoehe && z >= h) { continue; }
                for(int i = 0; i < m.anzahl - 1; i++)
                {
                    double cx = zahl(m.punkte[i].x), cy = zahl(m.punkte[i].y), dx = zahl(m.punkte[i + 1].x), dy = zahl(m.punkte[i + 1].y);
                    double rx = b.x - a.x, ry = b.y - a.y, sx = dx - cx, sy = dy - cy, nn = rx * sy - ry * sx;
                    if(mathe::betrag(nn) < 1e-9) { continue; }
                    double t = ((cx - a.x) * sy - (cy - a.y) * sx) / nn, u = ((cx - a.x) * ry - (cy - a.y) * rx) / nn;
                    if(t < 0 || t > 1 || u < 0 || u > 1 || (best.gefunden && t >= best.t)) { continue; }
                    double l = mathe::hypot(sx, sy);
                    double nx = -sy / l, ny = sx / l;
                    if(nx * (a.x - cx) + ny * (a.y - cy) < 0) { nx = -nx; ny = -ny; }
                    best = { true, t, a.x + rx * t + nx * 0.3, a.y + ry * t + ny * 0.3, { nx, ny } };
                }
            }
            return best;
        }

        rueckruf aktueller_rueckruf = nullptr;
        void* rueckruf_daten = nullptr;

        void anhaengen(ergebnis& e, double x, double y, double z, double t)
        {
            if(e.pfad_laenge < pfad_max) { e.pfad[e.pfad_laenge++] = { x, y, z, t }; }
            if(aktueller_rueckruf) { aktueller_rueckruf(e, rueckruf_daten); }
        }

        // Rückmeldung ohne neuen Pfadpunkt (bei längeren Schleifen nach dem Flug)
        void zwischendurch(const ergebnis& e)
        {
            if(aktueller_rueckruf) { aktueller_rueckruf(e, rueckruf_daten); }
        }
    }

    einstellungen& E() { return werte; }
    void setze_zufall(zufall& z) { aktueller_zufall = &z; }
    void vorbereiten() { fuelle_tabelle(); }
    void setze_rueckruf(rueckruf r, void* daten) { aktueller_rueckruf = r; rueckruf_daten = daten; }
    double grad() { return mathe::pi / 180; }
    double zahl(daten::fk f) { return f.roh / 4096.0; }
    punkt zu_punkt(const daten::punkt& p) { return { zahl(p.x), zahl(p.y) }; }

    double gauss()
    {
        double u = 0, v = 0;
        while(u == 0) { u = zufallszahl(); }
        while(v == 0) { v = zufallszahl(); }
        return mathe::wurzel(-2 * mathe::log(u)) * mathe::cos(2 * mathe::pi * v);
    }

    // Liegt p auf der Bowlingbahn (Rechteck entlang einer Strecke)?
    bool auf_bowlingbahn(punkt p, const daten::bahn& bahn)
    {
        if(! bahn.hat_bowlingbahn) { return false; }
        const daten::bowlingbahn& l = bahn.bowling;
        double x1 = zahl(l.a.x), y1 = zahl(l.a.y), x2 = zahl(l.b.x), y2 = zahl(l.b.y);
        double dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy;
        double t = ((p.x - x1) * dx + (p.y - y1) * dy) / len2;
        if(t < 0 || t > 1.03) { return false; }
        double qx = x1 + t * dx, qy = y1 + t * dy;
        const double halb = zahl(l.breite) / 2, ex = p.x - qx, ey = p.y - qy;
        return ex * ex + ey * ey <= halb * halb;
    }

    bool ist_ob(punkt p, const daten::bahn& bahn)
    {
        if(p.x < 0 || p.y < 0 || p.x > zahl(bahn.breite) || p.y > zahl(bahn.hoehe)) { return true; }
        return ob_zone(p, bahn) != nullptr;
    }

    // Je mehr Kraft, desto stärker die Streuung von Richtung, Kraft und Winkel (Vorhand streut etwas mehr)
    wurf streue(const wurf& w)
    {
        double p = w.kraft, vh = w.vorhand ? 1.2 : 1, st = werte.streuung * (w.streu_faktor != 0 ? w.streu_faktor : 1);
        wurf r = w;
        // Reihenfolge wie im JS-Objekt: richtung, kraft, winkel
        r.richtung = w.richtung + gauss() * (0.8 + 7 * (p * p * mathe::wurzel(p))) * vh * st * grad();
        r.kraft = clamp(p * (1 + gauss() * (0.02 + 0.05 * p) * st), 0.01, 1.08);
        r.winkel = w.winkel + gauss() * (1 + 6 * p * p) * st;
        return r;
    }

    // Anteil der Reichweite je nach Kraft; unter 30 % geht es bis auf kurze Annäherungswürfe herunter
    double kraft_faktor(double k)
    {
        return k >= 0.3 ? 0.25 + 0.75 * k : 0.03 + 0.445 * mathe::max(0, k) / 0.3;
    }

    // umgekehrt: welche Kraft braucht die Scheibe für d Meter (ohne Rutschen)?
    double kraft_fuer(const daten::scheibe& s, double d)
    {
        double g = d / (reichweite(s) / werte.weite);
        double k = g >= 0.475 ? (g - 0.25) / 0.75 : (g - 0.03) / 0.445 * 0.3;
        return mathe::max(0.02, mathe::min(1, k));
    }

    double reichweite(const daten::scheibe& s)
    {
        return (30 + zahl(s.speed) * 6.5 + zahl(s.glide) * 2) * werte.weite;
    }

    void simuliere(const daten::bahn& bahn, const wurf& w, wind wind_in, ergebnis& e)
    {
        const daten::scheibe& s = *w.scheibe;
        const double kraft = w.kraft, winkel = w.winkel, DEG = grad();
        const double turn = zahl(s.turn), fade = zahl(s.fade), glide = zahl(s.glide);
        const wind wi = { wind_in.x * werte.wind, wind_in.y * werte.wind };
        const punkt start = { w.x, w.y };
        const punkt korb = zu_punkt(bahn.korb);
        // Linkshänder und Vorhand spiegeln die Kurven (beides zusammen hebt sich auf)
        const double seite = (w.links ? -1 : 1) * (w.vorhand ? -1 : 1);
        const double gegen = -(wi.x * mathe::cos(w.richtung) + wi.y * mathe::sin(w.richtung));   // Gegenwind > 0

        double D = reichweite(s) / werte.weite * kraft_faktor(kraft);
        D *= 1 - mathe::min(mathe::betrag(winkel), 40) / 40 * 0.12;
        if(w.vorhand) { D *= 0.9; }
        D *= w.weite_faktor != 0 ? w.weite_faktor : 1;   // Stärke des Spielers
        D *= werte.weite;
        D *= clamp(1 - 0.03 * gegen, 0.7, 1.15);

        // Gegenwind macht Scheiben instabiler (mehr Turn), Rückenwind stabiler
        // Gesamte Richtungsänderung (rad) durch Turn, Fade und Abwurfwinkel
        const double turnK = -turn * 0.2 * (0.3 + kraft) * clamp(1 + 0.15 * gegen, 0.3, 2) * werte.turn;
        const double fadeK = fade * 2.2 * (1.2 - 0.4 * kraft) * clamp(1 + 0.08 * gegen, 0.5, 1.6) * werte.fade;
        const double winkK = -winkel * DEG * 1.2 * werte.winkel;
        // Fade-Haken: am Ende rutscht die langsame Scheibe seitlich weg (Meter, nach links bei RHBH)
        const double haken = fade * D * 0.03 * werte.fade * (1.2 - 0.4 * kraft) / 0.8 * clamp(1 + 0.08 * gegen, 0.5, 1.6);
        const double H = 1.5 + 6 * kraft * (1 - winkel / 80);
        const double T = 1.2 + 2.6 * kraft + 0.15 * glide;
        fuelle_tabelle();
        const double sin_r = mathe::sin(w.richtung), cos_r = mathe::cos(w.richtung);

        e.pfad_laenge = 0;
        e.brems_anzahl = 0;
        anhaengen(e, w.x, w.y, 1.3, 0);
        double px = w.x, py = w.y, th = w.richtung, z = 1.3, u = 0;
        typ ereignis = typ::landung;
        bool hat_ereignis = false;
        const daten::baum* ereignis_baum = nullptr;
        punkt ereignis_normal = { 0, 0 };
        bool geprueft[256] = {};
        const int baeume_n = bahn.baeume_anzahl < 256 ? bahn.baeume_anzahl : 256;
        for(int b = 0; b < baeume_n; ++b)
        {
            const daten::baum& baum = bahn.baeume[b];
            baum_cache& c = baeume_cache[b];
            c.x = zahl(baum.p.x);
            c.y = zahl(baum.p.y);
            const double r = zahl(baum.r);
            c.r2 = r * r;
            c.h = zahl(baum.h);
            if(c.h == 0) { c.h = 9; }
            c.x0 = abrunden(c.x - r) - 1;
            c.x1 = abrunden(c.x + r) + 1;
            c.y0 = abrunden(c.y - r) - 1;
            c.y1 = abrunden(c.y + r) + 1;
            c.am_abwurf = abstand2({ c.x, c.y }, start) < 25;
        }
        const double korb_r2 = 0.45 * 0.45;
        double brems = 1;   // < 1, nachdem Äste die Scheibe abgebremst haben

        for(int i = 1; i <= N; i++)
        {
            u = double(i) / N;
            const double ds = D * (tab.f[i] - tab.f[i - 1]) * brems;
            const double wT = tab.wT[i];
            const double wF = tab.wF[i];
            th += seite * (turnK * wT - fadeK * wF + winkK * (1 - 0.5 * u)) / N;
            // höchstens 80° von der Abwurfrichtung weg: die Scheibe fliegt nie rückwärts
            th = w.richtung + clamp(th - w.richtung, -80 * DEG, 80 * DEG);
            double sin_th, cos_th;
            mathe::sincos(th, sin_th, cos_th);
            const double qx = -sin_th, qy = cos_th;
            const double quer = wi.x * qx + wi.y * qy;
            // Fade-Haken quer zur Abwurfrichtung (nie nach hinten); wF wächst, je langsamer die Scheibe wird
            const double hs = seite * haken * wF / (0.22 * N);   // Summe aller wF ≈ 0,22·N
            px += cos_th * ds + qx * quer * 0.2 * T / N + sin_r * hs;
            py += sin_th * ds + qy * quer * 0.2 * T / N - cos_r * hs;
            z = 1.3 * (1 - u) + H * tab.sin_pi_u[i];
            anhaengen(e, px, py, z, u * T);

            // Mauer: unterhalb ihrer Höhe prallt die Scheibe ab, darüber fliegt sie hinweg
            const pfadpunkt& vorher = e.pfad[e.pfad_laenge - 2];
            mauer_treffer mauer = { false, 0, 0, 0, { 0, 0 } };
            if(bahn.mauern_anzahl) { mauer = treffe_mauer(bahn, { vorher.x, vorher.y }, { px, py }, true, z); }
            if(mauer.gefunden)
            {
                px = mauer.x;
                py = mauer.y;
                e.pfad[e.pfad_laenge - 1] = { px, py, z, u * T };
                ereignis = typ::mauer;
                hat_ereignis = true;
                ereignis_normal = mauer.normal;
                break;
            }

            const punkt p = { px, py };
            bool raus = false;
            if(abstand2(p, start) > 25)   // in den ersten 5 m ab Abwurfpunkt zählen Bäume nicht
            {
                const int pxi = abrunden(px), pyi = abrunden(py);
                for(int b = 0; b < baeume_n; b++)
                {
                    const baum_cache& c = baeume_cache[b];
                    if(geprueft[b]) { continue; }
                    if(pxi < c.x0 || pxi > c.x1 || pyi < c.y0 || pyi > c.y1) { continue; }   // weit weg
                    if(c.am_abwurf) { continue; }   // Baum steht direkt am Abwurfpunkt: ganz ignorieren
                    const daten::baum& baum = bahn.baeume[b];
                    if(abstand2(p, { c.x, c.y }) < c.r2 && z < c.h)
                    {
                        geprueft[b] = true;
                        // drei Möglichkeiten: abprallen, abbremsen (fliegt langsamer weiter) oder durch eine Lücke
                        const double wz = zufallszahl();
                        if(wz < werte.baum_abprallen)
                        {
                            ereignis = typ::baum;
                            hat_ereignis = true;
                            ereignis_baum = &baum;
                            raus = true;
                            break;
                        }
                        if(wz < werte.baum_abprallen + werte.baum_bremsen)
                        {
                            brems *= 0.35 + zufallszahl() * 0.25;
                            if(e.brems_anzahl < brems_max) { e.brems_punkte[e.brems_anzahl++] = e.pfad_laenge - 1; }
                        }
                    }
                }
            }
            if(raus) { break; }
            if(abstand2(p, korb) < korb_r2 && z < 1.7)
            {
                ereignis = zufallszahl() < (u > 0.6 ? 0.8 : 0.35) ? typ::korb : typ::abpraller;
                hat_ereignis = true;
                break;
            }
        }

        double t = e.pfad[e.pfad_laenge - 1].t;
        bool drin = false;
        typ art = hat_ereignis ? ereignis : typ::landung;

        auto fallen = [&](double zx, double zy, double dauer)
        {
            const pfadpunkt st = e.pfad[e.pfad_laenge - 1];
            const int n = 10;
            for(int k = 1; k <= n; k++)
            {
                const double a = double(k) / n;
                anhaengen(e, st.x + (zx - st.x) * a, st.y + (zy - st.y) * a, st.z * (1 - a * a), t + a * dauer);
            }
            t += dauer;
        };

        if(art == typ::korb)
        {
            fallen(korb.x, korb.y, 0.25);
            drin = true;
        }
        else if(art == typ::abpraller)
        {
            const double a = zufallszahl() * mathe::pi * 2, r = 1 + zufallszahl() * 2.5;
            fallen(korb.x + mathe::cos(a) * r, korb.y + mathe::sin(a) * r, 0.5);
        }
        else if(art == typ::baum || art == typ::mauer)
        {
            // Kick: die Scheibe prallt wie von einer Wand ab (Einfallswinkel = Ausfallswinkel, plus Zufall)
            // und fliegt je nach Restgeschwindigkeit ein paar Meter weg, statt am Stamm liegen zu bleiben
            double bx, by, br;
            if(ereignis_baum) { bx = zahl(ereignis_baum->p.x); by = zahl(ereignis_baum->p.y); br = zahl(ereignis_baum->r); }
            else { bx = px - ereignis_normal.x; by = py - ereignis_normal.y; br = 0; }
            double nl = mathe::hypot(px - bx, py - by);
            if(nl == 0) { nl = 1; }
            const double nx = (px - bx) / nl, ny = (py - by) / nl;
            const double vx = mathe::cos(th), vy = mathe::sin(th), dot = vx * nx + vy * ny;
            double ab = mathe::atan2(vy - 2 * dot * ny, vx - 2 * dot * nx) + gauss() * (art == typ::mauer ? 0.3 : 0.6);
            // von der Mauer immer weg, nie hindurch
            if(art == typ::mauer && mathe::cos(ab) * nx + mathe::sin(ab) * ny < 0.15) { ab = mathe::atan2(ny, nx) + gauss() * 0.4; }
            const double weit = (1 + (1 - u) * D * 0.045) * (0.7 + zufallszahl() * 0.6) * werte.kick * (art == typ::mauer ? 0.6 : 1);
            // mindestens ein Stück aus der Krone heraus
            const double zx = px + mathe::cos(ab) * weit, zy = py + mathe::sin(ab) * weit;
            const double raus = mathe::hypot(zx - bx, zy - by) < br * 0.8 ? br * 0.8 : 0;
            double ex = zx + mathe::cos(ab) * raus, ey = zy + mathe::sin(ab) * raus;
            mauer_treffer zweite = treffe_mauer(bahn, { px, py }, { ex, ey }, false, 0);
            if(zweite.gefunden) { ex = zweite.x; ey = zweite.y; }
            const pfadpunkt st = e.pfad[e.pfad_laenge - 1];
            const int n = 14;
            const double dauer = 0.35 + weit * 0.05;
            for(int k = 1; k <= n; k++)
            {
                const double a = double(k) / n;
                // fällt ab und hüpft einmal kurz auf
                const double hz = st.z * (1 - a) * (1 - a) + mathe::sin(mathe::pi * a) * 0.6;
                anhaengen(e, st.x + (ex - st.x) * a, st.y + (ey - st.y) * a, mathe::max(0, hz), t + a * dauer);
            }
            t += dauer;
        }
        else
        {
            // Landung, dann Rutschen – auf der Bowlingbahn sehr weit
            pfadpunkt& ende = e.pfad[e.pfad_laenge - 1];
            ende.z = 0;
            double dx = mathe::cos(th), dy = mathe::sin(th);
            const bool bowling = auf_bowlingbahn({ ende.x, ende.y }, bahn);
            double L = (0.5 + D * 0.025) * (0.5 + zufallszahl()) * (1 - clamp(winkel, -30, 30) / 60) * brems;
            if(bowling)
            {
                const daten::bowlingbahn& l = bahn.bowling;
                double ax = zahl(l.b.x) - zahl(l.a.x), ay = zahl(l.b.y) - zahl(l.a.y);
                const double n = mathe::hypot(ax, ay);
                ax /= n;
                ay /= n;
                double vor = mathe::vorzeichen(ax * dx + ay * dy);
                if(vor == 0) { vor = 1; }
                dx = ax * vor;
                dy = ay * vor;
                L = (1 + D * 0.03) * 3 * (0.6 + zufallszahl() * 0.8);
            }
            const int schritte = int(mathe::max(1, mathe::runde(L / 0.2)));
            double sx = ende.x, sy = ende.y;
            for(int k = 1; k <= schritte; k++)
            {
                const double v = 1 - double(k) / schritte;
                if(bahn.mauern_anzahl && treffe_mauer(bahn, { sx, sy }, { sx + dx * L / schritte, sy + dy * L / schritte }, false, 0).gefunden) { break; }   // rutscht gegen die Mauer
                sx += dx * L / schritte;
                sy += dy * L / schritte;
                t += 0.015 + 0.05 * (1 - v);
                anhaengen(e, sx, sy, 0, t);
                if(abstand2({ sx, sy }, korb) < korb_r2)
                {
                    if(auf_bowlingbahn({ sx, sy }, bahn))
                    {
                        drin = true;
                        art = typ::bowling;
                        anhaengen(e, korb.x, korb.y, 0, t + 0.05);
                    }
                    break;
                }
                if(ist_ob({ sx, sy }, bahn)) { break; }
            }
        }

        const pfadpunkt& letzte = e.pfad[e.pfad_laenge - 1];
        punkt lie = { letzte.x, letzte.y };
        bool ob = false;
        int ob_index = -1;
        if(! drin && ist_ob(lie, bahn))
        {
            ob = true;
            // hier fliegt die Scheibe (zuletzt) ins Aus; bei Insel-Bahnen startet der Wurf schon im Aus
            ob_index = e.pfad_laenge - 1;   // nie im Spiel gewesen: OB erst bei der Landung
            // dort weiterspielen, wo die Scheibe zuletzt im Spiel war
            for(int k = e.pfad_laenge - 1; k >= 0; k--)
            {
                zwischendurch(e);
                if(! ist_ob({ e.pfad[k].x, e.pfad[k].y }, bahn)) { lie = { e.pfad[k].x, e.pfad[k].y }; ob_index = k + 1; break; }
            }
            // OB zählt erst, wenn die Scheibe im Aus aufkommt: Anzeige beim ersten Bodenkontakt danach
            while(ob_index < e.pfad_laenge - 1 && e.pfad[ob_index].z > 0.05) { ob_index++; }
            if(ist_ob(lie, bahn)) { lie = start; }
            // manche Bahnen haben eine Dropzone: nach OB geht es dort weiter
            if(bahn.hat_dropzone) { lie = zu_punkt(bahn.dropzone); }
        }
        if(drin) { lie = korb; }

        // Mando: die Scheibe muss die Linie zwischen zwei Bäumen in der Lücke kreuzen
        mando_ergebnis mando = mando_ergebnis::keins;
        int mando_index = -1;
        if(! w.mando_ok)
        {
            mando_kreuzung m = kreuze_mando(bahn, e, start);
            if(m.gefunden)
            {
                mando = m.ok ? mando_ergebnis::ok : mando_ergebnis::verpasst;
                if(! m.ok)
                {
                    // verpasst: +1, weiter von der Mando-Dropzone (sonst von der alten Lage); zählt vor OB und Treffer
                    mando_index = m.index;
                    drin = false;
                    ob = false;
                    ob_index = -1;
                    lie = bahn.m.hat_dropzone ? zu_punkt(bahn.m.dropzone) : start;
                }
            }
        }

        e.lie = lie;
        e.drin = drin;
        e.ob = ob;
        e.ob_index = ob_index;
        e.mando = mando;
        e.mando_index = mando_index;
        e.art = art;
        e.dauer = t;
        e.distanz = abstand(lie, start);
    }
}
