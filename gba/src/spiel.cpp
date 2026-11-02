// Spielszene der GBA-Version (Etappe 4): eine Bahn spielen – Abläufe wie in index.html
// (zielen, Kraft laden, Flug, Landung, OB, Mando, Putten), Grafik aus der Webversion.
//
// Steuerung:
//   ▲ ▼  zielen (Ziellinie hoch/runter, gehalten schneller)   ◀ ▶  Scheibe wählen
//   L / R  Abwurfwinkel Anhyzer / Hyzer     B    Vorhand / Rückhand (im Putt: Spin / Push)
//   A halten  Kraft laden, loslassen werfen (im Putt: A putten, wenn das Fadenkreuz auf den Ketten ist)
//   SELECT  Umsehen: Steuerkreuz schiebt die Kamera, A ganze Bahn, B/SELECT zurück
//           (im Putt-Modus: werfen statt putten)  START  zurück zur Bahnansicht

#include "spiel.h"
#include "optionen.h"

#include "bn_core.h"
#include "bn_keypad.h"
#include "bn_string.h"
#include "bn_vector.h"
#include "bn_optional.h"
#include "bn_sprite_palette_item.h"
#include "bn_sprite_palette_ptr.h"
#include "bn_span.h"
#include "bn_array.h"
#include "bn_math.h"
#include "bn_timer.h"
#include "bn_timers.h"
#include "bn_bg_palettes.h"
#include "bn_sprite_ptr.h"
#include "bn_sprite_text_generator.h"
#include "bn_palette_bitmap_bg_ptr.h"
#include "bn_palette_bitmap_bg_painter.h"
#include "bn_palette_bitmap_roi.h"

#include "bn_sprite_items_figuren.h"
#include "bn_sprite_items_korb.h"
#include "bn_sprite_items_balken.h"
#include "bn_sprite_items_kraftmarke.h"
#include "bn_sprite_items_blatt.h"
#include "bn_sprite_items_windpfeil.h"
#include "bn_sprite_items_windkasten.h"
#include "common_variable_8x8_sprite_font.h"

#include "physik.h"
#include "mathe.h"
#include "zufall.h"
#include "gen_bahnen.h"
#include "gen_taschen.h"
#include "gen_einstellungen.h"
#include "gen_bahn_bilder.h"
#include "gen_medien.h"

namespace
{
    // Bilder der Figuren (gba/graphics/figuren.bmp)
    enum figur { f_scheibe, f_schatten, f_punkt, f_punkt_gelb, f_spieler, f_fadenkreuz, f_korb, f_marke,
                 f_fadenkreuz_rot, f_putt_scheibe };

    // Putt-Nahansicht (gba/graphics/putt_ansicht.bmp aus zeichnePuttHintergrund in index.html):
    // Lage auf dem Bildschirm und Umrechnung der Web-Koordinaten (320 × 180, KETTEN = 160, 75)
    constexpr int putt_bild_x = (240 - gen::putt_breite) / 2, putt_bild_y = 4;
    constexpr int ketten_sx = putt_bild_x + gen::putt_ketten_x - 120, ketten_sy = putt_bild_y + gen::putt_ketten_y - 80;
    constexpr double web_kx = 160, web_ky = 75;

    constexpr int bild_breite = gen::bahn_bild_breite, bild_hoehe = gen::bahn_bild_hoehe;
    constexpr int schirm_breite = 240, schirm_hoehe = 160;
    constexpr int ziel_punkte = 11;

    BN_DATA_EWRAM_BSS physik::ergebnis flug_ergebnis;   // groß – nicht auf den Stack und nicht in den IWRAM

    double abstand(physik::punkt a, physik::punkt b) { return mathe::hypot(a.x - b.x, a.y - b.y); }


    const char* typ_name(daten::scheiben_typ t)
    {
        switch(t)
        {
        case daten::scheiben_typ::driver: return "Driver";
        case daten::scheiben_typ::fairway: return "Fairway";
        case daten::scheiben_typ::midrange: return "Midrange";
        default: return "Putter";
        }
    }

    // Kraftbalken wie zeichneKraftbalken() in index.html: 12 Stücke à 8 Pixel, Mitte des Bildschirms
    constexpr int balken_stuecke = 12, balken_y = 60;

    // Tempo: in Hauptmenü → Einstellungen wählbar (optionen.h); 100 % = wie im Browser
    double flug_tempo() { return opt().flug / 100.0; }
    double pendel_tempo() { return opt().pendel / 100.0; }
    double ziel_tempo() { return opt().zielen / 100.0; }
    double putt_tempo() { return opt().putt / 100.0; }

    class spiel
    {
    public:
        spiel(runde_stand& r, unsigned startwert) :
            _b(gen::bahnen[r.erste_bahn + r.index]),
            _r(r),
            _item(*gen::bahn_bilder[r.erste_bahn + r.index]),
            _bg(bn::palette_bitmap_bg_ptr::create(_item.palette_item())),
            _painter(_bg),
            _text(common::variable_8x8_sprite_font),
            _zz(startwert * 2654435761u + 12345u),
            _px_pro_m(double(bild_breite) / physik::zahl(_b.breite)),
            _schatten(bn::sprite_items::figuren.create_sprite(0, 0, f_schatten)),
            _scheibe(bn::sprite_items::figuren.create_sprite(0, 0, f_scheibe)),
            _korb(bn::sprite_items::figuren.create_sprite(0, 0, f_korb))
        {
            _bahn_nr = r.erste_bahn + r.index;
            bn::bg_palettes::set_transparent_color(bn::color(0, 0, 0));
            _schatten.set_z_order(2);
            _korb.set_z_order(1);
            _scheibe.set_z_order(0);
            for(int i = 0; i < ziel_punkte; ++i)
            {
                bn::sprite_ptr p = bn::sprite_items::figuren.create_sprite(0, 0, i < 8 ? f_punkt : f_punkt_gelb);
                p.set_z_order(1);
                _ziel.push_back(bn::move(p));
            }

            // Wind wie neueRunde() in index.html: 1..6 m/s, beliebige Richtung
            const double st = 1 + zahl01() * 5, ri = zahl01() * mathe::pi * 2;
            _wind = { mathe::cos(ri) * st, mathe::sin(ri) * st };
            wind_anzeige();

            // Spieler in Wurfreihenfolge, alle am Abwurf; jede Figur in der Farbe des Spielers
            _anzahl = r.anzahl;
            const bn::span<const bn::color> grund = bn::sprite_items::figuren.palette_item().colors_ref();
            for(int i = 0; i < _anzahl; ++i)
            {
                stand& s = _st[i];
                s.platz = r.reihenfolge[i];
                s.sp = &gen::alle_spieler[r.spieler[s.platz]];
                s.lie = physik::zu_punkt(_b.abwurf);
                _aktiv = i;
                s.scheibe_nr = start_scheibe();
                s.vorhand = s.sp->vorhand;

                for(int k = 0; k < 16; ++k) { _farben[i][k] = grund[k]; }
                const int f = s.sp->farbe, rot = f & 31, gruen = (f >> 5) & 31, blau = (f >> 10) & 31;
                _farben[i][10] = bn::color(rot, gruen, blau);
                _farben[i][11] = bn::color(rot / 2, gruen / 2, blau / 2);
                bn::sprite_palette_item farbe(bn::span<const bn::color>(_farben[i].data(), 16), bn::bpp_mode::BPP_4);
                _paletten.push_back(farbe.create_palette());
                bn::sprite_ptr figur = bn::sprite_items::figuren.create_sprite(0, 0, f_spieler);
                figur.set_palette(_paletten.back());
                figur.set_z_order(1);
                _figuren.push_back(bn::move(figur));
            }
            _aktiv = 0;
            naechster();

            // Einblendung zu Beginn: Bahn, Par, Länge (und wer anfängt)
            {
                bn::string<64> t;
                bn::ostringstream z(t);
                if(_b.kurz[0]) { z.append(_b.kurz); }
                else { z.append("Bahn "); z.append(int(_b.nummer)); }
                if(_b.name[0] && ! _b.kurz[0]) { z.append(" \""); z.append(_b.name); z.append("\""); }
                if(_r.frei) { z.append(" - Weiten testen - "); }
                else
                {
                    z.append(" - Par ");
                    z.append(int(_b.par));
                    z.append(" - ");
                }
                z.append(int(abstand(physik::zu_punkt(_b.abwurf), korb()) + 0.5));
                z.append(" m");
                if(_anzahl > 1) { z.append(" - "); z.append(sp().name); z.append(" beginnt"); }
                melde(t, 150);
            }

            // Kamera sofort an die richtige Stelle
            kamera_ziel(_kam_x, _kam_y);
            _kam_x &= ~1;
            _blit = 2;
        }

