// ============================================================
//  DETAILGRAFIK MIT JAHRESZEITEN
// ============================================================
//  Detailliertere Pixelgrafik für das Bahnbild. Läuft im Kontext von index.html
//  und nutzt dessen Hilfsfunktionen (maske, polygonPfad, zufall, pixelKreis,
//  zeichneLinien, zeichneBauten, zeichneMando …).
//  Bilder je Jahreszeit: node werkzeuge/grafik_vorschau.mjs [bahn] [ordner]
//
//  Ideen darin:
//   - Paletten mit 4–6 Stufen statt 2–3, Schatten bläulicher, Lichter gelblicher
//   - Gras mit großflächigem Rauschen + geordnetem Dithering (Bayer 4×4)
//     statt reinem Pixelrauschen; Grasbüschel, Blumen, Klee, Maulwurfshügel
//   - gemähte Bahn in Fahrtrichtung, ausgefranste Kanten, abgelaufene Stelle am Abwurf
//   - Wege mit dunklem Rand, hellerer Mitte, Kieseln und Gras am Rand
//   - Bäume aus mehreren Blättergruppen mit Kontur und Licht von links oben;
//     Laubbäume und Kiefern; Schatten als dunklere Palettenstufe statt Transparenz
//   - Holzdeck aus Querdielen mit Fugen, Nägeln und Maserung, Zaun mit Pfosten und Maschen
//   - Abwurf aus Beton mit Bahnschild und Bank
//   - vier Jahreszeiten (optionen.jahreszeit: fruehling, sommer, herbst, winter):
//     eigene Paletten für Boden und Bäume, Blüten, Herbstlaub, Schnee und kahle Äste;
//     im Herbst fallen bunte Blätter (zeichneLaubfall, jedes Bild in der Spielschleife)
//   - Themen-Optiken der Wochenbahnen stehen mit in JAHRESZEITEN (z. B. "wueste": Sand mit
//     Windrippeln, Kakteen und Felsen statt Bäumen, rissige Flussbetten als OB mit art "flussbett")
// ============================================================
"use strict";

