// Boogie Garanten – GBA-Version: Hauptmenü, Bahnauswahl, Start.
//
//  - Hauptmenü:      Single Flight (Spieler mit ◀ ▶), Vierer Flight (Hot-Seat), Einzelne Bahn
//  - Runde/Spiel:    gba/src/spiel.cpp (szene_runde)
//  - Bahnauswahl:    Übersicht jeder Bahn, A spielt sie, B macht einen Testwurf (Flugbahn, Rechenzeit)
//  - Selbsttests:    Zufall wie physik.js („Zufall: OK“), Speichern (Zähler „Starts“ im SRAM)
//  - BG_BENCHMARK:   Messung der Wurfzeit für GitHub Actions (mGBA)

#include "bn_core.h"
#include "bn_keypad.h"
#include "bn_sram.h"
#include "bn_string.h"
#include "bn_vector.h"
#include "bn_palette_bitmap_roi.h"
#include "bn_palette_bitmap_bg_painter.h"
#include "bn_palette_bitmap_bg_ptr.h"
#include "bn_optional.h"
#include "bn_math.h"
#include "bn_bg_palettes.h"
#include "bn_sprite_ptr.h"
#include "bn_sprite_text_generator.h"

#include "bn_sprite_items_scheibe.h"
#include "bn_sprite_items_korb.h"
#include "common_variable_8x8_sprite_font.h"
#include "common_variable_8x16_sprite_font.h"

#include "bn_sprite_items_karte.h"

#include "bn_timer.h"
#include "bn_timers.h"
#include "bn_log.h"

#include "physik.h"
#include "mathe.h"
#include "spiel.h"
#include "gen_version.h"

// Kennung des Builds (git-Commit), vom Makefile gesetzt
#ifndef BG_KENNUNG
    #define BG_KENNUNG "lokal"
#endif
#include "gen_bahnen.h"
#include "gen_taschen.h"
#include "gen_bahn_bilder.h"
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

}

// Hauptmenü: Single Flight (Spieler wählen), Vierer Flight, Einzelne Bahn (Bahnauswahl)
enum class auswahl { single, vierer, bahn };

auswahl szene_menue(int starts, bool zufall_gleich, int& spieler_nr, uint32_t& bilder)
{
    bn::bg_palettes::set_transparent_color(bn::color(7, 15, 6)); // Wiese

    bn::sprite_text_generator gross(common::variable_8x16_sprite_font);
    bn::sprite_text_generator klein(common::variable_8x8_sprite_font);
    gross.set_center_alignment();
    klein.set_center_alignment();

    bn::vector<bn::sprite_ptr, 40> feste_texte;
    gross.generate(0, -66, "BOOGIE GARANTEN", feste_texte);
    klein.generate(0, -50, "Retro-Edition  v" BG_VERSION "  (" BG_KENNUNG ")", feste_texte);
    {
        bn::string<48> zeile;
        bn::ostringstream z(zeile);
        z.append(zufall_gleich ? "Zufall: OK" : "Zufall: FEHLER!");
        z.append("   Starts: ");
        z.append(starts);
        klein.generate(0, 72, zeile, feste_texte);
    }
    klein.generate(0, 56, "Hoch/Runter: waehlen   A: los", feste_texte);

    bn::sprite_ptr korb = bn::sprite_items::korb.create_sprite(96, 34);
    bn::sprite_ptr scheibe = bn::sprite_items::scheibe.create_sprite(-96, 42);

    int wahl = 0;
    bool neu = true;
    bn::vector<bn::sprite_ptr, 40> eintraege;

    while(true)
    {
        ++bilder;
        if(bn::keypad::up_pressed()) { wahl = (wahl + 2) % 3; neu = true; }
        if(bn::keypad::down_pressed()) { wahl = (wahl + 1) % 3; neu = true; }
        if(wahl == 0 && bn::keypad::left_pressed()) { spieler_nr = (spieler_nr + gen::spieler_anzahl - 1) % gen::spieler_anzahl; neu = true; }
        if(wahl == 0 && bn::keypad::right_pressed()) { spieler_nr = (spieler_nr + 1) % gen::spieler_anzahl; neu = true; }
        if(bn::keypad::a_pressed() || bn::keypad::start_pressed()) { return auswahl(wahl); }

        if(neu)
        {
            neu = false;
            eintraege.clear();
            for(int i = 0; i < 3; ++i)
            {
                bn::string<48> zeile;
                bn::ostringstream z(zeile);
                z.append(i == wahl ? "> " : "  ");
                if(i == 0)
                {
                    z.append("Single Flight:  ");
                    if(wahl == 0) { z.append("< "); }
                    z.append(gen::alle_spieler[spieler_nr].name);
                    if(wahl == 0) { z.append(" >"); }
                }
                else if(i == 1) { z.append("Vierer Flight"); }
                else { z.append("Einzelne Bahn"); }
                z.append(i == wahl ? " <" : "  ");
                gross.generate(0, -26 + i * 18, zeile, eintraege);
            }
        }

        // die Scheibe schwebt ein wenig hin und her
        scheibe.set_y(42 + bn::fixed(int((bilder / 8) % 6) - 3) / 2);
        bn::core::update();
    }
}