        // Spielt die Bahn; true = fertig, false = mit START abgebrochen
        bool spielen()
        {
            while(true)
            {
                if(bn::keypad::start_pressed() && _zustand != zustand::flug && _zustand != zustand::fertig)
                {
                    if(_uhr_bilder <= _abbruch_bis) { bn::bg_palettes::set_fade_intensity(0); return false; }
                    _abbruch_bis = _uhr_bilder + 150;
                    melde("Nochmal START: Runde beenden", 150);
                }
                if(! eingabe()) { bn::bg_palettes::set_fade_intensity(0); return true; }
                bild();
            }
        }

        // Ein Bild zeichnen (auch aus der Physik-Rückmeldung heraus, während ein Wurf gerechnet wird)
        void bild()
        {
            ++_uhr_bilder;
            // Spielzeit nach der echten Uhr (wie uhr += dt in index.html, höchstens 0,05 s je Bild):
            // dauert ein Bild länger (Kamera, Berechnung), läuft die Animation trotzdem gleich schnell
            _dt = mathe::min(0.05, double(_echt.elapsed_ticks_with_restart()) / bn::timers::ticks_per_second());
            _zeit += _dt;
            if(_zustand == zustand::laden)
            {
                // wie schleife() in index.html: Kraft pendelt in 1,1 s hoch und wieder herunter
                const double ph = mathe_mod((_zeit - _lade_zeit) * pendel_tempo() / 1.1, 2);
                _kraft = ph < 1 ? ph : 2 - ph;
            }
            if(_zustand == zustand::flug) { flug_weiter(); }

            const bool putt_bild = _zustand == zustand::putt;
            if(putt_bild != _zeigt_putt)
            {
                _zeigt_putt = putt_bild;
                _bg.set_palette(putt_bild ? gen::putt_ansicht.palette_item() : _item.palette_item());
                _blit = 2;
            }
            if(_zeigt_putt)
            {
                if(_blit > 0)
                {
                    _painter.clear();
                    _painter.unsafe_blit(putt_bild_x, putt_bild_y, bn::palette_bitmap_roi(gen::putt_ansicht.pixels_item(), 0, 0,
                                         gen::putt_breite, gen::putt_hoehe));
                    _painter.flip_page_later();
                    --_blit;
                }
            }
            else if(_uebersicht)
            {
                // ganze Bahn (Übersichtsbild 240 × 135), etwas nach unten gerückt
                if(_blit > 0)
                {
                    const bn::palette_bitmap_item& ue = *gen::uebersichten[_bahn_nr];
                    _painter.clear();
                    _painter.unsafe_blit(0, uebersicht_oben, bn::palette_bitmap_roi(ue.pixels_item(), 0, 0,
                                         gen::uebersicht_breite, gen::uebersicht_hoehe));
                    _painter.flip_page_later();
                    --_blit;
                }
            }
            else
            {
                // Kamera weich nachführen (x gerade, damit das Kopieren schnell bleibt)
                int zx, zy;
                kamera_ziel(zx, zy);
                int nx = _kam_x + (zx - _kam_x) / 6, ny = _kam_y + (zy - _kam_y) / 6;
                // im Flug ohne Nachziehen: die Kamera folgt sofort, sobald die Scheibe am Rand ist
                const bool sofort = _umsehen || _zustand == zustand::flug;
                if(bn::abs(zx - _kam_x) < 6 || sofort) { nx = zx; }
                if(bn::abs(zy - _kam_y) < 6 || sofort) { ny = zy; }
                nx &= ~1;
                if(nx != _kam_x || ny != _kam_y) { _kam_x = nx; _kam_y = ny; _blit = 2; }
                if(_blit > 0)
                {
                    _painter.unsafe_blit(0, 0, bn::palette_bitmap_roi(_item.pixels_item(), _kam_x, _kam_y, schirm_breite, schirm_hoehe));
                    _painter.flip_page_later();
                    --_blit;
                }
            }

            figuren();
            texte();
            bn::core::update();
        }

    private:
        enum class zustand { zielen, laden, flug, pause, putt, fertig };

        const daten::bahn& _b;
        runde_stand& _r;

        // Stand je Spieler auf dieser Bahn (wie die Felder von spieler[] in index.html)
        struct stand
        {
            const daten::spieler* sp = nullptr;
            int platz = 0;              // Platz in runde_stand
            physik::punkt lie = { 0, 0 };
            int wuerfe = 0, scheibe_nr = 0;
            bool vorhand = false, mando_ok = false, fertig = false;
        };
        stand _st[max_spieler];
        int _anzahl = 1, _aktiv = 0;
        stand& st() { return _st[_aktiv]; }
        const stand& st() const { return _st[_aktiv]; }
        const daten::spieler& sp() const { return *_st[_aktiv].sp; }
        const bn::palette_bitmap_item& _item;
        bn::palette_bitmap_bg_ptr _bg;
        bn::palette_bitmap_bg_painter _painter;
        bn::sprite_text_generator _text;
        zufall _zz;                         // Zufall des Spiels (Wind, Böen, Putts); die Physik bekommt je Wurf eigenen
        zufall _wurf_zufall = zufall(1);
        double _px_pro_m;

        bn::sprite_ptr _schatten, _scheibe, _korb;
        bn::vector<bn::sprite_ptr, ziel_punkte> _ziel;
        bn::vector<bn::sprite_ptr, 20> _zeile_oben, _zeile_zwei, _zeile_unten, _zeile_mitte;
        bn::vector<bn::sprite_ptr, balken_stuecke> _balken;
        bn::vector<bn::sprite_ptr, 6> _balken_text;
        bn::optional<bn::sprite_ptr> _kraftmarke;
        int _balken_stand[balken_stuecke] = {};
        int _banner_bis = 0;
        double _kraft_angezeigt = 0;   // Kraft des letzten Wurfs (für den Balken im Flug)
        bn::optional<bn::sprite_ptr> _fadenkreuz, _putt_scheibe;
        bool _zeigt_putt = false, _kreuz_gruen = true;
        bn::string<64> _text_oben, _text_zwei, _text_unten, _text_mitte;

        zustand _zustand = zustand::zielen;
        int _kam_x = 0, _kam_y = 0, _blit = 0;
        int _bahn_nr = 0;

        // Umsehen: Kamera frei schieben; Übersicht: ganze Bahn auf einem Bildschirm
        static constexpr int uebersicht_oben = 12;
        bool _umsehen = false, _uebersicht = false;
        int _frei_x = 0, _frei_y = 0, _halten_umsehen = 0;
        int _uhr_bilder = 0, _pause_bis = 0, _halten_links = 0, _halten_rechts = 0;
        physik::wind _wind;
        int _winkel = 0;
        bool _putt_modus = false, _push = false;
        int _abbruch_bis = -1;      // START einmal gedrückt: bis hierhin zählt ein zweites START als Abbruch
        bn::vector<bn::sprite_ptr, 64> _ende_texte;
        bn::vector<bn::sprite_ptr, max_spieler> _figuren;           // Spieler auf der Bahn, in ihrer Farbe
        bn::vector<bn::sprite_palette_ptr, max_spieler> _paletten;
        bn::array<bn::color, 16> _farben[max_spieler];
        double _ziel_richtung = 0, _kraft = 0;

        // Flug
        double _flug_t = 0;
        bool _rechnet = false;
        physik::punkt _flug_pos = { 0, 0 };
        double _flug_z = 0;

        // Putt
        physik::punkt _putt_lie = { 0, 0 };
        const char* _putt_ergebnis = nullptr;
        double _putt_ox = 0, _putt_oy = 0;   // Fadenkreuz beim Putten (Web-Pixel um die Ketten)
        double _putt_flug_zeit = 0, _putt_zeit0 = 0;
        bn::timer _echt;            // echte Zeit seit dem letzten Bild
        int _gebremst = 0;          // schon gemeldete Brems-Stellen im Flug (Äste)

        // Blätter in der Krone (wie flug.blaetter in index.html): viele beim Abprallen, mittel beim
        // Abbremsen, wenige beim Durchfliegen; fliegen ~0,8 s radial weg mit etwas Schwerkraft
        struct blatt { double x, y, z, a, v, t0; };
        static constexpr int blaetter_max = 32;
        blatt _blatt[blaetter_max];
        bn::vector<bn::sprite_ptr, blaetter_max> _blatt_sprites;
        int _blatt_neu = 0;
        int _blatt_brems = 0, _blatt_durch = 0;
        bool _blatt_baum = false;

