// ERZEUGT von werkzeuge/exportiere_gba.mjs – nicht von Hand bearbeiten
// Quelle: STANDARD in physik.js
#ifndef GEN_EINSTELLUNGEN_H
#define GEN_EINSTELLUNGEN_H

#include "daten.h"

namespace gen::einstellungen
{
    constexpr daten::fk winkel = {6554};  // 1.6
    constexpr daten::fk turn = {6144};  // 1.5
    constexpr daten::fk fade = {6144};  // 1.5
    constexpr daten::fk weite = {4096};  // 1
    constexpr daten::fk streuung = {4096};  // 1
    constexpr daten::fk wind = {4096};  // 1
    constexpr daten::fk tempo = {2253};  // 0.55
    constexpr daten::fk kick = {4096};  // 1
    constexpr daten::fk zoom_stufe = {12288};  // 3
    constexpr daten::fk baum_abprallen = {1843};  // 0.45
    constexpr daten::fk baum_bremsen = {1229};  // 0.3
}

#endif
