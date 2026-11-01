// Mathefunktionen für das Flugmodell (double), ohne libm.
//
// Warum eigene Funktionen? Der GBA-Build von Butano bindet keine Mathe-Bibliothek ein, und mit
// eigenen Funktionen rechnen der GBA und der PC-Test (tests/gba/) Bit für Bit gleich.
// Genauigkeit: wenige Einheiten der letzten Stelle (~1e-15) – Abweichungen zu JavaScript
// (Math.sin usw.) bleiben damit weit unter allem, was man im Spiel sehen könnte.
#ifndef MATHE_H
#define MATHE_H

#include <stdint.h>
#include <string.h>

namespace mathe
{
    constexpr double pi = 3.14159265358979323846;

    inline double betrag(double x) { return x < 0 ? -x : x; }
    inline double min(double a, double b) { return a < b ? a : b; }
    inline double max(double a, double b) { return a > b ? a : b; }
    inline double clamp(double v, double a, double b) { return max(a, min(b, v)); }

    // wie Math.sign (0 bleibt 0)
    inline double vorzeichen(double x) { return x > 0 ? 1 : x < 0 ? -1 : 0; }

    inline uint64_t bits(double x) { uint64_t b; memcpy(&b, &x, sizeof(b)); return b; }
    inline double aus_bits(uint64_t b) { double x; memcpy(&x, &b, sizeof(x)); return x; }

    // Quadratwurzel: Startwert über den Exponenten, dann Newton, zum Schluss eine Rundungskorrektur
    inline double wurzel(double x)
    {
        if(x <= 0) { return 0; }
        double y = aus_bits((bits(x) >> 1) + (uint64_t(1023) << 51));
        for(int i = 0; i < 5; ++i) { y = 0.5 * (y + x / y); }
        // y ist jetzt bis auf eine Einheit genau; die nähere der Nachbarzahlen wählen
        double unten = aus_bits(bits(y) - 1), oben = aus_bits(bits(y) + 1);
        double fehler = betrag(y * y - x);
        if(betrag(unten * unten - x) < fehler) { y = unten; fehler = betrag(unten * unten - x); }
        if(betrag(oben * oben - x) < fehler) { y = oben; }
        return y;
    }

    inline double hypot(double a, double b) { return wurzel(a * a + b * b); }

    namespace detail
    {
        // sin und cos für |r| <= pi/4 (Taylorreihe, Fehler < 1e-17)
        inline double sin_kern(double r)
        {
            double r2 = r * r;
            return r * (1 + r2 * (-1.0 / 6 + r2 * (1.0 / 120 + r2 * (-1.0 / 5040 + r2 * (1.0 / 362880 +
                   r2 * (-1.0 / 39916800 + r2 * (1.0 / 6227020800.0 + r2 * (-1.0 / 1307674368000.0))))))));
        }

        inline double cos_kern(double r)
        {
            double r2 = r * r;
            return 1 + r2 * (-0.5 + r2 * (1.0 / 24 + r2 * (-1.0 / 720 + r2 * (1.0 / 40320 + r2 * (-1.0 / 3628800 +
                   r2 * (1.0 / 479001600 + r2 * (-1.0 / 87178291200.0 + r2 * (1.0 / 20922789888000.0))))))));
        }

        // x = k * pi/2 + r mit |r| <= pi/4 (Cody-Waite, pi/2 in drei Teilen)
        inline double reduziere(double x, int& k)
        {
            constexpr double zwei_durch_pi = 0.63661977236758134308;
            constexpr double p1 = 1.5707963267341256e+00;
            constexpr double p2 = 6.0771005065061922e-11;
            constexpr double p3 = 2.0222662487959506e-21;
            double n = x * zwei_durch_pi;
            n = n >= 0 ? double(int64_t(n + 0.5)) : -double(int64_t(0.5 - n));
            k = int(int64_t(n) & 3);
            return ((x - n * p1) - n * p2) - n * p3;
        }
    }

    inline double sin(double x)
    {
        int k;
        double r = detail::reduziere(x, k);
        switch(k)
        {
        case 0: return detail::sin_kern(r);
        case 1: return detail::cos_kern(r);
        case 2: return -detail::sin_kern(r);
        default: return -detail::cos_kern(r);
        }
    }

    inline double cos(double x)
    {
        int k;
        double r = detail::reduziere(x, k);
        switch(k)
        {
        case 0: return detail::cos_kern(r);
        case 1: return -detail::sin_kern(r);
        case 2: return -detail::cos_kern(r);
        default: return detail::sin_kern(r);
        }
    }

    // Arkustangens für x >= 0
    inline double atan_positiv(double x)
    {
        bool umgekehrt = x > 1;
        if(umgekehrt) { x = 1 / x; }
        // tan(pi/12) = 2 - sqrt(3): darüber um pi/6 verschieben
        constexpr double tan_pi_12 = 0.26794919243112270647;
        constexpr double wurzel3 = 1.73205080756887729353;
        bool verschoben = x > tan_pi_12;
        if(verschoben) { x = (x * wurzel3 - 1) / (wurzel3 + x); }
        // Taylorreihe für |x| <= 0.268
        double x2 = x * x, summe = 0;
        for(int n = 29; n >= 1; n -= 2)
        {
            summe = (((n / 2) % 2) ? -1.0 : 1.0) / n + x2 * summe;
        }
        double a = x * summe;
        if(verschoben) { a += pi / 6; }
        if(umgekehrt) { a = pi / 2 - a; }
        return a;
    }

    // wie Math.atan2(y, x)
    inline double atan2(double y, double x)
    {
        // Vorzeichen von y über das Vorzeichenbit, damit auch -0 wie in JavaScript behandelt wird
        bool y_negativ = (bits(y) >> 63) != 0, x_negativ = (bits(x) >> 63) != 0;
        double a;
        if(y == 0) { a = x_negativ ? pi : 0; }
        else if(x == 0) { a = pi / 2; }
        else
        {
            a = atan_positiv(betrag(y / x));
            if(x < 0) { a = pi - a; }
        }
        return y_negativ ? -a : a;
    }

    // natürlicher Logarithmus für x > 0
    inline double log(double x)
    {
        constexpr double ln2 = 0.69314718055994530942;
        constexpr double wurzel_halb = 0.70710678118654752440;
        uint64_t b = bits(x);
        int e = int((b >> 52) & 0x7FF) - 1023;
        double m = aus_bits((b & 0x000FFFFFFFFFFFFFull) | (uint64_t(1023) << 52));   // 1 <= m < 2
        if(m > 2 * wurzel_halb) { m *= 0.5; ++e; }                                      // m in [0.707, 1.414]
        // log(m) = 2 atanh(s), s = (m - 1) / (m + 1), |s| <= 0.172
        double s = (m - 1) / (m + 1), s2 = s * s, summe = 0;
        for(int n = 25; n >= 1; n -= 2) { summe = 1.0 / n + s2 * summe; }
        return e * ln2 + 2 * s * summe;
    }

    // wie Math.round (x.5 rundet Richtung +unendlich)
    inline double runde(double x)
    {
        double f = x >= 0 ? double(int64_t(x)) : -double(int64_t(-x));   // abgeschnitten
        if(f > x) { f -= 1; }                                              // floor
        return (x - f >= 0.5) ? f + 1 : f;
    }
}

#endif