        // Wind wie zeichneWind() in index.html: Kästchen oben rechts, Pfeil in Windrichtung, Stärke, „WIND“
        bn::optional<bn::sprite_ptr> _wind_kasten, _wind_pfeil;
        bn::vector<bn::sprite_ptr, 4> _wind_text;
        // Freies Werfen: Landepunkte markieren (wie marken in index.html)
        static constexpr int marken_max = 12;
        bn::vector<bn::sprite_ptr, marken_max> _marken;
        physik::punkt _marken_ort[marken_max];
        int _marken_neu = 0;        // nächster Platz (die ältesten werden überschrieben)
        bool _putt_ton = false;     // Ton beim Putt schon gespielt
        bn::optional<bn::sprite_ptr> _portraet;   // Porträt bei „… ist dran“
        double _zeit = 0, _dt = 0, _lade_zeit = 0;

        double zahl01() { return _zz.naechste() / 4294967296.0; }

        static double mathe_mod(double a, double m)
        {
            return a - m * double(int(a / m));
        }

        const daten::scheibe& scheibe() const { return sp().tasche[st().scheibe_nr]; }

        int start_scheibe() const
        {
            if(sp().lieblingsscheibe_index >= 0) { return sp().lieblingsscheibe_index; }
            for(int k = 0; k < sp().tasche_anzahl; ++k) { if(sp().tasche[k].standard) { return k; } }
            return 0;
        }

        int putter() const
        {
            for(int k = 0; k < sp().tasche_anzahl; ++k) { if(sp().tasche[k].typ == daten::scheiben_typ::putter) { return k; } }
            return 0;
        }

        physik::punkt korb() const { return physik::zu_punkt(_b.korb); }
        double zum_korb() const { physik::punkt k = korb(); return mathe::atan2(k.y - st().lie.y, k.x - st().lie.x); }

        // Bildschirmposition (Butano: Mitte = 0, 0) eines Punktes in Metern
        // In der Übersicht ist das Bild kleiner (240 statt 512 Pixel breit) und beginnt bei Zeile uebersicht_oben
        double zoom() const { return _uebersicht ? double(gen::uebersicht_breite) / bild_breite : 1; }
        int kam_x() const { return _uebersicht ? 0 : _kam_x; }
        int kam_y() const { return _uebersicht ? -uebersicht_oben : _kam_y; }
        // Bildpunkt im großen Bahnbild → Bildschirm (Butano: Mitte = 0, 0)
        bn::fixed bx(double px) const { return bn::fixed(float(px * zoom())) - kam_x() - schirm_breite / 2; }
        bn::fixed by(double py) const { return bn::fixed(float(py * zoom())) - kam_y() - schirm_hoehe / 2; }
        bn::fixed sx(double x) const { return bx(x * _px_pro_m); }
        bn::fixed sy(double y) const { return by(y * _px_pro_m); }

        void kamera_ziel(int& x, int& y) const
        {
            if(_umsehen)
            {
                x = _frei_x;
                y = _frei_y;
                return;
            }
            double mx, my;
            if(_zustand == zustand::flug)
            {
                // wie im Browser: im Flug steht die Kamera, sie schiebt nur mit, wenn die Scheibe
                // aus dem Bild fliegen würde (spart das Umkopieren des ganzen Bildes in jedem Bild)
                constexpr int rand_x = 56, rand_y = 40;
                const int px = int(_flug_pos.x * _px_pro_m), py = int(_flug_pos.y * _px_pro_m);
                x = _kam_x;
                y = _kam_y;
                if(px - x < rand_x) { x = px - rand_x; }
                if(px - x > schirm_breite - rand_x) { x = px - (schirm_breite - rand_x); }
                if(py - y < rand_y) { y = py - rand_y; }
                if(py - y > schirm_hoehe - rand_y) { y = py - (schirm_hoehe - rand_y); }
                x = bn::max(0, bn::min(x, bild_breite - schirm_breite));
                y = bn::max(0, bn::min(y, bild_hoehe - schirm_hoehe));
                return;
            }
            else if(_zustand == zustand::zielen || _zustand == zustand::laden)
            {
                // etwas in Wurfrichtung vorausschauen
                const double vor = mathe::min(abstand(st().lie, korb()), 40) * 0.45;
                mx = st().lie.x + mathe::cos(_ziel_richtung) * vor;
                my = st().lie.y + mathe::sin(_ziel_richtung) * vor;
            }
            else { mx = st().lie.x; my = st().lie.y; }
            x = bn::max(0, bn::min(int(mx * _px_pro_m) - schirm_breite / 2, bild_breite - schirm_breite));
            y = bn::max(0, bn::min(int(my * _px_pro_m) - schirm_hoehe / 2, bild_hoehe - schirm_hoehe));
        }

        // Wer ist dran? Wie naechster() in index.html: erst alle vom Abwurf (in Reihenfolge),
        // danach immer, wer am weitesten vom Korb weg ist. Alle im Korb: Bahn beendet.
        void naechster()
        {
            int wahl = -1;
            for(int i = 0; i < _anzahl && wahl < 0; ++i) { if(! _st[i].fertig && _st[i].wuerfe == 0) { wahl = i; } }
            if(wahl < 0)
            {
                double weitester = -1;
                for(int i = 0; i < _anzahl; ++i)
                {
                    if(_st[i].fertig) { continue; }
                    const double d = abstand(_st[i].lie, korb());
                    if(d > weitester) { weitester = d; wahl = i; }
                }
            }
            if(wahl < 0) { ende(); return; }
            const bool wechsel = _anzahl > 1 && (wahl != _aktiv || st().wuerfe == 0);
            _aktiv = wahl;
            _text_mitte.clear();
            _zeile_mitte.clear();
            naechster_zug();
            if(wechsel)
            {
                bn::string<64> t;
                bn::ostringstream z(t);
                z.append(sp().name);
                z.append(" ist dran");
                if(_text_mitte.size()) { z.append(" - "); z.append(_text_mitte); }   // z. B. Scheibenwechsel
                melde(t, 96);
                _portraet = gen::portraets[int(st().sp - gen::alle_spieler)]->create_sprite(0, -44);
                _portraet->set_z_order(0);
            }
        }

        // Ganze Bahn auf dem Bildschirm (Übersichtsbild) an/aus – Palette und Bild wechseln mit
        void setze_uebersicht(bool an)
        {
            if(an == _uebersicht) { return; }
            _uebersicht = an;
            if(! _zeigt_putt) { _bg.set_palette(an ? gen::uebersichten[_bahn_nr]->palette_item() : _item.palette_item()); }
            _blit = 2;
        }

        // Wie im Browser (passendeStufe): am Abwurf immer die ganze Bahn zeigen
        bool ganze_bahn_am_abwurf() const
        {
            return ! _putt_modus && (st().wuerfe == 0 || _r.frei) && (_zustand == zustand::zielen || _zustand == zustand::laden);
        }

        void naechster_zug()
        {
            _ziel_richtung = zum_korb();
            _winkel = 0;
            _kraft = 0;
            _putt_modus = abstand(st().lie, korb()) <= 10;
            if(_putt_modus) { st().scheibe_nr = putter(); }
            else if(! _r.frei) { passe_scheibe_an(); }
            _zustand = _putt_modus ? zustand::putt : zustand::zielen;
            _putt_zeit0 = _zeit;
            _putt_ergebnis = nullptr;
            setze_uebersicht(ganze_bahn_am_abwurf());
        }

        // Passt die gewählte Scheibe nicht zur Entfernung (viel zu weit oder zu kurz), automatisch eine
        // passende nehmen – wie passeScheibeAn() in index.html
        void passe_scheibe_an()
        {
            const double d = abstand(st().lie, korb());
            const double rw_akt = physik::reichweite(scheibe());
            if(d <= rw_akt * 1.0 && d >= rw_akt * 0.6) { return; }
            // am liebsten eine Scheibe, die die Strecke mit etwa 85 % Kraft schafft
            int best = st().scheibe_nr;
            double note = 1e300;
            for(int i = 0; i < sp().tasche_anzahl; ++i)
            {
                const daten::scheibe& x = sp().tasche[i];
                const double r = physik::reichweite(x);
                const double n = mathe::betrag(r * 0.85 - d) + (r < d ? 1000 : 0) - (x.standard ? 6 : 0);
                if(n < note) { note = n; best = i; }
            }
            if(note >= 1000)
            {
                best = 0;
                for(int i = 1; i < sp().tasche_anzahl; ++i)
                {
                    if(physik::reichweite(sp().tasche[i]) > physik::reichweite(sp().tasche[best])) { best = i; }
                }
            }
            if(best == st().scheibe_nr) { return; }
            st().scheibe_nr = best;
            bn::string<48> t;
            bn::ostringstream z(t);
            z.append(scheibe().name);
            z.append(" (");
            z.append(typ_name(scheibe().typ));
            z.append(")");
            melde(t, 96);   // 1,6 s
        }