window.zeichneHintergrundDetail = function (z, optionen = {}) {
  // kronen: false = 3/4-Ansicht im Spiel – Laub- und Nadelbäume nur als Schatten im Bahnbild, die Kronen
  // zeichnet das Spiel als angehobene Sprites (baumSprite), damit Figuren dahinter verschwinden können
  const opt = Object.assign({ deko: true, kiefern: true, jahreszeit: "sommer", kronen: true }, optionen);
  const BW = Math.round(W * z), BH = Math.round(H * z);
  const hg = document.createElement("canvas");
  hg.width = BW; hg.height = BH;
  const c = hg.getContext("2d");
  const zr = Math.max(1, Math.round(z));

  // ---------- Masken wie im Spiel ----------
  const aufWeg = maske(m => {
    for (const f of bahn.wegFlaechen || []) { polygonPfad(m, f); m.fill(); }
    for (const w of bahn.wege || []) {
      m.lineWidth = w.breite; m.beginPath();
      w.punkte.forEach(([x, y], i) => i ? m.lineTo(x, y) : m.moveTo(x, y));
      m.stroke();
    }
  }, BW, BH);
  const aufFairway = maske(m => { if (bahn.fairway && bahn.fairway.length) { polygonPfad(m, bahn.fairway); m.fill(); } }, BW, BH);
  const obTests = (bahn.ob || []).map(o => {
    if (o.w !== undefined) return (px, py, x, y) => x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h;
    const mm = maske(cc => { polygonPfad(cc, o.linie ? linienFlaeche(o) : o.punkte || o.insel); cc.fill(); }, BW, BH);
    return o.insel ? (px, py, x) => x >= o.ab && !mm(px, py) : (px, py) => mm(px, py);
  });
  const inBild = (px, py) => px >= 0 && py >= 0 && px < BW && py < BH;
  const wegB = (px, py) => inBild(px, py) && aufWeg(px, py);
  const fairB = (px, py) => inBild(px, py) && aufFairway(px, py);

  // ---------- Rauschen und Dithering ----------
  const hash = (x, y, s = 0) => {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const vnoise = (x, y, s) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), cc = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
    return a + (b - a) * u + (cc - a) * v + (a - b - cc + d) * u * v;
  };
  const fbm = (x, y, s) => vnoise(x, y, s) * 0.55 + vnoise(x * 2.3, y * 2.3, s + 1) * 0.3 + vnoise(x * 5.1, y * 5.1, s + 2) * 0.15;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bay = (px, py) => (BAYER[(py & 3) * 4 + (px & 3)] + 0.5) / 16;
  // Wert t (0…1) auf eine Farbrampe abbilden, Zwischenstufen gedithert
  const stufe = (n, t, px, py) => { const f = Math.max(0, Math.min(1, t)) * (n - 1); let i = Math.floor(f); if (f - i > bay(px, py)) i++; return Math.min(n - 1, i); };

  // ---------- Paletten (dunkel → hell) ----------
  const R = a => a.map(rgb);
  const JZ = JAHRESZEITEN[opt.jahreszeit] || JAHRESZEITEN.sommer, winter = !!JZ.schnee, wueste = !!JZ.wueste;
  const GRAS = R(JZ.gras), AUS = R(JZ.aus), FAIR = R(JZ.fair), WEG = R(JZ.weg), FLUSS = R(JZ.flussbett || JZ.aus);
  const ERDE = R(JZ.erde || ["#5a4228", "#735634", "#8c6c42"]);
  const DECK = R(["#5e3c1e", "#7a5530", "#9a6e3a", "#b88a4c", "#cfa262", "#e0bc7c"]);

  // Bäume vorbereiten: Typ (Laub/Kiefer) aus der Lage, damit er immer gleich bleibt
  // In der Wüste stehen statt Bäumen Kakteen und Felsen (art in den Bahndaten, sonst zufällig nach Lage)
  const baeume = [...bahn.baeume].sort((a, b) => a.r - b.r).map(b => {
    const h = hash(Math.round(b.x * 10), Math.round(b.y * 10), 6);
    // Gegenstände mit "art" (Kaktus, Fels, Arten neuer Themen): Form und Farben aus dem Baukasten (objektArt)
    const art = b.art || (wueste ? (hash(Math.round(b.x * 10), Math.round(b.y * 10), 5) < 0.55 ? "kaktus" : "fels") : null);
    if (art) { const def = objektArt({ art }, JZ, h); return { ...b, art, kiefer: false, kahl: false, form: def.form, farben: def.farben }; }
    const kiefer = opt.kiefern && hash(Math.round(b.x * 10), Math.round(b.y * 10), 5) < 0.3;
    return { ...b, kiefer, kahl: winter && !kiefer, farben: kiefer ? JZ.kiefer : JZ.laubbaum(h) };
  });
  // Schatten fallen nach rechts unten (Licht von links oben)
  // als Maske einmal gezeichnet (schneller als jeden Bildpunkt gegen alle Bäume zu prüfen)
  const schattenMaske = maske(m => {
    for (const b of baeume) {
      if (b.kahl) continue;
      if (b.form === "saeule") {
        // Kakteen sind hoch und schmal: langer Schatten nach rechts unten
        m.lineWidth = b.r * 1.3; m.lineCap = "round"; m.beginPath();
        m.moveTo(b.x + b.r * 0.2, b.y + b.r * 0.2); m.lineTo(b.x + b.r * 0.2 + (b.h || 4) * 0.55, b.y + b.r * 0.2 + (b.h || 4) * 0.7); m.stroke();
        continue;
      }
      m.beginPath(); m.ellipse(b.x + b.r * 0.35, b.y + b.r * 0.45, b.r * 1.01, b.r * 1.01 / 1.15, 0, 0, Math.PI * 2); m.fill();
    }
  }, BW, BH);
  const ab = bahn.abwurf;
  // Wurfrichtung (Abwurf → Korb): Mähstreifen laufen in diese Richtung, die abgelaufene Stelle liegt davor
  const rl = Math.hypot(bahn.korb.x - ab.x, bahn.korb.y - ab.y) || 1, ux = (bahn.korb.x - ab.x) / rl, uy = (bahn.korb.y - ab.y) / rl;

  // ---------- Bodenschicht pixelweise ----------
  const bild = c.createImageData(BW, BH), d = bild.data;
  const setze = (px, py, f) => { if (!inBild(px, py)) return; const i = (py * BW + px) * 4; d[i] = f[0]; d[i + 1] = f[1]; d[i + 2] = f[2]; d[i + 3] = 255; };
  const art = new Uint8Array(BW * BH); // 0 Gras, 1 Aus, 2 Fairway, 3 Weg, 4 Deck, 5 Erde
  const kante = Math.max(1, Math.round(0.45 * S)); // Breite der ausgefransten Fairwaykante in Pixeln
  const l = bahn.bowlingbahn;
  const lAchse = l && (() => { const dx = l.x2 - l.x1, dy = l.y2 - l.y1, len = Math.hypot(dx, dy); return { ux: dx / len, uy: dy / len, len }; })();

  // großflächiges Rauschen nur alle "rs" Bildpunkte neu berechnen (ändert sich erst über Meter)
  const rs = Math.max(1, Math.floor(S / 5)), nZeile = new Float32Array(BW);
  for (let py = 0; py < BH; py++) for (let px = 0; px < BW; px++) {
    const x = (px + 0.5) / S, y = (py + 0.5) / S;
    if (py % rs === 0 && px % rs === 0) nZeile[px] = fbm(x / 7, y / 7, 1);
    const n = nZeile[px - px % rs], fein = hash(px, py, 9);
    const zi = obTests.findIndex(t => t(px, py, x, y)), zone = zi >= 0 ? bahn.ob[zi] : null;
    const wirft = (qx, qy) => (l && aufBowlingbahn({ x: qx, y: qy }, bahn)) || (Math.abs(qx - ab.x) < 1.6 && Math.abs(qy - ab.y) < 1.1);
    const schatten = schattenMaske(px, py) || wirft(x - 0.3, y - 0.4) ? 2 : 0;
    let f, a = 0;
    if (l && aufBowlingbahn({ x, y }, bahn)) {
      // Dielen längs, versetzte Stöße, Maserung, dunkle Ränder
      const u = (x - l.x1) * lAchse.ux + (y - l.y1) * lAchse.uy, v = -(x - l.x1) * lAchse.uy + (y - l.y1) * lAchse.ux + l.breite / 2;
      // Dielen quer zur Bahn (wie ein Steg): so bleiben die Fugen trotz der leichten Schräge gerade
      const dp = Math.max(3, Math.round(0.45 * S)), up = Math.floor(u * S), diele = Math.floor(up / dp);
      let t = 0.6 + 0.28 * (vnoise(diele * 3.7, v * 1.8, 3) - 0.5) + 0.18 * (hash(diele, 0, 4) - 0.5);
      if (up % dp === 0) t = 0.2; else if (up % dp === 1) t += 0.14;
      if (hash(diele, Math.floor(v / 0.9), 6) < 0.08 && Math.abs((v % 0.9) - 0.45) < 0.06) t = 0.25; // Nagel
      if (v < 0.3 || v > l.breite - 0.3) t = 0.1;
      if (winter && fbm(x * 1.2, y * 1.2, 12) + (fein - 0.5) * 0.15 > 0.52) { f = GRAS[stufe(GRAS.length, 0.75 + (fein - 0.5) * 0.3, px, py)]; a = 4; art[py * BW + px] = a; const i = (py * BW + px) * 4; d[i] = f[0]; d[i + 1] = f[1]; d[i + 2] = f[2]; d[i + 3] = 255; continue; }
      f = DECK[stufe(DECK.length, t, px, py)]; a = 4;
    } else if (zone && zone.art === "flussbett") {
      // ausgetrocknetes Flussbett: rissige Lehmschollen (Zellen um zufällige Punkte, Risse an den Grenzen)
      const g = 1.3, cxg = Math.floor(x / g), cyg = Math.floor(y / g);
      let d1 = 9, d2 = 9, zelle = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const qx = (cxg + i + hash(cxg + i, cyg + j, 21)) * g, qy = (cyg + j + hash(cxg + i, cyg + j, 22)) * g, dd = Math.hypot(x - qx, y - qy);
        if (dd < d1) { d2 = d1; d1 = dd; zelle = hash(cxg + i, cyg + j, 23); } else if (dd < d2) d2 = dd;
      }
      const riss = (d2 - d1) * S < Math.max(1, S * 0.09);
      let t = riss ? 0.02 : 0.45 + (zelle - 0.5) * 0.35 + (n - 0.5) * 0.3 + Math.min(0.2, (d2 - d1) * 0.25) + (fein - 0.5) * 0.08;
      f = FLUSS[stufe(FLUSS.length, t - schatten * 0.18, px, py)]; a = 1;
    } else if (zone && zone.w !== undefined && !zone.art) {
      f = WEG[stufe(WEG.length, 0.4 + n * 0.4, px, py)]; a = 3;
    } else if (wegB(px, py)) {
      // Rand dunkler, Mitte heller, Kiesel
      let rand = 0;
      for (let k = 1; k <= Math.max(1, Math.round(0.3 * S)); k++) if (!wegB(px + k, py) || !wegB(px - k, py) || !wegB(px, py + k) || !wegB(px, py - k)) { rand = k; break; }
      let t = 0.45 + (n - 0.5) * 0.5 + (fein - 0.5) * 0.15;
      if (rand) t -= 0.35 / rand;
      if (fein > 0.985) t = 1; else if (fein < 0.012) t = 0;
      f = WEG[stufe(WEG.length, t - schatten * 0.15, px, py)]; a = 3;
    } else {
      let imFair = fairB(px, py);
      // ausgefranste Kante: in der Übergangszone entscheidet das Dithermuster
      if (!zone) {
        const ringsum = fairB(px + kante, py) + fairB(px - kante, py) + fairB(px, py + kante) + fairB(px, py - kante);
        if (ringsum > 0 && ringsum < 4) imFair = (ringsum + (imFair ? 1 : 0)) / 5 > bay(px, py) * 0.6 + 0.2 + (fein - 0.5) * 0.3;
      }
      // abgelaufene Stelle direkt vor dem Abwurf
      const lx = x - ab.x - ux * 2.6, ly = y - ab.y - uy * 2.6, dxAb = (lx * ux + ly * uy) / 2.6, dyAb = (-lx * uy + ly * ux) / 1.6;
      const abgelaufen = dxAb * dxAb + dyAb * dyAb + (vnoise(x * 1.5, y * 1.5, 7) - 0.5) * 0.9 < 1;
      if (abgelaufen && !zone) {
        const t = vnoise(x * 3, y * 3, 8);
        if (t > 0.62 && fein > 0.35) { f = ERDE[stufe(ERDE.length, (t - 0.62) * 3, px, py)]; a = 5; }
        else f = FAIR[stufe(FAIR.length, 0.75 + (t - 0.5) * 0.4, px, py)], a = 2;
      } else if (imFair && wueste) {
        // festgefahrener Sand mit feinen Windrippeln quer zum Wind (leicht schräg zur Bahn)
        const rip = Math.sin((x * 0.8 + y * 0.45) * 2.1 + vnoise(x / 3, y / 3, 13) * 5);
        let t = 0.5 + rip * 0.08 + (n - 0.5) * 0.4 - schatten * 0.22;
        if (zone) t -= 0.3;
        f = FAIR[stufe(FAIR.length, t, px, py)]; a = 2;
      } else if (imFair) {
        // Mähstreifen in Wurfrichtung (je 2,2 m), weich gedithert
        const band = ((Math.floor((-x * uy + y * ux) / 2.2) % 2) + 2) % 2;
        let t = 0.35 + band * 0.25 + (n - 0.5) * 0.45 - schatten * 0.2;
        if (zone) t -= 0.35;
        f = FAIR[stufe(FAIR.length, t, px, py)]; a = 2;
      } else if (zone) {
        f = AUS[stufe(AUS.length, 0.3 + (n - 0.5) * 0.9 + (fein - 0.5) * 0.25 - schatten * 0.18, px, py)]; a = 1;
      } else if (wueste) {
        // loser Sand: Dünenwellen (großes Rauschen) mit deutlichen Rippeln, Kämme heller
        const rip = Math.sin((x * 0.8 + y * 0.45) * 1.6 + vnoise(x / 4, y / 4, 14) * 6);
        f = GRAS[stufe(GRAS.length, 0.46 + (n - 0.5) * 1.0 + rip * 0.12 + (fein - 0.5) * 0.12 - schatten * 0.2, px, py)]; a = 0;
      } else {
        f = GRAS[stufe(GRAS.length, 0.48 + (n - 0.5) * 0.9 + (fein - 0.5) * 0.25 - schatten * 0.16, px, py)]; a = 0;
      }
    }
    art[py * BW + px] = a;
    const i = (py * BW + px) * 4;
    d[i] = f[0]; d[i + 1] = f[1]; d[i + 2] = f[2]; d[i + 3] = 255;
  }

  // ---------- Kleinkram im Gras (erst ab ca. 5 Pixel pro Meter) ----------
  const rnd = zufall(3);
  const artBei = (px, py) => inBild(px, py) ? art[py * BW + px] : 255;
  if (S >= 5) {
    // bei hoher Auflösung sind Büschel und Blumen halb so groß – dafür mehr davon, damit die Wiese gleich dicht wirkt
    const flaeche = (bahn.welt.breite * bahn.welt.hoehe) * Math.pow(typeof AUF === "number" ? AUF : 1, 1.5);
    // Grasbüschel
    if (wueste) {
      // trockene Büsche und Kiesel im Sand
      const BUSCH = R(JZ.busch);
      for (let i = 0; i < flaeche * JZ.bueschel; i++) {
        const px = Math.floor(rnd() * BW), py = Math.floor(rnd() * BH), a = artBei(px, py);
        if (a !== 0) continue;
        const r = Math.max(1, Math.round(S * (0.18 + rnd() * 0.22)));
        for (let k = 0; k < r * 5; k++) {
          const w = rnd() * Math.PI * 2, dd = rnd() * r;
          setze(Math.round(px + Math.cos(w) * dd + r * 0.5), Math.round(py + Math.sin(w) * dd + r * 0.6), GRAS[0]);
        }
        for (let k = 0; k < r * 6; k++) {
          const w = rnd() * Math.PI * 2, dd = rnd() * r;
          setze(Math.round(px + Math.cos(w) * dd), Math.round(py + Math.sin(w) * dd), BUSCH[Math.floor(rnd() * BUSCH.length)]);
        }
      }
      for (let i = 0; i < flaeche * 0.35; i++) {
        const px = Math.floor(rnd() * BW), py = Math.floor(rnd() * BH), a = artBei(px, py);
        if (a !== 0 && a !== 2) continue;
        const F = R(JZ.fels);
        setze(px + 1, py + 1, GRAS[0]); setze(px, py, F[2 + Math.floor(rnd() * 2)]);
      }
    }
    for (let i = 0; i < (wueste ? 0 : flaeche * JZ.bueschel); i++) {
      const px = Math.floor(rnd() * BW), py = Math.floor(rnd() * BH), a = artBei(px, py);
      if (a !== 0 && a !== 1) continue;
      const P = a ? AUS : GRAS, hell = P[P.length - 1], mittel = P[P.length - 2], dunkel = P[0];
      setze(px, py + 1, dunkel); setze(px - 1, py, dunkel);
      setze(px, py, mittel); setze(px - 1, py - 1, hell); setze(px + 1, py - 1, mittel); setze(px, py - 2, hell);
    }
    // Blumen je nach Jahreszeit, nur im Rough: Kreuz aus Blütenblättern mit gelber Mitte, oder einzelner Löwenzahn
    for (let i = 0; i < flaeche * JZ.blumen.dichte; i++) {
      const px = Math.floor(rnd() * BW), py = Math.floor(rnd() * BH);
      if (artBei(px, py) !== 0) continue;
      const farbe = rgb(JZ.blumen.farben[Math.floor(rnd() * JZ.blumen.farben.length)]), mitte = rgb("#f2c62e");
      if (farbe[0] === mitte[0] && farbe[1] === mitte[1]) { setze(px, py, mitte); setze(px + 1, py, rgb("#d9a520")); setze(px, py + 1, GRAS[1]); }
      else { setze(px - 1, py, farbe); setze(px + 1, py, farbe); setze(px, py - 1, farbe); setze(px, py + 1, farbe); setze(px, py, mitte); }
    }
    if (JZ.klee) for (let i = 0; i < flaeche * 0.05; i++) {
      const cx = rnd() * BW, cy = rnd() * BH;
      if (artBei(Math.floor(cx), Math.floor(cy)) !== 0) continue;
      for (let k = 0; k < 14; k++) {
        const px = Math.round(cx + (rnd() - 0.5) * S * 1.4), py = Math.round(cy + (rnd() - 0.5) * S);
        if (artBei(px, py) === 0) { setze(px, py, rgb("#3f9a44")); setze(px + 1, py, rgb("#2d8034")); }
      }
    }
    // Maulwurfshügel
    for (let i = 0; i < (wueste ? 0 : 6); i++) {
      const px = Math.floor(rnd() * BW), py = Math.floor(rnd() * BH);
      if (artBei(px, py) !== 0) continue;
      const r = Math.max(2, Math.round(0.35 * S));
      for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) {
        const q = (xx * xx + yy * yy) / (r * r);
        if (q > 1 + (hash(px + xx, py + yy, 11) - 0.5) * 0.5) continue;
        setze(px + xx, py + yy, ERDE[q < 0.3 && xx + yy < 0 ? 2 : q < 0.7 ? 1 : 0]);
      }
    }
    // Laub unter den Laubbäumen (Herbst) bzw. Blütenblätter (Frühling)
    if (JZ.laub) for (const b of baeume) {
      if (b.kiefer || (JZ.laub.nurBluete && !b.farben.bluete)) continue;
      const anz = Math.round(b.r * b.r * S * JZ.laub.dichte), LAUB = R(JZ.laub.farben);
      for (let i = 0; i < anz; i++) {
        const w = rnd() * Math.PI * 2, rr = b.r * (0.9 + rnd() * 0.7);
        const px = Math.round((b.x + Math.cos(w) * rr) * S), py = Math.round((b.y + Math.sin(w) * rr) * S), a = artBei(px, py);
        if (a === 0 || a === 1 || a === 2) { const f = LAUB[Math.floor(rnd() * LAUB.length)]; setze(px, py, f); if (rnd() < 0.4) setze(px + 1, py, f); }
      }
    }
  }
  c.putImageData(bild, 0, 0);

  const rechteck = (x, y, w, h, farbe) => { c.fillStyle = farbe; c.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); };

  // ---------- Spielfeldrand wie bisher ----------
  c.fillStyle = PAL.weiss;
  for (let px = 0; px < BW; px += 6) { c.fillRect(px, 0, 3, 1); c.fillRect(px, BH - 1, 3, 1); }
  for (let py = 0; py < BH; py += 6) { c.fillRect(0, py, 1, 3); c.fillRect(BW - 1, py, 1, 3); }
  c.fillStyle = "#e84030";
  for (let px = 12; px < BW; px += 24) { c.fillRect(px, 1, 2, 2); c.fillRect(px, BH - 3, 2, 2); }
  for (let py = 12; py < BH; py += 24) { c.fillRect(1, py, 2, 2); c.fillRect(BW - 3, py, 2, 2); }

  zeichneLinien(c, z);

  // ---------- OB-Grenzen: Zaun mit Pfosten und Maschen, Linie mit Pflöcken ----------
  const am = (v, m) => v <= 0.01 || v >= m - 0.01;
  for (const [oi, o] of bahn.ob.entries()) {
    const pk = o.linie || o.insel || o.punkte || [[o.x, o.y], [o.x + o.w, o.y], [o.x + o.w, o.y + o.h], [o.x, o.y + o.h]];
    // Linie nicht durch eine andere OB-Fläche ziehen (z. B. wo sich zwei Flussbetten kreuzen)
    const inAnderemOB = (px, py, x, y) => inBild(px, py) && obTests.some((t, j) => j !== oi && t(px, py, x, y));
    let weg = 0; // zurückgelegte Meter entlang der Grenze, für gleichmäßige Pfostenabstände
    pk.forEach((a, i) => {
      const b = pk[(i + 1) % pk.length];
      if (o.linie && i === pk.length - 1) return;
      if (o.art === "natur") return; // Grenze sind Baumstämme/Sträucher, keine Linie
      if ((am(a[0], bahn.welt.breite) && a[0] === b[0]) || (am(a[1], bahn.welt.hoehe) && a[1] === b[1])) return;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(len * S);
      for (let k = 0; k <= n; k++) {
        const x = a[0] + (b[0] - a[0]) * k / n, y = a[1] + (b[1] - a[1]) * k / n, px = Math.round(x * S), py = Math.round(y * S), m = weg + len * k / n;
        if (inAnderemOB(px, py, x, y)) continue;
        if (o.art === "zaun") {
          // Maschendraht: zwei versetzte Drähte ergeben ein Rautenmuster, darunter ein Schattenpixel
          rechteck(px + zr, py + zr, zr, zr, "rgba(0,20,0,.35)");
          rechteck(px, py, zr, zr, k % 2 ? "#b4b4ac" : "#e0e0d8");
          if (k % 3 === 0) rechteck(px, py - zr, zr, zr, "#9a9a92");
        } else {
          if (k % 6 < 3) rechteck(px, py, zr, zr, PAL.weiss);
        }
        // Pfosten (Zaun alle 2,5 m) bzw. Pflöcke (Linie alle 8 m)
        const abstand = o.art === "zaun" ? 2.5 : 8, vorher = weg + len * (k - 1) / n;
        if (k > 0 && Math.floor(m / abstand) !== Math.floor(vorher / abstand)) {
          const g = Math.max(2, Math.round(0.3 * S));
          rechteck(px - g / 2 + zr, py - g / 2 + zr, g, g, "rgba(0,20,0,.45)");
          if (o.art === "zaun") { rechteck(px - g / 2, py - g / 2, g, g, "#4e4e4a"); rechteck(px - g / 2, py - g / 2, zr, zr, "#8a8a84"); }
          else { rechteck(px - g / 2, py - g / 2, g, g, "#c8301f"); rechteck(px - g / 2, py - g / 2, g, zr, "#f05a40"); }
        }
      }
      weg += len;
    });
  }

  // Inselgrün (insel, ab): die Grenze bei x = ab ist auch eine OB-Linie (nur bei Themen-OB wie dem Flussbett)
  for (const o of bahn.ob) {
    if (!o.insel || !o.art || o.ab <= 0) continue;
    const px = Math.round(o.ab * S), g = Math.max(2, Math.round(0.3 * S));
    for (let py = 0; py < BH; py++) {
      if (py % (6 * zr) < 3 * zr) rechteck(px, py, zr, 1, PAL.weiss);
      if (py % Math.round(8 * S) === Math.round(4 * S)) { rechteck(px - g / 2 + zr, py + zr, g, g, "rgba(0,20,0,.45)"); rechteck(px - g / 2, py, g, g, "#c8301f"); rechteck(px - g / 2, py, g, zr, "#f05a40"); }
    }
  }

  // ---------- Brücken: wo ein Weg ein Flussbett kreuzt (nur Bild – darunter bleibt OB) ----------
  for (const w of bahn.wege || []) {
    const pk = w.punkte, fluss = (bahn.ob || []).filter(o => o.art === "flussbett"), imFluss = (x, y) => fluss.some(o => obTests[bahn.ob.indexOf(o)](Math.round(x * S), Math.round(y * S), x, y));
    if (!fluss.length) continue;
    for (let i = 0; i < pk.length - 1; i++) {
      const [ax, ay] = pk[i], [bx, by] = pk[i + 1], len = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / len, uy = (by - ay) / len;
      // Abschnitte des Wegs im Flussbett suchen (alle 0,25 m), dann je eine Brücke mit 1,2 m Auflage an beiden Ufern
      let start = null;
      for (let d = 0; d <= len + 0.25; d += 0.25) {
        const dd = Math.min(d, len), drin = d <= len && imFluss(ax + ux * dd, ay + uy * dd);
        if (drin && start === null) start = dd;
        if (!drin && start !== null) { brueckeZeichnen(ax + ux * (start - 1.2), ay + uy * (start - 1.2), ux, uy, dd - start + 2.4, w.breite + 1); start = null; }
      }
    }
  }
  function rgbText(f) { return "rgb(" + f.join(",") + ")"; }
  function brueckeZeichnen(x0, y0, ux, uy, lang, breit) {
    const nx = -uy, ny = ux, pt = (l, q) => [(x0 + ux * l + nx * q) * S, (y0 + uy * l + ny * q) * S];
    const viereck = (l0, l1, q0, q1, farbe) => { c.fillStyle = farbe; c.beginPath(); [pt(l0, q0), pt(l1, q0), pt(l1, q1), pt(l0, q1)].forEach(([x, y], k) => k ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill(); };
    const h = breit / 2;
    // Schatten nach rechts unten
    c.save(); c.translate(0.5 * S, 0.7 * S); viereck(0, lang, -h - 0.3, h + 0.3, "rgba(30,15,0,.4)"); c.restore();
    // Bohlen quer zur Laufrichtung, abwechselnd heller/dunkler, mit Fugen
    const bohle = 0.45;
    for (let l = 0, k = 0; l < lang; l += bohle, k++) {
      const f = rgbText(DECK[2 + ((k * 7) % 3)]);
      viereck(l, Math.min(lang, l + bohle), -h, h, f);
      viereck(l, Math.min(lang, l + bohle * 0.12), -h, h, rgbText(DECK[0]));
    }
    // Geländer links und rechts: Balken mit Pfosten
    for (const q of [-h, h]) {
      viereck(0, lang, q - 0.18, q + 0.18, rgbText(DECK[1]));
      viereck(0, lang, q - 0.18, q - 0.05, rgbText(DECK[4]));
      for (let l = 0.2; l < lang; l += 1.6) viereck(l, l + 0.35, q - 0.3, q + 0.3, rgbText(DECK[0]));
    }
  }

  // ---------- Bowlingbahn: Schatten, Rahmen, Pfeile ----------
  if (l) {
    c.fillStyle = "#3a240f";
    for (let i = 0; i < 3; i++) {
      // Pfeile wie auf einer Bowlingbahn: kleine Dreiecke in Wurfrichtung
      const ax = (l.x1 + 3.2 + i * 1.3) * S, ay = (l.y1 + (l.y2 - l.y1) * (3.2 + i * 1.3) / (l.x2 - l.x1) + (i - 1) * 1.1) * S, g = Math.max(2, Math.round(0.35 * S));
      for (let k = 0; k < g; k++) c.fillRect(Math.round(ax + k), Math.round(ay - (g - k) / 2), 1, Math.max(1, g - k));
    }
  }

  // ---------- Circle 1 (10 m) gepunktet ----------
  // auf hellem Boden (z. B. Sand) mit eigener Farbe: dunkle Markierung mit hellem Schatten, etwas kräftiger
  if (JZ.circle) {
    const [dunkel, hell] = JZ.circle, g = zr;
    for (let w = 0; w < Math.PI * 2; w += 0.22 / z) {
      const px = Math.round((bahn.korb.x + Math.cos(w) * 10) * S), py = Math.round((bahn.korb.y + Math.sin(w) * 10) * S);
      rechteck(px + zr, py + zr, g, g, hell); rechteck(px, py, g, g, dunkel);
    }
  } else {
    c.fillStyle = "rgba(255,255,255,.4)";
    for (let w = 0; w < Math.PI * 2; w += 0.12 / z) c.fillRect(Math.round((bahn.korb.x + Math.cos(w) * 10) * S), Math.round((bahn.korb.y + Math.sin(w) * 10) * S), 1, 1);
  }

  // ---------- Abwurf: Beton mit Kante, Sprenkeln und Schatten ----------
  {
    const tw = Math.max(12, Math.round(3.2 * S)), th = Math.max(9, Math.round(2.2 * S)), x0 = Math.round(ab.x * S - tw / 2), y0 = Math.round(ab.y * S - th / 2);
    rechteck(x0, y0, tw, th, "#55554f");
    rechteck(x0 + zr, y0 + zr, tw - 2 * zr, th - 2 * zr, "#8e8e88");
    rechteck(x0 + zr, y0 + zr, tw - 2 * zr, zr, "#b2b2aa");
    rechteck(x0 + zr, y0 + zr, zr, th - 2 * zr, "#a2a29a");
    const rr = zufall(17);
    for (let i = 0; i < tw * th / 10; i++) rechteck(x0 + 2 * zr + rr() * (tw - 4 * zr), y0 + 2 * zr + rr() * (th - 4 * zr), 1, 1, rr() < 0.5 ? "#7a7a74" : "#a4a49c");
    // aufgemalte Abwurflinie vorne
    rechteck(x0 + tw - 2 * zr, y0 + zr, zr, th - 2 * zr, "#e8e4d0");
  }

  zeichneBauten(c, z);

  // ---------- Deko: Bahnschild, Bank und Mülleimer am Abwurf ----------
  // Plätze links/rechts hinter dem Abwurf (bezogen auf die Wurfrichtung); belegt ist, was auf Weg, Fairway,
  // im Aus, unter einem Baum oder auf dem Abwurf läge
  const frei = (x, y, r) => {
    for (let k = 0; k < 9; k++) {
      const qx = x + r * Math.cos(k * 0.8) * (k ? 1 : 0), qy = y + r * Math.sin(k * 0.8) * (k ? 1 : 0), px = Math.round(qx * S), py = Math.round(qy * S);
      if (!inBild(px, py) || art[py * BW + px] !== 0) return false;
      if (baeume.some(b => Math.hypot(b.x - qx, b.y - qy) < b.r + 0.5)) return false;
      if (Math.abs(qx - ab.x) < 2.4 && Math.abs(qy - ab.y) < 1.9) return false;
    }
    return true;
  };
  const platz = (r, ...kandidaten) => {
    for (const [vor, seit] of kandidaten) {
      const x = ab.x + ux * vor - uy * seit, y = ab.y + uy * vor + ux * seit;
      if (frei(x, y, r)) return { x, y };
    }
    return null;
  };
  if (opt.deko && S >= 5 && bahn.nummer) {
    // Bahnschild: Pfosten, Holzrahmen, grüne Tafel mit Nummer und kleiner Bahnlinie
    const schild = platz(1.4, [-2.5, -3.4], [-2.5, 3.4], [-4, -3], [-4, 3], [0, -4], [0, 4]);
    if (schild) {
      const sw = Math.round(2.2 * S), sh = Math.round(1.4 * S), sx = Math.round(schild.x * S - sw / 2), sy = Math.round(schild.y * S - sh / 2);
      rechteck(sx + sw / 2 - zr, sy + sh, 2 * zr, Math.round(0.7 * S), "#5a3a1c");
      rechteck(sx + zr * 2, sy + zr * 2, sw, sh, "rgba(0,20,0,.45)");
      rechteck(sx, sy, sw, sh, "#6b4422");
      rechteck(sx + zr, sy + zr, sw - 2 * zr, sh - 2 * zr, "#1f6b3a");
      rechteck(sx + zr, sy + zr, sw - 2 * zr, zr, "#2f8a4c");
      const pz = Math.max(1, Math.round(S / 9));
      let ende = sx + 3 * zr;
      for (const ch of String(bahn.nummer)) {
        ZIFFERN[ch].forEach((zeile, j) => [...zeile].forEach((q, i) => { if (q === "1") rechteck(ende + i * pz, sy + 3 * zr + j * pz, pz, pz, "#f4f4f0"); }));
        ende += 4 * pz;
      }
      for (let i = 0; ende + zr + i < sx + sw - 2 * zr; i += zr) rechteck(ende + zr + i, sy + sh / 2 + Math.round(Math.sin(i / sw * 3) * zr), zr, zr, "#d8e8c0");
    }
    // Bank: drei Latten, Füße, Schatten
    const bank = platz(1.3, [-2, 3.8], [-2, -3.8], [-4.5, 2.5], [-4.5, -2.5], [1, 4.5], [1, -4.5]);
    if (bank) {
      const bw = Math.round(2 * S), lh = Math.max(1, Math.round(0.16 * S)), bx = Math.round(bank.x * S - bw / 2), by = Math.round(bank.y * S - lh * 2);
      rechteck(bx + 2 * zr, by + 2 * zr, bw, lh * 4, "rgba(0,20,0,.45)");
      rechteck(bx + zr, by - zr, 2 * zr, lh * 4 + 2 * zr, "#3c3c38"); rechteck(bx + bw - 3 * zr, by - zr, 2 * zr, lh * 4 + 2 * zr, "#3c3c38");
      for (let i = 0; i < 3; i++) {
        const ly = by + i * (lh + Math.max(1, lh / 2));
        rechteck(bx, ly, bw, lh, "#9a6a36"); rechteck(bx, ly, bw, 1, winter ? "#f4f8ff" : "#c08a4a");
      }
      // Mülleimer neben der Bank
      const mx = Math.round(bank.x * S + bw / 2 + 0.7 * S), my = Math.round(bank.y * S), mr = Math.max(2, Math.round(0.35 * S));
      if (frei(mx / S, my / S, 0.4)) {
        pixelKreis(c, mx + zr, my + zr, mr, "rgba(0,20,0,.45)");
        pixelKreis(c, mx, my, mr, "#2c4a34"); pixelKreis(c, mx, my, Math.max(1, mr - 2), "#121a14");
      }
    }
  }

  // ---------- Bäume ----------
  // Laubbaum: Krone aus mehreren Blättergruppen, jede mit Kontur, Grund, Mitte, Licht (zeichneBaumKrone)
  for (const b of baeume) {
    const r = b.r * S, cx = b.x * S, cy = b.y * S, rr = zufall(Math.round(b.x * 100 + b.y * 7)), LB = b.farben;
    if (b.art && !opt.kronen) continue; // 3/4-Ansicht: Gegenstand kommt als Sprite (objektSprite), hier nur Schatten
    if (b.art) { // Draufsicht (Vorschau-Werkzeug): Säule wie Kaktus, Krone/Kegel/Kugel als Krone, sonst Fels
      if (b.form === "saeule") zeichneKaktus(c, cx, cy, r, LB, rr, zr);
      else if (b.form === "kugel" || b.form === "krone" || b.form === "kegel") zeichneBaumKrone(c, b, cx, cy, r, zr, winter);
      else zeichneFels(c, cx, cy, r, LB, rr, zr, S);
    }
    else if (opt.kronen) zeichneBaumKrone(c, b, cx, cy, r, zr, winter);
    else {
      // 3/4-Ansicht: nur der Stammfuß auf dem Boden, die Krone kommt als Sprite darüber
      pixelKreis(c, cx + zr, cy + zr, Math.max(1, Math.round(r * 0.12)), "rgba(0,20,0,.35)");
    }
  }
  zeichneMando(c, z);
  // für das fallende Laub (zeichneLaubfall): Laubbäume mit ihren Farben
  // für Blätter, die beim Treffer aus der Krone fliegen (blattFarbenAn): jeder Baum mit seinen Farben
  hg.baumFarben = baeume.map(({ x, y, r, h, farben, kiefer, kahl, art, form }) => ({ x, y, r, h, farben, kiefer, kahl, art, form }));
  hg.kronenAlsSprite = !opt.kronen; hg.winter = winter; hg.S = S; hg.zr = zr;
  if (JZ.laubfall) { hg.laubBaeume = baeume.filter(b => !b.kiefer && !b.kahl && !b.art).map(({ x, y, r, farben }) => ({ x, y, r, farben })); hg.laubBahn = bahn; }
  return hg;
};

