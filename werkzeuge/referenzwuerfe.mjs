// Referenzwürfe: simuliert viele festgelegte Würfe mit dem Flugmodell aus physik.js
// und speichert die Ergebnisse in tests/referenz.json.
// Die GBA-Version (C++) wird später gegen diese Datei getestet.
//
//   node werkzeuge/referenzwuerfe.mjs            Datei neu schreiben (nach Änderungen an physik.js/bahnen.js/taschen.js)
//   node werkzeuge/referenzwuerfe.mjs --pruefen  nur vergleichen; Fehler, wenn sich etwas geändert hat
//
// Jeder Wurf hat seinen eigenen Startwert für den Zufall, die Ergebnisse sind daher immer gleich.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), "..");
const ZIEL = join(WURZEL, "tests", "referenz.json");
// Arten von Würfen (Anzahl): freie Würfe überall, Annäherungen kurz vor dem Korb,
// und gezielte Fälle für Bowlingbahn und Mauern, damit jede Regel getestet wird
const ARTEN = [["frei", 300], ["annaeherung", 120], ["bowling", 60], ["mauer", 120]];
const FORMAT = 1; // erhöhen, wenn sich der Aufbau der Datei ändert

// --- Spieldateien laden, wie im Browser (window = globales Objekt) ---
const ctx = vm.createContext({ Math, Object, Set, Array, JSON, Number });
ctx.window = ctx;
for (const datei of ["bahnen.js", "taschen.js", "physik.js"]) {
  vm.runInContext(readFileSync(join(WURZEL, datei), "utf8"), ctx, { filename: datei });
}
const { BAHNEN, SPIELER, Physik } = ctx;

// Stärken wie im Spiel, vereinfacht: Wurfart-Stärke (Lieblingsscheibe usw. sind Sache von index.html)
function staerke(sp, wurfart) {
  const s = (sp.staerken || {})[wurfart] || {};
  return { streuung: s.streuung || 1, weite: s.weite || 1 };
}

const runde = (v, n = 4) => Math.round(v * 10 ** n) / 10 ** n;
const punkt = p => ({ x: runde(p.x), y: runde(p.y) });

// Parameter der Würfe kommen aus einem eigenen, festen Zufall (unabhängig vom Flugzufall)
const wahl = Physik.erzeugeZufall(20261101);
const nimm = liste => liste[Math.floor(wahl() * liste.length)];