        // Stärken wie staerke() in index.html (Wurfart, Hyzer/Anhyzer, S-Line, Lieblingsscheibe)
        void staerke(double& streuung, double& weite) const
        {
            streuung = 1;
            weite = 1;
            auto anwenden = [&](const daten::staerke& s)
            {
                if(s.gesetzt) { streuung *= physik::zahl(s.streuung); weite *= physik::zahl(s.weite); }
            };
            if(st().scheibe_nr == sp().lieblingsscheibe_index) { anwenden(sp().lieblingsscheibe); }
            anwenden(st().vorhand ? sp().vorhand_staerke : sp().rueckhand);
            if(_winkel < -2) { anwenden(sp().anhyzer); }
            if(_winkel > 2) { anwenden(sp().hyzer); }
            if(! st().vorhand && (_winkel < -2 || (bn::abs(_winkel) <= 2 && physik::zahl(scheibe().turn) <= -2))) { anwenden(sp().sline); }
        }

        // Böe wie boe() in index.html
        physik::wind boe()
        {
            const double f = 0.8 + zahl01() * 0.4, a = (zahl01() - 0.5) * 20 * physik::grad();
            return { (_wind.x * mathe::cos(a) - _wind.y * mathe::sin(a)) * f,
                     (_wind.x * mathe::sin(a) + _wind.y * mathe::cos(a)) * f };
        }

        // ---------- Eingabe; false = Bahn beendet ----------
        bool eingabe()
        {
            if(_umsehen)
            {
                umsehen();
                return true;
            }
            switch(_zustand)
            {
            case zustand::zielen:
            {
                // ▲ ▼: Ziellinie auf dem Bildschirm hoch/runter – erst fein (0,5°), gehalten 24°/s
                // (wie im Browser ~25°/s), lange gehalten 60°/s
                _halten_links = bn::keypad::up_held() ? _halten_links + 1 : 0;
                _halten_rechts = bn::keypad::down_held() ? _halten_rechts + 1 : 0;
                auto schritt = [](int h) { return h == 1 ? 0.5 : (h > 18 ? (h > 75 ? 1.0 : 0.4) : 0.0) * ziel_tempo(); };
                // nach rechts geworfen: hoch = gegen den Uhrzeigersinn; nach links geworfen umgekehrt
                const double richtung = mathe::cos(_ziel_richtung) < 0 ? -1 : 1;
                _ziel_richtung += (schritt(_halten_rechts) - schritt(_halten_links)) * richtung * physik::grad();
                if(bn::keypad::left_pressed()) { st().scheibe_nr = (st().scheibe_nr + sp().tasche_anzahl - 1) % sp().tasche_anzahl; }
                if(bn::keypad::right_pressed()) { st().scheibe_nr = (st().scheibe_nr + 1) % sp().tasche_anzahl; }
                if(bn::keypad::l_pressed()) { _winkel = bn::max(_winkel - 5, -30); }
                if(bn::keypad::r_pressed()) { _winkel = bn::min(_winkel + 5, 30); }
                if(bn::keypad::b_pressed()) { st().vorhand = ! st().vorhand; }
                if(bn::keypad::select_pressed())
                {
                    _halten_umsehen = 0;
                    if(_uebersicht)
                    {
                        // aus der ganzen Bahn: Nahansicht am Spieler beginnen
                        setze_uebersicht(false);
                        kamera_ziel(_frei_x, _frei_y);   // vor _umsehen = true, sonst liefert es _frei_x/_frei_y
                    }
                    else { _frei_x = _kam_x; _frei_y = _kam_y; }
                    _umsehen = true;
                }
                if(bn::keypad::a_pressed()) { _zustand = zustand::laden; _lade_zeit = _zeit; _kraft = 0; }
                break;
            }
            case zustand::laden:
                if(! bn::keypad::a_held()) { werfen(); }
                break;
            case zustand::putt:
                if(_putt_ergebnis)
                {
                    if(_uhr_bilder >= _pause_bis) { putt_ende(); }
                    break;
                }
                if(bn::keypad::b_pressed()) { _push = ! _push; }
                if(bn::keypad::select_pressed()) { _putt_modus = false; st().scheibe_nr = start_scheibe(); _zustand = zustand::zielen; }
                if(bn::keypad::a_pressed()) { putten(); }
                break;
            case zustand::flug:
                break;
            case zustand::pause:
                if(_uhr_bilder >= _pause_bis) { naechster(); }
                break;
            case zustand::fertig:
                if(bn::keypad::a_pressed()) { return false; }
                break;
            }
            return true;
        }

        // ---------- Umsehen (wie "Umsehen" in index.html) ----------
        void umsehen()
        {
            if(bn::keypad::b_pressed() || bn::keypad::select_pressed())
            {
                _umsehen = false;
                setze_uebersicht(ganze_bahn_am_abwurf());
                _blit = 2;
                return;
            }
            if(bn::keypad::a_pressed())
            {
                setze_uebersicht(! _uebersicht);
                return;
            }
            if(_uebersicht) { return; }
            const bool gedrueckt = bn::keypad::left_held() || bn::keypad::right_held() || bn::keypad::up_held() || bn::keypad::down_held();
            _halten_umsehen = gedrueckt ? _halten_umsehen + 1 : 0;
            const int tempo = _halten_umsehen > 20 ? 8 : 4;
            if(bn::keypad::left_held()) { _frei_x -= tempo; }
            if(bn::keypad::right_held()) { _frei_x += tempo; }
            if(bn::keypad::up_held()) { _frei_y -= tempo; }
            if(bn::keypad::down_held()) { _frei_y += tempo; }
            _frei_x = bn::max(0, bn::min(_frei_x, bild_breite - schirm_breite));
            _frei_y = bn::max(0, bn::min(_frei_y, bild_hoehe - schirm_hoehe));
        }

        // ---------- Wurf ----------
        static void rueckmeldung(const physik::ergebnis&, void* daten)
        {
            spiel& s = *static_cast<spiel*>(daten);
            static bn::timer seit;
            if(seit.elapsed_ticks() < bn::timers::ticks_per_frame() / 2) { return; }
            s.bild();
            seit.restart();
        }

        void werfen()
        {
            double streuung, weite;
            staerke(streuung, weite);
            physik::wurf w;
            w.x = st().lie.x;
            w.y = st().lie.y;
            w.richtung = _ziel_richtung;
            w.kraft = _kraft;
            _kraft_angezeigt = _kraft;
            w.winkel = _winkel;
            w.scheibe = &scheibe();
            w.links = sp().linkshaender;
            w.vorhand = st().vorhand;
            w.streu_faktor = streuung;
            w.weite_faktor = weite;
            w.mando_ok = st().mando_ok;
            ++st().wuerfe;

            _zustand = zustand::flug;
            _flug_t = 0;
            _flug_pos = st().lie;
            _flug_z = 1.3;
            _rechnet = true;
            _wurf_zufall = zufall(_zz.naechste());
            physik::setze_zufall(_wurf_zufall);
            physik::setze_rueckruf(rueckmeldung, this);
            flug_ergebnis.pfad_laenge = 0;
            _gebremst = 0;
            _blatt_brems = 0;
            _blatt_durch = 0;
            _blatt_baum = false;
            ton(bn::sound_items::sfx_wurf);
            physik::wurf g = physik::streue(w);
            physik::simuliere(_b, g, boe(), flug_ergebnis);
            physik::setze_rueckruf(nullptr, nullptr);
            _rechnet = false;
        }

