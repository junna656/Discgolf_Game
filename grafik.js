// ============================================================
//  DETAILGRAFIK MIT JAHRESZEITEN
// ============================================================
//  Detailliertere Pixelgrafik für das Bahnbild. Läuft im Kontext von index.html
//  und nutzt dessen Hilfsfunktionen (maske, polygonPfad, zufall, pixelKreis,
//  zeichneLinien, zeichneBauten, zeichneMando …). Die klassische Grafik
//  (zeichneHintergrund in index.html) bleibt für die GBA-Version unverändert.
//  Vorher/Nachher-Bilder: node werkzeuge/grafik_vorschau.mjs [bahn] [ordner]
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
//     eigene Paletten für Boden und Bäume, Blüten, Herbstlaub, Schnee und kahle Äste
// ============================================================
"use strict";

window.zeichneHintergrundDetail = function (z, optionen = {}) {
  const opt = Object.assign({ deko: true, kiefern: true, jahreszeit: "sommer" }, optionen);
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
  const JZ = JAHRESZEITEN[opt.jahreszeit] || JAHRESZEITEN.sommer, winter = !!JZ.schnee;
  const GRAS = R(JZ.gras), AUS = R(JZ.aus), FAIR = R(JZ.fair), WEG = R(JZ.weg);
  const HALME = R(["#4a3e2a", "#7a6a46", "#a8945e"]);
  const ERDE = R(["#5a4228", "#735634", "#8c6c42"]);
  const DECK = R(["#5e3c1e", "#7a5530", "#9a6e3a", "#b88a4c", "#cfa262", "#e0bc7c"]);

  // Bäume vorbereiten: Typ (Laub/Kiefer) aus der Lage, damit er immer gleich bleibt
  const baeume = [...bahn.baeume].sort((a, b) => a.r - b.r).map(b => {
    const kiefer = opt.kiefern && hash(Math.round(b.x * 10), Math.round(b.y * 10), 5) < 0.3;
    const h = hash(Math.round(b.x * 10), Math.round(b.y * 10), 6);
    return { ...b, kiefer, kahl: winter && !kiefer, farben: kiefer ? JZ.kiefer : JZ.laubbaum(h) };
  });
  // Schatten fallen nach rechts unten (Licht von links oben)
  const imSchatten = (x, y) => {
    for (const b of baeume) {
      if (b.kahl) continue;
      const dx = x - (b.x + b.r * 0.35), dy = (y - (b.y + b.r * 0.45)) * 1.15;
      if (dx * dx + dy * dy < b.r * b.r * 1.02) return true;
    }
    return false;
  };
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

  for (let py = 0; py < BH; py++) for (let px = 0; px < BW; px++) {
    const x = (px + 0.5) / S, y = (py + 0.5) / S;
    const n = fbm(x / 7, y / 7, 1), fein = hash(px, py, 9);
    const zi = obTests.findIndex(t => t(px, py, x, y)), zone = zi >= 0 ? bahn.ob[zi] : null;
    const wirft = (qx, qy) => (l && aufBowlingbahn({ x: qx, y: qy }, bahn)) || (Math.abs(qx - ab.x) < 1.6 && Math.abs(qy - ab.y) < 1.1);
    const schatten = imSchatten(x, y) || wirft(x - 0.3, y - 0.4) ? 2 : 0;
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
      } else if (imFair) {
        // Mähstreifen in Wurfrichtung (je 2,2 m), weich gedithert
        const band = ((Math.floor((-x * uy + y * ux) / 2.2) % 2) + 2) % 2;
        let t = 0.35 + band * 0.25 + (n - 0.5) * 0.45 - schatten * 0.2;
        if (zone) t -= 0.35;
        f = FAIR[stufe(FAIR.length, t, px, py)]; a = 2;
      } else if (zone) {
        f = AUS[stufe(AUS.length, 0.3 + (n - 0.5) * 0.9 + (fein - 0.5) * 0.25 - schatten * 0.18, px, py)]; a = 1;
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
    const flaeche = (bahn.welt.breite * bahn.welt.hoehe);
    // Grasbüschel
    for (let i = 0; i < flaeche * JZ.bueschel; i++) {
      const px = Math.floor(rnd() * BW), py = Math.floor(rnd() * BH), a = artBei(px, py);
      if (a !== 0 && a !== 1) continue;
      // im Winter: trockene Halme, die aus dem Schnee ragen
      const P = winter ? HALME : a ? AUS : GRAS, hell = P[P.length - 1], mittel = P[P.length - 2], dunkel = P[0];
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
    for (let i = 0; i < 6; i++) {
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
  for (const o of bahn.ob) {
    const pk = o.linie || o.insel || o.punkte || [[o.x, o.y], [o.x + o.w, o.y], [o.x + o.w, o.y + o.h], [o.x, o.y + o.h]];
    let weg = 0; // zurückgelegte Meter entlang der Grenze, für gleichmäßige Pfostenabstände
    pk.forEach((a, i) => {
      const b = pk[(i + 1) % pk.length];
      if (o.linie && i === pk.length - 1) return;
      if (o.art === "natur") return;
      if ((am(a[0], bahn.welt.breite) && a[0] === b[0]) || (am(a[1], bahn.welt.hoehe) && a[1] === b[1])) return;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(len * S);
      for (let k = 0; k <= n; k++) {
        const x = a[0] + (b[0] - a[0]) * k / n, y = a[1] + (b[1] - a[1]) * k / n, px = Math.round(x * S), py = Math.round(y * S), m = weg + len * k / n;
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
  c.fillStyle = "rgba(255,255,255,.4)";
  for (let w = 0; w < Math.PI * 2; w += 0.12 / z) c.fillRect(Math.round((bahn.korb.x + Math.cos(w) * 10) * S), Math.round((bahn.korb.y + Math.sin(w) * 10) * S), 1, 1);

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
  // Laubbaum: Krone aus mehreren Blättergruppen, jede mit Kontur, Grund, Mitte, Licht
  for (const b of baeume) {
    const r = b.r * S, cx = b.x * S, cy = b.y * S, rr = zufall(Math.round(b.x * 100 + b.y * 7)), LB = b.farben, KI = b.farben;
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
      c.fillStyle = "rgba(60,80,120,.35)";
      for (const q of aeste) c.fillRect(Math.round(q.x + r * 0.3), Math.round(q.y + r * 0.4), dick(q), dick(q));
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
  zeichneMando(c, z);
  return hg;
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
      ["#2a3a14", "#4a5a1e", "#6a7428", "#8a8a34", "#aaa448"],
    ][Math.floor(h * 4)],
    kiefer: ["#0c2e22", "#163f2e", "#1f5438", "#2c6a44", "#4a8a52"],
    blumen: { dichte: 0.008, farben: ["#f6f4ea"] },
    klee: false, bueschel: 0.7,
    laub: { dichte: 0.6, farben: ["#c8782a", "#d9a030", "#a4522a", "#8a6a2a", "#b84028"] },
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
    klee: false, bueschel: 0.35, laub: null,
  },
};

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
