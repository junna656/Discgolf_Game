// Flugmodell der GBA-Version – Übersetzung von physik.js (Referenz bleibt physik.js!).
//
// Ändert sich physik.js, muss diese Übersetzung mitziehen: tests/gba/physik_test.cpp vergleicht
// beide mit den Referenzwürfen aus tests/referenz.json (werkzeuge/referenzwuerfe.mjs).
//
// Rechnet in double mit eigenen Mathefunktionen (mathe.h), ohne Butano – derselbe Code läuft
// auf dem GBA und im PC-Test.
#ifndef PHYSIK_H
#define PHYSIK_H

#include "daten.h"
#include "zufall.h"

namespace physik
{
    // Stellschrauben (STANDARD in physik.js)
    struct einstellungen
    {
        double winkel, turn, fade, weite, streuung, wind, kick, baum_abprallen, baum_bremsen;
    };

    einstellungen& E();                     // aktuelle Werte, anfangs wie STANDARD
    void setze_zufall(zufall& z);           // statt Math.random (muss vor dem ersten Wurf gesetzt sein)
    void vorbereiten();                     // Tabellen füllen (einmal beim Start, sonst beim ersten Wurf)

    double grad();                          // DEG = PI / 180
    double gauss();
    double reichweite(const daten::scheibe& s);
    double kraft_faktor(double k);
    double kraft_fuer(const daten::scheibe& s, double d);

    struct punkt
    {
        double x, y;
    };

    struct pfadpunkt
    {
        double x, y, z, t;
    };

    double zahl(daten::fk f);               // Festkomma aus den Daten → double
    punkt zu_punkt(const daten::punkt& p);

    bool ist_ob(punkt p, const daten::bahn& bahn);
    bool auf_bowlingbahn(punkt p, const daten::bahn& bahn);

    // wurf: {x, y, richtung (rad), kraft 0..1, winkel (Grad, + = Hyzer, - = Anhyzer), scheibe, hand, wurfart}
    struct wurf
    {
        double x, y, richtung, kraft, winkel;
        const daten::scheibe* scheibe;
        bool links;                         // hand === "links"
        bool vorhand;                       // wurfart === "vorhand"
        double streu_faktor = 1;            // Stärke des Spielers
        double weite_faktor = 1;
        bool mando_ok = false;              // Mando schon geschafft (gilt dann nicht mehr)
    };

    // wind: {x, y} in m/s (Richtung, in die der Wind weht)
    struct wind
    {
        double x, y;
    };

    enum class typ : uint8_t
    {
        landung, baum, mauer, korb, abpraller, bowling
    };

    enum class mando_ergebnis : uint8_t
    {
        keins, ok, verpasst
    };

    constexpr int pfad_max = 400;
    constexpr int brems_max = 16;

    struct ergebnis
    {
        pfadpunkt pfad[pfad_max];
        int pfad_laenge;
        punkt lie;
        bool drin, ob;
        int ob_index;
        mando_ergebnis mando;
        int mando_index;
        typ art;
        int brems_punkte[brems_max];
        int brems_anzahl;
        int durch_punkte[brems_max];    // durchPunkte: ungehindert durch eine Krone geflogen
        int durch_anzahl;
        int baum_index;                 // baumIndex: Pfadstelle des Abpralls in eine Krone, -1 = keiner
        double dauer, distanz;
    };

    // Streuung je nach Kraft (wie Physik.streue)
    wurf streue(const wurf& w);

    // Rückmeldung während der Berechnung: wird nach jedem neuen Pfadpunkt aufgerufen.
    // Alle Punkte außer dem letzten (e.pfad_laenge - 1) sind dann schon endgültig.
    // Auf dem GBA zeichnet das Spiel darin weiter (bn::core::update), damit die Scheibe schon
    // fliegt, während der Rest noch gerechnet wird. nullptr = keine Rückmeldung.
    struct ergebnis;
    using rueckruf = void (*)(const ergebnis& e, void* daten);
    void setze_rueckruf(rueckruf r, void* daten);

    // Flug berechnen (wie Physik.simuliere). Das Ergebnis ist groß (~13 KB):
    // auf dem GBA nicht auf den Stack legen, sondern z. B. static.
    void simuliere(const daten::bahn& bahn, const wurf& w, wind wind_in, ergebnis& aus);
}

#endif