// Ein Testwurf mit dem Flugmodell: Lieblingsscheibe (sonst Standardscheibe) vom Abwurf Richtung Korb,
// Kraft passend zur Länge, flach, ohne Wind.
BN_DATA_EWRAM_BSS physik::ergebnis testergebnis;   // groß – nicht auf den Stack und nicht in den IWRAM

// Während der Berechnung: spätestens nach einem halben Bild weiterzeichnen (bn::core::update),
// damit das Spiel nicht stockt. Die Physik rechnet dabei unverändert weiter.
struct fortschritt
{
    bn::timer seit_bild;
    int max_am_stueck = 0;      // längste Rechenstrecke ohne neues Bild (Ticks)
    int bild_ticks = 0;         // Zeit für das Zeichnen zwischendurch (Ticks)
    int bilder = 0;
    bool aktualisieren = true;  // false: nur messen (Benchmark)
    void (*zeichne)(const physik::ergebnis& e, void* ctx) = nullptr;
    void* ctx = nullptr;
};

void bei_schritt(const physik::ergebnis& e, void* daten)
{
    fortschritt& f = *static_cast<fortschritt*>(daten);
    const int am_stueck = f.seit_bild.elapsed_ticks();
    if(am_stueck < bn::timers::ticks_per_frame() / 2) { return; }
    f.max_am_stueck = bn::max(f.max_am_stueck, am_stueck);
    bn::timer zeichnen;
    if(f.zeichne) { f.zeichne(e, f.ctx); }
    if(f.aktualisieren) { bn::core::update(); }
    ++f.bilder;
    f.bild_ticks += zeichnen.elapsed_ticks();
    f.seit_bild.restart();
}

int ticks_zu_ms(int ticks)
{
    return int(int64_t(ticks) * 1000 / bn::timers::ticks_per_second());
}

// Gibt die reine Rechenzeit in ms zurück (ohne das Zeichnen zwischendurch)
int testwurf(int bahn_nr, int spieler_nr, uint32_t startwert, const daten::scheibe*& scheibe_aus, fortschritt& f)
{
    static zufall z(1);
    z = zufall(startwert);
    physik::setze_zufall(z);

    const daten::bahn& b = gen::bahnen[bahn_nr];
    const daten::spieler& sp = gen::alle_spieler[spieler_nr];
    int si = sp.lieblingsscheibe_index;
    if(si < 0)
    {
        si = 0;
        for(int k = 0; k < sp.tasche_anzahl; ++k) { if(sp.tasche[k].standard) { si = k; } }
    }
    const daten::scheibe& scheibe = sp.tasche[si];
    scheibe_aus = &scheibe;
    const physik::punkt ab = physik::zu_punkt(b.abwurf), ko = physik::zu_punkt(b.korb);
    const daten::staerke& st = sp.vorhand ? sp.vorhand_staerke : sp.rueckhand;

    physik::wurf w;
    w.x = ab.x;
    w.y = ab.y;
    w.richtung = mathe::atan2(ko.y - ab.y, ko.x - ab.x);
    w.kraft = physik::kraft_fuer(scheibe, mathe::hypot(ko.x - ab.x, ko.y - ab.y));
    w.winkel = 0;
    w.scheibe = &scheibe;
    w.links = sp.linkshaender;
    w.vorhand = sp.vorhand;
    w.streu_faktor = st.gesetzt ? physik::zahl(st.streuung) : 1;
    w.weite_faktor = st.gesetzt ? physik::zahl(st.weite) : 1;

    bn::timer uhr;
    f.seit_bild.restart();
    physik::setze_rueckruf(bei_schritt, &f);
    physik::wurf g = physik::streue(w);
    physik::simuliere(b, g, { 0, 0 }, testergebnis);
    physik::setze_rueckruf(nullptr, nullptr);
    f.max_am_stueck = bn::max(f.max_am_stueck, f.seit_bild.elapsed_ticks());
    return ticks_zu_ms(uhr.elapsed_ticks() - f.bild_ticks);
}

