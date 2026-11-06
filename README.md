# Boogie Garanten

8-Bit-Discgolf-Spiel im Browser für Thomas, Daniel, André und Gunnar.
Erster Kurs: der Hyzernauts Discgolfparcours im Volkspark Potsdam mit allen 15 Bahnen –
weitere Kurse folgen.

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
| `portraets.js` | 8-Bit-Porträts der Spieler |
| `grafik.js` | Detailgrafik der Bahnen mit vier Jahreszeiten (Einstellungen → Grafik und Jahreszeit; Standard: nach Datum). Die klassische Grafik in `index.html` bleibt für die GBA-Version |
| `rufe/` | Ruf-Aufnahmen („Achtung, zweite Scheibe!“) |
| `werkzeuge/grafik_vorschau.mjs` | rendert eine Bahn klassisch und in allen Jahreszeiten als PNG (Vergleichsbilder in `docs/GRAFIK-VORSCHLAEGE.md`) |
| `werkzeuge/referenzwuerfe.mjs` | erzeugt `tests/referenz.json` und `tests/gba/gen_referenz.h`: 600 Würfe mit festem Zufall als Referenz für das Flugmodell (Web und GBA) |
| `docs/GBA-PLAN.md` | Plan für eine Game-Boy-Advance-Version |
| `gba/` | GBA-Version (C++/Butano); `gba/include/gen_*.h` (Bahnen, Taschen, Stellschrauben, Version) erzeugt `werkzeuge/exportiere_gba.mjs` aus den JS-Dateien |

Bahn 1, 9 und 15 sind nach Bahnschildern, Fotos und Luftbild nachgebaut, die übrigen
Bahnen nach dem Übersichtsplan der Hyzernauts.

## Entwicklung und Releases

- **Referenzwürfe:** Nach jeder gewollten Änderung an `physik.js`, `bahnen.js` oder `taschen.js`
  `node werkzeuge/referenzwuerfe.mjs` ausführen und `tests/referenz.json` mit committen.
  Die GitHub Action „Physik-Referenz“ prüft das (`--pruefen`). Bei Änderungen an `physik.js`
  muss auch `gba/src/physik.bn_iwram.cpp` angepasst werden – die Action „GBA-ROM“ vergleicht beide.
- Entwickelt wird auf dem Branch `dev`, live ist der Branch `main` (GitHub Pages, www.discgolf-game.de).
  Vorschauen: `dev` unter www.discgolf-game.de/dev/, das Grafik-Update (`dev-graphic`) unter www.discgolf-game.de/dev-graphic/.
- Ein Release übernimmt `dev` nach `main` und erhöht die Versionsnummer (Menü und `?v=` an den Skripten).
- `mehrspieler.js` und `server/` bilden den Online-Multiplayer; der Server wird per GitHub Action zu Cloudflare deployt.

## GBA-Version (Analogue Pocket)

Die GitHub Action „GBA-ROM“ baut bei jedem Push die ROM: **Actions → GBA-ROM → letzter Lauf →
Artifacts → boogie-garanten-gba-…** herunterladen und entpacken.

- **Analogue Pocket:** `.gba`-Datei auf die SD-Karte nach `Assets/gba/common/` kopieren
  (der openFPGA-GBA-Kern braucht dort auch die GBA-BIOS-Datei, siehe Anleitung des Kerns).
- **Emulator:** z. B. mGBA.
- **Selbst bauen:** devkitARM installieren, dann `gba/hole_butano.sh` und `make -C gba`.
- Nach Änderungen an der Webversion `node werkzeuge/exportiere_gba.mjs` ausführen und die
  Header mit committen (die Action prüft das).
