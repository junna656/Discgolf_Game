// Datentypen für Kurse, Bahnen, Spieler und Taschen der GBA-Version.
// Die Inhalte stehen in gen_bahnen.h, gen_taschen.h und gen_einstellungen.h und werden von
// werkzeuge/exportiere_gba.mjs aus bahnen.js, taschen.js und physik.js erzeugt.
//
// Ohne Butano nutzbar, damit dieselben Header auch in den nativen Tests (tests/gba/) laufen.
#ifndef DATEN_H
#define DATEN_H

#include <stdint.h>

namespace daten
{
    // Festkommazahl mit 12 Nachkommabits, gleiches Format wie bn::fixed:  wert = roh / 4096
    // (auf dem GBA:  bn::fixed::from_data(z.roh))
    struct fk
    {
        int32_t roh;
    };

    struct punkt
    {
        fk x, y;
    };

    struct baum
    {
        punkt p;
        fk r;   // Radius der Krone in Metern
        fk h;   // Höhe in Metern (darüber fliegt die Scheibe hinweg)
    };

    enum class ob_art : uint8_t
    {
        rechteck,   // x, y, w, h
        polygon,    // punkte
        linie,      // Grenzlinie punkte; OB ist die Seite, auf der "innen" NICHT liegt
        insel,      // Inselgrün punkte; ab x >= ab ist alles außerhalb der Insel OB
    };

    struct ob_zone
    {
        ob_art art;
        bool natur;             // nur Grafik: keine weiße OB-Linie
        const char* name;
        fk x, y, w, h;          // rechteck
        const punkt* punkte;    // polygon, linie, insel
        uint8_t anzahl;
        punkt innen;            // linie
        fk ab;                  // insel
    };

    struct mauer
    {
        const punkt* punkte;
        uint8_t anzahl;
        fk h;
    };

    struct bowlingbahn
    {
        punkt a, b;
        fk breite;
    };

    struct mando
    {
        punkt a, b;             // die Scheibe muss die Linie a–b in der Lücke kreuzen
        bool hat_dropzone;
        punkt dropzone;
    };

    struct bahn
    {
        uint8_t nummer;
        const char* name;       // kann leer sein
        const char* kurz;       // kann leer sein
        const char* ort;
        uint8_t par;
        fk breite, hoehe;       // Spielfläche in Metern
        punkt abwurf, korb;
        const baum* baeume;
        uint16_t baeume_anzahl;
        const ob_zone* ob;
        uint8_t ob_anzahl;
        const mauer* mauern;
        uint8_t mauern_anzahl;
        bool hat_bowlingbahn;
        bowlingbahn bowling;
        bool hat_dropzone;
        punkt dropzone;
        bool hat_mando;
        mando m;
    };

    struct kurs
    {
        const char* id;
        const char* name;
        const char* ort;
        uint8_t erste_bahn;     // Index in bahnen[]
        uint8_t bahnen_anzahl;
    };

    enum class scheiben_typ : uint8_t
    {
        driver,
        fairway,
        midrange,
        putter,
    };

    struct scheibe
    {
        const char* name;
        scheiben_typ typ;
        fk speed, glide, turn, fade;
        bool standard;
    };

    // Stärke für eine Wurfart: Streuung und Weite werden damit multipliziert
    struct staerke
    {
        bool gesetzt;
        fk streuung;
        fk weite;
    };

    struct spieler
    {
        const char* name;
        uint16_t farbe;             // GBA-Farbe (5 Bit je Kanal: r | g << 5 | b << 10)
        bool linkshaender;
        bool vorhand;               // Startwert der Wurfart
        fk putten;                  // 1 = normal, kleiner = ruhigeres Putt-Fadenkreuz
        staerke rueckhand, vorhand_staerke, hyzer, anhyzer, sline, lieblingsscheibe;
        int8_t lieblingsscheibe_index;  // in tasche, -1 = keine
        const scheibe* tasche;
        uint8_t tasche_anzahl;
    };
}

#endif
