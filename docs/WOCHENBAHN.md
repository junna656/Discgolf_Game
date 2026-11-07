# Wochenkurs: Ablauf jede Woche

Jede Woche gibt es einen neuen, zufällig erzeugten Kurs mit eigenem Thema und eigener Bestenliste.
Zurzeit 6 Bahnen pro Woche (`ANZAHL_STANDARD` in `werkzeuge/wochenbahn.mjs`), Ziel später: 18.

## Zeitplan (deutsche Zeit)

| Wann | Was | Wer |
|---|---|---|
| **Donnerstag 18:00** | Abfrage des Themas für die nächste Woche | geplante Aufgabe in Claude Code (neue Session, Push-Nachricht) |
| nach der Antwort | Kurs bauen und auf `dev` pushen → testen unter www.discgolf-game.de/dev/ | Claude in dieser Session |
| bis Sonntag ~20:00 | Befunde gemeinsam fixen (auf `dev`) | du + Claude |
| **Sonntag 11:47** | Prüfung: Gibt es den Kurs für die kommende Woche? Wenn nicht: eigenes Thema ausdenken, Kurs bauen, auf `dev` pushen | geplante Aufgabe in Claude Code |
| **Sonntag ab 20:00** | nur `wochenbahnen.js` wird von `dev` nach `main` kopiert (fehlt der Kurs noch immer: zufällig mit vorhandenem Thema) | Action „Wochenbahn live“ |
| **Montag 0:00** | das Spiel zeigt den neuen Kurs (schaltet selbst nach Datum um), der alte wandert ins Archiv | Spiel |

Die Wochen-Bestenliste: pro Person zählt die beste ganze Runde der Woche (Kurs-ID `woche-<jahr>-<kw>`).
Live gibt es nur die ganze Runde. In der Vorschau `/dev/` sind auch einzelne Bahnen wählbar, und die
Bestenliste heißt `vorschau-woche-…`, Testrunden zählen also nicht.
Archiv mit Siegern und alten Kursen (spielbar ohne Wertung): www.discgolf-game.de/archiv/

## Kurs bauen

```
node werkzeuge/wochenbahn.mjs --thema wueste                      # Kurs für die kommende Woche
node werkzeuge/wochenbahn.mjs --thema wueste --seed 3             # neu würfeln (gleiche Woche wird ersetzt)
node werkzeuge/wochenbahn.mjs --thema wueste --name "Fata Morgana" # Kursname vorgeben (KWxx kommt automatisch dazu)
node werkzeuge/wochenbahn.mjs --thema wueste --bahnen 18          # andere Anzahl Bahnen
node werkzeuge/wochenbahn.mjs --pruefen                           # wochenbahnen.js prüfen
node werkzeuge/grafik_vorschau.mjs                                # (Bilder einer Bahn aus bahnen.js)
```

- Bahntypen der Wüste (zufällig, gewichtet): **quer** (Flussbett quer über die Bahn), **insel** (Korb auf einer Insel
  im Flussbett), **schlucht** (enger Gang zwischen zwei Felswänden), **mando** (Lücke in einem Felsriegel, Mando-Linie),
  **offen** (Kakteenfeld). Dazu Doglegs links/rechts, zufällige Spiegelung und wechselnde Dichte.
- Felsen haben `fest: true`: Die Scheibe prallt immer ab (nie bremsen/durchfliegen), rutscht nicht hinein und bleibt
  nie auf einem Fels liegen. Felswände sind Mauern mit `art: "felswand"`, `h: 30` (nicht zu überfliegen), `breite`
  und `seite` (Felsband liegt außen). Kein Text bei Treffern an Felsen, Kakteen und Felswänden.
- Par per Zufall: ~88 % Par 3 (60–140 m), ~10 % Par 4 (140–200 m), ~2 % Par 5 (201–250 m), `--par` erzwingt.
- Namen: Kurs = Fantasiename + „ KWxx“, jede Bahn einen eigenen Fantasienamen (keiner doppelt; das Thema
  braucht mindestens Anzahl + 1 Namen).
- Der Kurs steht danach als feste Daten in `wochenbahnen.js`; Fixes (Kaktus versetzen, OB ändern …) gehen
  direkt dort von Hand.
- `physik.js`, `bahnen.js` und die Referenzwürfe bleiben unberührt.

## Neues Thema

1. In `werkzeuge/wochenbahn.mjs` unter `THEMEN` einen Eintrag anlegen: `name` (Anzeige), `optik`
   (Schlüssel in `JAHRESZEITEN`), `namen` (mindestens Bahnen + 1 Fantasienamen, für 18 Bahnen also 19+) und `baue(z, g, L)`, das
   Hindernisse (`baeume` mit `r`, `h` und `art`), `ob` und `wege` liefert. Vorlage: `wueste`.
2. Die Optik festlegen – zwei Wege:
   - **ohne Release (bevorzugt für schnelle Themen):** `optikDaten` im Thema angeben: Paletten wie in
     `JAHRESZEITEN.wueste` (gras, aus, fair, weg, flussbett, fels, busch, himmel, laubbaum als Farbliste …),
     `basis` = vorhandene Optik für den Rest, `circle` = [dunkel, hell] für Circle 1 auf hellem Boden, `wueste: true` für Sand-Boden/Kakteen-Szene. Die Daten
     landen mit in `wochenbahnen.js` und gehen so am Sonntag live. Nutzbar sind die vorhandenen Arten:
     Hindernisse `kaktus`, `fels` oder normale Bäume (ohne `art`), OB `flussbett`, Zaun, Linie.
   - **mit Release:** fester Eintrag in `JAHRESZEITEN` (`grafik.js`), neue Hindernis-Arten mit eigener
     Zeichenfunktion wie `zeichneKaktus`/`zeichneFels`, neue Bodenarten wie `flussbett`, eigene Putt-Szene
     wie `wuestenSzene`.
3. Ist das Thema eine Jahreszeit (z. B. Winter), reicht `optik: "winter"`, sonst gibt es keine Jahreszeiten
   auf Wochenbahnen.
4. Bilder prüfen (alle Bahnen, Putt-Ansicht), dann bauen, `--pruefen`, committen, auf `dev` pushen.

## Releases

- Der Wochenkurs braucht kein Release: Die Action kopiert nur `wochenbahnen.js` nach `main`.
- Der Generator (`werkzeuge/`) läuft nur auf `dev` und braucht kein Release.
- Änderungen an Spiel-Code und Grafik (`grafik.js`, `index.html`, `wochen.js`) kommen erst mit einem normalen
  Release nach `main`. **Wichtig:** Braucht ein Thema neue Zeichenarten, muss das Release vor Sonntag 20:00
  live sein, sonst fehlt `main` die Optik (die Bahn erscheint dann in der Jahreszeit-Optik). Sonst `optikDaten` nehmen.