// Krone eines Baums (Laub, Kiefer oder kahl im Winter) mit Mitte cx, cy und Radius r in Bildpunkten.
// zr: Pixelgröße der Details; gleiche Zufallsfolge je Baum, damit er überall gleich aussieht
function zeichneBaumKrone(c, b, cx, cy, r, zr, winter, imSprite = false) {
  const rr = zufall(Math.round(b.x * 100 + b.y * 7)), LB = b.farben, KI = b.farben;
  if (b.kahl) {
    // Winter: kahle Krone aus Ästen, Schatten als Äste auf dem Schnee, Schnee auf der Lichtseite
    const aeste = [];
    const ast = (x, y, w, len, tiefe) => {
      const n = Math.max(2, Math.round(len));
      for (let k = 0; k <= n; k++) aeste.push({ x: x + Math.cos(w) * len * k / n, y: y + Math.sin(w) * len * k / n, d: tiefe });
      if (tiefe < 3) for (let j = 0; j < 2; j++) {
        const t = 0.45 + rr() * 0.45;
        ast(x + Math.cos(w) * len * t, y + Math.sin(w) * len * t, w + (j ? 1 : -1) * (0.4 + rr() * 0.5), len * (0.45 + rr() * 0.15), tiefe + 1);
      }
    };
    const anz = 6 + Math.floor(rr() * 3);
    for (let i = 0; i < anz; i++) ast(cx, cy, (i / anz) * Math.PI * 2 + rr() * 0.5, r * (0.5 + rr() * 0.15), 0);
    const dick = q => q.d === 0 ? Math.max(1, zr + 1) : q.d === 1 ? zr : 1;
    if (!imSprite) { // Astschatten auf dem Schnee (nur im Bahnbild, nicht in der angehobenen Krone)
      c.fillStyle = "rgba(60,80,120,.35)";
      for (const q of aeste) c.fillRect(Math.round(q.x + r * 0.3), Math.round(q.y + r * 0.4), dick(q), dick(q));
    }
    for (const q of aeste) { c.fillStyle = q.d < 2 ? "#3a2e24" : "#5a4a3c"; c.fillRect(Math.round(q.x), Math.round(q.y), dick(q), dick(q)); }
    c.fillStyle = "#f4f8ff";
    for (const q of aeste) if (q.d < 3 && rr() < 0.25) c.fillRect(Math.round(q.x), Math.round(q.y) - 1, dick(q), 1);
    pixelKreis(c, cx, cy, Math.max(1, zr + 1), "#2a2018");
  } else if (b.kiefer) {
    // Kiefer: Nadelbüschel strahlenförmig um die Mitte, bläulicheres Grün
    const buschel = [];
    for (let ring = 0; ring < 3; ring++) {
      const anz = [1, 6, 10][ring], abst = [0, 0.42, 0.72][ring];
      for (let i = 0; i < anz; i++) {
        const w = (i / anz) * Math.PI * 2 + rr() * 0.5 + ring;
        buschel.push({ x: cx + Math.cos(w) * r * abst, y: cy + Math.sin(w) * r * abst, r: r * (ring ? 0.3 + rr() * 0.08 : 0.42) });
      }
    }
    for (const q of buschel) pixelKreis(c, q.x, q.y, q.r + zr, KI[0]);
    for (const q of buschel) pixelKreis(c, q.x, q.y, q.r, KI[1]);
    for (const q of buschel) pixelKreis(c, q.x - q.r * 0.2, q.y - q.r * 0.25, q.r * 0.65, KI[2]);
    for (const q of buschel) pixelKreis(c, q.x - q.r * 0.35, q.y - q.r * 0.4, q.r * 0.3, KI[3]);
    if (winter) for (const q of buschel) { pixelKreis(c, q.x - q.r * 0.3, q.y - q.r * 0.35, q.r * 0.42, "#c4d0e2"); pixelKreis(c, q.x - q.r * 0.4, q.y - q.r * 0.45, q.r * 0.25, "#f4f8ff"); }
    // Nadeln: kurze Striche nach außen
    for (let i = 0; i < r * 5; i++) {
      const w = rr() * Math.PI * 2, dd = rr() * r * 0.95, lx = Math.cos(w), ly = Math.sin(w);
      c.fillStyle = rr() < 0.4 ? (winter ? "#f4f8ff" : KI[4]) : KI[0];
      for (let k = 0; k < Math.max(1, zr * 1.5); k++) c.fillRect(Math.round(cx + lx * (dd + k)), Math.round(cy + ly * (dd + k)), 1, 1);
    }
  } else {
    const gruppen = [{ x: cx, y: cy, r: r * 0.62 }];
    const anz = 6 + Math.floor(rr() * 3);
    for (let i = 0; i < anz; i++) {
      const w = (i / anz) * Math.PI * 2 + rr() * 0.6, rg = r * (0.32 + rr() * 0.12);
      gruppen.push({ x: cx + Math.cos(w) * (r - rg) * 0.95, y: cy + Math.sin(w) * (r - rg) * 0.95, r: rg });
    }
    // hinten liegende (rechts unten) zuerst, vordere (links oben, im Licht) zuletzt
    gruppen.sort((p, q) => (q.x + q.y) - (p.x + p.y));
    for (const q of gruppen) pixelKreis(c, q.x, q.y, q.r + zr, LB[0]);
    for (const q of gruppen) {
      pixelKreis(c, q.x, q.y, q.r, LB[1]);
      pixelKreis(c, q.x - q.r * 0.18, q.y - q.r * 0.22, q.r * 0.72, LB[2]);
      pixelKreis(c, q.x - q.r * 0.36, q.y - q.r * 0.4, q.r * 0.36, LB[3]);
      if (q.r * 0.14 >= 1) pixelKreis(c, q.x - q.r * 0.45, q.y - q.r * 0.5, q.r * 0.14, LB[4]);
    }
    // Blätter-Dither an den Übergängen, bei Blütenbäumen helle Blüten
    for (let i = 0; i < r * (LB.bluete ? 9 : 4); i++) {
      const w = rr() * Math.PI * 2, dd = Math.sqrt(rr()) * r * 0.92;
      c.fillStyle = LB.bluete ? (rr() < 0.5 ? LB[4] : "#ffffff") : rr() < 0.55 ? LB[1] : LB[3];
      c.fillRect(Math.round(cx + Math.cos(w) * dd), Math.round(cy + Math.sin(w) * dd), 1, 1);
    }
  }
}