const wuerfe = [];
const plan = ARTEN.flatMap(([art, n]) => Array(n).fill(art));
const mitBowling = BAHNEN.map((b, i) => i).filter(i => BAHNEN[i].bowlingbahn);
const mitMauern = BAHNEN.map((b, i) => i).filter(i => BAHNEN[i].mauern);
for (let i = 0; i < plan.length; i++) {
  const art = plan[i], frei = art === "frei";
  const bahnIndex = art === "bowling" ? mitBowling[i % mitBowling.length]
    : art === "mauer" ? mitMauern[i % mitMauern.length] : i % BAHNEN.length;
  const bahn = BAHNEN[bahnIndex];
  const spielerIndex = Math.floor(wahl() * SPIELER.length);
  const sp = SPIELER[spielerIndex];
  const scheibenIndex = Math.floor(wahl() * sp.tasche.length);
  const scheibe = sp.tasche[scheibenIndex];
  const wurfart = wahl() < 0.7 ? "rueckhand" : "vorhand";

  let start, ziel = bahn.korb, zielWeite = 0.95 + wahl() * 0.2;
  if (art === "frei") {
    // meist vom Abwurf, sonst irgendwo zwischen Abwurf und Korb
    const a = wahl() < 0.6 ? 0 : wahl() * 0.85;
    start = { x: bahn.abwurf.x + (bahn.korb.x - bahn.abwurf.x) * a, y: bahn.abwurf.y + (bahn.korb.y - bahn.abwurf.y) * a };
  } else if (art === "annaeherung") {
    // 4–24 m vor dem Korb (Korbtreffer, Abpraller)
    const lang = Math.hypot(bahn.korb.x - bahn.abwurf.x, bahn.korb.y - bahn.abwurf.y), a = 1 - (4 + wahl() * 20) / lang;
    start = { x: bahn.abwurf.x + (bahn.korb.x - bahn.abwurf.x) * a, y: bahn.abwurf.y + (bahn.korb.y - bahn.abwurf.y) * a };
  } else if (art === "bowling") {
    // von der Bowlingbahn aus zu kurz geworfen, damit die Scheibe zum Korb rutscht
    const l = bahn.bowlingbahn, t = 0.3 + wahl() * 0.6;
    start = { x: l.x1 + (l.x2 - l.x1) * t, y: l.y1 + (l.y2 - l.y1) * t };
    zielWeite = 0.75;
  } else {
    // flach und kurz auf eine Mauer zu: 4–12 m davor, auf der Seite des Abwurfs
    const [[x1, y1], [x2, y2]] = nimm(bahn.mauern).punkte, t = wahl();
    ziel = { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t };
    let nx = -(y2 - y1), ny = x2 - x1;
    const nl = Math.hypot(nx, ny);
    nx /= nl; ny /= nl;
    if (nx * (bahn.abwurf.x - ziel.x) + ny * (bahn.abwurf.y - ziel.y) < 0) { nx = -nx; ny = -ny; }
    const weg = 4 + wahl() * 8, quer = (wahl() - 0.5) * 10;
    start = { x: ziel.x + nx * weg - ny * quer, y: ziel.y + ny * weg + nx * quer };
    zielWeite = 1 + wahl() * 0.15;
  }
  const richtung = Math.atan2(ziel.y - start.y, ziel.x - start.x) + (wahl() - 0.5) * (frei ? 30 : 2) * Physik.DEG;
  const kraft = frei ? nimm([0.15, 0.4, 0.6, 0.8, 0.95, 1])
    : runde(Physik.kraftFuer(scheibe, Math.hypot(ziel.x - start.x, ziel.y - start.y) * zielWeite), 4);
  const winkel = frei ? nimm([-30, -15, -5, 0, 0, 5, 15, 30]) : 0;
  const windStaerke = frei ? nimm([0, 0, 2, 4, 6]) : 0, windRichtung = wahl() * Math.PI * 2;
  const wind = { x: runde(Math.cos(windRichtung) * windStaerke), y: runde(Math.sin(windRichtung) * windStaerke) };
  const st = frei ? staerke(sp, wurfart) : { streuung: 0.3, weite: 1 };
  const startwert = (0x5EED0000 + i) >>> 0;

  const eingabe = {
    x: runde(start.x), y: runde(start.y), richtung: runde(richtung, 6), kraft, winkel,
    hand: sp.hand, wurfart, streuFaktor: st.streuung, weiteFaktor: st.weite,
  };

  // Ablauf wie im Spiel: erst streuen, dann fliegen – beides mit demselben Zufall
  Physik.setzeZufall(Physik.erzeugeZufall(startwert));
  const gestreut = Physik.streue({ ...eingabe, scheibe });
  const erg = Physik.simuliere(bahn, gestreut, wind);
  Physik.setzeZufall(null);

  const pfad = erg.pfad;
  wuerfe.push({
    nr: i,
    art,
    startwert,
    bahn: bahnIndex,
    spieler: spielerIndex,
    scheibe: scheibenIndex,
    eingabe,
    wind,
    // nach der Streuung (so kann simuliere() auch einzeln getestet werden)
    gestreut: { richtung: runde(gestreut.richtung, 6), kraft: runde(gestreut.kraft, 6), winkel: runde(gestreut.winkel, 6) },
    ergebnis: {
      typ: erg.typ,
      lie: punkt(erg.lie),
      drin: erg.drin,
      ob: erg.ob,
      mando: erg.mando,
      distanz: runde(erg.distanz),
      dauer: runde(erg.dauer),
      pfadLaenge: pfad.length,
      // ein paar Stützpunkte des Flugs, um Abweichungen im Verlauf zu finden
      stuetzpunkte: [0.25, 0.5, 0.75].map(f => {
        const p = pfad[Math.min(pfad.length - 1, Math.round(f * 160))];
        return { x: runde(p.x), y: runde(p.y), z: runde(p.z) };
      }),
    },
  });
}

