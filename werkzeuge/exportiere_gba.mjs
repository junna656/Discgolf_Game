// Erzeugt die C++-Header der GBA-Version aus der Webversion (eine Quelle für beides).
//
//   node werkzeuge/exportiere_gba.mjs            gba/include/gen_*.h neu schreiben
//   node werkzeuge/exportiere_gba.mjs --pruefen  nur vergleichen; Fehler, wenn etwas veraltet ist
//
// Erzeugt: Versionsnummer, Testwerte für den Zufallsgenerator, Kurse und Bahnen,
// Spieler und Taschen, Stellschrauben des Flugmodells.
// Die Datentypen dazu stehen in gba/include/daten.h.

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
const { Physik, KURSE, FREIES_FELD, BAHNEN, SPIELER } = ctx;

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

// ============================================================
//  Hilfen für C++-Code
// ============================================================
const UMLAUTE = { "ä": "ae", "ö": "oe", "ü": "ue", "Ä": "Ae", "Ö": "Oe", "Ü": "Ue", "ß": "ss", "é": "e", "è": "e", "á": "a", "·": "-", "–": "-", "’": "'" };
// Texte für die GBA-Schrift (nur ASCII)
function ascii(t, wo) {
  if (t === undefined || t === null) return "";
  let r = "";
  for (const ch of String(t)) {
    if (ch.charCodeAt(0) < 127) r += ch;
    else if (UMLAUTE[ch] !== undefined) r += UMLAUTE[ch];
    else throw new Error(`Zeichen „${ch}“ in „${t}“ (${wo}) fehlt in UMLAUTE (werkzeuge/exportiere_gba.mjs)`);
  }
  return r;
}
const str = (t, wo) => JSON.stringify(ascii(t, wo));
const FK_MAX = 2 ** 31 / 4096;
function fk(v, wo) {
  if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`Keine Zahl: ${v} (${wo})`);
  if (Math.abs(v) >= FK_MAX) throw new Error(`Zahl zu groß für Festkomma: ${v} (${wo})`);
  return `{${Math.round(v * 4096)}}`;
}
const pt = (x, y, wo) => `{${fk(x, wo)}, ${fk(y, wo)}}`;
const ptA = (a, wo) => pt(a[0], a[1], wo);
const ptO = (o, wo) => pt(o.x, o.y, wo);
const NULLPUNKT = "{{0}, {0}}";
const bool = b => (b ? "true" : "false");
const bezeichner = t => ascii(t, "Bezeichner").replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