// ---------- 3/4-Ansicht: Baum als Sprite ----------
// Stamm vom Boden bis zur Krone, Krone angehoben um etwa Baumhöhe × 0,6 – derselbe Faktor, mit dem die
// Scheibe nach ihrer Flughöhe angehoben wird; unten an der Krone eine Schattenseite für Volumen.
// b: Baum aus bild.baumFarben; S: Bildpunkte je Meter; Rückgabe: Bild und Fußpunkt (ax, ay) darin
window.baumAnhebung = b => Math.max(b.r * 1.1, (b.h || Math.min(12, Math.max(3, 1.5 + b.r * 1.8))) * 0.6 - b.r * 0.15);
// ============================================================
//  GEGENSTÄNDE IN DER 3/4-ANSICHT (Baukasten)
// ============================================================
//  Alles, was auf der Bahn steht (Bäume, Kakteen, Felsen, künftige Gegenstände neuer Themen), ist in den
//  Bahndaten ein Eintrag in "baeume" mit x, y, r (Radius in m), h (Höhe in m) und optional "art".
//  - OBJEKT_FORMEN: wie etwas gezeichnet wird (Code). Jede Form malt ein Sprite vom Fußpunkt nach oben.
//  - OBJEKT_ARTEN: welche Art welche Form und Farben hat (Daten). Eingebaut: kaktus, fels, busch.
//    Ein Thema kann eigene Arten mitbringen: optikDaten.objekte = { "<art>": { form, farben } } –
//    farben: Liste dunkel → hell (mind. 5) oder Name einer Palette der Optik ("fels", "busch", "laubbaum" …).
//    So kommen neue Gegenstände ohne Release live; nur eine neue Form braucht Code (und ein Release).
//  - unbekannte Art: Form "kugel" in Felsfarben, damit nie etwas unsichtbar ist.
//  Höhen werden mit 0,6 projiziert – wie die Flughöhe der Scheibe.
window.OBJEKT_FORMEN = ["krone", "kegel", "saeule", "brocken", "kugel"];
window.OBJEKT_ARTEN = {
  kaktus: { form: "saeule", farben: "laubbaum" },
  fels: { form: "brocken", farben: "fels" },
  busch: { form: "kugel", farben: "laubbaum" },
};
// Art eines Gegenstands auflösen: { form, farben (Liste) }; h01: fester Zufallswert je Ort (für Farbvarianten)
window.objektArt = function (o, JZ, h01 = 0.5) {
  const def = (o.art && ((JZ.objekte && JZ.objekte[o.art]) || OBJEKT_ARTEN[o.art])) || (o.art ? { form: "kugel", farben: "fels" } : null);
  if (!def) return null;
  let f = def.farben;
  if (typeof f === "string") f = typeof JZ[f] === "function" ? JZ[f](h01) : JZ[f];
  if (!Array.isArray(f) || f.length < 5) f = (JZ.fels || ["#4a4440", "#6a625a", "#8a8278", "#aaa296", "#cac2b4"]);
  return { form: OBJEKT_FORMEN.includes(def.form) ? def.form : "kugel", farben: f };
};
// projizierte Höhe in m (wie weit das Sprite über den Fußpunkt reicht)
const objektHoehe = o => o.h || Math.min(12, Math.max(3, 1.5 + o.r * 1.8));

