// Boogie Garanten – GBA-Version, Etappe 1: „Hallo Welt“
//
// Prüft auf dem echten Gerät (Analogue Pocket, GBA, mGBA):
//  - Bild und Sprites:   Titel, Korb und Scheibe
//  - Tasten:             ▲▼ zielen, A halten = Kraft laden, loslassen = werfen, B = zurück
//  - Zufall:             mulberry32 liefert dieselben Zahlen wie physik.js
//  - Speichern (SRAM):   Anzahl der Starts bleibt nach dem Ausschalten erhalten
//
// Der Wurf hier ist nur eine einfache Animation – das echte Flugmodell kommt in Etappe 3.
//
// Etappe 2: SELECT zeigt alle Bahnen (Minikarte) und Spieler aus den erzeugten Daten.

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

#include "bn_sprite_items_karte.h"

#include "gen_version.h"
#include "gen_bahnen.h"
#include "gen_taschen.h"
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

    // Festkommazahl aus den erzeugten Daten (gleiches Format wie bn::fixed)
    bn::fixed fx(daten::fk z)
    {
        return bn::fixed::from_data(z.roh);
    }

    // Spielfeld in Bildschirmkoordinaten (Mitte = 0, 0)
    constexpr bn::fixed abwurf_x = -96;
    constexpr bn::fixed boden_y = 30;
    constexpr bn::fixed korb_x = 88;
}

// Szene 1: Titel und Probewurf. Endet mit SELECT.
void szene_wurf(int starts, bool zufall_gleich)
{
    bn::bg_palettes::set_transparent_color(bn::color(7, 15, 6)); // Wiese

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

    while(! bn::keypad::select_pressed())
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
                klein.generate(0, 56, "SELECT: Bahnen ansehen", hinweis);
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
                // Treffer nur, wenn die Scheibe waagerecht UND senkrecht beim Korb liegt
                bool treffer = bn::abs(korb_x - scheibe.x()) < 10 && bn::abs(boden_y - scheibe.y()) < 8;
                gross.generate(0, -36, treffer ? "Treffer!" : "A oder B: nochmal", anzeige);
            }
        }

        bn::core::update();
    }
}

// Szene 2: Bahnen und Spieler aus den erzeugten Daten (bahnen.js, taschen.js) ansehen.
// Links/Rechts: Bahn, L/R: Spieler, SELECT: zurück
void szene_daten()
{
    bn::bg_palettes::set_transparent_color(bn::color(5, 12, 5));

    bn::sprite_text_generator gross(common::variable_8x16_sprite_font);
    bn::sprite_text_generator klein(common::variable_8x8_sprite_font);
    gross.set_center_alignment();
    klein.set_center_alignment();

    int bahn_nr = 0, spieler_nr = 0;
    bool neu = true;
    bn::vector<bn::sprite_ptr, 24> texte;
    bn::vector<bn::sprite_ptr, 64> karte;

    while(! bn::keypad::select_pressed())
    {
        if(bn::keypad::left_pressed()) { bahn_nr = (bahn_nr + gen::bahnen_anzahl - 1) % gen::bahnen_anzahl; neu = true; }
        if(bn::keypad::right_pressed()) { bahn_nr = (bahn_nr + 1) % gen::bahnen_anzahl; neu = true; }
        if(bn::keypad::l_pressed()) { spieler_nr = (spieler_nr + gen::spieler_anzahl - 1) % gen::spieler_anzahl; neu = true; }
        if(bn::keypad::r_pressed()) { spieler_nr = (spieler_nr + 1) % gen::spieler_anzahl; neu = true; }

        if(neu)
        {
            neu = false;
            texte.clear();
            karte.clear();
            const daten::bahn& b = gen::bahnen[bahn_nr];

            // Überschrift
            {
                bn::string<48> zeile;
                bn::ostringstream z(zeile);
                if(bahn_nr == gen::freies_feld) { z.append(b.name); }
                else
                {
                    z.append("Bahn ");
                    z.append(int(b.nummer));
                    if(b.name[0]) { z.append("  "); z.append(b.name); }
                }
                z.append("   Par ");
                z.append(int(b.par));
                gross.generate(0, -70, zeile, texte);
            }

            // Minikarte: Spielfläche 192 Pixel breit, in der Mitte bei y = -4
            const bn::fixed massstab = bn::fixed(192) / fx(b.breite);
            const bn::fixed mitte_x = fx(b.breite) / 2, mitte_y = fx(b.hoehe) / 2;
            auto bild = [&](daten::punkt p, int frame)
            {
                bn::fixed x = (fx(p.x) - mitte_x) * massstab, y = (fx(p.y) - mitte_y) * massstab - 4;
                if(! karte.full())
                {
                    bn::sprite_ptr s = bn::sprite_items::karte.create_sprite(x, y, frame);
                    s.set_z_order(frame >= 3 ? 0 : 1);   // Abwurf und Korb vor den Bäumen
                    karte.push_back(bn::move(s));
                }
            };
            bild(b.abwurf, 3);
            bild(b.korb, 4);
            for(int i = 0; i < b.baeume_anzahl; ++i)
            {
                bn::fixed r = fx(b.baeume[i].r) * massstab;
                bild(b.baeume[i].p, r < 4 ? 0 : r < 6 ? 1 : 2);
            }

            // Kennzahlen der Bahn
            {
                int dx = (b.korb.x.roh - b.abwurf.x.roh) >> 12, dy = (b.korb.y.roh - b.abwurf.y.roh) >> 12;
                bn::string<64> zeile;
                bn::ostringstream z(zeile);
                z.append(bn::sqrt(dx * dx + dy * dy));
                z.append(" m   ");
                z.append(int(b.baeume_anzahl));
                z.append(" Baeume   ");
                z.append(int(b.ob_anzahl));
                z.append(" OB");
                if(b.hat_bowlingbahn) { z.append("   Bowlingbahn"); }
                if(b.mauern_anzahl) { z.append("   Mauer"); }
                if(b.hat_mando) { z.append("   Mando"); }
                if(b.hat_dropzone) { z.append("   Dropzone"); }
                klein.generate(0, 58, zeile, texte);
            }

            // Spieler
            {
                const daten::spieler& s = gen::alle_spieler[spieler_nr];
                bn::string<64> zeile;
                bn::ostringstream z(zeile);
                z.append(s.name);
                z.append(": ");
                z.append(int(s.tasche_anzahl));
                z.append(" Scheiben");
                if(s.lieblingsscheibe_index >= 0)
                {
                    z.append(", Liebling ");
                    z.append(s.tasche[s.lieblingsscheibe_index].name);
                }
                klein.generate(0, 70, zeile, texte);
            }
        }

        bn::core::update();
    }
}

int main()
{
    bn::core::init();

    const int starts = zaehle_start();
    const bool zufall_gleich = zufall_ok();

    while(true)
    {
        // nach jeder Szene ein Bild weiter, sonst zählt der SELECT-Druck gleich für die nächste Szene
        szene_wurf(starts, zufall_gleich);
        bn::core::update();
        szene_daten();
        bn::core::update();
    }
}
