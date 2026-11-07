# GBA-Version: eingefroren als `V1.0_GBA` – und wie sie wieder aktiviert werden kann

## Stand

- Die GBA-Version (C++/Butano, für Analogue Pocket und Emulatoren) ist auf dem Branch
  **`V1.0_GBA`** gesichert. Er entspricht `main` zum Release 0.6.1 (Commit `9d318d7`) und enthält
  alles, was zur ROM gehört: `gba/`, `tests/gba/`, die Werkzeuge `exportiere_gba.mjs`,
  `rendere_gba.mjs`, `bmp_fuer_gba.py`, die Action `.github/workflows/gba.yml` und die
  klassische Grafik in `index.html`, aus der die GBA-Bilder gerendert werden.
- Auf `dev`/`main` ist das alles entfernt. Es gibt **keinen Abgleich mehr**: Änderungen an
  `physik.js`, `bahnen.js`, `taschen.js` usw. kommen nicht mehr in der ROM an.
- Die ROM baut man weiter aus dem Branch `V1.0_GBA` (siehe unten).

## ROM aus `V1.0_GBA` bauen

- **GitHub:** Actions → „GBA-ROM“ → *Run workflow* → Branch `V1.0_GBA` wählen. Danach unter
  Artifacts `boogie-garanten-gba-0.6.1` herunterladen.
  (Die Action existiert nur auf diesem Branch. Erscheint sie nicht in der Liste, einmal einen
  beliebigen Commit auf `V1.0_GBA` pushen – sie läuft bei Pushes auf jeden Branch.)
- **Lokal:** `git checkout V1.0_GBA`, devkitARM installieren, `gba/hole_butano.sh`, dann `make -C gba`.

## Wieder aktivieren (GBA wieder mit der Webversion synchron halten)

Was sich seit dem Einfrieren auf `dev` geändert hat und dabei zu beachten ist:

| Änderung auf `dev` | Folge für die GBA-Version |
|---|---|
| Klassische Grafik (`zeichneHintergrund`, klassischer Korb und Putt-Hintergrund) entfernt | `rendere_gba.mjs` rendert damit die Bahnbilder (256 Farben, 512 × 288). Entweder die klassische Grafik aus `V1.0_GBA` wieder herholen (als eigene Datei, z. B. `werkzeuge/grafik_klassisch.js`, die nur das Werkzeug lädt) oder das Werkzeug auf die Detailgrafik (`zeichneHintergrundDetail`) umstellen und die Palette auf 256 Farben reduzieren. |
| Wochenbahnen (`wochenbahnen.js`, `wochen.js`) | Kurs, der jede Woche wechselt – eine ROM ändert sich nicht von selbst. Vorschlag: nur `KURSE` aus `bahnen.js` exportieren (so wie bisher), Wochenbahnen weglassen. Wochenbahnen haben Bäume mit `art` (kaktus/fels) und eigener Höhe `h` und OB mit `art: "flussbett"`; der Export müsste `h` übernehmen, wenn sie doch mit sollen. |
| `referenzwuerfe.mjs` schreibt nur noch `tests/referenz.json` | Den C++-Header `tests/gba/gen_referenz.h` erzeugte der entfernte Teil am Ende des Werkzeugs – aus `V1.0_GBA` zurückholen. |

Schritte:

1. Branch von `dev` anlegen (z. B. `gba-zurueck`).
2. Aus `V1.0_GBA` zurückholen:
   `git checkout V1.0_GBA -- gba tests/gba werkzeuge/exportiere_gba.mjs werkzeuge/rendere_gba.mjs werkzeuge/bmp_fuer_gba.py .github/workflows/gba.yml docs/GBA-PLAN.md`
3. Den C++-Teil von `werkzeuge/referenzwuerfe.mjs` aus `V1.0_GBA` wieder einfügen (Abschnitt
  „Dieselben Würfe als C++-Header“ und die Prüfung von `gen_referenz.h`).
4. Grafik für das Rendern klären (siehe Tabelle) und `werkzeuge/rendere_gba.mjs` anpassen.
5. Physik vergleichen: `git diff V1.0_GBA dev -- physik.js` – jede Änderung auch in
   `gba/src/physik.bn_iwram.cpp` nachziehen. Die Action „GBA-ROM“ vergleicht beide mit den Referenzwürfen.
6. `node werkzeuge/exportiere_gba.mjs` und `node werkzeuge/referenzwuerfe.mjs` ausführen, Header committen.
7. Release-Ablauf in `CLAUDE.md` wieder um `gba/include/gen_version.h` (`BG_VERSION`) ergänzen,
   README-Abschnitt „GBA-Version“ aus `V1.0_GBA` zurückholen.
8. Action „GBA-ROM“ grün? Dann nach `dev` mergen.
