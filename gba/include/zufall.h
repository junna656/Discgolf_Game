// Zufallsgenerator mulberry32 – Bit für Bit gleich wie Physik.erzeugeZufall in physik.js.
// Läuft auf dem GBA und nativ auf dem PC (für die Tests in tests/gba/).
#ifndef ZUFALL_H
#define ZUFALL_H

#include <stdint.h>

class zufall
{
public:
    explicit zufall(uint32_t startwert) : _a(startwert) {}

    // nächste 32-Bit-Zahl (in physik.js geteilt durch 2^32 → 0 ≤ x < 1)
    uint32_t naechste()
    {
        _a += 0x6D2B79F5u;
        uint32_t t = (_a ^ (_a >> 15)) * (1u | _a);
        t = (t + ((t ^ (t >> 7)) * (61u | t))) ^ t;
        return t ^ (t >> 14);
    }

private:
    uint32_t _a;
};

#endif