// Polygon pixelgenau füllen (ohne Kantenglättung): Punkte [[x, y], …] in Bildpunkten
function fuellePolygon(c, pk, farbe) {
  const ys = pk.map(p => p[1]), y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
  c.fillStyle = farbe;
  for (let y = y0; y <= y1; y++) {
    const yy = y + 0.5, xs = [];
    for (let i = 0; i < pk.length; i++) {
      const [ax, ay] = pk[i], [bx, by] = pk[(i + 1) % pk.length];
      if ((ay <= yy && by > yy) || (by <= yy && ay > yy)) xs.push(ax + (yy - ay) / (by - ay) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) c.fillRect(Math.round(xs[k]), y, Math.max(0, Math.round(xs[k + 1]) - Math.round(xs[k])), 1);
  }
}
// gedithertes Abdunkeln der unteren Partie eines schon gemalten Bereichs (Volumen, Licht von oben)
function schattenUnten(c, x0, x1, yVon, yBis, staerke = 0.9) {
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  c.globalCompositeOperation = "source-atop"; c.fillStyle = "rgba(0,16,8,.32)";
  for (let y = Math.round(yVon); y <= yBis; y++) {
    const t = (y - yVon) / Math.max(1, yBis - yVon);
    for (let x = Math.round(x0); x <= x1; x++) if ((BAY[(y & 3) * 4 + (x & 3)] + 0.5) / 16 < t * staerke) c.fillRect(x, y, 1, 1);
  }
  c.globalCompositeOperation = "source-over";
}
function zeichneStamm(c, ax, ay, cy, sb, kahl, rr, zr) {
  const RINDE = kahl ? ["#2a2018", "#3a2e24", "#5a4a3c"] : ["#2e2016", "#4a3624", "#6a5038"];
  for (let y = cy; y <= ay; y++) {
    const t = (y - cy) / Math.max(1, ay - cy), w = Math.round(sb * (0.8 + 0.35 * t * t));
    const x0 = ax - Math.floor(w / 2);
    c.fillStyle = RINDE[1]; c.fillRect(x0, y, w, 1);
    c.fillStyle = RINDE[2]; c.fillRect(x0, y, Math.max(1, Math.round(w * 0.25)), 1);
    c.fillStyle = RINDE[0]; c.fillRect(x0 + w - Math.max(1, Math.round(w * 0.3)), y, Math.max(1, Math.round(w * 0.3)), 1);
    if (rr() < 0.25) { c.fillStyle = RINDE[0]; c.fillRect(x0 + 1 + Math.floor(rr() * Math.max(1, w - 2)), y, 1, 1 + Math.floor(rr() * 2)); }
  }
  c.fillStyle = RINDE[0]; c.fillRect(ax - Math.round(sb * 0.8), ay, Math.round(sb * 1.6), Math.max(1, Math.round(zr / 2)));
}

// Sprite eines Gegenstands. o: Eintrag aus bild.baumFarben (x, y, r, h, form, farben, kahl …);
// S: Bildpunkte je Meter; Rückgabe: Bild und Fußpunkt (ax, ay) darin
window.objektSprite = function (o, S, zr, winter) {
  const form = o.form || (o.kiefer ? "kegel" : "krone"), F = o.farben, r = o.r * S, rand = Math.ceil(zr * 2 + 2);
  const hp = form === "krone" || form === "kegel" ? baumAnhebung(o) * S + r * 1.3 : objektHoehe(o) * 0.6 * S + r * 0.9;
  const BWs = Math.ceil(2 * r * 1.6 + 2 * rand), BHs = Math.ceil(hp + r + 2 * rand);
  const cv = document.createElement("canvas"); cv.width = BWs; cv.height = BHs;
  const c = cv.getContext("2d"), rr = zufall(Math.round(o.x * 31 + o.y * 17));
  const ax = Math.round(BWs / 2), ay = BHs - rand - Math.ceil(r * 0.5);
  // kroneY: Zeile, ab der nach oben die Krone im Wind schwingt (null = steht fest, z. B. Fels, Kaktus)
  const kroneY = ZEICHNER[form](c, o, { ax, ay, r, S, zr, F, rr, winter }) ?? null;
  return { c: cv, ax, ay, kroneY };
};
window.baumSprite = window.objektSprite; // früherer Name

// Sprite zeichnen; die Krone wiegt sich im Wind: oberhalb von kroneY in Streifen versetzt, oben am meisten.
// dx: Auslenkung ganz oben in Bildpunkten (Vorzeichen = Richtung)
window.zeichneObjektSprite = function (c, sp, x, y, dx) {
  const X = Math.round(x - sp.ax), Y = Math.round(y - sp.ay);
  if (!sp.kroneY || Math.abs(dx) < 0.5) { c.drawImage(sp.c, X, Y); return; }
  const H = sp.kroneY, streifen = Math.max(1, Math.ceil(Math.abs(dx) * 1.5));
  c.drawImage(sp.c, 0, H, sp.c.width, sp.c.height - H, X, Y + H, sp.c.width, sp.c.height - H); // Stamm fest
  for (let k = 0; k < streifen; k++) {
    const y0 = Math.round(H * k / streifen), y1 = Math.round(H * (k + 1) / streifen), anteil = 1 - (k + 0.5) / streifen;
    c.drawImage(sp.c, 0, y0, sp.c.width, y1 - y0, X + Math.round(dx * anteil), Y + y0, sp.c.width, y1 - y0);
  }
};

const ZEICHNER = {
  // Laubbaum (oder kahl im Winter): Stamm, angehobene Krone, Schattenseite unten
  krone(c, o, { ax, ay, r, S, zr, rr, winter }) {
    const cy = Math.round(ay - baumAnhebung(o) * S);
    zeichneStamm(c, ax, ay, cy, Math.max(2, Math.round(S * (0.32 + o.r * 0.05))), o.kahl, rr, zr);
    zeichneBaumKrone(c, o, ax, cy, r, zr, winter, true);
    if (!o.kahl) schattenUnten(c, ax - r - zr, ax + r + zr, cy + r * 0.15, cy + r + zr);
    return Math.round(cy + r * 0.7);
  },
  // Nadelbaum: Stamm und Kegel aus Etagen
  kegel(c, o, { ax, ay, r, S, zr, rr, winter }) {
    const cy = Math.round(ay - baumAnhebung(o) * S);
    zeichneStamm(c, ax, ay, cy, Math.max(2, Math.round(S * (0.32 + o.r * 0.05))), false, rr, zr);
    zeichneKiefernKegel(c, o, ax, cy, r, zr, winter, rr);
    return Math.round(cy + r * 0.85);
  },
  // Säule mit Armen (Saguaro): Rippen senkrecht, Licht links, runde Kuppe, Stacheln, manchmal Blüte
  saeule(c, o, { ax, ay, r, S, zr, F, rr }) {
    const hp = objektHoehe(o) * 0.6 * S, b = Math.max(3, Math.round(r * 1.1));
    const saeule = (x0, yOben, yUnten, w) => {
      for (let y = Math.round(yOben); y <= yUnten; y++) {
        const kuppe = y - yOben < w / 2 ? Math.sqrt(Math.max(0, (w / 2) ** 2 - (w / 2 - (y - yOben)) ** 2)) : w / 2;
        for (let x = Math.round(x0 + w / 2 - kuppe); x < x0 + w / 2 + kuppe; x++) {
          const u = (x - x0) / w, rip = Math.round((x - x0) / Math.max(2, zr + 1)) % 2;
          c.fillStyle = u < 0.18 ? F[3] : u > 0.82 ? F[0] : rip ? F[2] : F[1];
          c.fillRect(x, y, 1, 1);
        }
      }
    };
    const x0 = ax - b / 2, oben = ay - hp;
    // Arme: waagrecht aus dem Stamm, dann nach oben; hinterer Arm zuerst
    const arme = 1 + Math.floor(rr() * 2.2);
    for (let i = 0; i < arme; i++) {
      const seite = i % 2 ? 1 : -1, hy = ay - hp * (0.3 + rr() * 0.2), aw = Math.max(2, Math.round(b * 0.6)), lang = Math.max(1, Math.round(b * (0.25 + rr() * 0.3)));
      const ox = seite < 0 ? x0 - lang - aw : x0 + b + lang;
      // kurzes waagrechtes Stück vom Stamm zum Arm, dann der Arm senkrecht nach oben
      const vx = seite < 0 ? ox + aw / 2 : x0 + b / 2, bx = seite < 0 ? x0 + b / 2 : ox + aw / 2;
      for (let y = Math.round(hy - aw * 0.4); y < hy + aw * 0.4; y++) { c.fillStyle = y < hy - aw * 0.1 ? F[2] : F[1]; c.fillRect(Math.round(vx), y, Math.round(bx - vx), 1); }
      saeule(ox, hy - hp * (0.3 + rr() * 0.15), hy + aw * 0.4, aw);
    }
    saeule(x0, oben, ay, b);
    // Stacheln und Blüte
    for (let i = 0; i < hp * 0.6; i++) { c.fillStyle = F[4]; c.fillRect(Math.round(x0 + rr() * b), Math.round(oben + b / 2 + rr() * (hp - b / 2)), 1, 1); }
    if (rr() < 0.35) { pixelKreis(c, ax, oben + 1, Math.max(1, b * 0.2), "#e8507a"); c.fillStyle = "#ffe066"; c.fillRect(ax, Math.round(oben + 1), 1, 1); }
  },
  // Brocken (Fels): Grundriss unregelmäßig, Seitenfläche bis zur projizierten Höhe, Oberseite hell mit Rissen
  brocken(c, o, { ax, ay, r, S, zr, F, rr, winter }) {
    const hp = objektHoehe(o) * 0.6 * S, n = 12, pk = [];
    for (let i = 0; i < n; i++) { const w = i / n * Math.PI * 2 + rr() * 0.2, d = r * (0.86 + rr() * 0.14); pk.push([ax + Math.cos(w) * d, ay + Math.sin(w) * d * 0.75]); }
    const oben = pk.map(([x, y]) => [ax + (x - ax) * 0.86, y - hp]);
    // Seite: Grundriss in Schritten nach oben ziehen (unten dunkel, oben mittel)
    // erst oben eingezogen (runde Kante statt Spitze)
    for (let k = 0; k <= hp; k += 1) { const t = Math.pow(k / Math.max(1, hp), 3); fuellePolygon(c, pk.map(([x, y], i) => [x + (oben[i][0] - x) * t, y - k]), k < hp * 0.35 ? F[0] : F[1]); }
    fuellePolygon(c, oben, F[2]);
    fuellePolygon(c, oben.map(([x, y]) => [ax - r * 0.15 + (x - ax) * 0.6, ay - hp - r * 0.08 + (y - (ay - hp)) * 0.6]), F[3]); // Glanz oben links
    // Risse und Kanten
    for (let i = 0; i < 2 + Math.floor(rr() * 2); i++) {
      let x = ax + (rr() - 0.5) * r, y = ay - hp + (rr() - 0.5) * r * 0.4; c.fillStyle = F[0];
      for (let k = 0; k < r * 0.6; k++) { c.fillRect(Math.round(x), Math.round(y), 1, 1); x += rr() - 0.3; y += rr() * 0.8; }
    }
    if (winter) fuellePolygon(c, oben.map(([x, y]) => [ax + (x - ax) * 0.75, y - 1]).filter((p, i) => i < 6), "#f4f8ff");
  },
  // Kugel (Busch, Strauch oder Unbekanntes): Krone direkt auf dem Boden, unten Schatten
  kugel(c, o, { ax, ay, r, S, zr, F, winter }) {
    const hp = objektHoehe(o) * 0.6 * S, rk = Math.min(r, Math.max(r * 0.6, hp / 2)), cy = Math.round(ay - Math.max(rk * 0.8, hp - rk));
    zeichneBaumKrone(c, { ...o, kahl: false, kiefer: false, farben: F }, ax, cy, rk, zr, winter, true);
    schattenUnten(c, ax - rk - zr, ax + rk + zr, cy, cy + rk + zr);
    return Math.round(cy);
  },
};

// Kiefer in der 3/4-Ansicht: Kegel aus vier Etagen, jede unten breiter, Licht links, Schatten rechts,
// Nadelspitzen am unteren Rand; im Winter Schnee auf den Etagen
function zeichneKiefernKegel(c, b, cx, cy, r, zr, winter, rr) {
  const KI = b.farben, oben = cy - r * 1.25, unten = cy + r * 0.85, n = 4, H = unten - oben;
  for (let e = 0; e < n; e++) {
    const y0 = oben + H * (e / n) * 0.85, y1 = oben + H * ((e + 1) / n), wUnten = r * (0.45 + 0.55 * (e + 1) / n);
    for (let y = Math.round(y0); y <= y1; y++) {
      const t = (y - y0) / Math.max(1, y1 - y0), w = Math.max(1, wUnten * (0.25 + 0.75 * t));
      for (let x = Math.round(cx - w); x <= cx + w; x++) {
        const u = (x - (cx - w)) / (2 * w); // 0 links … 1 rechts
        let f = u < 0.22 ? KI[3] : u < 0.5 ? KI[2] : u < 0.8 ? KI[1] : KI[0];
        if (y > y1 - zr) f = KI[0];
        c.fillStyle = f; c.fillRect(x, y, 1, 1);
      }
      if (winter && t < 0.35) { c.fillStyle = t < 0.15 ? "#f4f8ff" : "#c4d0e2"; c.fillRect(Math.round(cx - w), y, Math.round(w * 1.1), 1); }
    }
    // Nadelspitzen und Kontur unten
    for (let x = Math.round(cx - wUnten); x <= cx + wUnten; x += Math.max(2, zr + 1)) {
      c.fillStyle = KI[0]; c.fillRect(x, Math.round(y1), Math.max(1, zr), Math.max(1, zr) + (rr() < 0.5 ? 1 : 0));
    }
  }
  // Nadel-Glanz
  for (let i = 0; i < r * 3; i++) {
    const y = oben + rr() * H, rel = (y - oben) / H, w = r * rel * 0.8, x = cx - w + rr() * w * 1.2;
    c.fillStyle = winter && rr() < 0.4 ? "#f4f8ff" : KI[4]; c.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
}

// ---------- Wüste: Kaktus und Fels von oben (Licht von links oben) ----------
// Kaktus (Saguaro von oben): runder Stamm mit Rippen und Stacheln, dazu zwei bis drei Arme
function zeichneKaktus(c, cx, cy, r, F, rr, zr) {
  const arme = [], anz = 2 + Math.floor(rr() * 2);
  for (let i = 0; i < anz; i++) {
    const w = rr() * Math.PI * 2, d = r * (0.75 + rr() * 0.2);
    arme.push({ x: cx + Math.cos(w) * d, y: cy + Math.sin(w) * d, r: r * (0.32 + rr() * 0.1), w });
  }
  // Arme: Verbindung zum Stamm, dann Armspitze
  for (const a of arme) {
    c.strokeStyle = F[0]; c.lineWidth = Math.max(2, a.r * 1.5 + 2 * zr); c.lineCap = "round";
    c.beginPath(); c.moveTo(cx, cy); c.lineTo(a.x, a.y); c.stroke();
    c.strokeStyle = F[1]; c.lineWidth = Math.max(1, a.r * 1.5);
    c.beginPath(); c.moveTo(cx, cy); c.lineTo(a.x, a.y); c.stroke();
    pixelKreis(c, a.x, a.y, a.r + zr, F[0]); pixelKreis(c, a.x, a.y, a.r, F[2]); pixelKreis(c, a.x - a.r * 0.3, a.y - a.r * 0.3, a.r * 0.45, F[3]);
  }
  const rs = r * 0.62;
  pixelKreis(c, cx, cy, rs + zr, F[0]);
  pixelKreis(c, cx, cy, rs, F[1]);
  pixelKreis(c, cx - rs * 0.15, cy - rs * 0.18, rs * 0.78, F[2]);
  pixelKreis(c, cx - rs * 0.35, cy - rs * 0.4, rs * 0.35, F[3]);
  // Rippen strahlenförmig, Stacheln als helle Punkte
  const rip = 8;
  for (let i = 0; i < rip; i++) {
    const w = i / rip * Math.PI * 2;
    for (let d = rs * 0.25; d < rs; d += 1) { c.fillStyle = F[0]; c.fillRect(Math.round(cx + Math.cos(w) * d), Math.round(cy + Math.sin(w) * d), 1, 1); }
    c.fillStyle = F[4]; c.fillRect(Math.round(cx + Math.cos(w + 0.3) * rs * 0.7), Math.round(cy + Math.sin(w + 0.3) * rs * 0.7), 1, 1);
  }
  // manchmal eine Blüte oben
  if (rr() < 0.35) { pixelKreis(c, cx - rs * 0.1, cy - rs * 0.1, Math.max(1, rs * 0.22), "#e8507a"); c.fillStyle = "#ffe066"; c.fillRect(Math.round(cx - rs * 0.1), Math.round(cy - rs * 0.1), 1, 1); }
}
// Fels: unregelmäßiger Umriss, oben links hell, rechts unten dunkel, ein paar Risse
function zeichneFels(c, cx, cy, r, F, rr, zr, S) {
  const n = 9, pk = [];
  for (let i = 0; i < n; i++) { const w = i / n * Math.PI * 2 + rr() * 0.3, d = r * (0.75 + rr() * 0.3); pk.push([cx + Math.cos(w) * d, cy + Math.sin(w) * d * 0.85]); }
  const flaeche = (ox, oy, k, f) => { c.fillStyle = f; c.beginPath(); pk.forEach(([x, y], i) => { const px = cx + (x - cx) * k + ox, py = cy + (y - cy) * k + oy; i ? c.lineTo(px, py) : c.moveTo(px, py); }); c.closePath(); c.fill(); };
  flaeche(0, 0, 1.06, F[0]);
  flaeche(0, 0, 1, F[1]);
  flaeche(-r * 0.12, -r * 0.14, 0.78, F[2]);
  flaeche(-r * 0.3, -r * 0.32, 0.42, F[3]);
  c.fillStyle = F[4];
  for (let i = 0; i < r * 0.8; i++) c.fillRect(Math.round(cx - r * 0.45 + rr() * r * 0.5), Math.round(cy - r * 0.5 + rr() * r * 0.4), 1, 1);
  // Risse
  c.fillStyle = F[0];
  for (let k = 0; k < 2; k++) {
    let x = cx + (rr() - 0.5) * r * 0.6, y = cy + (rr() - 0.5) * r * 0.5, w = rr() * Math.PI * 2;
    for (let i = 0; i < r * 0.7; i++) { c.fillRect(Math.round(x), Math.round(y), 1, 1); w += (rr() - 0.5) * 0.8; x += Math.cos(w); y += Math.sin(w); }
  }
}

// ---------- Fallendes Laub (Herbst): kleine Animation über dem Bahnbild ----------
// Blätter lösen sich aus den Kronen, trudeln mit dem Wind zu Boden (Schatten kommt ihnen entgegen),
// bleiben kurz liegen und verblassen. Koordinaten in Metern, gezeichnet im Bahnbild-Maßstab S.
const laubfall = { teile: [], bahn: null };
window.zeichneLaubfall = function (c, bild, dt, wind) {
  const baeume = bild && bild.laubBaeume;
  if (!baeume || !baeume.length) { laubfall.teile.length = 0; return; }
  if (laubfall.bahn !== bild.laubBahn) { laubfall.bahn = bild.laubBahn; laubfall.teile.length = 0; }
  const ziel = Math.min(100, baeume.length * 5);
  if (laubfall.teile.length < ziel && Math.random() < dt * ziel * 0.3) {
    const b = baeume[Math.floor(Math.random() * baeume.length)], w = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * b.r * 0.9, f = b.farben;
    laubfall.teile.push({
      x: b.x + Math.cos(w) * d, y: b.y + Math.sin(w) * d, h: bild.kronenAlsSprite ? baumAnhebung(b) / 0.6 + (Math.random() - 0.5) * b.r : 3 + Math.random() * 5, v: 0.5 + Math.random() * 0.6,
      phase: Math.random() * 6.3, farbe: f[2 + Math.floor(Math.random() * 2)], rand: f[1], liegt: 0, // Farben wie in der Krone
    });
  }
  const A = typeof AUF === "number" ? AUF : 1; // bei hoher Auflösung halbe Spielpixel = echte Pixel
  const wx = ((wind && wind.x) || 0) * 0.35, wy = ((wind && wind.y) || 0) * 0.35, pz = Math.max(1, Math.round(S * A / 5)) / A;
  laubfall.teile = laubfall.teile.filter(t => {
    if (t.h > 0) {
      t.phase += dt * 4; t.h -= t.v * dt;
      t.x += (wx + Math.sin(t.phase) * 0.5) * dt; t.y += (wy + Math.cos(t.phase * 0.7) * 0.3) * dt;
    } else t.liegt += dt;
    return t.liegt < 4;
  });
  // 3/4-Ansicht: Blätter in der Luft um ihre Höhe × 0,6 angehoben (wie die Scheibe); hochkant ist
  // "oben" auf dem Bildschirm die +x-Richtung der Bahn
  const heben = bild.kronenAlsSprite, hk = typeof hochkant !== "undefined" && hochkant;
  for (const t of laubfall.teile) {
    const L = heben && t.h > 0 ? t.h * 0.6 : 0;
    const px = Math.round((t.x + (hk ? L : 0)) * S * A) / A, py = Math.round((t.y - (hk ? 0 : L)) * S * A) / A;
    if (t.h > 0) { c.fillStyle = "rgba(0,20,0,.35)"; c.fillRect(Math.round((t.x + t.h * 0.25) * S * A) / A, Math.round((t.y + t.h * 0.35) * S * A) / A, pz, pz); }
    const quer = t.h > 0 && Math.sin(t.phase) > 0; // das Blatt dreht sich: mal breit, mal schmal
    c.globalAlpha = t.liegt > 3 ? 4 - t.liegt : 1;
    c.fillStyle = t.rand; c.fillRect(px, py, quer ? 2 * pz : pz, quer ? pz : 2 * pz);
    c.fillStyle = t.farbe; c.fillRect(px, py, pz, pz);
    c.globalAlpha = 1;
  }
};

// Paletten und Deko je Jahreszeit (Farben dunkel → hell)
const mitBluete = p => Object.assign(p, { bluete: true });
window.JAHRESZEITEN = {
  fruehling: {
    gras: ["#1c5426", "#286a2a", "#378234", "#47983a", "#5aac40", "#70bc48"],
    aus: ["#163f22", "#1d4e27", "#255e2b", "#2e6c2f", "#397a32", "#468636"],
    fair: ["#3a8a34", "#4ea03c", "#5eb244", "#6ec04c", "#80cc56", "#94d862"],
    weg: ["#6e5232", "#8a6a3e", "#a3804c", "#b8955a", "#c9a86c", "#d8bb80"],
    laubbaum: h => h < 0.3 ? mitBluete(["#7a3a5a", "#c06a92", "#de8eb2", "#f2b6ce", "#fde4ee"]) : ["#123f1a", "#2a7028", "#3e9234", "#58ac40", "#86ca5a"],
    kiefer: ["#0c2e22", "#163f2e", "#1f5438", "#2c6a44", "#4a8a52"],
    blumen: { dichte: 0.2, farben: ["#f6f4ea", "#f6f4ea", "#f2c62e", "#a070d0", "#6a8ce8"] },
    klee: true, bueschel: 0.9,
    laub: { dichte: 0.12, farben: ["#f2b6ce", "#fde4ee", "#de8eb2"], nurBluete: true },
  },
  sommer: {
    gras: ["#174a26", "#1f5a2a", "#276b2c", "#2f7d32", "#3a8c36", "#4c9c3c"],
    aus: ["#123a20", "#183f24", "#1d4c27", "#22572a", "#2a632d", "#336e30"],
    fair: ["#2f7d32", "#45953e", "#52a646", "#5fb54c", "#6cc152", "#7ccc5c"],
    weg: ["#6e5232", "#8a6a3e", "#a3804c", "#b8955a", "#c9a86c", "#d8bb80"],
    laubbaum: () => ["#0e3a1a", "#1c5a24", "#2a7a30", "#3c9a3c", "#62b44c"],
    kiefer: ["#0c2e22", "#163f2e", "#1f5438", "#2c6a44", "#4a8a52"],
    blumen: { dichte: 0.07, farben: ["#f6f4ea", "#f6f4ea", "#f2c62e"] },
    klee: true, bueschel: 0.9, laub: null,
  },
  herbst: {
    gras: ["#28441e", "#345428", "#3f622c", "#4b6e30", "#587a36", "#6a863e"],
    aus: ["#1e361a", "#253f1e", "#2d4a22", "#355526", "#3e5f2a", "#48692e"],
    fair: ["#3a6a2e", "#4a7a34", "#58883a", "#649240", "#709c46", "#7ea64e"],
    weg: ["#5e4428", "#7a5a34", "#937040", "#a8844e", "#ba9860", "#caac74"],
    laubbaum: h => [
      ["#5a2a10", "#a4501c", "#d07828", "#e8a038", "#f4c860"],
      ["#4a1414", "#8a2a1e", "#b84028", "#d8642e", "#ec9040"],
      ["#5a4a10", "#a08a20", "#c8b030", "#e4cc48", "#f4e478"],
      ["#3a2410", "#5e3e1c", "#7e5828", "#9a7436", "#b8944e"], // braun (Eiche)
    ][Math.floor(h * 4)],
    kiefer: ["#0c2e22", "#163f2e", "#1f5438", "#2c6a44", "#4a8a52"],
    blumen: { dichte: 0.008, farben: ["#f6f4ea"] },
    klee: false, bueschel: 0.7,
    laub: { dichte: 0.6, farben: ["#c8782a", "#d9a030", "#a4522a", "#8a6a2a", "#b84028"] },
    laubfall: true,
  },
  winter: {
    schnee: true,
    gras: ["#7f90b0", "#9eb0cc", "#bccadf", "#d4deec", "#e6edf6", "#f6f9fd"],
    aus: ["#71829f", "#8c9ebc", "#a8b8d2", "#c2cfe3", "#d8e1ee", "#e8eef6"],
    fair: ["#647e74", "#94a8bc", "#b0c0d4", "#c8d4e4", "#dae3ee", "#e8eef6"],
    weg: ["#4e4440", "#665a52", "#7e7266", "#968a7c", "#aea494", "#c6beb2"],
    laubbaum: () => ["#3a2e24"],
    kiefer: ["#0a281e", "#123628", "#1a4832", "#24583c", "#3a7448"],
    blumen: { dichte: 0, farben: [] },
    klee: false, bueschel: 0, laub: null,
  },
};

// Themen-Optiken der Wochenbahnen (keine Jahreszeit, gelten immer für ihre Bahn)
JAHRESZEITEN.wueste = {
  wueste: true,
  gras: ["#9c6a38", "#b27c42", "#c68e4e", "#d6a05c", "#e2b26e", "#eec488"], // loser Sand
  aus: ["#7e5230", "#925f36", "#a46c3e", "#b47a48", "#c28852", "#ce965e"],
  fair: ["#b48a56", "#c49a62", "#d2a86e", "#deb67c", "#e8c48c", "#f2d4a0"], // festgefahrener Sand
  weg: ["#6a5440", "#806650", "#967a60", "#aa8e72", "#bca284", "#ccb496"],
  erde: ["#8a5c34", "#a06c3c", "#b67e48"],
  flussbett: ["#4e3220", "#6a4428", "#7e5432", "#92643c", "#a47448", "#b48456"], // rissiger Lehm
  laubbaum: h => h < 0.5 ? ["#1c3a20", "#2c5a2e", "#3e7638", "#5a9248", "#e8e0b0"] : ["#1e3a26", "#2e5634", "#427040", "#60904e", "#f0e8c0"],
  kiefer: ["#1c3a20", "#2c5a2e", "#3e7638", "#5a9248", "#e8e0b0"],
  fels: ["#4a3426", "#6e5038", "#8e6c4c", "#ac8a66", "#c8a884"],
  busch: ["#6a6230", "#7e7438", "#948a48", "#5a4a2a"],
  himmel: ["#3a8ed8", "#5aa6e0", "#84bee6", "#b6d6e8", "#f0dcb4"],
  circle: ["#4a2810", "#f6e6c4"], // Circle 1: dunkle Punkte mit hellem Rand, auf Sand gut sichtbar
  blumen: { dichte: 0, farben: [] },
  klee: false, bueschel: 0.08, laub: null,
};

// Optiken, die eine Wochenbahn als Daten mitbringt (optikDaten in wochenbahnen.js): so braucht ein neues Thema
// kein Release, solange es vorhandene Zeichenarten nutzt. basis = Optik, deren übrige Werte gelten;
// laubbaum darf eine Farbliste sein (statt Funktion), wueste: true schaltet Sand, Kakteen und Felsen ein.
for (const e of window.WOCHENBAHNEN || []) {
  const d = e && e.optikDaten;
  if (!d || !e.optik || JAHRESZEITEN[e.optik]) continue;
  const o = Object.assign({}, JAHRESZEITEN[d.basis] || JAHRESZEITEN.sommer, d);
  if (Array.isArray(o.laubbaum)) { const f = o.laubbaum; o.laubbaum = () => f; }
  JAHRESZEITEN[e.optik] = o;
}

// Ziffern 3×5 für das Bahnschild
const ZIFFERN = {
  0: ["111", "101", "101", "101", "111"], 1: ["010", "110", "010", "010", "111"], 2: ["111", "001", "111", "100", "111"],
  3: ["111", "001", "011", "001", "111"], 4: ["101", "101", "111", "001", "001"], 5: ["111", "100", "111", "001", "111"],
  6: ["111", "100", "111", "101", "111"], 7: ["111", "001", "010", "010", "010"], 8: ["111", "101", "111", "101", "111"],
  9: ["111", "101", "111", "001", "111"],
};

// Jahreszeit nach Datum (meteorologisch): Dez–Feb Winter, März–Mai Frühling, Juni–Aug Sommer, Sep–Nov Herbst
window.jahreszeitNachDatum = (datum = new Date()) => {
  const m = datum.getMonth();
  return m === 11 || m < 2 ? "winter" : m < 5 ? "fruehling" : m < 8 ? "sommer" : "herbst";
};

// ============================================================
//  PUTT-ANSICHT JE JAHRESZEIT (Seitenansicht am Korb)
// ============================================================
//  zeichnePuttSzene: Himmel, zwei Baumreihen und Wiese, je Jahreszeit einmal gemalt und gemerkt.
//  zeichnePuttLaub: im Herbst fallen Blätter aus der Baumreihe vor dem Korb zu Boden.
const PUTT_HORIZONT = 100;
const puttSzenen = {};
// A = echte Pixel je Spielpixel (AUF): bei hoher Auflösung wird die Szene im feinen Raster gemalt –
// Formen behalten ihre Größe in Spielpixeln, Dithering, Gras, Blumen, Äste und Laub werden pixelgenau feiner.
window.zeichnePuttSzene = function (c, jz, bx, by, bw, bh, A = 1) {
  const k = jz + ":" + bw + "x" + bh + "@" + A;
  if (!puttSzenen[k]) puttSzenen[k] = puttSzeneMalen(jz, bw, bh, A);
  c.drawImage(puttSzenen[k], bx, by, bw, bh);
};

function puttSzeneMalen(jz, bw, bh, A = 1) {
  const JZ = JAHRESZEITEN[jz] || JAHRESZEITEN.sommer, winter = !!JZ.schnee, wueste = !!JZ.wueste;
  const BW = bw * A, BH = bh * A;
  const cv = document.createElement("canvas"); cv.width = BW; cv.height = BH;
  const c = cv.getContext("2d"), rnd = zufall(42), hor = PUTT_HORIZONT, HOR = hor * A;
  // eigener Zufall für Details, deren Anzahl mit A wächst – so stehen Bäume und Wolken bei jeder Auflösung gleich
  const rd = A > 1 ? zufall(4711) : rnd;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5], bay = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
  // punkt: echte Pixel; K und R: Kreis bzw. Rechteck in Spielpixeln, gezeichnet im feinen Raster
  const punkt = (x, y, f, w = 1, h = 1) => { c.fillStyle = f; c.fillRect(Math.round(x), Math.round(y), w, h); };
  const K = (x, y, r, f) => pixelKreis(c, x * A, y * A, r * A, f);
  const R = (x, y, w, h, f) => { c.fillStyle = f; c.fillRect(Math.round(x * A), Math.round(y * A), Math.max(1, Math.round(w * A)), Math.max(1, Math.round(h * A))); };
  // Farbe mit Himmel mischen: weiter hinten liegende Bäume wirken blasser
  const misch = (a, b, t) => { const p = rgb(a), q = rgb(b); return "rgb(" + p.map((v, i) => Math.round(v + (q[i] - v) * t)).join(",") + ")"; };
  // Farbrampe verfeinern: zwischen je zwei Stufen eine Mischstufe (bei hoher Auflösung)
  const feiner = P => A > 1 ? P.flatMap((f, i) => i ? [misch(P[i - 1], f, 0.5), f] : [f]) : P;
  const rampe = (P, t, x, y) => { const f = Math.max(0, Math.min(1, t)) * (P.length - 1); let i = Math.floor(f); if (f - i > bay(x, y)) i++; return P[Math.min(P.length - 1, i)]; };

  // ---- Himmel: Verlauf mit Dithering, Sonne, Wolken ----
  const HIMMEL = {
    fruehling: ["#4aa8ec", "#6cc0f4", "#94d4f8", "#bfe6fb"],
    sommer: ["#2f8ee0", "#4aa6ec", "#6cbcf2", "#94d0f6"],
    herbst: ["#6a9cc8", "#86b0d4", "#a6c4dc", "#c8d8e2"],
    winter: ["#9aaec4", "#b4c4d4", "#ccd6e0", "#e2e8ee"],
  }[jz] || JZ.himmel || ["#2f8ee0", "#4aa6ec", "#6cbcf2", "#94d0f6"];
  const HF = feiner(HIMMEL);
  for (let y = 0; y < HOR; y++) for (let x = 0; x < BW; x++) punkt(x, y, rampe(HF, y / HOR, x, y));
  if (jz === "sommer" || jz === "fruehling" || wueste) {
    // Sonne mit gedithertem Schein
    if (A > 1) for (let y = -13 * A; y <= 13 * A; y++) for (let x = -13 * A; x <= 13 * A; x++) {
      const d = Math.hypot(x, y) / A; if (d > 9 && d < 13 && bay(x & 3, y & 3) < (13 - d) / 8) punkt((bw - 24) * A + x, 18 * A + y, "#fff6c8");
    }
    K(bw - 24, 18, 9, "#fff2a8"); K(bw - 24, 18, 7, "#ffe066"); K(bw - 26, 16, 3, "#fff6c8");
  }
  const wolke = (x, y, w, hell, dunkel) => {
    // Unterseite dunkler, darüber die hellen Ballen, oben links ein Lichtrand
    for (let i = 0; i < w; i += 5) K(x + i, y + 1 - Math.round(Math.sin(i / w * Math.PI) * 5), 5 + (i % 3), dunkel);
    for (let i = 0; i < w; i += 5) K(x + i, y - Math.round(Math.sin(i / w * Math.PI) * 5), 5 + (i % 3), hell);
    if (A > 1) for (let i = 0; i < w; i += 5) K(x + i - 1, y - 1.5 - Math.round(Math.sin(i / w * Math.PI) * 5), 2.5 + (i % 3) * 0.6, "#ffffff");
    R(x - 4, y + 3, w + 8, 2, dunkel);
    R(x - 5, y + 1, w + 10, 2, hell);
  };
  const wolken = { fruehling: 3, sommer: 2, herbst: 4, winter: 5, wueste: 1 }[jz] ?? 2;
  for (let i = 0; i < wolken; i++) {
    const w = 18 + Math.floor(rnd() * 22), x = 6 + rnd() * (bw - w - 12), y = 12 + rnd() * 40;
    wolke(x, y, w, winter ? "#eef2f6" : "#f8fbff", winter ? "#c4ccd6" : jz === "herbst" ? "#b8c4cc" : "#d8e8f2");
  }

  if (wueste) { wuestenSzene(c, JZ, HIMMEL, bw, bh, hor, rnd, bay, punkt, misch, A, K, R, rd); return cv; }

  // ---- Baumreihen am Horizont ----
  const laubFarben = i => JZ.laubbaum(((i * 0.37) % 1 + 1) % 1);
  // hintere Reihe: blasse Kronen (im Winter blasse Äste) direkt auf dem Horizont
  for (let x = -4; x < bw + 8; x += 7 + Math.floor(rnd() * 4)) {
    const r = 6 + Math.floor(rnd() * 4), y = hor - 4 - Math.floor(rnd() * 5);
    if (winter) {
      const f = misch("#4a3e34", HIMMEL[3], 0.55);
      punkt(x * A, (y - r) * A, f, Math.max(1, A / 2), (r + 4) * A);
      for (let k = 0; k < r * A; k += 2) { punkt(x * A - (k >> 1), (y - r) * A + k, f); punkt(x * A + (k >> 1), (y - r) * A + k + 1, f); }
    } else {
      const p = laubFarben(Math.floor(x));
      K(x, y, r, misch(p[1], HIMMEL[3], 0.5)); K(x - 2, y - 2, r * 0.6, misch(p[2], HIMMEL[3], 0.5));
      if (A > 1) for (let k = 0; k < r * 4; k++) { const w = rd() * Math.PI * 2, d = Math.sqrt(rd()) * r * 0.9; punkt((x + Math.cos(w) * d) * A, (y + Math.sin(w) * d) * A, misch(rd() < 0.5 ? p[1] : p[2], HIMMEL[3], 0.45)); }
    }
  }
  // vordere Reihe: Laubbäume mit Stamm, Kontur und Licht von links oben; dazwischen Kiefern
  const baeume = [];
  for (let x = 4; x < bw; x += 13 + Math.floor(rnd() * 7)) baeume.push({ x, r: 8 + Math.floor(rnd() * 5), kiefer: rnd() < 0.25, i: baeume.length });
  for (const b of baeume) {
    const fuss = hor + 2, cy = fuss - b.r - 6;
    R(b.x - 1, cy, 3, fuss - cy, "#3a2a1c");
    punkt((b.x - 1) * A, cy * A, "#5a4430", A > 1 ? 2 : 1, (fuss - cy) * A);
    if (A > 1) { punkt((b.x - 1) * A + 2, cy * A, "#4a3624", 1, (fuss - cy) * A); for (let y = cy * A; y < fuss * A; y += 3) if (rd() < 0.5) punkt((b.x - 1) * A + 1 + Math.floor(rd() * 4), y, "#2a1e14"); }
    if (b.kiefer) {
      const KI = JZ.kiefer;
      for (let s = 0; s < 4; s++) {
        const w = b.r - s * 2, y = fuss - 6 - s * 5;
        for (let k = 0; k < 6 * A; k++) {
          const kk = k / A;
          punkt((b.x - w) * A + k, y * A - k, kk < 2 ? KI[0] : kk < 4 ? KI[1] : KI[2], Math.max(1, (w * A - k) * 2), 1);
          // Nadelspitzen am unteren Rand
          if (A > 1 && k === 0) for (let i = 0; i < w * 2 * A; i += 3) punkt((b.x - w) * A + i, y * A + 1, KI[0]);
        }
        if (winter) { R(b.x - w + 5, y - 5, Math.max(1, (w - 5) * 2), 1, "#f4f8ff"); R(b.x - w + 2, y - 2, 2, 1, "#f4f8ff"); }
      }
    } else if (winter) {
      // kahler Baum: Äste nach oben verzweigt, Schnee auf den Ästen
      const ast = (x, y, w, len, t) => {
        const dicke = A > 1 ? [3, 2, 1, 1][t] : t ? 1 : 2;
        for (let k = 0; k < len * A; k++) {
          const px = x * A + Math.cos(w) * k, py = y * A + Math.sin(w) * k;
          punkt(px, py, t < 2 ? "#3a2e24" : "#5a4a3c", dicke, 1);
          if (t < 3 && k % (3 * A) === 1 && rd() < 0.5) punkt(px, py - 1, "#f4f8ff", A > 1 ? 2 : 1, 1);
        }
        if (t < 3) for (const s of [-1, 1]) ast(x + Math.cos(w) * len * 0.6, y + Math.sin(w) * len * 0.6, w + s * (0.4 + rnd() * 0.3), len * 0.6, t + 1);
      };
      ast(b.x, cy + 4, -Math.PI / 2, b.r + 4, 0);
    } else {
      const LB = laubFarben(b.i + 3);
      const gruppen = [{ x: b.x, y: cy, r: b.r * 0.7 }];
      for (let k = 0; k < 5; k++) { const w = Math.PI + k / 4 * Math.PI, rg = b.r * (0.4 + rnd() * 0.12); gruppen.push({ x: b.x + Math.cos(w) * b.r * 0.55, y: cy + Math.sin(w) * b.r * 0.5 + 2, r: rg }); }
      for (const q of gruppen) K(q.x, q.y, q.r + 1, LB[0]);
      for (const q of gruppen) {
        K(q.x, q.y, q.r, LB[1]);
        K(q.x - q.r * 0.2, q.y - q.r * 0.25, q.r * 0.7, LB[2]);
        K(q.x - q.r * 0.38, q.y - q.r * 0.42, q.r * 0.34, LB[3]);
      }
      // einzelne Blätter bzw. Blüten; bei hoher Auflösung mehr und kleiner
      for (let k = 0; k < b.r * 3 * A * A; k++) {
        const w = rd() * Math.PI * 2, d = Math.sqrt(rd()) * b.r * 0.9;
        punkt((b.x + Math.cos(w) * d) * A, (cy + Math.sin(w) * d) * A, LB.bluete ? (rd() < 0.5 ? LB[4] : "#ffffff") : rd() < 0.5 ? LB[1] : LB[3]);
      }
    }
  }

  // ---- Wiese: Mähstreifen in Perspektive (nach vorne breiter), Büschel, Blumen, Laub oder Schnee ----
  const F = winter ? JZ.gras : JZ.fair, G = JZ.gras, FF = feiner(F);
  let streifen = 0;
  for (let y = hor, k = 0; y < bh; k++) {
    const h = 2 + Math.floor(k * 1.3);
    for (let yy = y * A; yy < Math.min(BH, (y + h) * A); yy++) for (let x = 0; x < BW; x++) {
      const t = (winter ? 0.62 : 0.4) + (streifen ? 0.18 : 0) + ((yy - HOR) / (BH - HOR)) * 0.12 + (rd() - 0.5) * 0.2;
      punkt(x, yy, rampe(FF, t, x, yy));
    }
    y += h; streifen = 1 - streifen;
  }
  // Schatten der Baumreihe direkt am Horizont
  for (let yy = 0; yy < A; yy++) for (let x = 0; x < BW; x++) if (bay(x, HOR + yy) < 0.6 - yy * 0.15) punkt(x, HOR + yy, winter ? "#8a9ab8" : G[0]);
  if (!winter) for (let yy = A; yy < 2 * A; yy++) for (let x = 0; x < BW; x++) if (bay(x, HOR + yy) < 0.3) punkt(x, HOR + yy, G[1]);
  // Büschel (vorne größer): Halme als kurze Striche
  const tiefeG = y => (y - HOR) / (BH - HOR);
  for (let i = 0; i < (winter ? 0 : 70 * A); i++) {
    const y = HOR + 3 * A + Math.floor(rd() * (BH - HOR - 4 * A)), x = Math.floor(rd() * BW);
    const g = A > 1 ? 1 + Math.round(tiefeG(y) * 4) : (y > HOR + 25 ? 2 : 1);
    punkt(x, y, G[0]);
    punkt(x - 1, y - g, F[F.length - 1], 1, g); punkt(x + 1, y - g, F[F.length - 2], 1, g);
    if (g > 1) punkt(x, y - 2 * g + 1, F[F.length - 1], 1, g);
  }
  // Blumen (vorne mit Blütenblättern)
  for (let i = 0; i < JZ.blumen.dichte * 300 * A; i++) {
    const y = HOR + 4 * A + Math.floor(rd() * (BH - HOR - 6 * A)), x = Math.floor(rd() * BW), f = JZ.blumen.farben[Math.floor(rd() * JZ.blumen.farben.length)];
    const nah = A > 1 ? tiefeG(y) > 0.55 : y > HOR + 25;
    if (nah) { punkt(x - 1, y, f); punkt(x + 1, y, f); punkt(x, y - 1, f); punkt(x, y + 1, f); if (A > 1) punkt(x, y + 2, G[0], 1, 2); }
    punkt(x, y, "#f2c62e");
  }
  // Laub (Herbst) bzw. Blütenblätter (Frühling): am Horizont dichter, vorne einzelne größere Blätter
  if (JZ.laub) for (let i = 0; i < JZ.laub.dichte * 260 * A; i++) {
    const nah = rd(), y = HOR + 2 * A + Math.floor(nah * nah * (BH - HOR - 4 * A)), x = Math.floor(rd() * BW), f = JZ.laub.farben[Math.floor(rd() * JZ.laub.farben.length)];
    const g = A > 1 ? 1 + Math.floor(tiefeG(y) * 3) : (y > HOR + 22 ? 2 : 1);
    punkt(x, y, f, g, Math.max(1, g - 1));
  }
  // Schnee: Glitzern und ein paar Fußspuren zum Korb
  if (winter) {
    for (let i = 0; i < 120 * A; i++) punkt(rd() * BW, HOR + 2 * A + rd() * (BH - HOR - 2 * A), rd() < 0.5 ? "#ffffff" : "#a8b8d0");
    for (let y = bh - 4, s = 0; y > hor + 8; y -= 3 + Math.floor((y - hor) / 12), s = 1 - s) {
      const x = bw / 2 - 14 + s * 4 + (bh - y) * 0.25, g = y > hor + 25 ? 2 : 1;
      R(x, y, g + 1, g, "#9eb0cc");
      if (A > 1) punkt(x * A, y * A, "#7f93b4", (g + 1) * A, 1);
    }
  }
  return cv;
}

// Wüste in der Putt-Ansicht: Dünen und Tafelberge am Horizont, Saguaros, Sand mit Rippeln
// (A, K, R wie in puttSzeneMalen: Feinraster, Kreis und Rechteck in Spielpixeln)
function wuestenSzene(c, JZ, HIMMEL, bw, bh, hor, rnd, bay, punkt, misch, A = 1, K, R, rd = rnd) {
  const F = JZ.fair, G = JZ.gras, FE = JZ.fels, BW = bw * A, BH = bh * A, HOR = hor * A;
  // Tafelberge weit hinten (blass)
  for (const [x0, w, h] of [[8, 38, 16], [bw - 52, 46, 22]]) {
    for (let X = x0 * A; X < (x0 + w) * A; X++) {
      const x = X / A, rand = Math.min(x - x0, x0 + w - x), hh = Math.min(h, rand * 1.6) * A;
      for (let Y = Math.round(HOR - hh); Y < HOR; Y++) punkt(X, Y, misch(Y < HOR - hh + 2 * A ? FE[3] : (A > 1 && (X + Y) % 7 === 0 ? FE[1] : FE[2]), HIMMEL[3], 0.5));
    }
  }
  // Dünen: zwei Reihen weicher Hügel
  for (const [hoehe, farbe, ph] of [[10, misch(G[3], HIMMEL[3], 0.35), 0.7], [6, G[2], 2.1]]) {
    for (let X = 0; X < BW; X++) {
      const x = X / A, hh = Math.round(hoehe * A * (0.55 + 0.45 * Math.sin(x / 17 + ph) * Math.sin(x / 7.3 + ph * 2)));
      for (let Y = HOR - Math.max(1, hh); Y <= HOR; Y++) punkt(X, Y, farbe);
      punkt(X, HOR - Math.max(1, hh), G[4]);
    }
  }
  // Sand vorne: Rippel in Perspektive (nach vorne breiter)
  for (let Y = HOR + 1; Y < BH; Y++) for (let X = 0; X < BW; X++) {
    const y = Y / A, x = X / A, tiefe = (y - hor) / (bh - hor), rip = Math.sin(y * (1.6 - tiefe) + Math.sin(x / 13) * 1.5);
    const t = 0.4 + tiefe * 0.2 + rip * 0.12 + (rd() - 0.5) * 0.12;
    const f = t * (F.length - 1); let i = Math.floor(f); if (f - i > bay(X, Y)) i++;
    punkt(X, Y, F[Math.max(0, Math.min(F.length - 1, i))]);
  }
  // Saguaros: Stamm mit Armen, Licht links, Rippen als Linien
  const KF = JZ.laubbaum(0.2);
  for (const [x, h, gross] of [[14, 30, 1], [44, 16, 0], [bw - 22, 34, 1], [bw - 50, 14, 0]]) {
    const fuss = gross ? hor + 14 : hor + 3, br = gross ? 5 : 3;
    const saeule = (sx, y0, y1, b) => {
      for (let Y = Math.round(y0 * A); Y < Math.round(y1 * A); Y++) for (let k = 0; k < b * A; k++)
        punkt(sx * A + k, Y, k === 0 ? KF[3] : k === b * A - 1 ? KF[0] : (A > 1 ? (k % 3 === 1 ? KF[1] : KF[2]) : (k + Y) % 3 ? KF[2] : KF[1]));
    };
    saeule(x, fuss - h, fuss, br);
    const ah = Math.round(h * 0.45), ax = br + 2;
    saeule(x - ax, fuss - h * 0.75, fuss - h * 0.75 + ah, br - 1); R(x - ax, fuss - h * 0.75 + ah, ax, 1, KF[1]);
    saeule(x + br + 1, fuss - h * 0.85, fuss - h * 0.85 + ah * 0.8, br - 1); R(x + br, fuss - h * 0.85 + ah * 0.8, 2, 1, KF[1]);
    for (let X = (x - 2) * A; X < (x + br + 4) * A; X++) if (bay(X, fuss * A) < 0.6) punkt(X + A, fuss * A, G[0], 1, A);
  }
  // Steine und trockene Büsche
  for (let i = 0; i < 40 * A; i++) {
    const Y = HOR + 3 * A + Math.floor(rd() * (BH - HOR - 4 * A)), X = Math.floor(rd() * BW), g = (Y > HOR + 25 * A ? 2 : 1) * (A > 1 ? 1.5 : 1) | 0;
    if (rd() < 0.5) { punkt(X, Y, FE[1], g, 1); if (g > 1) { punkt(X + g, Y, FE[2]); punkt(X, Y - 1, FE[3], g, 1); } }
    else { const B = JZ.busch; punkt(X, Y, B[0]); punkt(X - 1, Y - g, B[2], 1, g); punkt(X + 1, Y - g, B[1], 1, g); if (g > 1) punkt(X, Y - 2 * g + 1, B[2], 1, g); }
  }
}

// Fallende Blätter in der Putt-Ansicht (nur Herbst): lösen sich aus der Baumreihe, trudeln mit dem Wind
// nach vorne und landen in der Wiese, bleiben kurz liegen und verblassen
const puttLaub = { teile: [], zuletzt: 0 };
window.zeichnePuttLaub = function (c, jz, bx, by, bw, bh, wind) {
  const JZ = JAHRESZEITEN[jz];
  if (!JZ || !JZ.laubfall) { puttLaub.teile.length = 0; return; }
  const jetzt = performance.now(), dt = Math.min(0.05, (jetzt - (puttLaub.zuletzt || jetzt)) / 1000);
  puttLaub.zuletzt = jetzt;
  const FARBEN = [0, 1, 2].map(i => JZ.laubbaum(i / 3 + 0.1));
  if (puttLaub.teile.length < 28 && Math.random() < dt * 9) {
    const p = FARBEN[Math.floor(Math.random() * FARBEN.length)];
    puttLaub.teile.push({ x: Math.random() * bw, y: PUTT_HORIZONT - 30 + Math.random() * 22, boden: PUTT_HORIZONT + 4 + Math.random() * (bh - PUTT_HORIZONT - 8),
      v: 10 + Math.random() * 10, phase: Math.random() * 6.3, farbe: p[2 + Math.floor(Math.random() * 2)], rand: p[1], liegt: 0 });
  }
  const wx = ((wind && wind.x) || 0) * 2;
  puttLaub.teile = puttLaub.teile.filter(t => {
    if (t.y < t.boden) { t.phase += dt * 5; t.y += t.v * dt; t.x += (wx + Math.sin(t.phase) * 12) * dt; }
    else t.liegt += dt;
    return t.liegt < 3 && t.x > -4 && t.x < bw + 4;
  });
  c.save();
  c.beginPath(); c.rect(bx, by, bw, bh); c.clip();
  for (const t of puttLaub.teile) {
    // bei hoher Auflösung (AUF) in echten Pixeln: Größe wächst feiner nach vorne
    const A = typeof AUF === "number" ? AUF : 1, nah = (t.y - PUTT_HORIZONT + 30) / (bh - PUTT_HORIZONT + 30);
    const g = A > 1 ? (1 + Math.round(nah * 3)) / A : nah > 0.6 ? 2 : 1, px = Math.round((bx + t.x) * A) / A, py = Math.round((by + t.y) * A) / A;
    const quer = t.liegt === 0 && Math.sin(t.phase) > 0;
    c.globalAlpha = t.liegt > 2 ? 3 - t.liegt : 1;
    c.fillStyle = t.rand; c.fillRect(px, py, quer ? 2 * g : g, quer ? g : 2 * g);
    c.fillStyle = t.farbe; c.fillRect(px, py, g, g);
  }
  c.restore();
};

// ============================================================
//  KORB IM DETAIL (nur mit Jahreszeiten-Grafik)
// ============================================================
const KORB = {
  gelb: ["#8a6a08", "#b08a10", "#f0c020", "#ffe066"],
  metall: ["#3a3e42", "#5a6066", "#8a9096", "#b0b6bc", "#d8dce0", "#f2f4f6"],
  schnee: "#f4f8ff",
};
const punktSetzen = (c, x, y, f, w = 1, h = 1) => { c.fillStyle = f; c.fillRect(Math.round(x), Math.round(y), w, h); };

// Seitenansicht in der Putt-Ansicht. K = KETTEN (Mitte der Ketten), wx = Wackeln nach einem Treffer
// a = echte Pixel je Spielpixel: bei a > 1 im feinen Raster (puttKorbFein), sonst die grobe Fassung
window.zeichnePuttKorb = function (c, K, wx, winter, a = 1) {
  if (a > 1) { puttKorbFein(c, K, wx, winter, a); return; }
  const M = KORB.metall, G = KORB.gelb, p = (x, y, f, w, h) => punktSetzen(c, x, y, f, w, h);
  const x0 = K.x, oben = K.y - 13, boden = K.y + 40;
  // Schatten am Boden: flache Ellipse, gedithert
  for (let j = 0; j < 3; j++) for (let i = -12 + j * 3; i <= 12 - j * 3; i++) if (((i + j) & 1) === 0 || j === 0) p(x0 + i + 2, boden + 1 - j, "rgba(0,20,0,.4)");
  // Stange: links Licht, rechts Schatten; Fuß mit Bodenhülse
  for (let y = oben + 1; y < boden; y++) { p(x0 - 1, y, M[3]); p(x0, y, M[4]); p(x0 + 1, y, M[1]); }
  p(x0, oben + 2, M[5], 1, 6);
  p(x0 - 2, boden - 3, M[1], 5, 3); p(x0 - 2, boden - 3, M[2], 5, 1); p(x0 - 3, boden, M[0], 7, 1);
  // hintere Ketten (dunkler, hinter der Stange), dann vordere Ketten: hängen vom Ring zum Kragen
  const kette = (xr, xk, y0, y1, hell, dunkel, wackel) => {
    for (let y = y0; y <= y1; y++) {
      const t = (y - y0) / (y1 - y0), x = xr + (xk - xr) * Math.pow(t, 2.2) + wackel * Math.sin(t * Math.PI);
      p(x, y, (y + Math.round(xr)) % 2 ? hell : dunkel);
    }
  };
  for (let i = -11; i <= 11; i += 2.75) kette(x0 + i, x0 + i * 0.4, oben + 5, K.y + 5, M[2], M[1], -wx * 0.6);
  // Kragen, an dem die Ketten unten hängen
  p(x0 - 6, K.y + 5, M[1], 13, 2); p(x0 - 6, K.y + 5, M[3], 13, 1);
  for (let i = -12; i <= 12; i += 2.4) kette(x0 + i, x0 + i * 0.5, oben + 4, K.y + 6, M[5], M[3], wx * (Math.round(i) % 2 ? 1 : -1));
  // Ring oben: Unterseite dunkel, Band gelb mit Licht und Schatten, abgerundete Enden
  p(x0 - 12, oben + 4, M[0], 25, 1);
  p(x0 - 13, oben, G[3], 27, 1); p(x0 - 14, oben + 1, G[2], 29, 2); p(x0 - 13, oben + 3, G[1], 27, 1);
  p(x0 - 14, oben + 1, G[1], 1, 2); p(x0 + 14, oben + 1, G[0], 1, 2);
  p(x0 - 10, oben + 1, G[3], 4, 1); // Glanz
  if (winter) { p(x0 - 12, oben - 1, KORB.schnee, 25, 1); p(x0 - 7, oben - 2, KORB.schnee, 6, 1); p(x0 + 4, oben - 2, KORB.schnee, 4, 1); }
  // Korb: Rand, Gitterstäbe vor dunklem Inneren, gelbes Band, Boden nach unten schmaler
  const ky = K.y + 9;
  p(x0 - 15, ky, M[4], 31, 1); p(x0 - 15, ky + 1, M[2], 31, 1);
  for (let y = ky + 2; y < ky + 8; y++) {
    const w = 14 - Math.floor((y - ky - 2) / 2);
    p(x0 - w, y, M[0], 2 * w + 1, 1);
    for (let x = -w; x <= w; x += 3) p(x0 + x, y, x < -w / 3 ? M[3] : x > w / 3 ? M[2] : M[4]);
  }
  p(x0 - 13, ky + 4, G[2], 27, 2); p(x0 - 13, ky + 4, G[3], 10, 1); p(x0 - 13, ky + 5, G[1], 27, 1);
  p(x0 - 11, ky + 8, M[1], 23, 1); p(x0 - 9, ky + 9, M[0], 19, 1);
  if (winter) p(x0 - 14, ky - 1, KORB.schnee, 29, 1);
};

// Gleiche Maße wie oben (Spielpixel), aber Kanten, Glieder, Stäbe und Lichter in echten Pixeln (q = 1 / a)
function puttKorbFein(c, K, wx, winter, a) {
  const M = KORB.metall, G = KORB.gelb, q = 1 / a;
  const p = (x, y, f, w = q, h = q) => { c.fillStyle = f; c.fillRect(Math.round(x * a) / a, Math.round(y * a) / a, w, h); };
  const x0 = K.x, oben = K.y - 13, boden = K.y + 40;
  // Schatten am Boden: flache Ellipse, gedithert
  for (let j = 0; j < 3 * a; j++) for (let i = -13 * a + j * 3; i <= 13 * a - j * 3; i++) if (((i + j) & 1) === 0 || j < a) p(x0 + 2 + i * q, boden + 1 + q - j * q, "rgba(0,20,0,.4)");
  // Stange: 3 Spielpixel breit, je echter Spalte eine Stufe – Licht links der Mitte, Schatten rechts
  const STANGE = [M[2], M[4], M[5], M[3], M[2], M[1]];
  for (let i = 0; i < 3 * a; i++) p(x0 - 1 + i * q, oben + 1, STANGE[Math.min(5, Math.floor(i * 6 / (3 * a)))], q, boden - oben - 1);
  // Bodenhülse mit Kante, Fuß
  p(x0 - 2, boden - 3, M[1], 5, 3); p(x0 - 2, boden - 3, M[4], 5, q); p(x0 - 2, boden - 3 + q, M[2], 5, q);
  p(x0 - 2, boden - 3, M[3], q, 3); p(x0 + 3 - q, boden - 3, M[0], q, 3);
  p(x0 - 3, boden, M[0], 7, 1); p(x0 - 3, boden, M[1], 7, q);
  // Ketten: Glieder aus je 2 echten Pixeln, abwechselnd hell/dunkel; hinten dunkler und dichter
  const kette = (xr, xk, y0, y1, hell, dunkel, wackel) => {
    for (let Y = Math.round(y0 * a); Y <= Math.round(y1 * a); Y++) {
      const t = (Y * q - y0) / (y1 - y0), x = xr + (xk - xr) * Math.pow(t, 2.2) + wackel * Math.sin(t * Math.PI);
      p(x, Y * q, (Y + Math.round(xr * a)) % 4 < 2 ? hell : dunkel);
    }
  };
  for (let i = -11; i <= 11.01; i += 1.84) kette(x0 + i, x0 + i * 0.4, oben + 5, K.y + 5, M[2], M[0], -wx * 0.6);
  // Kragen, an dem die Ketten unten hängen
  p(x0 - 6, K.y + 5, M[1], 13, 2); p(x0 - 6, K.y + 5, M[4], 13, q); p(x0 - 6, K.y + 5 + q, M[3], 13, q); p(x0 + 7 - q, K.y + 5, M[0], q, 2);
  for (let i = -12; i <= 12.01; i += 1.6) kette(x0 + i, x0 + i * 0.5, oben + 4, K.y + 6, Math.abs(i) < 6 ? M[5] : M[4], M[2], wx * (Math.round(i) % 2 ? 1 : -1));
  // Ring oben: Band mit Verlauf (Licht oben), abgerundete Enden, Glanz, dunkle Unterseite
  p(x0 - 12, oben + 4, M[0], 25, 1); p(x0 - 12, oben + 4, M[1], 25, q);
  for (let Y = 0; Y < 4 * a; Y++) {
    const t = Y / (4 * a), rund = Y === 0 || Y === 4 * a - 1 ? 1 : 0, l = x0 - 14 + rund, w = 29 - 2 * rund;
    const f = t < 0.15 ? G[3] : t < 0.6 ? G[2] : t < 0.85 ? G[1] : G[0];
    p(l, oben + Y * q, f, w, q);
    p(l, oben + Y * q, t < 0.6 ? G[2] : G[1]); p(l + w - q, oben + Y * q, G[0]); // Enden: links Licht, rechts Schatten
  }
  p(x0 - 11, oben + q, "#fff4c0", 5, q); p(x0 - 10, oben + 2 * q, G[3], 3, q); p(x0 + 6, oben + q, G[3], 2, q); // Glanz
  if (winter) { p(x0 - 12, oben - 1, KORB.schnee, 25, 1); p(x0 - 7, oben - 2, KORB.schnee, 6, 1); p(x0 + 4, oben - 2, KORB.schnee, 4, 1); p(x0 - 12, oben - q, "#c8d4e6", 25, q); }
  // Korb: Rand, Gitterstäbe vor dunklem Inneren, gelbes Band, Boden nach unten schmaler
  const ky = K.y + 9;
  [M[5], M[4], M[3], M[2]].forEach((f, i) => p(x0 - 15, ky + i * 2 / 4, f, 31, 2 / 4)); // Rand: 2 Spielpixel, vier Stufen
  for (let Y = 0; Y < 6 * a; Y++) {
    const y = ky + 2 + Y * q, w = 14 - Y * q / 2;
    p(x0 - w, y, M[0], 2 * w + q, q);
    for (let X = -Math.floor(w * a); X <= Math.floor(w * a); X++) if ((X + 300) % 3 === 0) {
      const x = X * q;
      p(x0 + x, y, x < -w / 3 ? M[3] : x > w / 3 ? M[2] : M[4]);
    }
  }
  // gelbes Band mit Licht und Schatten
  p(x0 - 13, ky + 4, G[2], 27, 2); p(x0 - 13, ky + 4, G[3], 27, q); p(x0 - 13, ky + 4, "#fff4c0", 8, q);
  p(x0 - 13, ky + 6 - q, G[1], 27, q); p(x0 + 14 - q, ky + 4, G[0], q, 2);
  // Boden des Korbs
  p(x0 - 11, ky + 8, M[1], 23, 1); p(x0 - 11, ky + 8, M[2], 23, q); p(x0 - 9, ky + 9, M[0], 19, 1);
  if (winter) { p(x0 - 14, ky - 1, KORB.schnee, 29, 1); p(x0 - 14, ky - 1 + q, "#c8d4e6", 29, q); }
}

// Draufsicht (leicht schräg) auf der Bahn; wächst mit der Figur (figurMasstab in index.html),
// damit das Verhältnis stimmt: Korb ≈ 1,35 m, Mensch ≈ 1,8 m → Korb ≈ 0,75 × Figurhöhe.
// x, y = Fuß am Boden (Bildschirm), dx = Wackeln, f = Figurmaßstab (1 oder 2)
// auf = echte Pixel je Spielpixel (hohe Auflösung): der Korb bleibt gleich groß, wird aber feiner
const KORB_ZU_FIGUR = 0.75 * 8 / 11; // Figur 8 Spielpixel hoch, Korb 11 g hoch
window.zeichneKorbObenDetail = function (c, x, y, dx, f, winter, auf = 1) {
  const M = KORB.metall, G = KORB.gelb, p = (px, py, f, w, h) => punktSetzen(c, px, py, f, w, h);
  const g = KORB_ZU_FIGUR * f * auf;
  const rx = Math.round(3.5 * g), ry = Math.max(1, Math.round(1.2 * g)), ringY = y - Math.round(11 * g), korbY = y - Math.round(5 * g);
  const ellipse = (cx, cy, a, b, farbe, nurVorne = 0) => {
    for (let w = 0; w < Math.PI * 2; w += 0.5 / Math.max(a, 1)) {
      const s = Math.sin(w); if (nurVorne > 0 && s < 0) continue; if (nurVorne < 0 && s > 0) continue;
      p(cx + Math.cos(w) * a, cy + s * b, farbe);
    }
  };
  // Schatten nach rechts unten
  for (let j = -ry; j <= ry; j++) for (let i = -rx; i <= rx; i++) if ((i * i) / (rx * rx) + (j * j) / (ry * ry) <= 1 && ((i + j) & 1) === 0) p(x + i + Math.round(3 * g), y + j + 1, "rgba(0,20,0,.45)");
  // Stange
  for (let yy = ringY; yy <= y; yy++) { p(x, yy, M[3]); if (g > 1) p(x + 1, yy, M[1]); }
  // Korb unten: dunkles Inneres, Rand, gelbe Vorderkante
  for (let j = -ry; j <= ry; j++) for (let i = -rx; i <= rx; i++) if ((i * i) / (rx * rx) + (j * j) / (ry * ry) <= 1) p(x + i, korbY + j, M[1]);
  ellipse(x, korbY, rx, ry, M[3], -1);
  ellipse(x, korbY, rx, ry, G[2], 1);
  p(x - rx, korbY, M[4]);
  // Ketten: vom Ring zur Mitte, Glieder abwechselnd hell/dunkel, vorne heller
  for (let i = -rx + 1; i <= rx - 1; i += g >= 2 ? 1 : 2) {
    const vorne = i % 2 === 0;
    for (let yy = ringY + ry; yy < korbY - ry + 1; yy++) {
      const t = (yy - ringY) / (korbY - ringY);
      p(x + i * (1 - t * 0.6) + dx * (vorne ? 1 : -1), yy, (yy + i) % 2 ? (vorne ? M[5] : M[2]) : (vorne ? M[3] : M[1]));
    }
  }
  // Ring oben: hinten dunkles Gelb, innen dunkel, vorne hell mit Glanz
  for (let j = -ry + 1; j < ry; j++) for (let i = -rx + 1; i < rx; i++) if ((i * i) / ((rx - 1) * (rx - 1) || 1) + (j * j) / (ry * ry) < 1) p(x + i + dx, ringY + j, M[0]);
  ellipse(x + dx, ringY, rx, ry, G[1], -1);
  ellipse(x + dx, ringY, rx, ry, G[2], 1);
  p(x + dx - rx + 1, ringY + ry - (ry > 1 ? 1 : 0), G[3], Math.max(1, Math.round(g)), 1);
  p(x + dx, ringY, M[4]);
  if (winter) ellipse(x + dx, ringY - 1, rx - 1, Math.max(1, ry - 1), KORB.schnee, -1);
};

// Farben [hell, dunkel] der Blätter, die beim Treffer an der Stelle (Meter) aus der Krone fliegen:
// die des getroffenen Baums; kahle Bäume im Winter stäuben Schnee, Felsen splittern. null = kein Bahnbild
window.blattFarbenAn = function (bild, x, y) {
  const liste = bild && bild.baumFarben;
  if (!liste || !liste.length) return null;
  let best = null, bd = Infinity;
  for (const b of liste) { const d = Math.hypot(b.x - x, b.y - y) - b.r; if (d < bd) { bd = d; best = b; } }
  if (best.kahl) return ["#f4f8ff", "#c4d0e2"];
  if (best.art) return [best.farben[3], best.farben[1]]; // Gegenstände (Fels, Kaktus, Arten neuer Themen)
  const f = best.farben;
  return best.kiefer ? [f[3], f[1]] : f.bluete ? [f[4], f[2]] : [f[3], f[1]];
};

// ============================================================
//  SPIELERFIGUR IN HOHER AUFLÖSUNG
// ============================================================
// Die Figuren selbst stehen in figuren.js (Sprites mit Posen); hier nur die Farbhilfe.
const hellerDunkler = (h, f) => { const p = rgb(h).map(v => Math.max(0, Math.min(255, Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f))))); return "rgb(" + p.join(",") + ")"; };
