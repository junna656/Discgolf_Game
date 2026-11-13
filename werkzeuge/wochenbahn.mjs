// Wochenbahn erzeugen: baut aus Thema, Woche und Zufall eine Bahn und trägt sie in wochenbahnen.js ein.
//
//   node werkzeuge/wochenbahn.mjs --thema wueste                 Bahn für die nächste Woche (ab kommendem Montag)
//   node werkzeuge/wochenbahn.mjs --thema wueste --woche 2026-46  Bahn für eine bestimmte Kalenderwoche (ISO)
//   Optionen: --seed <zahl>  anderer Zufall (gleiche Eingaben = gleiche Bahn)
//             --name "<Fantasiename>"  Kursname statt eines zufälligen Namens aus der Themenliste
//             --par 3|4|5   Par erzwingen (sonst per Zufall: ~88 % Par 3, ~10 % Par 4, ~2 % Par 5)
//             --pruefen     nur prüfen, ob wochenbahnen.js gültig ist (keine Änderung)
//             --hat-naechste  Exit 0, wenn die Bahn der kommenden Woche schon eingetragen ist
//             --zufallsthema  gibt ein vorhandenes Thema aus (nicht das der letzten Woche)
//             --bahnen <n>  Anzahl Bahnen (Standard ANZAHL_STANDARD = 6, später 18)
//             --typen a,b,…  Bahntypen der Reihe nach (sonst plan des Themas oder Zufall nach Gewicht)
//   Ohne Eintrag für die Woche wird er angehängt, sonst ersetzt (so lässt sich ein Kurs neu würfeln).
//
// Neues Thema: in THEMEN unten einen Eintrag mit name, optik, namen und baue(z, g, L) ergänzen.
// Die Optik entweder als optikDaten im Thema (Paletten, landen mit in wochenbahnen.js – kein Release nötig)
// oder fest in JAHRESZEITEN (grafik.js, braucht ein Release). Vorlage: JAHRESZEITEN.wueste.
// Neue Gegenstände (3/4-Ansicht): in baeume mit art, r und h; die Art in optikDaten.objekte festlegen,
// z. B. objekte: { eisblock: { form: "brocken", farben: ["#…", …] } } – Formen: krone, kegel, saeule,
// brocken, kugel (siehe OBJEKT_FORMEN in grafik.js). --pruefen meldet unbekannte Arten und Formen.
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
  const v = art < 0.25 ? 0 : seite * L * (0.06 + z() * 0.22), k = 0.4 + z() * 0.3;
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
      "Wadi Wackelkorb", "Staubteufel", "Dornige Diva", "Die Glutpfanne", "Klapperschlangenkurve", "Sandkasten XXL", "Tafelberg-Tango",
      "Kamelbuckel", "Dattelpalmen-Dogleg", "Heiße Kette", "Wüstenfuchs", "Tumbleweed Alley", "Durststrecke", "Sanddünen-Sprint", "Mirage-Mando", "Kojotenkehle",
      "Kakteenkarree", "Skarabäus-Sprint", "Sonnenstich", "Glutnest", "Salzpfanne", "Beduinenbogen"],
    // Bahntypen (Gewicht): quer = Flussbett quer, insel = Korb auf einer Insel im Flussbett,
    // schlucht = enge Schlucht zwischen Felswänden, mando = Lücke zwischen zwei großen Felsen,
    // offen = kein Flussbett quer, dafür Kakteenfeld. Felsen und Felswände werfen die Scheibe immer zurück.
    typen: { quer: 3, insel: 1.3, schlucht: 1.6, mando: 1.8, offen: 1.2 },
    // Namen, die nur zu einem Bahntyp passen (werden dort bevorzugt, sonst nicht vergeben)
    typNamen: { mando: ["Mirage-Mando", "Geierfelsen", "Tafelberg-Tango"], schlucht: ["Kaktusschlucht", "Kojotenkehle", "Klapperschlangenkurve"],
      insel: ["Oase Ohnegleichen", "Wadi Wackelkorb"], offen: ["Dornige Diva", "Tumbleweed Alley", "Kakteenkarree"] },
    baue(z, g, L) {
      const { abwurf, korb, linie } = g;
      const typ = waehleGewichtet(z, this.typen);
      const ob = [], flussbetten = [], mauern = [], feste = [];
      let mando = null, sperrZonen = []; // sperrZonen: {x, y, r} – dort keine gestreuten Hindernisse
      const P = t => punktAufLinie(linie, t);

      // ---- Flussbett quer über die Bahn bei Anteil t der Strecke ----
      const quer = (t) => {
        const p = P(t), nx = -p.uy, ny = p.ux;
        const mitte = [], breiten = [], schwung = 3 + z() * 5, phase = z() * 6, schraeg = (z() - 0.5) * 0.6;
        for (let s = -1.2; s <= 1.2001; s += 0.1) {
          const d = s * g.welt.hoehe, m = Math.sin(s * 5 + phase) * schwung;
          mitte.push([r1(p.x + nx * d + p.ux * (m + d * schraeg)), r1(p.y + ny * d + p.uy * (m + d * schraeg))]);
          breiten.push(5 + z() * 2 + Math.sin(s * 3 + phase) * 2);
        }
        return band(mitte, breiten);
      };
      // ---- Flussbett längs auf einer Seite (wie ein Aus neben der Bahn) ----
      const laengs = () => {
        const seite = z() < 0.5 ? -1 : 1, mitte = [], breiten = [];
        for (let k = 0; k <= 20; k++) {
          const t = k / 20, x = -5 + (g.welt.breite + 10) * t;
          const y = (() => { const [a, b, c] = linie; return x <= b[0] ? a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]) : b[1] + (c[1] - b[1]) * (x - b[0]) / (c[0] - b[0]); })();
          mitte.push([r1(x), r1(y + seite * (21 + z() * 4 + Math.sin(t * 7) * 2.5))]);
          breiten.push(6 + z() * 3);
        }
        return band(mitte, breiten);
      };

      let keinXSpiegeln = false;
      if (typ === "quer") {
        flussbetten.push(quer(0.35 + z() * 0.35));
        if (z() < 0.5) flussbetten.push(laengs());
      } else if (typ === "insel") {
        // Korb auf einer Insel; ab x = ab ist alles außer der Insel Flussbett (OB)
        const R = 8 + z() * 5, insel = [];
        for (let i = 0; i < 14; i++) { const w = i / 14 * Math.PI * 2, rr = R * (0.85 + z() * 0.3); insel.push([r1(korb.x + Math.cos(w) * rr), r1(korb.y + Math.sin(w) * rr * 0.85)]); }
        const ab = r1(korb.x - R - 6 - z() * Math.min(18, L * 0.15));
        if (ab < abwurf.x + 30) return null;
        ob.push({ name: "Flussbett um die Insel", art: "flussbett", insel, ab });
        keinXSpiegeln = true; // „ab“ gilt nur nach rechts
        if (z() < 0.35) flussbetten.push(laengs());
      } else if (typ === "schlucht") {
        // zwei Felswände links und rechts der Linie; dazwischen ein Gang von 9–15 m. Der Fels reicht auf
        // beiden Seiten bis zum Spielfeldrand (an den Enden schließen Wände bis zum Rand ab) – kein Weg außen herum
        const t0 = 0.18 + z() * 0.12, t1 = Math.min(0.8, t0 + 0.38 + z() * 0.22), halb = 4.5 + z() * 3;
        for (const sei of [1, -1]) {
          const punkte = [];
          for (let t = t0; t <= t1 + 1e-9; t += (t1 - t0) / 8) {
            const p = P(t), w = halb + Math.sin(t * 17 + sei) * 1.2 + (z() - 0.5) * 1.2;
            punkte.push([r1(p.x - p.uy * w * sei), r1(p.y + p.ux * w * sei)]);
          }
          // Richtung zum Rand: die Achse, die der Außenseite in der Mitte der Schlucht am nächsten liegt
          const m = P((t0 + t1) / 2), ox = -m.uy * sei, oy = m.ux * sei, W = g.welt.breite, Hh = g.welt.hoehe;
          const zumRand = Math.abs(ox) > Math.abs(oy) ? ([x, y]) => [ox > 0 ? W + 3 : -3, y] : ([x, y]) => [x, oy > 0 ? Hh + 3 : -3];
          const linieBisRand = [zumRand(punkte[0]), ...punkte, zumRand(punkte[punkte.length - 1])].map(([x, y]) => [r1(x), r1(y)]);
          mauern.push({ art: "felswand", punkte: linieBisRand, h: 30, breite: 4, seite: sei, bisRand: true });
        }
        // Abwurf und Korb dürfen nicht im Fels liegen und brauchen Platz davor
        if (mauern.some(m => imPolygon(abwurf, m.punkte) || imPolygon(korb, m.punkte) || abstandZurLinie(abwurf, m.punkte) < 6 || abstandZurLinie(korb, m.punkte) < 11)) return null;
      } else if (typ === "mando") {
        // zwei große Felsen mit Lücke von 6–9 m; die Scheibe muss hindurch
        const t = 0.35 + z() * 0.25, p = P(t), luecke = 6 + z() * 3, versatz = (z() - 0.5) * 3;
        const rs = [3.6 + z() * 1.4, 3.6 + z() * 1.4], nx = -p.uy, ny = p.ux;
        const a = { x: r1(p.x + nx * (versatz + luecke / 2 + rs[0])), y: r1(p.y + ny * (versatz + luecke / 2 + rs[0])) };
        const b = { x: r1(p.x - nx * (luecke / 2 - versatz + rs[1])), y: r1(p.y - ny * (luecke / 2 - versatz + rs[1])) };
        feste.push({ ...a, r: r1(rs[0]), h: r1(7 + z() * 3), art: "fels", fest: true }, { ...b, r: r1(rs[1]), h: r1(7 + z() * 3), art: "fels", fest: true });
        mando = { a: [a.x, a.y], b: [b.x, b.y] };
        // Felsriegel: nach außen setzen sich die beiden Felsen in weiteren Brocken fort
        for (const [q, sei, r0] of [[a, 1, rs[0]], [b, -1, rs[1]]]) {
          let d = r0, x = q.x, y = q.y;
          for (let k = 0, n = 2 + Math.floor(z() * 3); k < n; k++) {
            const r = 2.2 + z() * 1.8; d = r + d * 0.75;
            x += nx * sei * d + (z() - 0.5) * 1.5; y += ny * sei * d + (z() - 0.5) * 1.5; d = r;
            feste.push({ x: r1(x), y: r1(y), r: r1(r), h: r1(4 + z() * 3), art: "fels", fest: true });
          }
        }
        sperrZonen.push({ x: p.x + nx * versatz, y: p.y + ny * versatz, r: luecke / 2 + 2 });
        if (z() < 0.45) { const tq = t < 0.5 ? 0.68 + z() * 0.08 : 0.2 + z() * 0.08; flussbetten.push(quer(tq)); }
      } else if (typ === "offen") {
        if (z() < 0.5) flussbetten.push(laengs());
      }
      for (const [i, fb] of flussbetten.entries()) ob.push({ name: "Flussbett " + (i + 1), art: "flussbett", punkte: fb });

      // Abwurf und Korb dürfen nicht im/am Flussbett liegen; Circle 1 bleibt frei
      const imFluss = p => flussbetten.some(fb => imPolygon(p, fb)) || ob.some(o => o.insel && p.x >= o.ab && !imPolygon(p, o.insel));
      const flussNah = (p, d) => flussbetten.some(fb => imPolygon(p, fb) || abstandZurLinie(p, [...fb, fb[0]]) < d);
      if (flussNah(abwurf, 8) || flussNah(korb, 14)) return null;
      const anWand = (p, r) => mauern.some(m => (m.bisRand && imPolygon(p, m.punkte)) || abstandZurLinie(p, m.punkte) < r + (m.bisRand ? 1 : m.breite + 1));

      // Kakteen und Felsen: am Rand dicht, im Fairway nur einzelne „im Spiel“
      const frei = (o, liste) => {
        if (abstand(o, abwurf) < 7 || abstand(o, korb) < 4.5 + o.r) return false;
        if (imFluss(o) || flussNah(o, o.r + 0.3) || anWand(o, o.r) || sperrZonen.some(q => abstand(q, o) < q.r + o.r)) return false;
        if ([...feste, ...liste].some(q => abstand(q, o) < q.r + o.r + 0.8)) return false;
        return o.x > -2 && o.y > -2 && o.x < g.welt.breite + 2 && o.y < g.welt.hoehe + 2;
      };
      const naheBahn = p => abstandZurLinie(p, linie);
      const kaktus = (p, z) => ({ x: r1(p.x), y: r1(p.y), r: r1(0.8 + z() * 0.9), h: r1(3 + z() * 3.5), art: "kaktus" });
      const fels = (p, z, gross = 0) => ({ x: r1(p.x), y: r1(p.y), r: r1(1 + z() * 2.4 + gross), h: r1(1.2 + z() * 1.8 + gross * 1.5), art: "fels", fest: true });
      const flaeche = g.welt.breite * g.welt.hoehe, dichte = typ === "offen" ? 1.5 : 0.7 + z() * 0.7;
      const aussen = streue(z, g, Math.round(flaeche / 160 * dichte), (p, z) => naheBahn(p) > 9 ? (z() < 0.6 ? kaktus(p, z) : fels(p, z)) : null, frei);
      // Felsgruppen am Fairwayrand, manchmal mit einem großen Brocken
      const gruppen = [];
      for (let k = 0, n = 1 + Math.floor(z() * 4); k < n; k++) {
        const p = P(0.25 + z() * 0.65), sei = z() < 0.5 ? -1 : 1, d = 7 + z() * 6;
        const m = { x: p.x - p.uy * sei * d, y: p.y + p.ux * sei * d };
        for (let j = 0; j < 2 + Math.floor(z() * 4); j++) {
          const o = fels({ x: m.x + (z() - 0.5) * 7, y: m.y + (z() - 0.5) * 5 }, z, j === 0 && z() < 0.5 ? 1.5 : 0);
          if (frei(o, [...aussen, ...gruppen])) gruppen.push(o);
        }
      }
      // im Spiel: Kakteen nahe der Linie (nie auf der Ideallinie), offene Bahn: ein ganzes Kakteenfeld;
      // manchmal ein einzelner großer Felsbrocken, um den man herumwerfen muss
      const imSpielAnz = Math.round(L / 28 * (typ === "offen" ? 2.4 : typ === "schlucht" ? 0.3 : 1));
      const imSpiel = streue(z, g, imSpielAnz, (p, z) => { const d = naheBahn(p); return d > 2.5 + 1.6 && d < (typ === "offen" ? 12 : 9) ? kaktus(p, z) : null; }, (o, l) => frei(o, [...aussen, ...gruppen, ...l]));
      if (typ !== "schlucht" && typ !== "mando" && z() < 0.4) {
        const p = P(0.4 + z() * 0.3), sei = z() < 0.5 ? -1 : 1, d = 3 + z() * 3, o = fels({ x: p.x - p.uy * sei * d, y: p.y + p.ux * sei * d }, z, 2);
        if (frei(o, [...aussen, ...gruppen, ...imSpiel])) gruppen.push(o);
      }
      const baeume = [...feste, ...imSpiel, ...gruppen, ...aussen];
      // ein Sandweg (Jeep-Piste) als Bild, nicht über Abwurf/Korb und nicht durch die Schlucht
      const wy = z() < 0.5 ? 0 : g.welt.hoehe, wx = g.welt.breite * (0.2 + z() * 0.6);
      const wege = typ === "schlucht" || typ === "insel" || typ === "mando" ? [] : [{ punkte: [[r1(wx), r1(wy)], [r1(wx + (z() - 0.5) * 30), r1(g.welt.hoehe / 2)], [r1(wx + (z() - 0.5) * 50), r1(g.welt.hoehe - wy)]], breite: 3 }];
      if (wege.length && wege[0].punkte.some((q, i, a) => i && (abstandZurStrecke(abwurf, { x: a[i - 1][0], y: a[i - 1][1] }, { x: q[0], y: q[1] }) < 8 || abstandZurStrecke(korb, { x: a[i - 1][0], y: a[i - 1][1] }, { x: q[0], y: q[1] }) < 8))) wege.length = 0;
      return { typ, baeume, ob, wege, mauern, mando, keinXSpiegeln };
    },
  },
  // Dunkler Herbstabend: Wald in der Dämmerung, Weiher und Bäche als OB (art "wasser"), Mandos durch Baumriegel,
  // Inseln und eine Par-4-Inselkette. Optik mit nacht/glow: Mond und Sterne in der Putt-Ansicht, alle Scheiben
  // leuchten grün (Phosphor-Glow) – das braucht Spiel-Code ab 0.10.0 (Release), der Rest ist reine Daten.
  herbstnacht: {
    name: "Herbstnacht", optik: "herbstnacht",
    optikDaten: {
      basis: "herbst", nacht: true, glow: true,
      gras: ["#0e1a16", "#13221a", "#182a1e", "#1e3222", "#243a26", "#2c4430"],
      aus: ["#0a1410", "#0e1914", "#121e17", "#16241a", "#1a2a1e", "#1f3022"],
      fair: ["#1a3424", "#21402a", "#284a30", "#2f5436", "#365e3c", "#3f6844"],
      weg: ["#2a2420", "#352e28", "#403830", "#4a4238", "#564c42", "#62584c"],
      erde: ["#2a2018", "#352a1e", "#403226"],
      wasser: ["#060e1c", "#0a1628", "#0f1e36", "#152844", "#1e3654", "#6a88b0"],
      laubbaum: ["#1e0e06", "#44220c", "#6c3a14", "#925622", "#b47434"],
      laubbaumVarianten: [
        ["#1e0e06", "#44220c", "#6c3a14", "#925622", "#b47434"], // Ahorn orange
        ["#1e0808", "#421410", "#642218", "#863424", "#a64c32"], // Ahorn rot
        ["#1e1a06", "#423a10", "#645818", "#867426", "#a68e3a"], // Birke gelb
        ["#1c140c", "#30221a", "#463224", "#5c4430", "#745a40"], // Eiche braun
      ],
      kiefer: ["#060f0c", "#0a1a14", "#10241c", "#163024", "#22402e"],
      fels: ["#1e2024", "#2e3036", "#42444a", "#585a60", "#74767c"],
      busch: ["#121c10", "#1a2814", "#24341a", "#2e4022", "#3c502c"],
      himmel: ["#05081a", "#0a1230", "#141e44", "#2a2c54", "#523e5c"],
      wolken: ["#2a3350", "#1a2038"],
      circle: ["#d8e4f0", "#05080c"],
      circleStil: "glow", circleGlow: "#a8ff7a", // Circle 1 als grüner Leuchtring, nur auf Land, unter der OB-Linie
      blumen: { dichte: 0, farben: [] },
      laub: { dichte: 0.5, farben: ["#7a3e18", "#8a5a20", "#5e2a16", "#6a4a1c", "#7a2a1a"] },
      bueschel: 0.5,
      objekte: {
        findling: { form: "brocken", farben: "fels" },
        laterne: { form: "laterne", stil: 1, farben: ["#101216", "#3a3e46", "#6a6e76", "#ffc860", "#fff4c0"] }, // Stil 1: klassisch schlank
        hecke: { form: "kugel", farben: "busch" },
      },
    },
    namen: ["Glühwürmchen-Gasse", "Mondscheinmando", "Laternenlauf", "Nebelbank", "Eulenruf", "Fledermaus-Flex", "Kürbislicht",
      "Sternschnuppe", "Dämmerdrive", "Glow Getter", "Irrlicht", "Herbstfeuer", "Mitternachtsmando", "Blätterrauschen", "Schattenspiel",
      "Uhu-Ufer", "Grüner Schimmer", "Novembernebel", "Spukwald", "Kastanienkurve", "Phosphorpfad", "Leuchtkäfer", "Mondsichel",
      "Weiherweg", "Inselhüpfer", "Laubhaufen-Lob", "Nachtwanderung", "Zwielicht"],
    typen: { quer: 1.5, insel: 1.6, inselkette: 0.5, mando: 2, offen: 1 },
    // Reihenfolge der Bahntypen im Kurs (Wunsch: Mandos, Inseln, eine Par 4 mit Inselkette)
    plan: ["quer", "mando", "insel", "inselkette", "mando", "insel"],
    typPar: { inselkette: 4 },
    typNamen: { mando: ["Mondscheinmando", "Mitternachtsmando", "Schattenspiel"], insel: ["Uhu-Ufer", "Weiherweg", "Mondsichel"],
      inselkette: ["Inselhüpfer", "Sternschnuppe"] },
    baue(z, g, L, vorgabe) {
      const { abwurf, korb, linie } = g;
      const typ = vorgabe || waehleGewichtet(z, this.typen);
      const ob = [], baeche = [], feste = [];
      let mando = null; const sperrZonen = [];
      const P = t => punktAufLinie(linie, t);
      const insel = (m, R) => { const pk = []; for (let i = 0; i < 16; i++) { const w = i / 16 * Math.PI * 2, rr = R * (0.85 + z() * 0.3); pk.push([r1(m.x + Math.cos(w) * rr), r1(m.y + Math.sin(w) * rr * 0.85)]); } return pk; };
      const baum = (p, z, gross = 0) => ({ x: r1(p.x), y: r1(p.y), r: r1(1.6 + z() * 2 + gross), h: r1(7 + z() * 6 + gross * 2) });
      const keinXSpiegeln = typ === "insel" || typ === "inselkette";
      // Ufer: statt der geraden Kante bei x = ab ein Landstück mit gewelltem Rand (Ring von Rand zu Rand, gilt als
      // Insel und ist damit nicht OB); ab rückt 8 m zurück, der Rand liegt 0,5–15,5 m dahinter (Buchten und
      // Landzungen), aber immer 4 m vor den Inseln. Eigener Zufall aus der Korblage, damit der übrige Aufbau gleich bleibt.
      const ufer = (ab0, ringe) => {
        const H = g.welt.hoehe, p1 = korb.x * 1.7, p2 = korb.y * 2.3, pk = [[0, 0]];
        const grenze = y => Math.min(Infinity, ...ringe.filter(r => r.some(q => Math.abs(q[1] - y) < 6)).map(r => Math.min(...r.map(q => q[0])) - 4));
        for (let y = 0; y <= H + 0.01; y += 2) pk.push([r1(Math.max(ab0 + 0.5, Math.min(grenze(y), ab0 + 8 + 4 * Math.sin(y / 16 + p1) + 2.5 * Math.sin(y / 6 + p2) + Math.sin(y / 2.3 + p1)))), r1(Math.min(H, y))]);
        if (pk[pk.length - 1][1] < H) pk.push([pk[pk.length - 1][0], r1(H)]);
        pk.push([0, r1(H)]);
        return pk;
      };

      if (typ === "quer") {
        baeche.push(querBand(z, g, P(0.35 + z() * 0.35)));
        z(); // früher: zweiter Bach längs – keine kreuzenden Bäche (nur ein Gewässer je Bahn)
      } else if (typ === "insel") {
        const R = 8 + z() * 4, ab = r1(korb.x - R - 6 - z() * Math.min(18, L * 0.15));
        if (ab < abwurf.x + 30) return null;
        const ki = insel(korb, R);
        ob.push({ name: "Weiher", art: "wasser", insel: ki, inseln: [ufer(r1(ab - 8), [ki])], ab: r1(ab - 8) });
      } else if (typ === "inselkette") {
        // Par 4: Wasser ab x = ab, darin 2 Zwischeninseln auf der Linie und die Korbinsel; Lücken 8–14 m Wasser
        if (L < 150) return null;
        const Rk = 10 + z() * 2, inseln = [], mitten = [];
        let t = 1, rVor = Rk;
        for (let k = 0; k < 2; k++) {
          const R = 13 + z() * 3, luecke = 8 + z() * 6, len = L;
          t -= (rVor + luecke + R) / len;
          const p = P(t), sei = (z() - 0.5) * 8;
          mitten.push({ x: p.x - p.uy * sei, y: p.y + p.ux * sei, R }); rVor = R;
        }
        const erste = mitten[mitten.length - 1], ab = r1(erste.x - erste.R - 10 - z() * 6);
        if (ab < abwurf.x + 45) return null;
        for (const m of mitten) inseln.push(insel(m, m.R));
        const ki = insel(korb, Rk);
        ob.push({ name: "Weiher", art: "wasser", insel: ki, inseln: [ufer(r1(ab - 8), [ki, ...inseln]), ...inseln], ab: r1(ab - 8) });
        sperrZonen.push(...mitten.map(m => ({ x: m.x, y: m.y, r: m.R * 0.55 })));
      } else if (typ === "mando") {
        // Baumriegel quer zur Bahn mit einer Lücke von 8–11 m zwischen zwei großen Eichen
        const t = 0.35 + z() * 0.25, p = P(t), luecke = 8 + z() * 3, versatz = (z() - 0.5) * 3;
        const rs = [3 + z(), 3 + z()], nx = -p.uy, ny = p.ux;
        const a = { x: r1(p.x + nx * (versatz + luecke / 2 + rs[0])), y: r1(p.y + ny * (versatz + luecke / 2 + rs[0])) };
        const b = { x: r1(p.x - nx * (luecke / 2 - versatz + rs[1])), y: r1(p.y - ny * (luecke / 2 - versatz + rs[1])) };
        feste.push({ ...a, r: r1(rs[0]), h: r1(13 + z() * 3) }, { ...b, r: r1(rs[1]), h: r1(13 + z() * 3) });
        mando = { a: [a.x, a.y], b: [b.x, b.y] };
        for (const [q, sei, r0] of [[a, 1, rs[0]], [b, -1, rs[1]]]) {
          let d = r0, x = q.x, y = q.y;
          for (let k = 0, n = 4 + Math.floor(z() * 3); k < n; k++) {
            const r = 2 + z() * 1.6; d = r + d * 0.8;
            x += nx * sei * d + (z() - 0.5) * 1.5; y += ny * sei * d + (z() - 0.5) * 1.5; d = r;
            feste.push({ x: r1(x), y: r1(y), r: r1(r), h: r1(11 + z() * 4) });
            // Hecke dazwischen, damit der Riegel dicht wirkt
            if (z() < 0.6) feste.push({ x: r1(x + (z() - 0.5) * 2 + p.ux * 2.5), y: r1(y + (z() - 0.5) * 2 + p.uy * 2.5), r: r1(1.2 + z() * 0.6), h: r1(1.6 + z() * 0.8), art: "hecke" });
          }
        }
        sperrZonen.push({ x: p.x + nx * versatz, y: p.y + ny * versatz, r: luecke / 2 + 2 });
        if (z() < 0.4) baeche.push(querBand(z, g, P(t < 0.5 ? 0.7 + z() * 0.06 : 0.2 + z() * 0.08)));
      } else if (typ === "offen") {
        if (z() < 0.5) baeche.push(laengsBand(z, g, linie));
      }
      for (const [i, fb] of baeche.entries()) ob.push({ name: "Bach " + (i + 1), art: "wasser", punkte: fb });

      const imWasser = p => baeche.some(fb => imPolygon(p, fb)) || ob.some(o => o.insel && p.x >= o.ab && !inselRinge(o).some(r => imPolygon(p, r)));
      const wasserNah = (p, d) => baeche.some(fb => imPolygon(p, fb) || abstandZurLinie(p, [...fb, fb[0]]) < d);
      if (wasserNah(abwurf, 8) || wasserNah(korb, 14)) return null;
      const frei = (o, liste) => {
        if (abstand(o, abwurf) < 7 || abstand(o, korb) < 5 + o.r) return false;
        if (imWasser(o) || wasserNah(o, o.r + 0.3) || sperrZonen.some(q => abstand(q, o) < q.r + o.r)) return false;
        if ([...feste, ...liste].some(q => abstand(q, o) < q.r + o.r + 0.6)) return false;
        return o.x > -2 && o.y > -2 && o.x < g.welt.breite + 2 && o.y < g.welt.hoehe + 2;
      };
      // Bäume auf Inseln: höchstens ein kleiner, nicht auf der Korbinsel
      const naheBahn = p => abstandZurLinie(p, linie);
      const flaeche = g.welt.breite * g.welt.hoehe, dichte = typ === "offen" ? 1.4 : 0.9 + z() * 0.5;
      const findling = (p, z) => ({ x: r1(p.x), y: r1(p.y), r: r1(0.9 + z() * 1.3), h: r1(1 + z() * 1.2), art: "findling", fest: true });
      const hecke = (p, z) => ({ x: r1(p.x), y: r1(p.y), r: r1(0.9 + z() * 0.9), h: r1(1.2 + z() * 1), art: "hecke" });
      const aussen = streue(z, g, Math.round(flaeche / 120 * dichte), (p, z) => { const d = naheBahn(p); if (d < 10) return null; const w = z(); return w < 0.78 ? baum(p, z) : w < 0.9 ? hecke(p, z) : findling(p, z); }, frei);
      const imSpielAnz = Math.round(L / 30 * (typ === "offen" ? 2 : typ === "inselkette" ? 0.4 : 1));
      const imSpiel = streue(z, g, imSpielAnz, (p, z) => { const d = naheBahn(p); return d > 4.2 && d < (typ === "offen" ? 11 : 9) ? (z() < 0.75 ? baum(p, z) : findling(p, z)) : null; }, (o, l) => frei(o, [...aussen, ...l]));
      const baeume = [...feste, ...imSpiel, ...aussen];
      // Waldweg als Bild (Brücke über Wasser), nicht über Abwurf/Korb
      const wy = z() < 0.5 ? 0 : g.welt.hoehe, wx = g.welt.breite * (0.2 + z() * 0.6);
      const strecken = pk => pk.slice(1).map((q, i) => [{ x: pk[i][0], y: pk[i][1] }, { x: q[0], y: q[1] }]);
      const nahWeg = (p, pk, d) => strecken(pk).some(([a, b]) => abstandZurStrecke(p, a, b) < d);
      let wege;
      const uferRing = (ob.find(o => o.inseln) || {}).inseln?.[0];
      if (uferRing) {
        // Uferweg: 5 m landeinwärts am gewellten Ufer entlang
        wege = [{ punkte: uferRing.slice(1, -1).map(([x, y]) => [r1(x - 5), y]), breite: 2.2 }];
      } else {
        wege = [{ punkte: [[r1(wx), r1(wy)], [r1(wx + (z() - 0.5) * 30), r1(g.welt.hoehe / 2)], [r1(wx + (z() - 0.5) * 50), r1(g.welt.hoehe - wy)]], breite: 2.5 }];
        // Mando: der Waldweg darf den Baumriegel nicht durchschneiden
        if (mando && feste.some(f => nahWeg(f, wege[0].punkte, f.r + 3))) wege = [];
      }
      if (wege.length && (nahWeg(abwurf, wege[0].punkte, 8) || nahWeg(korb, wege[0].punkte, 8))) wege = [];
      // Laternen am Weg: alle ~16 m, abwechselnd links und rechts, nicht im Wasser und nicht an Abwurf/Korb
      const laternen = [];
      for (const w of wege) {
        let rest = 6, sei = 1;
        for (const [a, b] of strecken(w.punkte)) {
          const len = abstand(a, b), ux = (b.x - a.x) / (len || 1), uy = (b.y - a.y) / (len || 1);
          for (; rest <= len; rest += 16, sei = -sei) {
            const d = w.breite / 2 + 1.1, o = { x: r1(a.x + ux * rest - uy * d * sei), y: r1(a.y + uy * rest + ux * d * sei), r: 0.3, h: 3.6, art: "laterne", fest: true };
            if (o.x < 1 || o.y < 1 || o.x > g.welt.breite - 1 || o.y > g.welt.hoehe - 1) continue;
            if (imWasser(o) || wasserNah(o, 1) || abstand(o, abwurf) < 7 || abstand(o, korb) < 8 || feste.some(f => abstand(f, o) < f.r + 1.5)) continue;
            laternen.push(o);
          }
          rest -= len;
        }
      }
      // Bäume auf dem Weg und direkt an den Laternen weg
      const aufWeg = o => wege.some(w => nahWeg(o, w.punkte, o.r + w.breite / 2)) || laternen.some(l => abstand(l, o) < o.r + 1);
      return { typ, baeume: [...laternen, ...baeume.filter(o => !aufWeg(o) || feste.includes(o))], ob, wege, mauern: [], mando, keinXSpiegeln };
    },
  },
};

