// Einstellungen der GBA-Version (Hauptmenü → Einstellungen), im Spielstand (SRAM) gespeichert.
#ifndef OPTIONEN_H
#define OPTIONEN_H

struct optionen
{
    int flug = 100;     // Fluggeschwindigkeit in % (100 = wie im Browser)
    int pendel = 65;    // Kraftpendel in % (100 = wie im Browser, 1,1 s je Ausschlag)
    int zielen = 100;   // Drehen beim Halten von ▲▼ in % (100 ≈ 24°/s wie im Browser)
    int putt = 150;     // Wackeln des Putt-Fadenkreuzes in % (100 = wie im Browser)
};

// Bestwerte je Spieler (Index in gen::alle_spieler), ebenfalls im Spielstand
struct rekorde
{
    int beste_runde[4] = {};   // Würfe der besten ganzen Runde, 0 = noch keine
    int runden[4] = {};        // gespielte ganze Runden
    int asse[4] = {};          // Asse (1 Wurf) in Runden
    int weitester[4] = {};     // weitester Wurf beim Freien Werfen (m)
};

optionen& opt();
void optionen_speichern();

#endif