        // Flug-Animation: wie flugPosition() in index.html, Zeit läuft mit E.tempo
        void flug_weiter()
        {
            const physik::ergebnis& e = flug_ergebnis;
            const int fertig_bis = _rechnet ? e.pfad_laenge - 1 : e.pfad_laenge;   // endgültige Punkte
            if(fertig_bis < 2) { return; }
            const double t_neu = _flug_t + gen::einstellungen::tempo * flug_tempo() * _dt;
            // nicht über die schon gerechneten Punkte hinaus
            if(_rechnet && t_neu > e.pfad[fertig_bis - 1].t) { return; }
            _flug_t = t_neu;
            if(! _rechnet && _flug_t >= e.dauer)
            {
                const physik::pfadpunkt& p = e.pfad[e.pfad_laenge - 1];
                _flug_pos = { p.x, p.y };
                _flug_z = p.z;
                landung();
                return;
            }
            int i = 1;
            while(i < fertig_bis - 1 && e.pfad[i].t < _flug_t) { ++i; }
            // Blätter: Abprallen 16 (Tempo 1,6), Abbremsen 9 (1,1), Durchfliegen 4 (0,7)
            if(e.art == physik::typ::baum && e.baum_index >= 0 && ! _blatt_baum && i >= e.baum_index)
            {
                _blatt_baum = true;
                blaetter(e.pfad[e.baum_index], 16, 1.6);
            }
            if(_blatt_brems < e.brems_anzahl && i >= e.brems_punkte[_blatt_brems])
            {
                blaetter(e.pfad[e.brems_punkte[_blatt_brems]], 9, 1.1);
                ++_blatt_brems;
            }
            if(_blatt_durch < e.durch_anzahl && i >= e.durch_punkte[_blatt_durch])
            {
                blaetter(e.pfad[e.durch_punkte[_blatt_durch]], 4, 0.7);
                ++_blatt_durch;
            }
            if(_gebremst < e.brems_anzahl && i >= e.brems_punkte[_gebremst])
            {
                ++_gebremst;
                ton(bn::sound_items::sfx_ast);
                melde("ABGEBREMST", 54);
            }
            const physik::pfadpunkt& a = e.pfad[i - 1];
            const physik::pfadpunkt& b = e.pfad[i];
            const double f = mathe::clamp((_flug_t - a.t) / mathe::max(1e-6, b.t - a.t), 0, 1);
            _flug_pos = { a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f };
            _flug_z = a.z + (b.z - a.z) * f;
        }

        // wie flugEnde() in index.html (ohne Freies Werfen)
        void landung()
        {
            const physik::ergebnis& e = flug_ergebnis;
            if(e.mando == physik::mando_ergebnis::ok || (e.mando == physik::mando_ergebnis::verpasst && _b.m.hat_dropzone)) { st().mando_ok = true; }
            if(_r.frei)
            {
                // Weitwurf: Landepunkt markieren, dann wieder vom Abwurf
                const physik::punkt abwurf = physik::zu_punkt(_b.abwurf);
                const double d = abstand(e.lie, abwurf);
                int& bester = _r.weitester[st().platz];
                _pause_bis = _uhr_bilder + 90;   // 1,5 s
                _zustand = zustand::pause;
                if(e.ob) { ton(bn::sound_items::sfx_ob); melde("OB!"); }
                else
                {
                    const int platz = _marken_neu % marken_max;
                    _marken_ort[platz] = e.lie;
                    if(_marken.size() <= platz)
                    {
                        bn::sprite_ptr m = bn::sprite_items::figuren.create_sprite(0, 0, f_marke);
                        m.set_z_order(2);
                        _marken.push_back(bn::move(m));
                    }
                    ++_marken_neu;
                    const bool best = int(d + 0.5) >= bester;
                    bester = bn::max(bester, int(d + 0.5));
                    if(e.drin) { ton(bn::sound_items::sfx_ketten); melde("TREFFER!"); }
                    else if(e.art == physik::typ::baum) { ton(bn::sound_items::sfx_baum); melde("BAUM!"); }
                    else if(e.art == physik::typ::mauer) { ton(bn::sound_items::sfx_baum); melde("MAUER!"); }
                    else
                    {
                        ton(bn::sound_items::sfx_landung);
                        bn::string<24> t;
                        bn::ostringstream z(t);
                        z.append(int(d + 0.5));
                        z.append(best ? " m  BEST!" : " m");
                        melde(t);
                    }
                }
                st().lie = abwurf;
                return;
            }
            st().lie = e.lie;
            _pause_bis = _uhr_bilder + 78;   // 1,3 s
            // Ruf bei Baum, Mauer, OB oder verpasster Mando (wie flugEnde in index.html)
            if(! e.drin && (e.art == physik::typ::baum || e.art == physik::typ::mauer || e.ob ||
                            e.mando == physik::mando_ergebnis::verpasst)) { rufe(); }
            _zustand = zustand::pause;
            if(e.drin)
            {
                st().fertig = true;
                ton(bn::sound_items::sfx_ketten);
                zeige_ergebnis(e.art == physik::typ::bowling ? "STRIKE!" : nullptr);
            }
            else if(e.mando == physik::mando_ergebnis::verpasst) { ++st().wuerfe; ton(bn::sound_items::sfx_ob); melde("MANDO VERPASST! +1"); }
            else if(e.ob) { ++st().wuerfe; ton(bn::sound_items::sfx_ob); melde("OB! +1"); }
            else if(e.art == physik::typ::baum) { ton(bn::sound_items::sfx_baum); melde("BAUM!"); }
            else if(e.art == physik::typ::mauer) { ton(bn::sound_items::sfx_baum); melde("MAUER!"); }
            else
            {
                ton(bn::sound_items::sfx_landung);
                bn::string<24> t;
                bn::ostringstream z(t);
                z.append(int(e.distanz + 0.5));
                z.append(" m");
                melde(t);
            }
        }

        static void ton(const bn::sound_item& t) { t.play(); }

        void wind_anzeige()
        {
            constexpr int x = 104, y = -46;
            _wind_kasten = bn::sprite_items::windkasten.create_sprite(x, y);
            _wind_kasten->set_z_order(1);
            _wind_kasten->set_bg_priority(0);
            _wind_pfeil = bn::sprite_items::windpfeil.create_sprite(x, y - 5);
            _wind_pfeil->set_z_order(0);
            // Windrichtung auf dem Bildschirm (y nach unten); Butano dreht gegen den Uhrzeigersinn
            double grad = -mathe::atan2(_wind.y, _wind.x) * 180 / mathe::pi;
            if(grad < 0) { grad += 360; }
            if(grad >= 360) { grad -= 360; }
            _wind_pfeil->set_rotation_angle(bn::fixed(float(grad)));
            const int zehntel = int(mathe::hypot(_wind.x, _wind.y) * 10 + 0.5);
            bn::string<12> t;
            bn::ostringstream z(t);
            z.append(zehntel / 10);
            z.append(".");
            z.append(zehntel % 10);
            _text.set_center_alignment();
            _text.generate(x, y + 5, t, _wind_text);
            _text.generate(x, y + 13, "WIND", _wind_text);
            _text.set_left_alignment();
        }

        void blaetter(const physik::pfadpunkt& q, int anzahl, double tempo)
        {
            for(int n = 0; n < anzahl; ++n)
            {
                const int platz = _blatt_neu % blaetter_max;
                ++_blatt_neu;
                _blatt[platz] = { q.x, q.y, q.z, zahl01() * mathe::pi * 2, (0.4 + zahl01()) * tempo, _zeit };
                if(_blatt_sprites.size() <= platz)
                {
                    // jedes 3. Blatt dunkel (wie n % 3 in index.html)
                    bn::sprite_ptr b = bn::sprite_items::blatt.create_sprite(0, 0, n % 3 ? 0 : 1);
                    b.set_z_order(0);
                    _blatt_sprites.push_back(bn::move(b));
                }
                else { _blatt_sprites[platz].set_tiles(bn::sprite_items::blatt.tiles_item(), n % 3 ? 0 : 1); }
            }
        }

        void blaetter_zeichnen()
        {
            const double S = _px_pro_m * zoom();
            for(int i = 0; i < _blatt_sprites.size(); ++i)
            {
                const blatt& b = _blatt[i];
                const double dt = _zeit - b.t0;
                if(dt > 0.8 || _zustand == zustand::putt || _zustand == zustand::fertig)
                {
                    _blatt_sprites[i].set_visible(false);
                    continue;
                }
                const double weg = b.v * dt * S * 3;
                _blatt_sprites[i].set_position(sx(b.x) + bn::fixed(float(mathe::cos(b.a) * weg)),
                                               sy(b.y) - bn::fixed(float(b.z * S * 0.6)) + bn::fixed(float(mathe::sin(b.a) * weg + dt * dt * 20)));
                _blatt_sprites[i].set_visible(true);
            }
        }

        // Ruf des Spielers, wenn ein Wurf schiefgeht (wie rufe() in index.html: Aufnahme oder nur Text)
        void rufe()
        {
            const int nr = int(st().sp - gen::alle_spieler);
            if(gen::ruf_toene[nr]) { ton(*gen::ruf_toene[nr]); }
        }

