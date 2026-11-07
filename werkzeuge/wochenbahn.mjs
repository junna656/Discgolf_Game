// Wochenbahn erzeugen: baut aus Thema, Woche und Zufall eine Bahn und trägt sie in wochenbahnen.js ein.
//
//   node werkzeuge/wochenbahn.mjs --thema wueste                 Bahn für die nächste Woche (ab kommendem Montag)
//   node werkzeuge/wochenbahn.mjs --thema wueste --woche 2026-46  Bahn für eine bestimmte Kalenderwoche (ISO)
//   Optionen: --seed <zahl>  anderer Zufall (gleiche Eingaben = gleiche Bahn)
//             --name "<Fantasiename>"  statt eines zufälligen Namens aus der Themenliste
//             --par 3|4|5   Par erzwingen (sonst per Zufall: ~88 % Par 3, ~10 % Par 4, ~2 % Par 5)
//             --pruefen     nur prüfen, ob wochenbahnen.js gültig ist (keine Änderung)
//             --hat-naechste  Exit 0, wenn die Bahn der kommenden Woche schon eingetragen ist
//             --zufallsthema  gibt ein vorhandenes Thema aus (nicht das der letzten Woche)
//   Ohne Eintrag für die Woche wird er angehängt, sonst ersetzt (so lässt sich eine Bahn neu würfeln).
//
// Neues Thema: in THEMEN unten einen Eintrag mit name, optik, namen und baue(z, g, L) ergänzen.
// Die Optik entweder als optikDaten im Thema (Paletten, landen mit in wochenbahnen.js – kein Release nötig)
// oder fest in JAHRESZEITEN (grafik.js, braucht ein Release). Vorlage: JAHRESZEITEN.wueste.
// Ein Thema, das eine Jahreszeit ist (z. B. Winter), nimmt einfach deren Optik.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATEI = join(WURZEL, "wochenbahnen.js");

