// Boogie Garanten – GBA-Version, Etappe 1: „Hallo Welt“
//
// Prüft auf dem echten Gerät (Analogue Pocket, GBA, mGBA):
//  - Bild und Sprites:   Titel, Korb und Scheibe
//  - Tasten:             ▲▼ zielen, A halten = Kraft laden, loslassen = werfen, B = zurück
//  - Zufall:             mulberry32 liefert dieselben Zahlen wie physik.js
//  - Speichern (SRAM):   Anzahl der Starts bleibt nach dem Ausschalten erhalten
//
// Der Wurf hier ist nur eine einfache Animation – das echte Flugmodell kommt in Etappe 3.

#include "bn_core.h"
#include "bn_keypad.h"
#include "bn_sram.h"
#include "bn_string.h"
#include "bn_vector.h"
#include "bn_math.h"
#include "bn_bg_palettes.h"
#include "bn_sprite_ptr.h"
#include "bn_sprite_text_generator.h"

#include "bn_sprite_items_scheibe.h"
#include "bn_sprite_items_korb.h"
#include "common_variable_8x8_sprite_font.h"
#include "common_variable_8x16_sprite_font.h"

#include "gen_version.h"
#include "gen_zufall_test.h"
#include "zufall.h"

namespace
{
    // --- Speicherstand ---
    constexpr char speicher_kennung[] = "BOOGIE GARANTEN 1";

    struct speicher
    {
        char kennung[sizeof(speicher_kennung)];
        int starts;
    };

    int zaehle_start()
    {
        speicher s;
        bn::sram::read(s);
        bool gueltig = true;

        for(int i = 0; i < int(sizeof(speicher_kennung)); ++i)
        {
            gueltig = gueltig && s.kennung[i] == speicher_kennung[i];
        }

        if(! gueltig || s.starts < 0)
        {
            bn::sram::clear(bn::sram::size());

            for(int i = 0; i < int(sizeof(speicher_kennung)); ++i)
            {
                s.kennung[i] = speicher_kennung[i];
            }

            s.starts = 0;
        }

        ++s.starts;
        bn::sram::write(s);
        return s.starts;
    }

    // --- Selbsttest: gleiche Zufallszahlen wie physik.js? ---
    bool zufall_ok()
    {
        for(int i = 0; i < gen::zufall_tests; ++i)
        {
            zufall z(gen::zufall_startwerte[i]);

            for(int k = 0; k < gen::zufall_laenge; ++k)
            {
                if(z.naechste() != gen::zufall_folgen[i][k])
                {
                    return false;
                }
            }
        }

        return true;
    }

    // Spielfeld in Bildschirmkoordinaten (Mitte = 0, 0)
    constexpr bn::fixed abwurf_x = -96;
    constexpr bn::fixed boden_y = 30;
    constexpr bn::fixed korb_x = 88;
}

int main()
{
    bn::core::init();
    bn::bg_palettes::set_transparent_color(bn::color(7, 15, 6)); // Wiese

    const int starts = zaehle_start();
    const bool zufall_gleich = zufall_ok();

    bn::sprite_text_generator gross(common::variable_8x16_sprite_font);
    bn::sprite_text_generator klein(common::variable_8x8_sprite_font);
    gross.set_center_alignment();
    klein.set_center_alignment();

    bn::vector<bn::sprite_ptr, 40> feste_texte;
    gross.generate(0, -68, "BOOGIE GARANTEN", feste_texte);
    klein.generate(0, -52, "Retro-Edition  v" BG_VERSION, feste_texte);

    {
        bn::string<48> zeile;
        bn::ostringstream z(zeile);
        z.append(zufall_gleich ? "Zufall: OK" : "Zufall: FEHLER!");
        z.append("   Starts: ");
        z.append(starts);
        klein.generate(0, 70, zeile, feste_texte);
    }

    bn::sprite_ptr korb = bn::sprite_items::korb.create_sprite(korb_x, boden_y - 12);
    bn::sprite_ptr scheibe = bn::sprite_items::scheibe.create_sprite(abwurf_x, boden_y);

    bn::vector<bn::sprite_ptr, 16> hinweis;
    bn::vector<bn::sprite_ptr, 16> anzeige;

    enum class zustand { zielen, laden, flug, liegt };
    zustand jetzt = zustand::zielen;
    bn::fixed ziel = 0;      // -1 .. 1: nach oben / unten zielen
    bn::fixed kraft = 0;     // 0 .. 1
    bn::fixed t = 0;         // Fortschritt des Flugs 0 .. 1
    bn::fixed weite = 0;
    bool neu_zeichnen = true;
    zufall wackel(uint32_t(starts) * 2654435761u);

    while(true)
    {
        switch(jetzt)
        {
        case zustand::zielen:
            if(bn::keypad::up_held()) { ziel = bn::max(ziel - bn::fixed(0.02), bn::fixed(-1)); }
            if(bn::keypad::down_held()) { ziel = bn::min(ziel + bn::fixed(0.02), bn::fixed(1)); }
            scheibe.set_position(abwurf_x, boden_y + ziel * 6);

            if(bn::keypad::a_pressed())
            {
                jetzt = zustand::laden;
                kraft = 0;
                neu_zeichnen = true;
            }
            break;

        case zustand::laden:
            kraft = bn::min(kraft + bn::fixed(0.015), bn::fixed(1));
            neu_zeichnen = true;

            if(bn::keypad::a_released())
            {
                // etwas Streuung aus dem Zufallsgenerator, wie im Spiel
                bn::fixed streu = bn::fixed(int(wackel.naechste() >> 24) - 128) / 1024;
                weite = (kraft + streu) * (korb_x - abwurf_x) * bn::fixed(1.1);
                t = 0;
                jetzt = zustand::flug;
            }
            break;

        case zustand::flug:
        {
            t += bn::fixed(0.02);

            if(t >= 1)
            {
                t = 1;
                jetzt = zustand::liegt;
                neu_zeichnen = true;
            }

            // Bogen: x linear, Höhe als Parabel, leichte Kurve nach oben/unten durch das Zielen
            bn::fixed x = abwurf_x + weite * t;
            bn::fixed hoehe = 4 * t * (1 - t) * (24 + kraft * 30);
            bn::fixed y = boden_y + ziel * 6 + ziel * 40 * t - hoehe;
            scheibe.set_position(x, y);
            scheibe.set_scale(1 + hoehe / 80);
            break;
        }

        case zustand::liegt:
            if(bn::keypad::b_pressed() || bn::keypad::a_pressed())
            {
                jetzt = zustand::zielen;
                scheibe.set_scale(1);
                neu_zeichnen = true;
            }
            break;
        }

        if(neu_zeichnen)
        {
            neu_zeichnen = false;
            hinweis.clear();
            anzeige.clear();

            if(jetzt == zustand::zielen)
            {
                klein.generate(0, -36, "Hoch/Runter: zielen   A halten: werfen", hinweis);
            }
            else if(jetzt == zustand::laden)
            {
                bn::string<24> zeile;
                bn::ostringstream z(zeile);
                z.append("Kraft: ");
                z.append((kraft * 100).integer());
                z.append(" %");
                gross.generate(0, -36, zeile, anzeige);
            }
            else if(jetzt == zustand::liegt)
            {
                bn::fixed rest = bn::abs(korb_x - scheibe.x());
                gross.generate(0, -36, rest < 10 ? "Treffer!" : "A oder B: nochmal", anzeige);
            }
        }

        bn::core::update();
    }
}