        // Ergebnis im Korb wie zeigeErgebnis() in index.html, mit Jubel unter Par
        void zeige_ergebnis(const char* extra)
        {
            const int diff = st().wuerfe - _b.par;
            bn::string<48> t;
            bn::ostringstream z(t);
            if(extra && st().wuerfe > 1) { z.append(extra); z.append(" "); }
            if(st().wuerfe == 1) { z.append("ACE!!!"); }
            else if(diff == -3) { z.append("ALBATROS!"); }
            else if(diff == -2) { z.append("EAGLE!"); }
            else if(diff == -1) { z.append("BIRDIE!"); }
            else if(diff == 0) { z.append("PAR"); }
            else if(diff == 1) { z.append("BOGEY"); }
            else if(diff == 2) { z.append("DOPPEL-BOGEY"); }
            else { z.append("+"); z.append(diff); }
            if(diff < 0) { ton(bn::sound_items::sfx_jubel); }
            melde(t, 96);
        }

        void melde(const bn::string_view& t, int bilder = 78)
        {
            _banner_bis = _uhr_bilder + bilder;
            _text_mitte = t;
            _zeile_mitte.clear();
            _text.set_center_alignment();
            _text.generate(0, -20, _text_mitte, _zeile_mitte);
            _text.set_left_alignment();
        }

        static void plus_minus(bn::ostringstream& z, int d)
        {
            if(d == 0) { z.append("E"); return; }
            if(d > 0) { z.append("+"); }
            z.append(d);
        }

        // Bahn beendet: Würfe in die Scorekarte, Rangliste wie zeichneEnde() in index.html
        void ende()
        {
            _zustand = zustand::fertig;
            for(int i = 0; i < _anzahl; ++i) { _r.karte[_st[i].platz][_r.index] = _st[i].wuerfe; }
            const bool ganz = _r.bahnen > 1, letzte = _r.index >= _r.bahnen - 1;

            // Gesamt je Platz bis zu dieser Bahn
            int gesamt[max_spieler] = {}, par = 0;
            for(int k = 0; k <= _r.index; ++k)
            {
                par += gen::bahnen[_r.erste_bahn + k].par;
                for(int i = 0; i < _anzahl; ++i) { gesamt[_st[i].platz] += _r.karte[_st[i].platz][k]; }
            }

            // sortiert: in der Runde nach Gesamt, sonst nach dieser Bahn
            int folge[max_spieler];
            for(int i = 0; i < _anzahl; ++i) { folge[i] = i; }
            for(int i = 1; i < _anzahl; ++i)
            {
                for(int j = i; j > 0; --j)
                {
                    const stand& a = _st[folge[j - 1]];
                    const stand& b = _st[folge[j]];
                    const int wa = ganz ? gesamt[a.platz] : a.wuerfe, wb = ganz ? gesamt[b.platz] : b.wuerfe;
                    if(wb < wa) { const int t = folge[j]; folge[j] = folge[j - 1]; folge[j - 1] = t; }
                }
            }

            _zeile_oben.clear(); _zeile_zwei.clear(); _zeile_unten.clear(); _zeile_mitte.clear();
            _text_oben.clear(); _text_zwei.clear(); _text_unten.clear(); _text_mitte.clear();
            _ende_texte.clear();
            _portraet.reset();
            _balken.clear();
            _balken_text.clear();
            _kraftmarke.reset();
            bn::bg_palettes::set_fade(bn::color(1, 2, 3), 0.7);   // Bahn abdunkeln, Text darüber

            bn::string<48> t;
            {
                bn::ostringstream z(t);
                if(letzte && ganz) { z.append("RUNDE BEENDET"); }
                else
                {
                    if(_b.kurz[0]) { z.append(_b.kurz); }
                    else { z.append("BAHN "); z.append(int(_b.nummer)); }
                    z.append(" GESPIELT");
                }
            }
            _text.set_center_alignment();
            _text.generate(0, -60, t, _ende_texte);
            _text.generate(ganz ? 18 : 70, -44, "WUERFE", _ende_texte);
            if(ganz) { _text.generate(82, -44, "GESAMT", _ende_texte); }

            for(int n = 0; n < _anzahl; ++n)
            {
                const stand& s = _st[folge[n]];
                const int y = -30 + n * 14;
                bn::string<32> name;
                {
                    bn::ostringstream z(name);
                    z.append(n + 1);
                    z.append(". ");
                    z.append(s.sp->name);
                }
                _text.set_left_alignment();
                _text.generate(-100, y, name, _ende_texte);
                bn::string<24> bahn;
                {
                    bn::ostringstream z(bahn);
                    z.append(s.wuerfe);
                    z.append(" (");
                    plus_minus(z, s.wuerfe - _b.par);
                    z.append(")");
                }
                _text.set_center_alignment();
                _text.generate(ganz ? 18 : 70, y, bahn, _ende_texte);
                if(ganz)
                {
                    bn::string<24> ges;
                    bn::ostringstream z(ges);
                    z.append(gesamt[s.platz]);
                    z.append(" (");
                    plus_minus(z, gesamt[s.platz] - par);
                    z.append(")");
                    _text.generate(82, y, ges, _ende_texte);
                }
            }
            _text.set_center_alignment();
            _text.generate(0, 50, letzte ? "A: zum Menue" : "A: naechste Bahn", _ende_texte);
            if(ganz)
            {
                bn::string<32> stand_text;
                bn::ostringstream z(stand_text);
                z.append("Bahn ");
                z.append(_r.index + 1);
                z.append(" von ");
                z.append(_r.bahnen);
                _text.generate(0, 62, stand_text, _ende_texte);
            }
            _text.set_left_alignment();
        }

        // ---------- Putt (wie puttWackel/putten/puttLage in index.html) ----------
        struct versatz { double x, y; };

        versatz putt_wackel(double t) const
        {
            const double d = abstand(st().lie, korb());
            const double stil = _push ? 0.65 : 1, gut = physik::zahl(sp().putten);
            const double A = (1.5 + d * 2.1 * gut) * stil * (0.7 + 0.3 * mathe::sin(t * 0.9));
            const double w = 1 + d * 0.1;
            const double r = zum_korb();
            const double quer = _wind.x * -mathe::sin(r) + _wind.y * mathe::cos(r);
            const double drift = quer * 1.6 * gut * (_push ? 1.7 : 0.8) * (0.6 + 0.4 * mathe::sin(t * 0.7));
            return { A * mathe::sin(t * 2.3 * w) + A * 0.5 * mathe::sin(t * 3.9 * w + 1) + drift,
                     A * 0.75 * mathe::sin(t * 2.9 * w + 2) + A * 0.3 * mathe::sin(t * 5.1 * w) };
        }

        // Zeit für das Wackeln des Fadenkreuzes; Einstellung „Putt-Fadenkreuz“ macht es schneller
        double putt_zeit() const { return (_zeit - _putt_zeit0) * putt_tempo(); }

        void putten()
        {
            const versatz o = putt_wackel(putt_zeit());
            _putt_ox = o.x;
            _putt_oy = o.y;
            _putt_flug_zeit = _zeit;
            _putt_ton = false;
            ton(bn::sound_items::sfx_wurf);
            ++st().wuerfe;
            const double ax = mathe::betrag(o.x), ay = mathe::betrag(o.y);
            constexpr double bx = 12, by = 9;   // KETTEN in index.html
            if(ax <= bx && ay <= by)
            {
                const bool innen = ax <= 7 && ay <= 5;
                _putt_ergebnis = (innen || zahl01() < 0.6) ? "drin" : "spit";
            }
            else if(o.y < -by) { _putt_ergebnis = "hoch"; }
            else if(o.y > by && ax < 16) { _putt_ergebnis = "kurz"; }
            else { _putt_ergebnis = "seite"; }

            const physik::punkt k = korb();
            const double r = zum_korb(), dx = mathe::cos(r), dy = mathe::sin(r), qx = -dy, qy = dx;
            const double weit = _push ? 0.55 : 1.5;
            physik::punkt p = k;
            const bn::string_view erg(_putt_ergebnis);
            if(erg == "hoch") { const double a = (1 + zahl01() * 3) * weit; p = { k.x + dx * a + qx * o.x * 0.08, k.y + dy * a + qy * o.x * 0.08 }; }
            else if(erg == "kurz") { const double a = 0.4 + zahl01() * 1.1; p = { k.x - dx * a, k.y - dy * a }; }
            else if(erg == "spit") { const double a = zahl01() * mathe::pi * 2, d = (0.6 + zahl01()) * weit; p = { k.x + mathe::cos(a) * d, k.y + mathe::sin(a) * d }; }
            else if(erg == "seite")
            {
                const double sg = o.x < 0 ? -1 : 1, a = (0.8 + zahl01() * 1.6) * weit, b = zahl01() * 2 * weit;
                p = { k.x + qx * sg * a + dx * b, k.y + qy * sg * a + dy * b };
            }
            if(erg != "drin" && physik::ist_ob(p, _b)) { p = { k.x - dx, k.y - dy }; }
            _putt_lie = p;
            _pause_bis = _uhr_bilder + 70;
            melde(erg == "drin" ? "DRIN!" : erg == "spit" ? "SPIT OUT!" : erg == "hoch" ? "ZU HOCH!" : erg == "kurz" ? "ZU KURZ!" : "DANEBEN!");
        }

