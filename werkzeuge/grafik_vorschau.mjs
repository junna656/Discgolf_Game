// Rendert Vorher/Nachher-Bilder einer Bahn mit dem Prototyp aus grafik_vorschau.js.
// Aufruf: node werkzeuge/grafik_vorschau.mjs [bahnnummer] [zielordner]
// Ergebnis: <ziel>/grafik_bahn<n>_{vorher,fruehling,sommer,herbst,winter}_z{1,3}.png (Pixel 1:1)
import { createRequire } from "module";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import fs from "fs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nr = Number(process.argv[2] || 1);
const ziel = path.resolve(process.argv[3] || path.join(wurzel, "docs/bilder"));
fs.mkdirSync(ziel, { recursive: true });

const browser = await chromium.launch();
const seite = await browser.newPage();
seite.on("pageerror", e => console.error("Fehler auf der Seite:", e.message));
await seite.goto(pathToFileURL(path.join(wurzel, "index.html")).href);
await seite.addScriptTag({ path: path.join(wurzel, "werkzeuge/grafik_vorschau.js") });
for (const z of [1, 3]) {
  const bilder = await seite.evaluate(([nr, z]) => {
    bahn = BAHNEN.find(b => b.nummer === nr);
    const alt = S; S = S0 * z;
    const bilder = { vorher: zeichneHintergrund(z).toDataURL() };
    for (const jahreszeit of Object.keys(JAHRESZEITEN)) bilder[jahreszeit] = zeichneHintergrundDetail(z, { jahreszeit }).toDataURL();
    S = alt;
    return bilder;
  }, [nr, z]);
  for (const [name, url] of Object.entries(bilder)) {
    const datei = path.join(ziel, `grafik_bahn${nr}_${name}_z${z}.png`);
    fs.writeFileSync(datei, Buffer.from(url.split(",")[1], "base64"));
    console.log(datei);
  }
}
await browser.close();