// Kurzer Selbsttest des Zufalls: ersten Werte für Startwert 1 (für den C++-Test)
const z = Physik.erzeugeZufall(1);
const zufallsfolge = Array.from({ length: 5 }, () => z());

// ein Wurf pro Zeile: kleine Datei, gut lesbare Unterschiede in git
const kopf = JSON.stringify({
  format: FORMAT,
  hinweis: "ERZEUGT von werkzeuge/referenzwuerfe.mjs – nicht von Hand bearbeiten",
  bahnen: BAHNEN.map(b => b.name ? `${b.nummer} ${b.name}` : `${b.nummer}`),
  spieler: SPIELER.map(s => s.name),
  zufallStartwert1: zufallsfolge,
}, null, 1).slice(0, -2);
const inhalt = `${kopf},\n "wuerfe": [\n${wuerfe.map(w => "  " + JSON.stringify(w)).join(",\n")}\n ]\n}\n`;

// Übersicht
const zaehle = f => wuerfe.filter(f).length;
const uebersicht = `${wuerfe.length} Würfe auf ${BAHNEN.length} Bahnen: ` +
  `${zaehle(w => w.ergebnis.drin)} im Korb (${zaehle(w => w.ergebnis.typ === "bowling")} Bowling), ${zaehle(w => w.ergebnis.typ === "abpraller")} Abpraller, ${zaehle(w => w.ergebnis.ob)} OB, ` +
  `${zaehle(w => w.ergebnis.typ === "baum")} Baum, ${zaehle(w => w.ergebnis.typ === "mauer")} Mauer, ` +
  `${zaehle(w => w.ergebnis.mando)} Mando`;

// Jede Regel des Flugmodells muss mindestens ein paar Mal vorkommen, sonst taugt der Test nichts
const abdeckung = {
  Korb: zaehle(w => w.ergebnis.typ === "korb"), Bowling: zaehle(w => w.ergebnis.typ === "bowling"),
  Abpraller: zaehle(w => w.ergebnis.typ === "abpraller"), OB: zaehle(w => w.ergebnis.ob),
  Baum: zaehle(w => w.ergebnis.typ === "baum"), Mauer: zaehle(w => w.ergebnis.typ === "mauer"),
  Mando: zaehle(w => w.ergebnis.mando), Landung: zaehle(w => w.ergebnis.typ === "landung"),
};
const fehlt = Object.entries(abdeckung).filter(([, n]) => n < 3).map(([k]) => k);
if (fehlt.length) {
  console.error(`Zu wenige Referenzwürfe für: ${fehlt.join(", ")} – ARTEN in werkzeuge/referenzwuerfe.mjs anpassen.`);
  process.exit(1);
}