// ============================================================
//  Kurse und Bahnen  →  gen_bahnen.h
// ============================================================
{
  const teile = [];
  const bahnZeilen = [];
  BAHNEN.forEach((b, i) => {
    const wo = `Bahn ${b.nummer}${b.name ? " " + b.name : ""}`;
    const n = `b${i}`;
    // Bäume (Standardhöhe wie in physik.js: 9 m)
    teile.push(`    constexpr baum ${n}_baeume[] = {\n${b.baeume.map(t =>
      `        {${ptO(t, wo)}, ${fk(t.r, wo)}, ${fk(t.h ?? 9, wo)}}`).join(",\n")}\n    };`);
    // OB-Zonen
    const ob = b.ob || [];
    ob.forEach((o, k) => {
      const pts = o.insel || o.punkte || o.linie;
      if (pts) teile.push(`    constexpr punkt ${n}_ob${k}[] = { ${pts.map(p => ptA(p, wo)).join(", ")} };`);
    });
    if (ob.length) {
      teile.push(`    constexpr ob_zone ${n}_ob[] = {\n${ob.map((o, k) => {
        const art = o.insel ? "insel" : o.linie ? "linie" : o.punkte ? "polygon" : "rechteck";
        const pts = o.insel || o.punkte || o.linie;
        if (art === "rechteck" && [o.x, o.y, o.w, o.h].some(v => typeof v !== "number")) throw new Error(`OB-Zone ${k} unbekannt (${wo})`);
        if (art === "linie" && !o.innen) throw new Error(`Grenzlinie ohne innen (${wo})`);
        return `        {ob_art::${art}, ${bool(o.art === "natur")}, ${str(o.name, wo)}, ` +
          `${art === "rechteck" ? [o.x, o.y, o.w, o.h].map(v => fk(v, wo)).join(", ") : "{0}, {0}, {0}, {0}"}, ` +
          `${pts ? `${n}_ob${k}, ${pts.length}` : "nullptr, 0"}, ` +
          `${o.innen ? ptA(o.innen, wo) : NULLPUNKT}, ${fk(o.ab ?? 0, wo)}}`;
      }).join(",\n")}\n    };`);
    }
    // Mauern
    const mauern = b.mauern || [];
    mauern.forEach((m, k) => teile.push(`    constexpr punkt ${n}_mauer${k}[] = { ${m.punkte.map(p => ptA(p, wo)).join(", ")} };`));
    if (mauern.length) {
      // Standardhöhe wie in physik.js: 1,2 m
      teile.push(`    constexpr mauer ${n}_mauern[] = { ${mauern.map((m, k) => `{${n}_mauer${k}, ${m.punkte.length}, ${fk(m.h ?? 1.2, wo)}}`).join(", ")} };`);
    }
    const l = b.bowlingbahn, m = b.mando;
    bahnZeilen.push(`        { // ${ascii(wo, wo)}
            ${b.nummer}, ${str(b.name, wo)}, ${str(b.kurz, wo)}, ${str(b.ort, wo)}, ${b.par},
            ${fk(b.welt.breite, wo)}, ${fk(b.welt.hoehe, wo)}, ${ptO(b.abwurf, wo)}, ${ptO(b.korb, wo)},
            ${n}_baeume, ${b.baeume.length},
            ${ob.length ? `${n}_ob` : "nullptr"}, ${ob.length},
            ${mauern.length ? `${n}_mauern` : "nullptr"}, ${mauern.length},
            ${bool(l)}, ${l ? `{${pt(l.x1, l.y1, wo)}, ${pt(l.x2, l.y2, wo)}, ${fk(l.breite, wo)}}` : `{${NULLPUNKT}, ${NULLPUNKT}, {0}}`},
            ${bool(b.dropzone)}, ${b.dropzone ? ptO(b.dropzone, wo) : NULLPUNKT},
            ${bool(m)}, ${m ? `{${ptA(m.a, wo)}, ${ptA(m.b, wo)}, ${bool(m.dropzone)}, ${m.dropzone ? ptO(m.dropzone, wo) : NULLPUNKT}}` : `{${NULLPUNKT}, ${NULLPUNKT}, false, ${NULLPUNKT}}`}
        }`);
  });
  let erste = 0;
  const kurse = KURSE.map(k => {
    const z = `        {${str(k.id, "Kurs")}, ${str(k.name, "Kurs")}, ${str(k.ort, "Kurs")}, ${erste}, ${k.bahnen.length}}`;
    erste += k.bahnen.length;
    return z;
  });
  if (BAHNEN[erste] !== FREIES_FELD) throw new Error("BAHNEN: freies Feld nicht nach den Kursen");

  dateien["gen_bahnen.h"] = `${KOPF}// Quelle: bahnen.js
#ifndef GEN_BAHNEN_H
#define GEN_BAHNEN_H

#include "daten.h"

namespace gen
{
    using namespace daten;

${teile.join("\n")}

    // alle Bahnen in derselben Reihenfolge wie window.BAHNEN (Kurse, dann freies Feld)
    constexpr int bahnen_anzahl = ${BAHNEN.length};
    constexpr bahn bahnen[bahnen_anzahl] = {
${bahnZeilen.join(",\n")}
    };

    constexpr int kurse_anzahl = ${KURSE.length};
    constexpr kurs kurse[kurse_anzahl] = {
${kurse.join(",\n")}
    };

    constexpr int freies_feld = ${erste};
}

#endif
`;
}

// ============================================================
//  Spieler und Taschen  →  gen_taschen.h
// ============================================================
{
  const lieblingMatch = html.match(/LIEBLING_STANDARD\s*=\s*\{\s*streuung:\s*([\d.]+),\s*weite:\s*([\d.]+)\s*\}/);
  if (!lieblingMatch) throw new Error("LIEBLING_STANDARD in index.html nicht gefunden");
  const LIEBLING_STANDARD = { streuung: +lieblingMatch[1], weite: +lieblingMatch[2] };
  const TYPEN = { Driver: "driver", Fairway: "fairway", Midrange: "midrange", Putter: "putter" };
  const farbe = hex => {
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || "");
    if (!m) throw new Error(`Farbe ${hex} unbekannt`);
    const [r, g, b] = m.slice(1).map(h => parseInt(h, 16) >> 3);
    return "0x" + (r | (g << 5) | (b << 10)).toString(16).toUpperCase().padStart(4, "0");
  };
  const st = (o, wo) => o ? `{true, ${fk(o.streuung ?? 1, wo)}, ${fk(o.weite ?? 1, wo)}}` : "{false, {4096}, {4096}}";

  const teile = [], zeilen = [];
  SPIELER.forEach((sp, i) => {
    const wo = `Spieler ${sp.name}`;
    teile.push(`    constexpr scheibe s${i}_tasche[] = {\n${sp.tasche.map(d => {
      if (!TYPEN[d.typ]) throw new Error(`Scheibentyp ${d.typ} unbekannt (${wo}, ${d.name})`);
      return `        {${str(d.name, wo)}, scheiben_typ::${TYPEN[d.typ]}, ${[d.speed, d.glide, d.turn, d.fade].map(v => fk(v, wo + " " + d.name)).join(", ")}, ${bool(d.standard)}}`;
    }).join(",\n")}\n    };`);
    const s = sp.staerken || {}, lieb = (sp.karte || {}).lieblingsscheibe || "";
    const liebIndex = sp.tasche.findIndex(d => d.name === lieb);
    if (lieb && liebIndex < 0) throw new Error(`Lieblingsscheibe ${lieb} nicht in der Tasche (${wo})`);
    if (sp.hand !== "rechts" && sp.hand !== "links") throw new Error(`hand ${sp.hand} unbekannt (${wo})`);
    zeilen.push(`        { // ${ascii(sp.name, wo)}
            ${str(sp.name, wo)}, ${farbe(sp.farbe)}, ${bool(sp.hand === "links")}, ${bool(sp.wurfart === "vorhand")}, ${fk(s.putten ?? 1, wo)},
            ${st(s.rueckhand, wo)}, ${st(s.vorhand, wo)}, ${st(s.hyzer, wo)}, ${st(s.anhyzer, wo)}, ${st(s.sline, wo)}, ${st(s.lieblingsscheibe || LIEBLING_STANDARD, wo)},
            ${liebIndex}, s${i}_tasche, ${sp.tasche.length}
        }`);
  });
  dateien["gen_taschen.h"] = `${KOPF}// Quelle: taschen.js (Standard der Lieblingsscheibe: LIEBLING_STANDARD in index.html)
#ifndef GEN_TASCHEN_H
#define GEN_TASCHEN_H

#include "daten.h"

namespace gen
{
    using namespace daten;

${teile.join("\n")}

    constexpr int spieler_anzahl = ${SPIELER.length};
    constexpr spieler alle_spieler[spieler_anzahl] = {
${zeilen.join(",\n")}
    };
}

#endif
`;
}