// ---------- Zufall (fest aus Woche, Thema, Seed) ----------
function hashText(t) { let h = 2166136261; for (const ch of t) h = Math.imul(h ^ ch.codePointAt(0), 16777619); return h >>> 0; }
function zufall(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const r1 = v => Math.round(v * 10) / 10;

// ---------- Kalender: ISO-Woche, Montag ----------
function isoWoche(d) { // d: Datum (UTC-Mitternacht)
  const t = new Date(d); t.setUTCDate(t.getUTCDate() + 3 - ((t.getUTCDay() + 6) % 7));
  const j1 = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  return { jahr: t.getUTCFullYear(), kw: 1 + Math.round(((t - j1) / 864e5 - 3 + ((j1.getUTCDay() + 6) % 7)) / 7) };
}
function montagDerWoche(jahr, kw) {
  const j4 = new Date(Date.UTC(jahr, 0, 4)), m = new Date(j4);
  m.setUTCDate(j4.getUTCDate() - ((j4.getUTCDay() + 6) % 7) + (kw - 1) * 7);
  return m;
}
// Woche, die am nächsten Montag beginnt (deutsche Zeit; an einem Montag die Woche danach)
function naechsteWoche(jetzt = new Date()) {
  const [j, m, t] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(jetzt).split("-").map(Number);
  const d = new Date(Date.UTC(j, m - 1, t));
  d.setUTCDate(d.getUTCDate() + (7 - ((d.getUTCDay() + 6) % 7)));
  return isoWoche(d);
}

// ---------- Geometrie ----------
const abstand = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function abstandZurStrecke(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
const abstandZurLinie = (p, pk) => Math.min(...pk.slice(1).map((q, i) => abstandZurStrecke(p, { x: pk[i][0], y: pk[i][1] }, { x: q[0], y: q[1] })));
function imPolygon(p, poly) {
  let drin = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p.y) !== (yj > p.y) && p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi) drin = !drin;
  }
  return drin;
}
// Band um eine Mittellinie (Breite je Punkt) als Polygon
function band(mitte, breiten) {
  const links = [], rechts = [];
  mitte.forEach((p, i) => {
    const a = mitte[Math.max(0, i - 1)], b = mitte[Math.min(mitte.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, w = breiten[i] / 2;
    links.push([r1(p[0] + nx * w), r1(p[1] + ny * w)]); rechts.push([r1(p[0] - nx * w), r1(p[1] - ny * w)]);
  });
  return [...links, ...rechts.reverse()];
}

// ---------- Grundgerüst jeder Bahn: Länge, Par, Abwurf, Korb, Knick, Fairway ----------
function waehlePar(z, erzwungen) {
  const w = z();
  const par = erzwungen || (w < 0.02 ? 5 : w < 0.12 ? 4 : 3);
  const L = par === 5 ? 201 + z() * 49 : par === 4 ? 140 + z() * 60 : 60 + z() * 80;
  return { par, L: Math.round(L) };
}
function geruest(z, L) {
  // Dogleg: Knickpunkt nach 45–65 % der Strecke, seitlich versetzt (mal links, mal rechts, mal gerade)
  const art = z(), seite = z() < 0.5 ? -1 : 1;
  const v = art < 0.3 ? 0 : seite * L * (0.08 + z() * 0.14), k = 0.45 + z() * 0.2;
  // gerade Strecke G so wählen, dass der Weg über den Knick genau L lang ist
  let G = L;
  for (let i = 0; i < 30; i++) G *= L / (Math.hypot(G * k, v) + Math.hypot(G * (1 - k), v));
  // leicht schräg liegende Bahn (±14°), dann Welt drumherum: Ränder 12 m am Abwurf, 14 m sonst; Höhe = Breite × 9/16
  const w = (z() - 0.5) * 0.5, dreh = (x, y) => ({ x: x * Math.cos(w) - y * Math.sin(w), y: x * Math.sin(w) + y * Math.cos(w) });
  const roh = [dreh(0, 0), dreh(G * k, v), dreh(G, 0)];
  const xs = roh.map(p => p.x), ys = roh.map(p => p.y);
  const minX = Math.min(...xs) - 12, maxX = Math.max(...xs) + 16, minY = Math.min(...ys) - 14, maxY = Math.max(...ys) + 14;
  const breite = Math.round(Math.max(maxX - minX, (maxY - minY) * 16 / 9, 110)), hoehe = breite * 9 / 16;
  const ox = -minX + (breite - (maxX - minX)) / 2 * 0.3, oy = -minY + (hoehe - (maxY - minY)) / 2;
  const [abwurf, knick, korb] = roh.map(p => ({ x: r1(p.x + ox), y: r1(p.y + oy) }));
  // Fairway: am Abwurf schmal, in der Mitte breit, am Korb wieder etwas schmaler
  const linie = [[abwurf.x, abwurf.y], [knick.x, knick.y], [korb.x, korb.y]];
  const mitte = [];
  for (let i = 0; i < 2; i++) for (let k = 0; k < 6; k++) {
    const t = k / 6, a = linie[i], b = linie[i + 1];
    mitte.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  const ende = [korb.x + (korb.x - knick.x) / abstand(knick, korb) * 6, korb.y + (korb.y - knick.y) / abstand(knick, korb) * 6];
  mitte.push([korb.x, korb.y], ende);
  const breitMax = 9 + z() * 8;
  const breiten = mitte.map((_, i) => { const t = i / (mitte.length - 1); return 4 + Math.sin(Math.min(1, t * 1.25) * Math.PI) * breitMax + (t > 0.85 ? 6 : 0); });
  return { welt: { breite, hoehe }, abwurf, korb, knick, linie, fairway: band(mitte, breiten) };
}

// ---------- Hindernisse streuen ----------
function streue(z, g, anzahl, macheEins, frei) {
  const liste = [];
  for (let i = 0, versuche = 0; i < anzahl && versuche < anzahl * 30; versuche++) {
    const p = { x: z() * g.welt.breite, y: z() * g.welt.hoehe };
    const o = macheEins(p, z);
    if (!o || !frei(o, liste)) continue;
    liste.push(o); i++;
  }
  return liste;
}

// ---------- Themen ----------
const THEMEN = {
  wueste: {
    name: "Wüste", optik: "wueste",
    namen: ["Fata Morgana", "Kaktusschlucht", "Dürre Elle", "Sandsturm", "Skorpionspfad", "Oase Ohnegleichen", "Geierfelsen",
      "Wadi Wackelkorb", "Staubteufel", "Dornige Diva", "Die Glutpfanne", "Klapperschlangenkurve", "Sandkasten XXL", "Tafelberg-Tango"],
    baue(z, g, L) {
      const { abwurf, korb, linie } = g;
      const ob = [];
      // 1–2 ausgetrocknete Flussbetten: eines quer über die Bahn (muss überworfen werden), evtl. eines längs am Rand
      const flussbetten = [];
      const quer = (anteil) => {
        // Mittellinie quer zur Bahn bei "anteil" der Strecke, mäandernd, über die ganze Weltbreite/-höhe
        const seg = anteil < 0.5 ? [linie[0], linie[1]] : [linie[1], linie[2]], t = anteil < 0.5 ? anteil * 2 : anteil * 2 - 1;
        const p = [seg[0][0] + (seg[1][0] - seg[0][0]) * t, seg[0][1] + (seg[1][1] - seg[0][1]) * t];
        const dx = seg[1][0] - seg[0][0], dy = seg[1][1] - seg[0][1], l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l;
        const mitte = [], breiten = [], schwung = 3 + z() * 5, phase = z() * 6, schraeg = (z() - 0.5) * 0.6;
        for (let s = -1.2; s <= 1.2001; s += 0.1) {
          const d = s * g.welt.hoehe, m = Math.sin(s * 5 + phase) * schwung;
          mitte.push([r1(p[0] + nx * d + (dx / l) * (m + d * schraeg)), r1(p[1] + ny * d + (dy / l) * (m + d * schraeg))]);
          breiten.push(5 + z() * 2 + Math.sin(s * 3 + phase) * 2);
        }
        return band(mitte, breiten);
      };
      const querAnteil = 0.35 + z() * 0.35;
      flussbetten.push(quer(querAnteil));
      if (z() < 0.55) {
        // zweites Flussbett längs der Bahn auf einer Seite: begrenzt die Bahn wie ein Aus
        const seite = z() < 0.5 ? -1 : 1, mitte = [], breiten = [];
        for (let k = 0; k <= 20; k++) {
          const t = k / 20, x = -5 + (g.welt.breite + 10) * t;
          // y auf der Bahn bei x (Polylinie über den Knick), dann seitlich weg
          const y = (() => { const [a, b, c] = linie; return x <= b[0] ? a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]) : b[1] + (c[1] - b[1]) * (x - b[0]) / (c[0] - b[0]); })();
          mitte.push([r1(x), r1(y + seite * (16 + z() * 3 + Math.sin(t * 7) * 3))]);
          breiten.push(6 + z() * 3);
        }
        flussbetten.push(band(mitte, breiten));
      }
      for (const [i, fb] of flussbetten.entries()) ob.push({ name: i ? "Flussbett längs" : "Flussbett", art: "flussbett", punkte: fb });
      // Abwurf und Korb dürfen nicht im Flussbett liegen, der Korb braucht 8 m Abstand
      const imFluss = p => flussbetten.some(fb => imPolygon(p, fb));
      const flussNah = (p, d) => flussbetten.some(fb => imPolygon(p, fb) || fb.some(q => Math.hypot(q[0] - p.x, q[1] - p.y) < d));
      if (flussNah(abwurf, 8) || flussNah(korb, 9)) return null;

      // Kakteen und Felsen: am Rand dicht, im Fairway nur einzelne „im Spiel“
      const frei = (o, liste) => {
        if (abstand(o, abwurf) < 7 || abstand(o, korb) < 4.5 + o.r) return false;
        if (imFluss(o)) return false;
        if (liste.some(q => abstand(q, o) < q.r + o.r + 0.8)) return false;
        return o.x > -2 && o.y > -2 && o.x < g.welt.breite + 2 && o.y < g.welt.hoehe + 2;
      };
      const naheBahn = p => abstandZurLinie(p, linie);
      const kaktus = (p, z) => ({ x: r1(p.x), y: r1(p.y), r: r1(0.8 + z() * 0.9), h: r1(3 + z() * 3.5), art: "kaktus" });
      const fels = (p, z) => ({ x: r1(p.x), y: r1(p.y), r: r1(1 + z() * 2.4), h: r1(1.2 + z() * 1.8), art: "fels" });
      const flaeche = g.welt.breite * g.welt.hoehe;
      // außerhalb des Korridors
      const aussen = streue(z, g, Math.round(flaeche / 160), (p, z) => naheBahn(p) > 9 ? (z() < 0.6 ? kaktus(p, z) : fels(p, z)) : null, frei);
      // Felsgruppen: ein paar Felsen eng beieinander, gern am Fairwayrand
      const gruppen = [];
      for (let k = 0, n = 2 + Math.floor(z() * 3); k < n; k++) {
        const t = 0.25 + z() * 0.65, seg = t < 0.5 ? [linie[0], linie[1]] : [linie[1], linie[2]], tt = t < 0.5 ? t * 2 : t * 2 - 1;
        const s = z() < 0.5 ? -1 : 1, dx = seg[1][0] - seg[0][0], dy = seg[1][1] - seg[0][1], l = Math.hypot(dx, dy);
        const m = { x: seg[0][0] + dx * tt - dy / l * s * (7 + z() * 6), y: seg[0][1] + dy * tt + dx / l * s * (7 + z() * 6) };
        for (let j = 0; j < 3 + Math.floor(z() * 3); j++) {
          const o = fels({ x: m.x + (z() - 0.5) * 7, y: m.y + (z() - 0.5) * 5 }, z);
          if (frei(o, [...aussen, ...gruppen])) gruppen.push(o);
        }
      }
      // im Spiel: wenige Kakteen nahe der Linie, aber nie mitten auf der Ideallinie (mind. 2,5 m daneben)
      const imSpiel = streue(z, g, Math.round(L / 28), (p, z) => { const d = naheBahn(p); return d > 2.5 + 1.6 && d < 9 ? kaktus(p, z) : null; }, (o, l) => frei(o, [...aussen, ...gruppen, ...l]));
      const baeume = [...imSpiel, ...gruppen, ...aussen];
      // ein Sandweg (Jeep-Piste) als Bild: vom unteren oder oberen Rand schräg durchs Gelände, nicht über Abwurf/Korb
      const wy = z() < 0.5 ? 0 : g.welt.hoehe, wx = g.welt.breite * (0.2 + z() * 0.6);
      const wege = [{ punkte: [[r1(wx), r1(wy)], [r1(wx + (z() - 0.5) * 30), r1(g.welt.hoehe / 2)], [r1(wx + (z() - 0.5) * 50), r1(g.welt.hoehe - wy)]], breite: 3 }];
      if (wege[0].punkte.some((q, i, a) => i && (abstandZurStrecke(abwurf, { x: a[i - 1][0], y: a[i - 1][1] }, { x: q[0], y: q[1] }) < 8 || abstandZurStrecke(korb, { x: a[i - 1][0], y: a[i - 1][1] }, { x: q[0], y: q[1] }) < 8))) wege.length = 0;
      return { baeume, ob, wege };
    },
  },
};

// ---------- Bahn bauen ----------
function baueBahn({ thema, woche, seed = 0, name, par: parErzwungen }) {
  const T = THEMEN[thema];
  if (!T) throw new Error(`Unbekanntes Thema "${thema}". Vorhanden: ${Object.keys(THEMEN).join(", ")}`);
  const [jahr, kw] = woche.split("-").map(Number);
  for (let versuch = 0; versuch < 200; versuch++) {
    const z = zufall(hashText(`${woche}|${thema}|${seed}|${versuch}`));
    const { par, L } = waehlePar(z, parErzwungen);
    const g = geruest(z, L);
    const teile = T.baue(z, g, L);
    if (!teile) continue;
    const bname = (name || T.namen[Math.floor(z() * T.namen.length)]) + " KW" + String(kw).padStart(2, "0");
    return {
      woche, ab: montagDerWoche(jahr, kw).toISOString().slice(0, 10), thema: T.name, optik: T.optik,
      ...(T.optikDaten ? { optikDaten: T.optikDaten } : {}),
      bahn: {
        nummer: 1, name: bname, ort: "Wochenbahn · " + T.name, par, optik: T.optik,
        welt: { breite: g.welt.breite, hoehe: g.welt.hoehe },
        abwurf: g.abwurf, korb: g.korb, fairway: g.fairway,
        baeume: teile.baeume, wege: teile.wege, ob: teile.ob,
      },
      erzeugt: { seed, versuch, laenge: L },
    };
  }
  throw new Error("Keine gültige Bahn gefunden – anderen --seed versuchen.");
}

// ---------- wochenbahnen.js lesen und schreiben ----------
function lies() {
  const ctx = vm.createContext({}); ctx.window = ctx;
  vm.runInContext(readFileSync(DATEI, "utf8"), ctx, { filename: "wochenbahnen.js" });
  return JSON.parse(JSON.stringify(ctx.WOCHENBAHNEN || []));
}
function schreibe(liste) {
  liste.sort((a, b) => a.woche.localeCompare(b.woche, "en", { numeric: true }));
  const kopf = `// ============================================================
//  WOCHENBAHNEN – ERZEUGT von werkzeuge/wochenbahn.mjs (Fixes von Hand sind erlaubt)
// ============================================================
//  Jede Woche eine neue Bahn: ab Montag 0:00 (deutsche Zeit) ist der jüngste Eintrag mit
//  "ab" <= heute die aktuelle Wochenbahn, die älteren stehen im Archiv (/archiv/).
//  Diese Datei ist reine Daten: Die Action „Wochenbahn live“ kopiert sie sonntags von dev nach main.
//  Felder: woche (ISO-Jahr-KW), ab (Montag), thema, optik (Schlüssel in JAHRESZEITEN, grafik.js),
//  bahn (wie in bahnen.js; baeume mit art "kaktus"/"fels" und Höhe h), erzeugt (Seed zum Nachbauen)
// ============================================================
`;
  const text = kopf + "window.WOCHENBAHNEN = [\n" + liste.map(e => JSON.stringify(e)).join(",\n") + "\n];\n";
  writeFileSync(DATEI, text);
}
function pruefe(liste) {
  const fehler = [];
  for (const e of liste) {
    const b = e.bahn;
    if (!/^\d{4}-\d{1,2}$/.test(e.woche) || !/^\d{4}-\d\d-\d\d$/.test(e.ab)) fehler.push(e.woche + ": woche/ab ungültig");
    if (!b || !b.welt || Math.abs(b.welt.hoehe - b.welt.breite * 9 / 16) > 0.01) fehler.push(e.woche + ": welt.hoehe muss breite × 9/16 sein");
    if (![3, 4, 5].includes(b.par)) fehler.push(e.woche + ": par");
    for (const p of [b.abwurf, b.korb]) if (!(p.x > 0 && p.y > 0 && p.x < b.welt.breite && p.y < b.welt.hoehe)) fehler.push(e.woche + ": Abwurf/Korb außerhalb");
    if ((b.ob || []).some(o => o.punkte && (imPolygon(b.abwurf, o.punkte) || imPolygon(b.korb, o.punkte)))) fehler.push(e.woche + ": Abwurf/Korb im OB");
  }
  const wochen = liste.map(e => e.woche);
  if (new Set(wochen).size !== wochen.length) fehler.push("Woche doppelt");
  return fehler;
}

// ---------- Aufruf ----------
const arg = n => { const i = process.argv.indexOf("--" + n); return i > 0 ? process.argv[i + 1] : undefined; };
const liste = lies();
if (process.argv.includes("--pruefen")) {
  const f = pruefe(liste);
  if (f.length) { console.error(f.join("\n")); process.exit(1); }
  console.log(`wochenbahnen.js ok: ${liste.length} Wochen (${liste.map(e => e.woche).join(", ")})`);
  process.exit(0);
}
// für die Action „Wochenbahn live“: gibt es schon die Bahn der kommenden Woche? / ein zufälliges vorhandenes Thema
if (process.argv.includes("--hat-naechste")) {
  const w = naechsteWoche();
  process.exit(liste.some(e => e.woche === `${w.jahr}-${w.kw}`) ? 0 : 1);
}
if (process.argv.includes("--zufallsthema")) {
  const t = Object.keys(THEMEN), letzte = liste.length ? liste[liste.length - 1].optik : null;
  const auswahl = t.length > 1 ? t.filter(k => THEMEN[k].optik !== letzte) : t; // nicht zweimal hintereinander dasselbe
  console.log(auswahl[Math.floor(Math.random() * auswahl.length)]);
  process.exit(0);
}
const thema = arg("thema");
if (!thema) { console.error("Bitte --thema angeben. Vorhanden: " + Object.keys(THEMEN).join(", ")); process.exit(1); }
let woche = arg("woche");
if (!woche) { const w = naechsteWoche(); woche = `${w.jahr}-${w.kw}`; }
const [wj, wk] = woche.split("-").map(Number); woche = `${wj}-${wk}`;
const eintrag = baueBahn({ thema, woche, seed: Number(arg("seed") || 0), name: arg("name"), par: arg("par") ? Number(arg("par")) : undefined });
const neu = [...liste.filter(e => e.woche !== woche), eintrag];
const f = pruefe(neu);
if (f.length) { console.error(f.join("\n")); process.exit(1); }
schreibe(neu);
const b = eintrag.bahn;
console.log(`KW ${wk}/${wj} ab ${eintrag.ab}: „${b.name}“ · ${eintrag.thema} · Par ${b.par} · ${Math.round(Math.hypot(b.korb.x - b.abwurf.x, b.korb.y - b.abwurf.y))} m Luftlinie (${eintrag.erzeugt.laenge} m gespielt) · ` +
  `${b.baeume.length} Hindernisse, ${b.ob.length} OB-Flächen`);