// Dieselben Würfe als C++-Header für tests/gba/physik_test.cpp
const ZIEL_CPP = join(WURZEL, "tests", "gba", "gen_referenz.h");
const zahl = v => {
  const t = String(v);
  return /[.e]/.test(t) ? t : t + ".0";
};
const TYPEN = ["landung", "baum", "mauer", "korb", "abpraller", "bowling"];
const MANDO = { null: "keins", ok: "ok", verpasst: "verpasst" };
const inhaltCpp = `// ERZEUGT von werkzeuge/referenzwuerfe.mjs – nicht von Hand bearbeiten
// Dieselben Würfe wie tests/referenz.json
#ifndef GEN_REFERENZ_H
#define GEN_REFERENZ_H

#include <stdint.h>

namespace referenz
{
    struct stuetz { double x, y, z; };

    struct wurf
    {
        int nr;
        uint32_t startwert;
        int bahn, spieler, scheibe;
        double x, y, richtung, kraft, winkel;
        bool links, vorhand;
        double streu_faktor, weite_faktor;
        double wind_x, wind_y;
        double g_richtung, g_kraft, g_winkel;     // nach der Streuung
        int typ;                                  // 0 landung, 1 baum, 2 mauer, 3 korb, 4 abpraller, 5 bowling
        double lie_x, lie_y;
        bool drin, ob;
        int mando;                                // 0 keins, 1 ok, 2 verpasst
        double distanz, dauer;
        int pfad_laenge;
        stuetz s[3];
    };

    constexpr int anzahl = ${wuerfe.length};
    constexpr wurf wuerfe[anzahl] = {
${wuerfe.map(w => {
  const e = w.eingabe, r = w.ergebnis, g = w.gestreut;
  const typ = TYPEN.indexOf(r.typ);
  if (typ < 0) throw new Error("unbekannter Typ " + r.typ);
  return `        {${w.nr}, ${w.startwert}u, ${w.bahn}, ${w.spieler}, ${w.scheibe}, ` +
    `${[e.x, e.y, e.richtung, e.kraft, e.winkel].map(zahl).join(", ")}, ${e.hand === "links"}, ${e.wurfart === "vorhand"}, ` +
    `${zahl(e.streuFaktor)}, ${zahl(e.weiteFaktor)}, ${zahl(w.wind.x)}, ${zahl(w.wind.y)}, ` +
    `${[g.richtung, g.kraft, g.winkel].map(zahl).join(", ")}, ${typ}, ${zahl(r.lie.x)}, ${zahl(r.lie.y)}, ${r.drin}, ${r.ob}, ` +
    `${["keins", "ok", "verpasst"].indexOf(MANDO[r.mando])}, ${zahl(r.distanz)}, ${zahl(r.dauer)}, ${r.pfadLaenge}, ` +
    `{${r.stuetzpunkte.map(p => `{${zahl(p.x)}, ${zahl(p.y)}, ${zahl(p.z)}}`).join(", ")}}}`;
}).join(",\n")}
    };
}

#endif
`;

if (process.argv.includes("--pruefen")) {
  let altCpp = "";
  try { altCpp = readFileSync(ZIEL_CPP, "utf8"); } catch { /* fehlt */ }
  if (altCpp !== inhaltCpp) {
    console.error("tests/gba/gen_referenz.h ist veraltet – bitte  node werkzeuge/referenzwuerfe.mjs  ausführen.");
    process.exit(1);
  }
  let alt = "";
  try { alt = readFileSync(ZIEL, "utf8"); } catch { /* fehlt */ }
  if (alt === inhalt) { console.log("Referenzwürfe unverändert. " + uebersicht); process.exit(0); }
  console.error("Referenzwürfe weichen von tests/referenz.json ab!");
  if (alt) {
    const a = JSON.parse(alt).wuerfe || [];
    const geaendert = wuerfe.filter((w, i) => JSON.stringify(w) !== JSON.stringify(a[i])).map(w => w.nr);
    console.error(`${geaendert.length} Würfe geändert, z. B. Nr. ${geaendert.slice(0, 10).join(", ")}`);
  }
  console.error("Wenn die Änderung an physik.js/bahnen.js/taschen.js gewollt ist:\n" +
    "  node werkzeuge/referenzwuerfe.mjs   (und die C++-Physik der GBA-Version anpassen)");
  process.exit(1);
}

mkdirSync(dirname(ZIEL), { recursive: true });
writeFileSync(ZIEL, inhalt);
writeFileSync(ZIEL_CPP, inhaltCpp);
console.log("tests/referenz.json geschrieben. " + uebersicht);
