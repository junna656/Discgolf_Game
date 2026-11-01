// Einstellungen der GBA-Version (Hauptmenü → Einstellungen), im Spielstand (SRAM) gespeichert.
#ifndef OPTIONEN_H
#define OPTIONEN_H

struct optionen
{
    int flug = 100;     // Fluggeschwindigkeit in % (100 = wie im Browser)
    int pendel = 65;    // Kraftpendel in % (100 = wie im Browser, 1,1 s je Ausschlag)
    int zielen = 100;   // Drehen beim Halten von ▲▼ in % (100 ≈ 24°/s wie im Browser)
};

optionen& opt();
void optionen_speichern();

#endif