        void putt_ende()
        {
            const bool drin = bn::string_view(_putt_ergebnis) == "drin";
            if(! drin) { rufe(); }
            _putt_ergebnis = nullptr;
            _zeile_mitte.clear();
            _text_mitte.clear();
            if(drin) { st().lie = korb(); st().fertig = true; }
            else { st().lie = _putt_lie; }
            naechster();
        }

        // ---------- Anzeige ----------
        void figuren()
        {
            const bool im_putt = _zustand == zustand::putt;
            const physik::punkt k = korb();
            _korb.set_position(sx(k.x), sy(k.y));
            blaetter_zeichnen();

            const bool wind_sichtbar = _zustand != zustand::fertig;
            _wind_kasten->set_visible(wind_sichtbar);
            _wind_pfeil->set_visible(wind_sichtbar);
            for(bn::sprite_ptr& w : _wind_text) { w.set_visible(wind_sichtbar); }

            for(int i = 0; i < _marken.size(); ++i)
            {
                _marken[i].set_position(sx(_marken_ort[i].x), sy(_marken_ort[i].y));
                _marken[i].set_visible(! im_putt);
            }

            // alle Spieler, die noch nicht im Korb sind, an ihrer Lage
            for(int i = 0; i < _anzahl; ++i)
            {
                _figuren[i].set_position(sx(_st[i].lie.x) - 4, sy(_st[i].lie.y) - 4);
                _figuren[i].set_visible(! _st[i].fertig && _zustand != zustand::fertig && ! im_putt);
                _figuren[i].set_z_order(i == _aktiv ? 0 : 1);
            }
            _korb.set_visible(! im_putt && _zustand != zustand::fertig);

            // Scheibe: in der Hand, im Flug (mit Höhe), liegend
            physik::punkt p = _zustand == zustand::flug ? _flug_pos : st().lie;
            const double z = _zustand == zustand::flug ? _flug_z : 0;
            _schatten.set_position(sx(p.x), sy(p.y));
            _scheibe.set_position(sx(p.x), sy(p.y) - bn::fixed(float(z * _px_pro_m * zoom() * 0.6)) - 1);
            const bool scheibe_sichtbar = _zustand == zustand::flug || _zustand == zustand::pause;
            _schatten.set_visible(scheibe_sichtbar);
            _scheibe.set_visible(scheibe_sichtbar);

            // Ziellinie wie zeichneZiellinie(): Punkte in Wurfrichtung, gelb gebogen je nach Winkel
            const bool zielen = _zustand == zustand::zielen || _zustand == zustand::laden;
            const double x0 = st().lie.x * _px_pro_m, y0 = st().lie.y * _px_pro_m;
            const double c = mathe::cos(_ziel_richtung), s = mathe::sin(_ziel_richtung);
            const double hand = (sp().linkshaender ? -1 : 1) * (st().vorhand ? -1 : 1);
            const double kurve = -_winkel * hand * 0.9;
            for(int i = 0; i < ziel_punkte; ++i)
            {
                double px, py;
                if(i < 8)
                {
                    const double d = 10 + i * 10 * (_zustand == zustand::laden ? 0.4 + _kraft * 0.6 : 1);
                    px = x0 + c * d;
                    py = y0 + s * d;
                }
                else
                {
                    const double d = (i - 7) * 6, ex = x0 + c * 86, ey = y0 + s * 86;
                    const double a = _ziel_richtung + kurve * physik::grad() * (d / 20);
                    px = ex + mathe::cos(a) * d - s * kurve * d * d / 400;
                    py = ey + mathe::sin(a) * d + c * kurve * d * d / 400;
                }
                _ziel[i].set_position(bx(px), by(py));
                _ziel[i].set_visible(zielen);
            }

            // Putt-Nahansicht: Fadenkreuz wackelt um die Ketten, nach dem Putt fliegt die Scheibe
            // (wie zeichnePuttAnsicht in index.html; Koordinaten in Web-Pixeln, 1:1 auf dem GBA)
            if(im_putt)
            {
                if(! _fadenkreuz)
                {
                    _fadenkreuz = bn::sprite_items::figuren.create_sprite(0, 0, f_fadenkreuz);
                    _fadenkreuz->set_z_order(0);
                    _kreuz_gruen = true;
                    _putt_scheibe = bn::sprite_items::figuren.create_sprite(0, 0, f_putt_scheibe);
                    _putt_scheibe->set_z_order(0);
                }
                auto setze = [](bn::sprite_ptr& sp, double wx, double wy)
                {
                    sp.set_position(bn::fixed(float(wx - web_kx)) + ketten_sx, bn::fixed(float(wy - web_ky)) + ketten_sy);
                };
                if(! _putt_ergebnis)
                {
                    const versatz o = putt_wackel(putt_zeit());
                    const bool auf_ketten = mathe::betrag(o.x) <= 12 && mathe::betrag(o.y) <= 9;
                    if(auf_ketten != _kreuz_gruen)
                    {
                        _kreuz_gruen = auf_ketten;
                        _fadenkreuz->set_tiles(bn::sprite_items::figuren.tiles_item(), auf_ketten ? f_fadenkreuz : f_fadenkreuz_rot);
                    }
                    setze(*_fadenkreuz, web_kx + o.x, web_ky + o.y);
                    _fadenkreuz->set_visible(true);
                    _putt_scheibe->set_visible(false);
                }
                else
                {
                    _fadenkreuz->set_visible(false);
                    const double t = (_zeit - _putt_flug_zeit) / 0.45;
                    const double zx = web_kx + _putt_ox, zy = web_ky + _putt_oy;
                    constexpr double start_y = 14 + 146 - 10;   // by + bh - 10
                    double x, y;
                    if(t < 1)
                    {
                        x = 160 + (zx - 160) * t;
                        y = start_y + (zy - start_y) * t - mathe::sin(mathe::pi * t) * 10;
                    }
                    else
                    {
                        const double t2 = mathe::min(1, (t - 1) * 1.6);
                        const bn::string_view erg(_putt_ergebnis);
                        x = zx;
                        const double boden = (erg == "drin" || (erg == "kurz" && mathe::betrag(_putt_ox) < 13)) ? web_ky + 12 : 14 + 104;
                        y = zy + (boden - zy) * t2;
                        if(erg == "hoch") { x = zx + t2 * 10; y = zy + (14 + 98 - zy) * t2; }
                    }
                    setze(*_putt_scheibe, x, y);
                    if(t > 1 && ! _putt_ton)
                    {
                        _putt_ton = true;
                        const bn::string_view erg(_putt_ergebnis);
                        ton(erg == "drin" || erg == "spit" ? bn::sound_items::sfx_ketten : bn::sound_items::sfx_landung);
                    }
                    _putt_scheibe->set_visible(true);
                }
            }
            else
            {
                _fadenkreuz.reset();
                _putt_scheibe.reset();
            }
        }

        // Kraftbalken wie zeichneKraftbalken(): grün/gelb/rot nach Streuung (kleiner bei Stärken),
        // hell bis zur Kraft, weiße Marke; nicht im Putt-Modus
        void kraftbalken()
        {
            const bool zeigen = ! _umsehen && (_zustand == zustand::zielen || _zustand == zustand::laden || _zustand == zustand::flug);
            if(! zeigen)
            {
                _balken.clear();
                _balken_text.clear();
                _kraftmarke.reset();
                return;
            }
            if(_balken.empty())
            {
                for(int i = 0; i < balken_stuecke; ++i)
                {
                    _balken.push_back(bn::sprite_items::balken.create_sprite(-balken_stuecke * 4 + i * 8 + 4, balken_y, 0));
                    _balken_stand[i] = -1;
                }
                _text.set_right_alignment();
                _text.generate(-balken_stuecke * 4 - 4, balken_y, "KRAFT", _balken_text);
                _text.set_left_alignment();
                _text.generate(balken_stuecke * 4 + 4, balken_y, "STREUUNG", _balken_text);
                _kraftmarke = bn::sprite_items::kraftmarke.create_sprite(0, balken_y);
            }
            double streuung, weite;
            staerke(streuung, weite);
            const double sf = streuung * (st().vorhand ? 1.2 : 1) * physik::E().streuung;
            const double gelb = mathe::max(0.5, mathe::min(0.93, 1 - 0.3 * sf));
            const double rot = mathe::max(0.75, mathe::min(0.97, 1 - 0.1 * sf));
            const bool mit_kraft = _zustand == zustand::laden || _zustand == zustand::flug;
            const double k = _zustand == zustand::laden ? _kraft : _kraft_angezeigt;
            for(int i = 0; i < balken_stuecke; ++i)
            {
                const double p = (i + 0.5) / balken_stuecke;
                int f = p < gelb ? 0 : p < rot ? 1 : 2;
                if(mit_kraft && p < k) { f += 3; }   // hell bis zur Kraft
                if(f != _balken_stand[i])
                {
                    _balken_stand[i] = f;
                    _balken[i].set_tiles(bn::sprite_items::balken.tiles_item(), f);
                }
            }
            _kraftmarke->set_visible(mit_kraft);
            _kraftmarke->set_x(bn::fixed(float(-balken_stuecke * 4 + balken_stuecke * 8 * mathe::min(1, k))));
        }

