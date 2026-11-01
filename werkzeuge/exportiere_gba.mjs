// Erzeugt die C++-Header der GBA-Version aus der Webversion (eine Quelle für beides).
//
//   node werkzeuge/exportiere_gba.mjs            gba/include/gen_*.h neu schreiben
//   node werkzeuge/exportiere_gba.mjs --pruefen  nur vergleichen; Fehler, wenn etwas veraltet ist
//
// Bisher: Versionsnummer und Testwerte für den Zufallsgenerator.
// Etappe 2 ergänzt Bahnen, Taschen und Stellschrauben.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), "..");
const ZIEL = join(WURZEL, "gba", "include");
const KOPF = "// ERZEUGT von werkzeuge/exportiere_gba.mjs – nicht von Hand bearbeiten\n";

const ctx = vm.createContext({ Math, Object, Set, Array, JSON, Number });
ctx.window = ctx;
for (const datei of ["bahnen.js", "taschen.js", "physik.js"]) {
  vm.runInContext(readFileSync(join(WURZEL, datei), "utf8"), ctx, { filename: datei });
}
const { Physik } = ctx;

const dateien = {};

// --- Version (wie im Menü der Webversion) ---
const html = readFileSync(join(WURZEL, "index.html"), "utf8");
const version = (html.match(/Version (\d+\.\d+\.\d+)/) || [])[1];
if (!version) throw new Error("Versionsnummer in index.html nicht gefunden");
dateien["gen_version.h"] = `${KOPF}#ifndef GEN_VERSION_H
#define GEN_VERSION_H

#define BG_VERSION "${version}"

#endif
`;

// --- Zufall: erste Werte von erzeugeZufall(startwert) als 32-Bit-Zahlen ---
const STARTWERTE = [1, 42, 20261101, 0x5EED0000, 0xFFFFFFFF];
const folgen = STARTWERTE.map(s => {
  const z = Physik.erzeugeZufall(s);
  return Array.from({ length: 8 }, () => Math.round(z() * 4294967296) >>> 0);
});
const hex = n => "0x" + n.toString(16).toUpperCase().padStart(8, "0") + "u";
dateien["gen_zufall_test.h"] = `${KOPF}#ifndef GEN_ZUFALL_TEST_H
#define GEN_ZUFALL_TEST_H

#include <stdint.h>

// Je Startwert die ersten 8 Zahlen von Physik.erzeugeZufall (physik.js), mal 2^32
namespace gen
{
    constexpr int zufall_tests = ${STARTWERTE.length};
    constexpr int zufall_laenge = 8;
    constexpr uint32_t zufall_startwerte[zufall_tests] = { ${STARTWERTE.map(hex).join(", ")} };
    constexpr uint32_t zufall_folgen[zufall_tests][zufall_laenge] = {
${folgen.map(f => "        { " + f.map(hex).join(", ") + " }").join(",\n")}
    };
}

#endif
`;

const pruefen = process.argv.includes("--pruefen");
let veraltet = [];
for (const [name, inhalt] of Object.entries(dateien)) {
  const pfad = join(ZIEL, name);
  let alt = "";
  try { alt = readFileSync(pfad, "utf8"); } catch { /* fehlt */ }
  if (alt === inhalt) continue;
  if (pruefen) veraltet.push(name); else writeFileSync(pfad, inhalt);
}
if (pruefen && veraltet.length) {
  console.error(`Veraltet: ${veraltet.join(", ")} – bitte  node werkzeuge/exportiere_gba.mjs  ausführen und committen.`);
  process.exit(1);
}
console.log(pruefen ? "GBA-Header aktuell." : `GBA-Header geschrieben (Version ${version}).`);
