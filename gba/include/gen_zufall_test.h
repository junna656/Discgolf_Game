// ERZEUGT von werkzeuge/exportiere_gba.mjs – nicht von Hand bearbeiten
#ifndef GEN_ZUFALL_TEST_H
#define GEN_ZUFALL_TEST_H

#include <stdint.h>

// Je Startwert die ersten 8 Zahlen von Physik.erzeugeZufall (physik.js), mal 2^32
namespace gen
{
    constexpr int zufall_tests = 5;
    constexpr int zufall_laenge = 8;
    constexpr uint32_t zufall_startwerte[zufall_tests] = { 0x00000001u, 0x0000002Au, 0x013528EDu, 0x5EED0000u, 0xFFFFFFFFu };
    constexpr uint32_t zufall_folgen[zufall_tests][zufall_laenge] = {
        { 0xA087EAF3u, 0x00B349C9u, 0x8706C4EBu, 0xFB2627FDu, 0xF7E79D2Bu, 0x47F66630u, 0x9CE301F0u, 0xB8829F5Cu },
        { 0x99E1EF7Cu, 0x72C32B8Au, 0xDA3B32C0u, 0xAB73B0ADu, 0x2CC09A8Au, 0x86CEC4D3u, 0x45F24514u, 0x9FEF4401u },
        { 0xAC8803C7u, 0xE56E28A2u, 0xC0AB6DE9u, 0x6B798607u, 0x7D9AA57Eu, 0x29FE039Eu, 0xC120B5BFu, 0xF76F4369u },
        { 0x9E8EDFB6u, 0x1DA874E3u, 0x8EC1D789u, 0x4377C70Cu, 0x2DF94316u, 0x8F4C2143u, 0xEDA279A7u, 0xBCD7BFBBu },
        { 0xE57BF3D3u, 0x3081A5A4u, 0xB7350390u, 0xF1ADE904u, 0xD8616A2Fu, 0x8A051437u, 0xAE35198Du, 0x79BF17C9u }
    };
}

#endif
