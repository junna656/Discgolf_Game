// Nativer Test (g++ auf dem PC): liefert zufall.h dieselben Zahlen wie physik.js?
//   g++ -std=c++17 -I gba/include tests/gba/zufall_test.cpp -o /tmp/zufall_test && /tmp/zufall_test
#include <cstdio>
#include "zufall.h"
#include "gen_zufall_test.h"

int main()
{
    int fehler = 0;
    for(int i = 0; i < gen::zufall_tests; ++i)
    {
        zufall z(gen::zufall_startwerte[i]);
        for(int k = 0; k < gen::zufall_laenge; ++k)
        {
            uint32_t ist = z.naechste(), soll = gen::zufall_folgen[i][k];
            if(ist != soll)
            {
                std::printf("FEHLER Startwert %08X, Zahl %d: %08X statt %08X\n", gen::zufall_startwerte[i], k, ist, soll);
                ++fehler;
            }
        }
    }
    if(fehler)
        std::printf("Zufall: %d Fehler\n", fehler);
    else
        std::printf("Zufall: alle Werte gleich wie physik.js\n");
    return fehler ? 1 : 0;
}
