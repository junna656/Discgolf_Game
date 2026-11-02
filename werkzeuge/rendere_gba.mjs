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

const AUDIO = join(WURZEL, "gba", "audio");

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

// Ruf-Dateien aus taschen.js (für die Header: werkzeuge/exportiere_gba.mjs benennt sie gleich)
const rufDateien = [];

// WAV, 8 Bit unsigned, mono
function wav8(proben, rate) {
  const n = proben.length, b = Buffer.alloc(44 + n);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n, 4); b.write("WAVE", 8);
  b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34);
  b.write("data", 36); b.writeUInt32LE(n, 40);
  // leise Web-Lautstärken (0,02–0,06) auf den GBA-Bereich anheben
  const spitze = Math.max(1e-6, ...proben.map(Math.abs)), faktor = 0.9 / spitze;
  proben.forEach((v, i) => b.writeUInt8(Math.max(0, Math.min(255, Math.round(128 + v * faktor * 127))), 44 + i));
  return b;
}

// Stille am Ende abschneiden
function kuerze(proben) {
  let ende = proben.length;
  while (ende > 1 && Math.abs(proben[ende - 1]) < 1e-4) ende--;
  return proben.slice(0, Math.min(proben.length, ende + 64));
}

const browser = await chromium.launch();
const seite = await browser.newPage();
const fehler = [];
seite.on("pageerror", e => fehler.push(e.message));
await seite.goto(pathToFileURL(join(WURZEL, "index.html")).href);
await seite.waitForFunction(() => typeof bahnBild === "function" && typeof BAHNEN !== "undefined");

const anzahl = await seite.evaluate(() => BAHNEN.length);
for (const sp of await seite.evaluate(() => SPIELER.map(s => s.rufDatei || ""))) {
  if (sp) rufDateien.push({ datei: sp, basis: sp.split("/").pop().replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "_") });
}
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
// Porträts (zeichnePortrait in portraets.js), 32 × 32 je Spieler
{
  const urls = await seite.evaluate(() => SPIELER.map(sp => {
    const c = document.createElement("canvas");
    c.width = 32; c.height = 32;
    zeichnePortrait(c.getContext("2d"), sp);
    return c.toDataURL("image/png");
  }));
  urls.forEach((url, i) => writeFileSync(join(TMP, `portraet_${i}.png`), Buffer.from(url.split(",")[1], "base64")));
}

// Töne (sfx in index.html) offline aufnehmen: ton() spielt in actx – dafür ein OfflineAudioContext
const TOENE = ["wurf", "baum", "ast", "landung", "ketten", "ob", "jubel"];
const RATE = 16384;   // Abtastrate für den GBA (Maxmod)
mkdirSync(AUDIO, { recursive: true });
for (const name of TOENE) {
  const proben = await seite.evaluate(async ([name, rate]) => {
    actx = new OfflineAudioContext(1, Math.round(rate * 1.4), rate);
    sfx[name]();
    const puffer = await actx.startRendering();
    actx = null;
    return Array.from(puffer.getChannelData(0));
  }, [name, RATE]);
  writeFileSync(join(AUDIO, `sfx_${name}.wav`), wav8(kuerze(proben), RATE));
}
await browser.close();

// Ruf-Aufnahmen der Spieler (rufDatei in taschen.js) mit ffmpeg umwandeln
for (const sp of rufDateien) {
  const ziel = join(AUDIO, `ruf_${sp.basis}.wav`);
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", join(WURZEL, sp.datei), "-ac", "1", "-ar", String(RATE),
    "-acodec", "pcm_u8", ziel]);
}
if (fehler.length) {
  console.error("Fehler auf der Seite:\n" + fehler.join("\n"));
  process.exit(1);
}

// Farben reduzieren (GBA: 15 Bit, 255 Farben + Index 0 frei) und als BMP für Butano speichern
execFileSync("python3", [join(WURZEL, "werkzeuge", "bmp_fuer_gba.py"), TMP, ZIEL], { stdio: "inherit" });
rmSync(TMP, { recursive: true, force: true });
console.log(`${anzahl} Bahnbilder und Übersichten, Porträts nach gba/graphics, Töne nach gba/audio geschrieben.`);
