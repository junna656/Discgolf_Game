// ERZEUGT von werkzeuge/exportiere_gba.mjs – nicht von Hand bearbeiten
// Porträts (portraets.js), Töne (sfx in index.html) und Rufe (taschen.js) – nur für den GBA-Build
#ifndef GEN_MEDIEN_H
#define GEN_MEDIEN_H

#include "bn_sprite_items_portraet_0.h"
#include "bn_sprite_items_portraet_1.h"
#include "bn_sprite_items_portraet_2.h"
#include "bn_sprite_items_portraet_3.h"
#include "bn_sound_items.h"

namespace gen
{
    // je Spieler (Reihenfolge wie alle_spieler)
    constexpr const bn::sprite_item* portraets[] = {
        &bn::sprite_items::portraet_0,
        &bn::sprite_items::portraet_1,
        &bn::sprite_items::portraet_2,
        &bn::sprite_items::portraet_3,
    };

    // Ruf, wenn ein Wurf schiefgeht (ruf/rufDatei in taschen.js); ohne Aufnahme nur als Text
    constexpr const char* ruf_texte[] = {
        "Achtung, zweite Scheibe!",
        "",
        "",
        "",
    };
    constexpr const bn::sound_item* ruf_toene[] = {
        &bn::sound_items::ruf_thomas,
        nullptr,
        nullptr,
        nullptr,
    };
}

#endif
