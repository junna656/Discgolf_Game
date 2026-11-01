// ERZEUGT von werkzeuge/exportiere_gba.mjs – nicht von Hand bearbeiten
// Bahnbilder aus der Webversion (gba/graphics/bahn_NN.bmp, erzeugt von werkzeuge/rendere_gba.mjs)
// Nur für den GBA-Build (braucht Butano).
#ifndef GEN_BAHN_BILDER_H
#define GEN_BAHN_BILDER_H

#include "bn_palette_bitmap_items_bahn_00.h"
#include "bn_palette_bitmap_items_uebersicht_00.h"
#include "bn_palette_bitmap_items_bahn_01.h"
#include "bn_palette_bitmap_items_uebersicht_01.h"
#include "bn_palette_bitmap_items_bahn_02.h"
#include "bn_palette_bitmap_items_uebersicht_02.h"
#include "bn_palette_bitmap_items_bahn_03.h"
#include "bn_palette_bitmap_items_uebersicht_03.h"
#include "bn_palette_bitmap_items_bahn_04.h"
#include "bn_palette_bitmap_items_uebersicht_04.h"
#include "bn_palette_bitmap_items_bahn_05.h"
#include "bn_palette_bitmap_items_uebersicht_05.h"
#include "bn_palette_bitmap_items_bahn_06.h"
#include "bn_palette_bitmap_items_uebersicht_06.h"
#include "bn_palette_bitmap_items_bahn_07.h"
#include "bn_palette_bitmap_items_uebersicht_07.h"
#include "bn_palette_bitmap_items_bahn_08.h"
#include "bn_palette_bitmap_items_uebersicht_08.h"
#include "bn_palette_bitmap_items_bahn_09.h"
#include "bn_palette_bitmap_items_uebersicht_09.h"
#include "bn_palette_bitmap_items_bahn_10.h"
#include "bn_palette_bitmap_items_uebersicht_10.h"
#include "bn_palette_bitmap_items_bahn_11.h"
#include "bn_palette_bitmap_items_uebersicht_11.h"
#include "bn_palette_bitmap_items_bahn_12.h"
#include "bn_palette_bitmap_items_uebersicht_12.h"
#include "bn_palette_bitmap_items_bahn_13.h"
#include "bn_palette_bitmap_items_uebersicht_13.h"
#include "bn_palette_bitmap_items_bahn_14.h"
#include "bn_palette_bitmap_items_uebersicht_14.h"
#include "bn_palette_bitmap_items_bahn_15.h"
#include "bn_palette_bitmap_items_uebersicht_15.h"
#include "bn_palette_bitmap_items_putt_ansicht.h"

namespace gen
{
    constexpr int bahn_bild_breite = 512, bahn_bild_hoehe = 288;

    // in derselben Reihenfolge wie bahnen[]
    constexpr const bn::palette_bitmap_item* bahn_bilder[] = {
        &bn::palette_bitmap_items::bahn_00,
        &bn::palette_bitmap_items::bahn_01,
        &bn::palette_bitmap_items::bahn_02,
        &bn::palette_bitmap_items::bahn_03,
        &bn::palette_bitmap_items::bahn_04,
        &bn::palette_bitmap_items::bahn_05,
        &bn::palette_bitmap_items::bahn_06,
        &bn::palette_bitmap_items::bahn_07,
        &bn::palette_bitmap_items::bahn_08,
        &bn::palette_bitmap_items::bahn_09,
        &bn::palette_bitmap_items::bahn_10,
        &bn::palette_bitmap_items::bahn_11,
        &bn::palette_bitmap_items::bahn_12,
        &bn::palette_bitmap_items::bahn_13,
        &bn::palette_bitmap_items::bahn_14,
        &bn::palette_bitmap_items::bahn_15,
    };

    // Putt-Nahansicht aus der Webversion (zeichnePuttHintergrund), 156 × 152;
    // die Ketten-Mitte (KETTEN in index.html) liegt im Bild bei putt_ketten_x/y
    constexpr const bn::palette_bitmap_item& putt_ansicht = bn::palette_bitmap_items::putt_ansicht;
    constexpr int putt_breite = 156, putt_hoehe = 152, putt_ketten_x = 160 - 82, putt_ketten_y = 75 - 11;

    // ganze Bahn auf Bildschirmbreite (240 × 135) für die Bahnauswahl
    constexpr int uebersicht_breite = 240, uebersicht_hoehe = 135;
    constexpr const bn::palette_bitmap_item* uebersichten[] = {
        &bn::palette_bitmap_items::uebersicht_00,
        &bn::palette_bitmap_items::uebersicht_01,
        &bn::palette_bitmap_items::uebersicht_02,
        &bn::palette_bitmap_items::uebersicht_03,
        &bn::palette_bitmap_items::uebersicht_04,
        &bn::palette_bitmap_items::uebersicht_05,
        &bn::palette_bitmap_items::uebersicht_06,
        &bn::palette_bitmap_items::uebersicht_07,
        &bn::palette_bitmap_items::uebersicht_08,
        &bn::palette_bitmap_items::uebersicht_09,
        &bn::palette_bitmap_items::uebersicht_10,
        &bn::palette_bitmap_items::uebersicht_11,
        &bn::palette_bitmap_items::uebersicht_12,
        &bn::palette_bitmap_items::uebersicht_13,
        &bn::palette_bitmap_items::uebersicht_14,
        &bn::palette_bitmap_items::uebersicht_15,
    };
}

#endif
