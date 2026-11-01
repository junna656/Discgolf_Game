// Nativer Test (g++ auf dem PC): rechnet die C++-Physik (gba/src/physik.bn_iwram.cpp) dieselben Würfe
// wie physik.js? Grundlage sind die 600 Referenzwürfe aus werkzeuge/referenzwuerfe.mjs.
//   g++ -std=c++17 -O2 -I gba/include -I tests/gba tests/gba/physik_test.cpp gba/src/physik.bn_iwram.cpp -o /tmp/physik_test && /tmp/physik_test
//
// Erlaubt sind nur winzige Abweichungen: die Bahndaten liegen in C++ als Festkomma vor
// (auf 1/4096 m gerundet), und die Mathefunktionen weichen in der letzten Stelle ab.
#include <cmath>
#include <cstdio>
#include "physik.h"
#include "gen_bahnen.h"
#include "gen_taschen.h"
#include "gen_referenz.h"

namespace
{
    constexpr double toleranz_ort = 0.01;     // Meter (Landepunkt, Stützpunkte)
    constexpr double toleranz_zeit = 0.001;   // Sekunden
    constexpr double toleranz_streuung = 1e-5;

    const char* typ_name(int t)
    {
        static const char* namen[] = { "landung", "baum", "mauer", "korb", "abpraller", "bowling" };
        return t >= 0 && t < 6 ? namen[t] : "?";
    }

    physik::ergebnis erg;   // groß, daher nicht auf dem Stack
}

int main(int argc, char**)
{
    bool ausfuehrlich = argc > 1;
    int fehler = 0;
    double max_ort = 0, max_streu = 0, max_zeit = 0;

    for(int i = 0; i < referenz::anzahl; ++i)
    {
        const referenz::wurf& r = referenz::wuerfe[i];
        zufall z(r.startwert);
        physik::setze_zufall(z);

        physik::wurf w;
        w.x = r.x;
        w.y = r.y;
        w.richtung = r.richtung;
        w.kraft = r.kraft;
        w.winkel = r.winkel;
        w.scheibe = &gen::alle_spieler[r.spieler].tasche[r.scheibe];
        w.links = r.links;
        w.vorhand = r.vorhand;
        w.streu_faktor = r.streu_faktor;
        w.weite_faktor = r.weite_faktor;

        physik::wurf g = physik::streue(w);
        physik::simuliere(gen::bahnen[r.bahn], g, { r.wind_x, r.wind_y }, erg);

        double d_streu = std::fmax(std::fabs(g.richtung - r.g_richtung),
                         std::fmax(std::fabs(g.kraft - r.g_kraft), std::fabs(g.winkel - r.g_winkel)));
        double d_ort = std::hypot(erg.lie.x - r.lie_x, erg.lie.y - r.lie_y);
        for(int k = 0; k < 3; ++k)
        {
            const double f[] = { 0.25, 0.5, 0.75 };
            int idx = int(std::lround(f[k] * 160));
            if(idx > erg.pfad_laenge - 1) { idx = erg.pfad_laenge - 1; }
            const physik::pfadpunkt& p = erg.pfad[idx];
            d_ort = std::fmax(d_ort, std::fabs(p.x - r.s[k].x));
            d_ort = std::fmax(d_ort, std::fabs(p.y - r.s[k].y));
            d_ort = std::fmax(d_ort, std::fabs(p.z - r.s[k].z));
        }
        double d_zeit = std::fabs(erg.dauer - r.dauer);
        max_streu = std::fmax(max_streu, d_streu);

        bool gleich = int(erg.art) == r.typ && erg.drin == r.drin && erg.ob == r.ob &&
                      int(erg.mando) == r.mando && erg.pfad_laenge == r.pfad_laenge;
        if(gleich)
        {
            max_ort = std::fmax(max_ort, d_ort);
            max_zeit = std::fmax(max_zeit, d_zeit);
        }

        if(! gleich || d_ort > toleranz_ort || d_zeit > toleranz_zeit || d_streu > toleranz_streuung)
        {
            ++fehler;
            if(fehler <= 20 || ausfuehrlich)
            {
                std::printf("Wurf %3d (Bahn-Index %2d): C++ %s%s%s Pfad %d Lage (%.4f, %.4f) | JS %s%s%s Pfad %d Lage (%.4f, %.4f) | Abw. %.5f m\n",
                            r.nr, r.bahn, typ_name(int(erg.art)), erg.ob ? " OB" : "", erg.drin ? " drin" : "", erg.pfad_laenge,
                            erg.lie.x, erg.lie.y, typ_name(r.typ), r.ob ? " OB" : "", r.drin ? " drin" : "", r.pfad_laenge,
                            r.lie_x, r.lie_y, d_ort);
            }
        }
    }

    std::printf("Physik: %d von %d Würfen gleich wie physik.js (größte Abweichung: Ort %.6f m, Zeit %.6f s, Streuung %.2g)\n",
                referenz::anzahl - fehler, referenz::anzahl, max_ort, max_zeit, max_streu);
    return fehler ? 1 : 0;
}
