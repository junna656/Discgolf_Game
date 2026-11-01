// Zeichnet alle Bahnen mit dem Code der Webversion (zeichneHintergrund in index.html)
// und legt sie als Bilder für die GBA-Version ab: gba/graphics/bahn_NN.bmp (512 × 288, 8 Bit)
// und gba/graphics/uebersicht_NN.bmp (240 × 135) für die Bahnauswahl, dazu die Putt-Nahansicht
// gba/graphics/putt_ansicht.bmp (156 × 152).
//
//   node werkzeuge/rendere_gba.mjs
//
// Braucht Playwright (Chromium) und Python mit Pillow (für die Farbreduktion).
// Die Bilder werden nicht eingecheckt – GitHub Actions erzeugt sie vor jedem ROM-Build neu,
// damit die GBA-Bahnen immer genau wie im Browser aussehen.

import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), "..");
const TMP = join(WURZEL, "werkzeuge", ".bahnbilder");
const ZIEL = join(WURZEL, "gba", "graphics");
const BREITE = 512;   // Pixel; die Höhe ergibt sich aus 16:9 (288)
const UEBERSICHT = 240;   // Übersicht: 240 × 135

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

const browser = await chromium.launch();
const seite = await browser.newPage();
const fehler = [];
seite.on("pageerror", e => fehler.push(e.message));
await seite.goto(pathToFileURL(join(WURZEL, "index.html")).href);
await seite.waitForFunction(() => typeof bahnBild === "function" && typeof BAHNEN !== "undefined");

const anzahl = await seite.evaluate(() => BAHNEN.length);
for (let i = 0; i < anzahl; i++) {
  // zum Spielen (512 × 288) und als Übersicht für die Bahnauswahl (240 × 135, ganzer Bildschirm breit)
  for (const [name, breite] of [["bahn", BREITE], ["uebersicht", UEBERSICHT]]) {
    const url = await seite.evaluate(([i, breite]) => {
      setzeBahn(BAHNEN[i]);
      return bahnBild(breite / W).toDataURL("image/png");
    }, [i, breite]);
    writeFileSync(join(TMP, `${name}_${String(i).padStart(2, "0")}.png`), Buffer.from(url.split(",")[1], "base64"));
  }
}
// Putt-Nahansicht (zeichnePuttHintergrund in index.html), 156 × 152 mit schwarzem Rand
{
  const url = await seite.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    zeichnePuttHintergrund(c.getContext("2d"));
    const aus = document.createElement("canvas");
    aus.width = 156; aus.height = 152;   // Breite durch 4 teilbar (Butano)
    aus.getContext("2d").drawImage(c, 82, 11, 156, 152, 0, 0, 156, 152);
    return aus.toDataURL("image/png");
  });
  writeFileSync(join(TMP, "putt_ansicht.png"), Buffer.from(url.split(",")[1], "base64"));
}
await browser.close();
if (fehler.length) {
  console.error("Fehler auf der Seite:\n" + fehler.join("\n"));
  process.exit(1);
}

// Farben reduzieren (GBA: 15 Bit, 255 Farben + Index 0 frei) und als BMP für Butano speichern
execFileSync("python3", [join(WURZEL, "werkzeuge", "bmp_fuer_gba.py"), TMP, ZIEL], { stdio: "inherit" });
rmSync(TMP, { recursive: true, force: true });
console.log(`${anzahl} Bahnbilder und Übersichten nach gba/graphics geschrieben.`);
