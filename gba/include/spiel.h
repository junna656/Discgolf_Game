// Spielszene der GBA-Version: eine Bahn spielen (Etappe 4).
#ifndef SPIEL_H
#define SPIEL_H

// Spielt die Bahn bahn_nr mit Spieler spieler_nr, bis der Korb getroffen ist oder START gedrückt wird.
// startwert: für Wind und Zufall (z. B. aus einem Bildzähler).
void szene_spiel(int bahn_nr, int spieler_nr, unsigned startwert);

#endif