#ifdef BG_BENCHMARK
// Messung für GitHub Actions: rechnet einige Würfe und schreibt die Zeiten ins mGBA-Log
void benchmark()
{
    const int bahnen[] = { 0, 8, gen::freies_feld };
    for(int b : bahnen)
    {
        for(int k = 0; k < 3; ++k)
        {
            const daten::scheibe* s = nullptr;
            fortschritt f;
            int ms = testwurf(b, 0, uint32_t(1000 + k), s, f);
            BN_LOG("BENCH Bahn-Index ", b, " Wurf ", k, ": ", ms, " ms gerechnet, max. ", ticks_zu_ms(f.max_am_stueck),
                   " ms am Stueck, ", f.bilder, " Bilder, Pfad ", testergebnis.pfad_laenge,
                   ", Typ ", int(testergebnis.art), ", ", int(testergebnis.distanz), " m");
        }
    }
    // Läuft das Spiel in Echtzeit? 120 Bilder (bn::core::update) sollten ~2 s dauern
    {
        bn::timer uhr;
        for(int i = 0; i < 120; ++i) { bn::core::update(); }
        BN_LOG("BENCH 120 Bilder: ", ticks_zu_ms(uhr.elapsed_ticks()), " ms (Soll ~2009 ms)");
    }
    BN_LOG("BENCH ENDE");
}
#endif

