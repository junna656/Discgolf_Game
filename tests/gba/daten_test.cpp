// Nativer Test (g++ auf dem PC): passen die erzeugten C++-Daten zu bahnen.js und taschen.js?
//   g++ -std=c++17 -I gba/include tests/gba/daten_test.cpp -o /tmp/daten_test && /tmp/daten_test
#include <cmath>
#include <cstdio>
#include <cstring>
#include "gen_bahnen.h"
#include "gen_taschen.h"
#include "gen_einstellungen.h"
#include "gen_pruefwerte.h"

namespace
{
    int fehler = 0;

    double z(daten::fk f) { return f.roh / 4096.0; }

    void pruefe(bool ok, const char* was)
    {
        if(! ok)
        {
            std::printf("FEHLER: %s\n", was);
            ++fehler;
        }
    }

    // Summen vergleichen; jede Zahl ist auf 1/4096 gerundet, daher Toleranz je Summand
    void vergleiche(double ist, double soll, int summanden, const char* was)
    {
        double toleranz = summanden * 0.5 / 4096 + 1e-9;
        if(std::fabs(ist - soll) > toleranz)
        {
            std::printf("FEHLER: %s: C++ %.6f, JS %.6f\n", was, ist, soll);
            ++fehler;
        }
    }

    bool in_welt(const daten::bahn& b, daten::punkt p)
    {
        return p.x.roh >= 0 && p.y.roh >= 0 && p.x.roh <= b.breite.roh && p.y.roh <= b.hoehe.roh;
    }
}

int main()
{
    using namespace gen;

    int baeume = 0, ob = 0, ob_punkte = 0, par = 0;
    double radien = 0, baum_x = 0, korb_y = 0;

    for(int i = 0; i < bahnen_anzahl; ++i)
    {
        const daten::bahn& b = bahnen[i];
        char was[96];
        std::snprintf(was, sizeof(was), "Bahn %d: Abwurf und Korb liegen auf der Spielfläche", b.nummer);
        pruefe(in_welt(b, b.abwurf) && in_welt(b, b.korb), was);
        std::snprintf(was, sizeof(was), "Bahn %d: Spielfläche hat 16:9", b.nummer);
        pruefe(std::fabs(z(b.hoehe) - z(b.breite) * 9 / 16) < 0.01, was);

        baeume += b.baeume_anzahl;
        par += b.par;
        korb_y += z(b.korb.y);

        for(int k = 0; k < b.baeume_anzahl; ++k)
        {
            radien += z(b.baeume[k].r);
            baum_x += z(b.baeume[k].p.x);
            pruefe(b.baeume[k].r.roh > 0 && b.baeume[k].h.roh > 0, "Baum mit Radius und Höhe > 0");
        }

        for(int k = 0; k < b.ob_anzahl; ++k)
        {
            const daten::ob_zone& o = b.ob[k];
            ++ob;
            ob_punkte += o.anzahl;
            bool ok = o.art == daten::ob_art::rechteck ? (o.w.roh > 0 && o.h.roh > 0 && ! o.punkte)
                    : o.art == daten::ob_art::linie ? o.anzahl >= 2
                    : o.anzahl >= 3;
            std::snprintf(was, sizeof(was), "Bahn %d: OB-Zone %d vollständig", b.nummer, k);
            pruefe(ok, was);
        }

        for(int k = 0; k < b.mauern_anzahl; ++k)
        {
            pruefe(b.mauern[k].anzahl >= 2, "Mauer mit mindestens 2 Punkten");
        }
    }

    vergleiche(baeume, pruefwerte::baeume, 0, "Anzahl Bäume");
    vergleiche(radien, pruefwerte::baum_radien, baeume, "Summe Baumradien");
    vergleiche(baum_x, pruefwerte::baum_x, baeume, "Summe Baum-x");
    vergleiche(ob, pruefwerte::ob_zonen, 0, "Anzahl OB-Zonen");
    vergleiche(ob_punkte, pruefwerte::ob_punkte, 0, "Anzahl OB-Punkte");
    vergleiche(korb_y, pruefwerte::korb_y, bahnen_anzahl, "Summe Korb-y");
    vergleiche(par, pruefwerte::par, 0, "Summe Par");

    int kurs_bahnen = 0;
    for(int i = 0; i < kurse_anzahl; ++i)
    {
        pruefe(kurse[i].erste_bahn == kurs_bahnen, "Kurse liegen lückenlos hintereinander");
        kurs_bahnen += kurse[i].bahnen_anzahl;
    }
    pruefe(kurs_bahnen == freies_feld && freies_feld == bahnen_anzahl - 1, "freies Feld ist die letzte Bahn");

    int scheiben = 0;
    double turn = 0, speed = 0;
    for(int i = 0; i < spieler_anzahl; ++i)
    {
        const daten::spieler& s = alle_spieler[i];
        int standard = 0;
        scheiben += s.tasche_anzahl;
        for(int k = 0; k < s.tasche_anzahl; ++k)
        {
            turn += z(s.tasche[k].turn);
            speed += z(s.tasche[k].speed);
            standard += s.tasche[k].standard;
        }
        pruefe(standard <= 1, "höchstens eine Standardscheibe je Tasche");
        pruefe(s.lieblingsscheibe_index < s.tasche_anzahl, "Lieblingsscheibe liegt in der Tasche");
        pruefe(s.lieblingsscheibe.gesetzt, "Lieblingsscheiben-Stärke gesetzt (sonst Standard)");
    }
    vergleiche(scheiben, pruefwerte::scheiben, 0, "Anzahl Scheiben");
    vergleiche(turn, pruefwerte::turn, scheiben, "Summe Turn");
    vergleiche(speed, pruefwerte::speed, scheiben, "Summe Speed");

    pruefe(einstellungen::baum_abprallen == 0.45, "Stellschraube baum_abprallen");

    if(fehler)
    {
        std::printf("Daten: %d Fehler\n", fehler);
        return 1;
    }

    std::printf("Daten: %d Bahnen, %d Bäume, %d OB-Zonen, %d Spieler, %d Scheiben – alles gleich wie in JS\n",
                bahnen_anzahl, baeume, ob, spieler_anzahl, scheiben);
    return 0;
}