        void setze_text(bn::string<64>& alt, const bn::string<64>& neu, bn::vector<bn::sprite_ptr, 20>& sprites, int y)
        {
            if(alt == neu) { return; }
            alt = neu;
            sprites.clear();
            _text.set_left_alignment();
            _text.generate(-114, y, alt, sprites);
        }

        void texte()
        {
            if(_zustand == zustand::fertig) { return; }
            const physik::punkt k = korb();
            const daten::scheibe& sc = scheibe();
            bn::string<64> oben;
            {
                bn::ostringstream z(oben);
                z.append(sp().name);
                z.append("   ");
                if(_b.kurz[0]) { z.append(_b.kurz); }
                else { z.append("Bahn "); z.append(int(_b.nummer)); }
                if(_r.frei)
                {
                    z.append("   Weitester: ");
                    z.append(_r.weitester[st().platz]);
                    z.append(" m");
                }
                else
                {
                    z.append("   Par ");
                    z.append(int(_b.par));
                    z.append("   Wurf ");
                    z.append(st().wuerfe + 1);
                }
                z.append("   ");
                z.append(int(abstand(st().lie, k) + 0.5));
                z.append(" m");
            }
            bn::string<64> zwei;
            {
                bn::ostringstream z(zwei);
                if(_zustand != zustand::putt)
                {
                    z.append(st().vorhand ? "Vorhand" : "Rueckhand");
                    if(_winkel > 0) { z.append(", Hyzer "); z.append(_winkel); }
                    else if(_winkel < 0) { z.append(", Anhyzer "); z.append(-_winkel); }
                    else { z.append(", flach"); }
                }
            }
            bn::string<64> unten;
            {
                bn::ostringstream z(unten);
                if(_umsehen)
                {
                    z.append(_uebersicht ? "GANZE BAHN   A: schieben   B: zurueck" : "UMSEHEN: Steuerkreuz   A: ganze Bahn   B: zurueck");
                }
                else if(_zustand == zustand::putt)
                {
                    z.append(_push ? "PUTT Push" : "PUTT Spin");
                    z.append("  A: putten  B: Stil  SEL: werfen");
                }
                else
                {
                    // wie im Browser: Name (Typ) und Flugzahlen Speed | Glide | Turn | Fade
                    z.append(sc.name);
                    z.append(" (");
                    z.append(typ_name(sc.typ));
                    z.append(")   ");
                    z.append(int(physik::zahl(sc.speed)));
                    z.append(" | ");
                    z.append(int(physik::zahl(sc.glide)));
                    z.append(" | ");
                    z.append(int(physik::zahl(sc.turn)));
                    z.append(" | ");
                    z.append(int(physik::zahl(sc.fade)));
                }
            }
            setze_text(_text_oben, oben, _zeile_oben, -74);
            setze_text(_text_zwei, zwei, _zeile_zwei, -64);
            setze_text(_text_unten, unten, _zeile_unten, 72);
            if(_portraet && _uhr_bilder >= _banner_bis) { _portraet.reset(); }
            if(_text_mitte.size() && _uhr_bilder >= _banner_bis && (_zustand == zustand::zielen || _zustand == zustand::putt)
               && ! (_zustand == zustand::putt && _putt_ergebnis))
            {
                _text_mitte.clear();
                _zeile_mitte.clear();
            }
            kraftbalken();
        }
    };
}

bool szene_runde(runde_stand& r, unsigned startwert)
{
    for(r.index = 0; r.index < r.bahnen; ++r.index)
    {
        bool weiter;
        {
            spiel s(r, startwert + unsigned(r.index) * 7919u);
            bn::core::update();   // damit der Tastendruck, der hierher geführt hat, nicht gleich weiterwirkt
            weiter = s.spielen();
        }
        bn::core::update();       // Bitmap-Hintergrund freigeben, bevor die nächste Bahn ihn braucht
        if(! weiter) { return false; }
        if(r.bahnen > 1 && r.index == r.bahnen - 1) { szene_scorekarte(r); }

        // nächste Bahn: wer diese am besten gespielt hat, wirft zuerst (stabil, wie spieler.sort in weiter())
        for(int i = 1; i < r.anzahl; ++i)
        {
            for(int j = i; j > 0; --j)
            {
                const int a = r.reihenfolge[j - 1], b = r.reihenfolge[j];
                if(r.karte[b][r.index] < r.karte[a][r.index]) { r.reihenfolge[j - 1] = b; r.reihenfolge[j] = a; }
            }
        }
    }
    return true;
}

void szene_spiel(int bahn_nr, int spieler_nr, unsigned startwert)
{
    runde_stand r;
    r.anzahl = 1;
    r.spieler[0] = spieler_nr;
    r.reihenfolge[0] = 0;
    r.erste_bahn = bahn_nr;
    r.bahnen = 1;
    szene_runde(r, startwert);
}

// Scorekarte: oben die Bahnnummern und Par, darunter je Spieler die Würfe und das Gesamt (±Par).
// Bis 18 Bahnen in einer Tabelle (8×8-Schrift, eine Zelle je Bahn).
void szene_scorekarte(const runde_stand& r)
{
    bn::bg_palettes::set_transparent_color(bn::color(3, 8, 4));
    bn::sprite_text_generator text(common::variable_8x8_sprite_font);
    bn::vector<bn::sprite_ptr, 120> zellen;

    constexpr int name_x = -116, erste_x = -78, gesamt_x = 108;
    const int spalte = r.bahnen > 15 ? 9 : 11;
    auto zelle = [&](int x, int y, const bn::string_view& t, bool mitte = true)
    {
        if(mitte) { text.set_center_alignment(); } else { text.set_left_alignment(); }
        if(zellen.size() + 4 < zellen.max_size()) { text.generate(x, y, t, zellen); }
    };

    text.set_center_alignment();
    text.generate(0, -70, "SCOREKARTE", zellen);
    zelle(name_x, -52, "Bahn", false);
    zelle(name_x, -40, "Par", false);
    zelle(gesamt_x, -52, "Ges.");
    int par_summe = 0;
    for(int k = 0; k < r.bahnen; ++k)
    {
        const daten::bahn& b = gen::bahnen[r.erste_bahn + k];
        par_summe += b.par;
        bn::string<8> n, p;
        bn::ostringstream zn(n), zp(p);
        zn.append(k + 1);
        zp.append(int(b.par));
        zelle(erste_x + k * spalte, -52, n);
        zelle(erste_x + k * spalte, -40, p);
    }
    {
        bn::string<8> p;
        bn::ostringstream z(p);
        z.append(par_summe);
        zelle(gesamt_x, -40, p);
    }

    for(int i = 0; i < r.anzahl; ++i)
    {
        const int y = -22 + i * 14;
        zelle(name_x, y, gen::alle_spieler[r.spieler[i]].name, false);
        int summe = 0;
        for(int k = 0; k < r.bahnen; ++k)
        {
            const int w = r.karte[i][k];
            summe += w;
            bn::string<8> t;
            bn::ostringstream z(t);
            z.append(w);
            zelle(erste_x + k * spalte, y, t);
        }
        bn::string<16> g;
        bn::ostringstream z(g);
        z.append(summe);
        const int d = summe - par_summe;
        z.append(d == 0 ? " E" : d > 0 ? " +" : " ");
        if(d != 0) { z.append(d); }
        zelle(gesamt_x, y, g);
    }
    text.set_center_alignment();
    text.generate(0, 70, "A: weiter", zellen);

    bn::core::update();
    while(! bn::keypad::a_pressed() && ! bn::keypad::b_pressed() && ! bn::keypad::start_pressed())
    {
        bn::core::update();
    }
}