// Szene 2: Bahnen und Spieler aus den erzeugten Daten (bahnen.js, taschen.js) ansehen.
// Links/Rechts: Bahn, L/R: Spieler, A/START: spielen, B: Testwurf, SELECT: zurück
void szene_daten()
{
    bn::bg_palettes::set_transparent_color(bn::color(0, 0, 0));

    bn::sprite_text_generator gross(common::variable_8x16_sprite_font);
    bn::sprite_text_generator klein(common::variable_8x8_sprite_font);
    gross.set_center_alignment();
    klein.set_center_alignment();

    int bahn_nr = 0, spieler_nr = 0;
    bool neu = true;
    bn::vector<bn::sprite_ptr, 24> texte;
    bn::vector<bn::sprite_ptr, 12> kennzahl;
    bn::vector<bn::sprite_ptr, 64> karte;
    bn::vector<bn::sprite_ptr, 26> flug;
    bn::fixed massstab, mitte_x, mitte_y;
    uint32_t bilder = 0;

    // Übersicht der Bahn (gerendert aus der Webversion) als Bitmap-Hintergrund, ganze Bildschirmbreite
    constexpr int oben = 13;   // Bildzeile, in der die Übersicht beginnt
    bn::optional<bn::palette_bitmap_bg_ptr> hintergrund;
    int noch_zeichnen = 0;     // Seiten, die die Übersicht noch bekommen müssen (Doppelpuffer)

    while(! bn::keypad::select_pressed())
    {
        ++bilder;
        if(bn::keypad::left_pressed()) { bahn_nr = (bahn_nr + gen::bahnen_anzahl - 1) % gen::bahnen_anzahl; neu = true; }
        if(bn::keypad::right_pressed()) { bahn_nr = (bahn_nr + 1) % gen::bahnen_anzahl; neu = true; }
        if(bn::keypad::l_pressed()) { spieler_nr = (spieler_nr + gen::spieler_anzahl - 1) % gen::spieler_anzahl; neu = true; }
        if(bn::keypad::r_pressed()) { spieler_nr = (spieler_nr + 1) % gen::spieler_anzahl; neu = true; }

        // A oder START: diese Bahn mit diesem Spieler spielen (Etappe 4)
        if(bn::keypad::a_pressed() || bn::keypad::start_pressed())
        {
            texte.clear();
            kennzahl.clear();
            karte.clear();
            flug.clear();
            hintergrund.reset();   // es gibt nur einen Bitmap-Hintergrund
            bn::core::update();
            szene_spiel(bahn_nr, spieler_nr, bilder);
            bn::bg_palettes::set_transparent_color(bn::color(0, 0, 0));
            bn::core::update();
            neu = true;
        }

        if(neu)
        {
            neu = false;
            texte.clear();
            kennzahl.clear();
            karte.clear();
            flug.clear();
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
                gross.generate(0, -72, zeile, texte);
            }

            // Übersicht: Bild der Bahn (240 Pixel breit) ab Zeile "oben"; der Korb als Markierung darüber
            const bn::palette_bitmap_item& uebersicht = *gen::uebersichten[bahn_nr];
            // nur einmal anlegen: ein Bitmap-Hintergrund belegt den ganzen Grafikspeicher, und Butano gibt
            // einen alten erst beim nächsten Bild frei – beim Blättern nur Farben und Bild tauschen
            if(hintergrund) { hintergrund->set_palette(uebersicht.palette_item()); }
            else { hintergrund = bn::palette_bitmap_bg_ptr::create(uebersicht.palette_item()); }
            noch_zeichnen = 2;
            massstab = bn::fixed(gen::uebersicht_breite) / fx(b.breite);
            mitte_x = fx(b.breite) / 2;
            mitte_y = fx(b.hoehe) / 2;
            {
                bn::fixed x = (fx(b.korb.x) - mitte_x) * massstab, y = (fx(b.korb.y) - mitte_y) * massstab;
                bn::sprite_ptr s = bn::sprite_items::karte.create_sprite(x, y, 4);
                s.set_z_order(0);
                karte.push_back(bn::move(s));
            }

            // Länge und Hinweis
            {
                int dx = (b.korb.x.roh - b.abwurf.x.roh) >> 12, dy = (b.korb.y.roh - b.abwurf.y.roh) >> 12;
                bn::string<64> zeile;
                bn::ostringstream z(zeile);
                z.append(bn::sqrt(dx * dx + dy * dy));
                z.append(" m     A: spielen     B: Testwurf");
                klein.generate(0, 61, zeile, kennzahl);
            }

            // Spieler
            {
                const daten::spieler& s = gen::alle_spieler[spieler_nr];
                bn::string<64> zeile;
                bn::ostringstream z(zeile);
                z.append("L/R ");
                z.append(s.name);
                z.append(": ");
                z.append(int(s.tasche_anzahl));
                z.append(" Scheiben");
                if(s.lieblingsscheibe_index >= 0)
                {
                    z.append(", Liebling ");
                    z.append(s.tasche[s.lieblingsscheibe_index].name);
                }
                klein.generate(0, 72, zeile, texte);
            }
        }

        // Übersicht in beide Seiten des Doppelpuffers zeichnen
        if(hintergrund && noch_zeichnen > 0)
        {
            const bn::palette_bitmap_item& uebersicht = *gen::uebersichten[bahn_nr];
            bn::palette_bitmap_bg_painter painter(*hintergrund);
            painter.clear();
            painter.unsafe_blit(0, oben, bn::palette_bitmap_roi(uebersicht.pixels_item(), 0, 0,
                                gen::uebersicht_breite, gen::uebersicht_hoehe));
            painter.flip_page_later();
            --noch_zeichnen;
        }

        // B: Testwurf mit dem Flugmodell (physik.bn_iwram.cpp) vom Abwurf Richtung Korb
        if(bn::keypad::b_pressed())
        {
            physik::ergebnis& erg = testergebnis;
            flug.clear();
            kennzahl.clear();

            // Flugbahn als Punkte auf die Minikarte – schon während der Berechnung (jeder 8. Punkt)
            struct zeichner
            {
                bn::vector<bn::sprite_ptr, 26>* flug;
                bn::fixed massstab, mitte_x, mitte_y;
                int naechster = 0;

                void punkt(double x, double y, int frame)
                {
                    if(flug->full()) { return; }
                    bn::fixed kx = (bn::fixed(x) - mitte_x) * massstab, ky = (bn::fixed(y) - mitte_y) * massstab;   // Bildmitte = Bildschirmmitte
                    bn::sprite_ptr sp = bn::sprite_items::karte.create_sprite(kx, ky, frame);
                    sp.set_z_order(0);
                    flug->push_back(bn::move(sp));
                }

                static void bei_bild(const physik::ergebnis& e, void* ctx)
                {
                    zeichner& z = *static_cast<zeichner*>(ctx);
                    while(z.naechster < e.pfad_laenge - 1)   // nur endgültige Punkte
                    {
                        z.punkt(e.pfad[z.naechster].x, e.pfad[z.naechster].y, 5);
                        z.naechster += 8;
                    }
                }
            };
            zeichner zz = { &flug, massstab, mitte_x, mitte_y };
            fortschritt f;
            f.zeichne = zeichner::bei_bild;
            f.ctx = &zz;

            const daten::scheibe* scheibe_p = nullptr;
            const int ms = testwurf(bahn_nr, spieler_nr, bilder * 2654435761u + uint32_t(bahn_nr) * 40503u, scheibe_p, f);
            const daten::scheibe& scheibe = *scheibe_p;
            zeichner::bei_bild(erg, &zz);
            zz.punkt(erg.lie.x, erg.lie.y, 6);

            // Ergebnis statt der Kennzahlen
            bn::string<64> zeile;
            bn::ostringstream zs(zeile);
            zs.append(scheibe.name);
            zs.append(": ");
            zs.append(int(erg.distanz + 0.5));
            zs.append(" m");
            static const char* namen[] = { "", ", Baum", ", Mauer", ", IM KORB!", ", Abpraller", ", BOWLING!" };
            zs.append(namen[int(erg.art)]);
            if(erg.ob) { zs.append(", OB"); }
            if(erg.mando == physik::mando_ergebnis::verpasst) { zs.append(", Mando verpasst"); }
            // Rechenzeit gesamt / längstes Stück ohne neues Bild
            zs.append("  ");
            zs.append(ms);
            zs.append("/");
            zs.append(ticks_zu_ms(f.max_am_stueck));
            zs.append(" ms");
            klein.generate(0, 61, zeile, kennzahl);
        }

        bn::core::update();
    }
}