// Flussbett/Bach quer über die Bahn am Punkt p (aus punktAufLinie) bzw. längs auf einer Seite (wie ein Aus)
function querBand(z, g, p) {
  const nx = -p.uy, ny = p.ux;
  const mitte = [], breiten = [], schwung = 3 + z() * 5, phase = z() * 6, schraeg = (z() - 0.5) * 0.6;
  for (let s = -1.2; s <= 1.2001; s += 0.1) {
    const d = s * g.welt.hoehe, m = Math.sin(s * 5 + phase) * schwung;
    mitte.push([r1(p.x + nx * d + p.ux * (m + d * schraeg)), r1(p.y + ny * d + p.uy * (m + d * schraeg))]);
    breiten.push(5 + z() * 2 + Math.sin(s * 3 + phase) * 2);
  }
  return band(mitte, breiten);
}
function laengsBand(z, g, linie) {
  const seite = z() < 0.5 ? -1 : 1, mitte = [], breiten = [];
  for (let k = 0; k <= 20; k++) {
    const t = k / 20, x = -5 + (g.welt.breite + 10) * t;
    const y = (() => { const [a, b, c] = linie; return x <= b[0] ? a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]) : b[1] + (c[1] - b[1]) * (x - b[0]) / (c[0] - b[0]); })();
    mitte.push([r1(x), r1(y + seite * (21 + z() * 4 + Math.sin(t * 7) * 2.5))]);
    breiten.push(6 + z() * 3);
  }
  return band(mitte, breiten);
}
// Inselringe einer OB-Zone (wie inselRinge in grafik.js): insel und weitere inseln
const inselRinge = o => [o.insel, ...(o.inseln || [])].filter(Boolean);

