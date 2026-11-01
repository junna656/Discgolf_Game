// Spielszene der GBA-Version: Bahnen spielen, allein oder zu viert (Hot-Seat).
#ifndef SPIEL_H
#define SPIEL_H

constexpr int max_spieler = 4, max_bahnen = 18;

// Stand einer Runde über mehrere Bahnen (wie runde/rundenIndex/karte in index.html)
struct runde_stand
{
    int anzahl = 1;                     // Spieler in dieser Runde
    int spieler[max_spieler] = {};      // Index in gen::alle_spieler, je Platz
    int reihenfolge[max_spieler] = {};  // Plätze in Wurfreihenfolge (wer die letzte Bahn am besten spielte, zuerst)
    int erste_bahn = 0;                 // Index in gen::bahnen
    int bahnen = 1;                     // Anzahl Bahnen der Runde
    int index = 0;                      // aktuelle Bahn (0 .. bahnen - 1)
    int karte[max_spieler][max_bahnen] = {};   // Würfe je Platz und Bahn (Scorekarte)
};

// Spielt eine ganze Runde. false = mit START abgebrochen.
bool szene_runde(runde_stand& r, unsigned startwert);

// Eine einzelne Bahn mit einem Spieler (Bahnauswahl)
void szene_spiel(int bahn_nr, int spieler_nr, unsigned startwert);

#endif