int main()
{
    bn::core::init();
    physik::vorbereiten();   // Tabellen des Flugmodells füllen (~0,3 s, sonst beim ersten Wurf)

#ifdef BG_BENCHMARK
    benchmark();
#endif

    const int starts = zaehle_start();
    const bool zufall_gleich = zufall_ok();

    int spieler_nr = 0;
    uint32_t bilder = 0;

    while(true)
    {
        const auswahl w = szene_menue(starts, zufall_gleich, spieler_nr, bilder);
        bn::core::update();   // nach jeder Szene ein Bild weiter, sonst zählt der Tastendruck gleich weiter

        if(w == auswahl::bahn) { szene_daten(); }
        else
        {
            // eine Runde über alle Bahnen des ersten Kurses (wie Single/Vierer Flight im Browser)
            runde_stand r;
            r.erste_bahn = gen::kurse[0].erste_bahn;
            r.bahnen = gen::kurse[0].bahnen_anzahl;
            r.anzahl = w == auswahl::single ? 1 : bn::min(gen::spieler_anzahl, max_spieler);
            for(int i = 0; i < r.anzahl; ++i)
            {
                r.spieler[i] = w == auswahl::single ? spieler_nr : i;
                r.reihenfolge[i] = i;
            }
            szene_runde(r, bilder);
        }
        bn::core::update();
    }
}
