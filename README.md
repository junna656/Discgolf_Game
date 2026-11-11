# Boogie Garanten

16-Bit-Discgolf-Spiel im Browser für Thomas, Daniel, André und Gunnar.
Erster Kurs: der Hyzernauts Discgolfparcours im Volkspark Potsdam mit allen 15 Bahnen.
Zweiter Kurs: die **Wochenbahn** – jede Woche eine neue, zufällig erzeugte Bahn mit Thema und eigener
Bestenliste (Archiv: www.discgolf-game.de/archiv/, Ablauf: `docs/WOCHENBAHN.md`).

**Spielen:** https://www.discgolf-game.de

## Modi
- **Freies Werfen** auf dem Sportplatz – Weiten testen, ohne Zählen
- **Single Flight** – eine Person spielt die Runde
- **Vierer Flight** – alle vier zusammen, mit Scorekarte

## Dateien
| Datei | Inhalt |
|---|---|
| `index.html` | das Spiel (Grafik, Steuerung, Menü, Anleitung) |
| `taschen.js` | Spieler, Bags mit Flugzahlen, Stärken, Aussehen, Spielerkarten |
| `bahnen.js` | alle Kurse (`KURSE`) mit ihren Bahnen und das freie Feld – ein neuer Kurs ist einfach ein weiterer Eintrag |
| `physik.js` | Flugmodell (Turn, Fade, Hyzer/Anhyzer, Wind, Streuung, Bäume, OB) |
| `portraets.js` | Porträts der Spieler (32 × 32 und fein 64 × 64) |
| `wochenbahnen.js` | alle Wochenbahnen als Daten (erzeugt von `werkzeuge/wochenbahn.mjs`, Fixes von Hand erlaubt) |
| `wochen.js` | wählt die Bahn dieser Woche (Wechsel Montag 0:00) und hängt sie als Kurs an `KURSE` |
| `archiv/` | Archiv der Wochenbahnen mit Siegern; alte Bahnen spielbar über `?woche=<jahr>-<kw>` |
| `grafik.js` | Grafik der Bahnen mit vier Jahreszeiten (Einstellungen → Jahreszeit; Standard: nach Datum) und den Themen-Optiken der Wochenbahnen (z. B. Wüste) |
| `figuren.js` | Spielerfiguren als Sprites (zwei Größen) mit Posen: Stehen, Ausholen (Rückhand/Vorhand), Wurf |
| `rufe/` | Ruf-Aufnahmen („Achtung, zweite Scheibe!“) |
| `werkzeuge/wochenbahn.mjs` | erzeugt eine Wochenbahn aus Thema, Woche und Zufall (`--thema wueste`), prüft `wochenbahnen.js` (`--pruefen`) |
| `werkzeuge/grafik_vorschau.mjs` | rendert eine Bahn in allen Jahreszeiten/Optiken als PNG (Vergleichsbilder in `docs/GRAFIK-VORSCHLAEGE.md`) |
| `werkzeuge/referenzwuerfe.mjs` | erzeugt `tests/referenz.json`: 600 Würfe mit festem Zufall als Referenz für das Flugmodell |
| `docs/WOCHENBAHN.md` | Wochenablauf (Donnerstag Abfrage, Sonntag live, Montag Wechsel), neue Themen |
| `docs/GBA-PLAN.md`, `docs/GBA-REAKTIVIEREN.md` | die eingefrorene GBA-Version (Branch `V1.0_GBA`) und wie sie wieder aufgenommen werden kann |

Bahn 1, 9 und 15 sind nach Bahnschildern, Fotos und Luftbild nachgebaut, die übrigen
Bahnen nach dem Übersichtsplan der Hyzernauts.

## Entwicklung und Releases

- **Referenzwürfe:** Nach jeder gewollten Änderung an `physik.js`, `bahnen.js` oder `taschen.js`
  `node werkzeuge/referenzwuerfe.mjs` ausführen und `tests/referenz.json` mit committen.
  Die GitHub Action „Physik-Referenz“ prüft das (`--pruefen`) und dazu `wochenbahnen.js`.
- Entwickelt wird auf dem Branch `dev`, live ist der Branch `main` (GitHub Pages, www.discgolf-game.de).
  Vorschauen: `dev` unter www.discgolf-game.de/dev/, das Grafik-Update (`dev-graphic`) unter www.discgolf-game.de/dev-graphic/.
- Ein Release übernimmt `dev` nach `main` und erhöht die Versionsnummer (Menü und `?v=` an den Skripten).
- Ausnahme Wochenbahn: Die Action „Wochenbahn live“ kopiert sonntags ab 20:00 nur `wochenbahnen.js` von `dev` nach `main`.
- `mehrspieler.js` und `server/` bilden den Online-Multiplayer; der Server wird per GitHub Action zu Cloudflare deployt.

## GBA-Version (eingefroren)

Die GBA-Version (Analogue Pocket, Emulatoren) ist als Stand 0.6.1 auf dem Branch `V1.0_GBA` gesichert
und wird nicht mehr mit der Webversion abgeglichen. ROM bauen und wieder aktivieren: `docs/GBA-REAKTIVIEREN.md`.