// Zufallsauswahl nach Gewichten {name: gewicht}
function waehleGewichtet(z, gewichte) {
  const e = Object.entries(gewichte), summe = e.reduce((a, [, w]) => a + w, 0);
  let r = z() * summe;
  for (const [k, w] of e) { if ((r -= w) < 0) return k; }
  return e[e.length - 1][0];
}
// Punkt bei Anteil t (0…1) der Länge einer Polylinie [[x, y], …] mit Richtung (ux, uy)
function punktAufLinie(pk, t) {
  const seg = pk.slice(1).map((q, i) => Math.hypot(q[0] - pk[i][0], q[1] - pk[i][1])), ges = seg.reduce((a, b) => a + b, 0);
  let rest = Math.max(0, Math.min(1, t)) * ges;
  for (let i = 0; i < seg.length; i++) {
    if (rest <= seg[i] || i === seg.length - 1) {
      const f = Math.min(1, rest / seg[i]), [ax, ay] = pk[i], [bx, by] = pk[i + 1];
      return { x: ax + (bx - ax) * f, y: ay + (by - ay) * f, ux: (bx - ax) / seg[i], uy: (by - ay) / seg[i] };
    }
    rest -= seg[i];
  }
}

// ---------- Kurs bauen: ANZAHL Bahnen eines Themas ----------
const ANZAHL_STANDARD = 6; // Bahnen pro Woche (Ziel später: 18)
function baueBahn(T, { woche, thema, seed, nr, parErzwungen, belegteNamen, typVorgabe }) {
  for (let versuch = 0; versuch < 200; versuch++) {
    // Bahn 1 nutzt denselben Zufall wie früher (eine Bahn pro Woche), die weiteren einen eigenen
    const z = zufall(hashText(`${woche}|${thema}|${seed}|${versuch}` + (nr > 1 ? `|b${nr}` : "")));
    const { par, L } = waehlePar(z, parErzwungen || (typVorgabe && T.typPar && T.typPar[typVorgabe]));
    const g = geruest(z, L);
    const teile = T.baue(z, g, L, typVorgabe);
    if (!teile) continue;
    // Fantasiename: zufällig aus der Liste, aber jeder nur einmal pro Woche
    // passende Typ-Namen zuerst; Namen anderer Typen nie
    const typN = (T.typNamen || {})[teile.typ] || [], fremd = new Set(Object.values(T.typNamen || {}).flat());
    const kandidaten = [...typN.filter(n => !belegteNamen.has(n)), ...T.namen.filter(n => !fremd.has(n) && !belegteNamen.has(n))];
    const zn = typN.some(n => !belegteNamen.has(n)) ? typN.filter(n => !belegteNamen.has(n)).length : kandidaten.length;
    const name = kandidaten[Math.floor(z() * zn)] || T.namen.find(n => !belegteNamen.has(n));
    belegteNamen.add(name);
    // für Abwechslung: Bahn zufällig senkrecht spiegeln (eigener Zufall). Nie waagerecht: Gespielt wird immer
    // von links nach rechts (hochkant: von unten nach oben) – wechselnde Richtungen verwirren.
    const zs = zufall(hashText(`${woche}|${thema}|${seed}|${nr}|spiegeln`)), sx = (zs(), false), sy = zs() < 0.5;
    const W = g.welt.breite, Hh = g.welt.hoehe, fx = x => r1(sx ? W - x : x), fy = y => r1(sy ? Hh - y : y);
    const P = p => ({ ...p, x: fx(p.x), y: fy(p.y) }), L2 = pk => pk.map(([x, y]) => [fx(x), fy(y)]);
    g.abwurf = P(g.abwurf); g.korb = P(g.korb); g.fairway = L2(g.fairway);
    teile.baeume = teile.baeume.map(P);
    teile.wege = teile.wege.map(w => ({ ...w, punkte: L2(w.punkte) }));
    teile.ob = teile.ob.map(o => o.insel ? { ...o, insel: L2(o.insel), ...(o.inseln ? { inseln: o.inseln.map(L2) } : {}) } : { ...o, punkte: L2(o.punkte) });
    // einmal gespiegelt dreht sich die Laufrichtung der Wandlinie um: Felsband bleibt außen
    teile.mauern = (teile.mauern || []).map(m => ({ ...m, punkte: L2(m.punkte), seite: sx !== sy ? -m.seite : m.seite }));
    if (teile.mando) teile.mando = { ...teile.mando, a: L2([teile.mando.a])[0], b: L2([teile.mando.b])[0] };
    return {
      bahn: {
        nummer: nr, name, ort: "Wochenkurs · " + T.name, par, optik: T.optik,
        welt: { breite: g.welt.breite, hoehe: g.welt.hoehe },
        abwurf: g.abwurf, korb: g.korb, fairway: g.fairway,
        baeume: teile.baeume, wege: teile.wege, ob: teile.ob,
        ...(teile.mauern.length ? { mauern: teile.mauern } : {}), ...(teile.mando ? { mando: teile.mando } : {}),
      },
      erzeugt: { versuch, laenge: L, typ: teile.typ },
    };
  }
  throw new Error(`Bahn ${nr}: keine gültige Bahn gefunden – anderen --seed versuchen.`);
}
function baueKurs({ thema, woche, seed = 0, name, par: parErzwungen, anzahl = ANZAHL_STANDARD, typen }) {
  const T = THEMEN[thema];
  if (!T) throw new Error(`Unbekanntes Thema "${thema}". Vorhanden: ${Object.keys(THEMEN).join(", ")}`);
  if (T.namen.length < anzahl + 1) throw new Error(`Thema ${thema}: zu wenige Namen (${T.namen.length}) für ${anzahl} Bahnen plus Kursname`);
  const [jahr, kw] = woche.split("-").map(Number);
  const belegteNamen = new Set(name ? [name] : []), erg = []; // vorgegebener Kursname wird kein Bahnname
  // Bahntypen: --typen a,b,… oder der Plan des Themas (sonst je Bahn zufällig nach Gewicht)
  const plan = typen || T.plan;
  for (let nr = 1; nr <= anzahl; nr++) erg.push(baueBahn(T, { woche, thema, seed, nr, parErzwungen, belegteNamen, typVorgabe: plan ? plan[(nr - 1) % plan.length] : undefined }));
  // Kursname: eigener Fantasiename (vorgegeben oder der erste noch freie aus der Liste) + KWxx
  const z = zufall(hashText(`${woche}|${thema}|${seed}|kurs`));
  let kursname = name;
  if (!kursname) { const fremd = new Set(Object.values(T.typNamen || {}).flat()), frei = T.namen.filter(n => !belegteNamen.has(n) && !fremd.has(n)); kursname = frei[Math.floor(z() * frei.length)]; }
  return {
    woche, ab: montagDerWoche(jahr, kw).toISOString().slice(0, 10), thema: T.name, optik: T.optik,
    name: kursname + " KW" + String(kw).padStart(2, "0"),
    ...(T.optikDaten ? { optikDaten: T.optikDaten } : {}),
    bahnen: erg.map(e => e.bahn),
    erzeugt: { seed, bahnen: erg.map(e => e.erzeugt) },
  };
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
//  Jede Woche ein neuer Kurs: ab Montag 0:00 (deutsche Zeit) ist der jüngste Eintrag mit
//  "ab" <= heute der aktuelle Wochenkurs, die älteren stehen im Archiv (/archiv/).
//  Diese Datei ist reine Daten: Die Action „Wochenbahn live“ kopiert sie sonntags von dev nach main.
//  Felder: woche (ISO-Jahr-KW), ab (Montag), thema, optik (Schlüssel in JAHRESZEITEN, grafik.js),
//  name (Kursname mit KW), bahnen (wie in bahnen.js; baeume mit art "kaktus"/"fels" und Höhe h),
//  erzeugt (Seed zum Nachbauen)
// ============================================================
`;
  const text = kopf + "window.WOCHENBAHNEN = [\n" + liste.map(e => JSON.stringify(e)).join(",\n") + "\n];\n";
  writeFileSync(DATEI, text);
}
// Gegenstände (3/4-Ansicht): Formen und eingebaute Arten direkt aus grafik.js lesen, damit beides gleich bleibt
function baukasten() {
  const g = readFileSync(join(WURZEL, "grafik.js"), "utf8");
  const formen = JSON.parse((g.match(/window\.OBJEKT_FORMEN = (\[[^\]]*\])/) || [, "[]"])[1]);
  const block = (g.match(/window\.OBJEKT_ARTEN = \{([\s\S]*?)\n\};/) || [, ""])[1];
  const arten = [...block.matchAll(/^\s+(\w+): \{ form:/gm)].map(m => m[1]);
  return { formen, arten };
}
function pruefe(liste) {
  const fehler = [], { formen, arten } = baukasten();
  for (const e of liste) {
    // eigene Arten des Themas: optikDaten.objekte = { art: { form, farben } }
    const eigene = (e.optikDaten && e.optikDaten.objekte) || {};
    for (const [art, d] of Object.entries(eigene)) {
      if (!formen.includes(d.form)) fehler.push(e.woche + `: Art "${art}" hat unbekannte Form "${d.form}" (vorhanden: ${formen.join(", ")})`);
      if (!(typeof d.farben === "string" || (Array.isArray(d.farben) && d.farben.length >= 5))) fehler.push(e.woche + `: Art "${art}" braucht farben (Palettenname oder mind. 5 Farben dunkel → hell)`);
    }
    if (!/^\d{4}-\d{1,2}$/.test(e.woche) || !/^\d{4}-\d\d-\d\d$/.test(e.ab)) fehler.push(e.woche + ": woche/ab ungültig");
    const bahnen = e.bahnen || [e.bahn];
    if (!bahnen.length || bahnen.length > 30) fehler.push(e.woche + ": 1–30 Bahnen");
    bahnen.forEach((b, i) => { if (b.nummer !== i + 1) fehler.push(e.woche + `: Bahn ${i + 1} hat nummer ${b.nummer}`); });
    for (const b of bahnen) {
    if (!b || !b.welt || Math.abs(b.welt.hoehe - b.welt.breite * 9 / 16) > 0.01) fehler.push(e.woche + ": welt.hoehe muss breite × 9/16 sein");
    if (![3, 4, 5].includes(b.par)) fehler.push(e.woche + ": par");
    for (const p of [b.abwurf, b.korb]) if (!(p.x > 0 && p.y > 0 && p.x < b.welt.breite && p.y < b.welt.hoehe)) fehler.push(e.woche + ": Abwurf/Korb außerhalb");
    const imOB = p => (b.ob || []).some(o => o.insel ? p.x >= o.ab && !inselRinge(o).some(r => imPolygon(p, r)) : o.punkte && imPolygon(p, o.punkte));
    if (imOB(b.abwurf) || imOB(b.korb)) fehler.push(e.woche + ": Abwurf/Korb im OB (Bahn " + b.nummer + ")");
    for (const t of b.baeume || []) {
      if (t.art && !arten.includes(t.art) && !eigene[t.art]) fehler.push(e.woche + `: unbekannte Art "${t.art}" (Bahn ${b.nummer}) – eingebaut: ${arten.join(", ")}; sonst in optikDaten.objekte festlegen`);
      if (t.art && !(t.h > 0)) fehler.push(e.woche + `: Gegenstand "${t.art}" ohne Höhe h (Bahn ${b.nummer})`);
    }
    if (b.mando && !(b.baeume || []).some(t => Math.hypot(t.x - b.mando.a[0], t.y - b.mando.a[1]) < 0.5)) fehler.push(e.woche + ": Mando ohne Felsen (Bahn " + b.nummer + ")");
    }
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
const eintrag = baueKurs({ thema, woche, seed: Number(arg("seed") || 0), name: arg("name"), par: arg("par") ? Number(arg("par")) : undefined,
  anzahl: arg("bahnen") ? Number(arg("bahnen")) : undefined, typen: arg("typen") ? arg("typen").split(",") : undefined });
const neu = [...liste.filter(e => e.woche !== woche), eintrag];
const f = pruefe(neu);
if (f.length) { console.error(f.join("\n")); process.exit(1); }
schreibe(neu);
const par = eintrag.bahnen.reduce((a, b) => a + b.par, 0), luft = b => Math.round(Math.hypot(b.korb.x - b.abwurf.x, b.korb.y - b.abwurf.y));
console.log(`KW ${wk}/${wj} ab ${eintrag.ab}: „${eintrag.name}“ · ${eintrag.thema} · ${eintrag.bahnen.length} Bahnen · Par ${par} · ${eintrag.bahnen.reduce((a, b) => a + luft(b), 0)} m`);
eintrag.bahnen.forEach((b, i) => console.log(`  ${b.nummer}. ${b.name.padEnd(22)} ${eintrag.erzeugt.bahnen[i].typ.padEnd(8)} Par ${b.par} · ${String(luft(b)).padStart(3)} m Luftlinie (${eintrag.erzeugt.bahnen[i].laenge} m gespielt) · ${b.baeume.length} Hindernisse, ${b.ob.length} OB`));
