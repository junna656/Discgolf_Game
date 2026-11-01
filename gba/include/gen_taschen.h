// ERZEUGT von werkzeuge/exportiere_gba.mjs – nicht von Hand bearbeiten
// Quelle: taschen.js (Standard der Lieblingsscheibe: LIEBLING_STANDARD in index.html)
#ifndef GEN_TASCHEN_H
#define GEN_TASCHEN_H

#include "daten.h"

namespace gen
{
    using namespace daten;

    constexpr scheibe s0_tasche[] = {
        {"Donnerkeil", scheiben_typ::driver, {49152}, {20480}, {-4096}, {8192}, false},
        {"Trace", scheiben_typ::driver, {45056}, {20480}, {-4096}, {8192}, false},
        {"Valkyrie", scheiben_typ::driver, {36864}, {16384}, {-8192}, {8192}, true},
        {"River", scheiben_typ::fairway, {28672}, {28672}, {-4096}, {4096}, false},
        {"Pfeil", scheiben_typ::fairway, {28672}, {20480}, {-4096}, {4096}, false},
        {"Fels", scheiben_typ::midrange, {20480}, {16384}, {0}, {8192}, false},
        {"Kiesel", scheiben_typ::putter, {8192}, {12288}, {0}, {4096}, false}
    };
    constexpr scheibe s1_tasche[] = {
        {"River", scheiben_typ::fairway, {28672}, {28672}, {-4096}, {4096}, true},
        {"Berg", scheiben_typ::putter, {4096}, {4096}, {4096}, {4096}, false}
    };
    constexpr scheibe s2_tasche[] = {
        {"Hammer", scheiben_typ::driver, {53248}, {20480}, {-4096}, {12288}, false},
        {"Shryke", scheiben_typ::driver, {53248}, {24576}, {-8192}, {8192}, false},
        {"River", scheiben_typ::fairway, {28672}, {28672}, {-4096}, {4096}, false},
        {"Moewe", scheiben_typ::fairway, {28672}, {24576}, {-4096}, {8192}, false},
        {"Mako3", scheiben_typ::midrange, {20480}, {20480}, {0}, {0}, true},
        {"Kompass", scheiben_typ::midrange, {20480}, {20480}, {0}, {4096}, false},
        {"Muschel", scheiben_typ::putter, {8192}, {16384}, {0}, {0}, false},
        {"Zange", scheiben_typ::putter, {12288}, {8192}, {0}, {12288}, false}
    };
    constexpr scheibe s3_tasche[] = {
        {"Katana", scheiben_typ::driver, {53248}, {20480}, {-12288}, {12288}, false},
        {"Trace", scheiben_typ::driver, {45056}, {20480}, {-4096}, {8192}, false},
        {"Heat", scheiben_typ::driver, {36864}, {12288}, {-12288}, {4096}, true},
        {"River", scheiben_typ::fairway, {28672}, {28672}, {-4096}, {4096}, false},
        {"Valkyrie", scheiben_typ::driver, {36864}, {16384}, {-8192}, {8192}, false},
        {"Method", scheiben_typ::midrange, {20480}, {20480}, {0}, {12288}, false},
        {"Mako3", scheiben_typ::midrange, {20480}, {20480}, {0}, {0}, false},
        {"Svea", scheiben_typ::midrange, {20480}, {24576}, {-4096}, {0}, false},
        {"Hydrogen", scheiben_typ::putter, {4096}, {8192}, {0}, {0}, false}
    };

    constexpr int spieler_anzahl = 4;
    constexpr spieler alle_spieler[spieler_anzahl] = {
        { // Thomas
            "Thomas", 0x1D3D, false, false, {4096},
            {true, {2048}, {4424}}, {false, {4096}, {4096}}, {false, {4096}, {4096}}, {false, {4096}, {4096}}, {false, {4096}, {4096}}, {true, {3277}, {4301}},
            2, s0_tasche, 7
        },
        { // Daniel
            "Daniel", 0x7627, false, false, {1434},
            {false, {4096}, {4096}}, {false, {4096}, {4096}}, {false, {4096}, {4096}}, {false, {4096}, {4096}}, {false, {4096}, {4096}}, {true, {3277}, {4301}},
            0, s1_tasche, 2
        },
        { // Andre
            "Andre", 0x1B1E, false, true, {4096},
            {false, {4096}, {4096}}, {true, {2048}, {4710}}, {false, {4096}, {4096}}, {false, {4096}, {4096}}, {false, {4096}, {4096}}, {true, {3277}, {4301}},
            4, s2_tasche, 8
        },
        { // Gunnar
            "Gunnar", 0x7173, false, false, {4096},
            {false, {4096}, {4096}}, {false, {4096}, {4096}}, {false, {4096}, {4096}}, {false, {4096}, {4096}}, {true, {1843}, {4096}}, {true, {3277}, {4301}},
            2, s3_tasche, 9
        }
    };
}

#endif