// ============================================================
//  Stellschrauben des Flugmodells  →  gen_einstellungen.h
// ============================================================
{
  const S = Physik.STANDARD;
  // als double, genau wie in JS (das Flugmodell rechnet in double; gerundete Werte würden z. B.
  // die Baum-Entscheidung "Zufall < 0,45" knapp verschieben)
  const zeilen = Object.entries(S).map(([k, v]) => {
    if (typeof v !== "number") throw new Error(`STANDARD.${k} ist keine Zahl`);
    return `    constexpr double ${bezeichner(k)} = ${Number.isInteger(v) ? v + ".0" : v};`;
  });
  dateien["gen_einstellungen.h"] = `${KOPF}// Quelle: STANDARD in physik.js
#ifndef GEN_EINSTELLUNGEN_H
#define GEN_EINSTELLUNGEN_H

namespace gen::einstellungen
{
${zeilen.join("\n")}
}

#endif
`;
}

// ============================================================
//  Bahnbilder  →  gen_bahn_bilder.h  (die Bilder selbst: werkzeuge/rendere_gba.mjs)
// ============================================================
{
  const nn = i => String(i).padStart(2, "0");
  dateien["gen_bahn_bilder.h"] = `${KOPF}// Bahnbilder aus der Webversion (gba/graphics/bahn_NN.bmp, erzeugt von werkzeuge/rendere_gba.mjs)
// Nur für den GBA-Build (braucht Butano).
#ifndef GEN_BAHN_BILDER_H
#define GEN_BAHN_BILDER_H

${BAHNEN.map((b, i) => `#include "bn_palette_bitmap_items_bahn_${nn(i)}.h"`).join("\n")}

namespace gen
{
    constexpr int bahn_bild_breite = 512, bahn_bild_hoehe = 288;

    // in derselben Reihenfolge wie bahnen[]
    constexpr const bn::palette_bitmap_item* bahn_bilder[] = {
${BAHNEN.map((b, i) => `        &bn::palette_bitmap_items::bahn_${nn(i)},`).join("\n")}
    };
}

#endif
`;
}

// ============================================================
//  Prüfwerte für tests/gba/daten_test.cpp (aus den JS-Daten berechnet)
// ============================================================
{
  const summe = (liste, f) => liste.reduce((a, x) => a + f(x), 0);
  const w = {
    baeume: summe(BAHNEN, b => b.baeume.length),
    baum_radien: summe(BAHNEN, b => summe(b.baeume, t => t.r)),
    baum_x: summe(BAHNEN, b => summe(b.baeume, t => t.x)),
    ob_zonen: summe(BAHNEN, b => (b.ob || []).length),
    ob_punkte: summe(BAHNEN, b => summe(b.ob || [], o => (o.insel || o.punkte || o.linie || []).length)),
    korb_y: summe(BAHNEN, b => b.korb.y),
    par: summe(BAHNEN, b => b.par),
    scheiben: summe(SPIELER, s => s.tasche.length),
    turn: summe(SPIELER, s => summe(s.tasche, d => d.turn)),
    speed: summe(SPIELER, s => summe(s.tasche, d => d.speed)),
  };
  dateien["gen_pruefwerte.h"] = `${KOPF}// Summen über die JS-Daten – tests/gba/daten_test.cpp rechnet sie in C++ nach
#ifndef GEN_PRUEFWERTE_H
#define GEN_PRUEFWERTE_H

namespace gen::pruefwerte
{
${Object.entries(w).map(([k, v]) => `    constexpr double ${k} = ${v};`).join("\n")}
}

#endif
`;
}

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
