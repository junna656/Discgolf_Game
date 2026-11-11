// 8-Bit-Porträts der Spieler (32 × 32 Pixel), gezeichnet aus "aussehen" in taschen.js
(function (g) {
  "use strict";

  function zeichnePortrait(c, sp, ohneHintergrund = false) {
    const a = sp.aussehen || {};
    const px = (f, x, y, w = 1, h = 1) => { c.fillStyle = f; c.fillRect(x, y, w, h); };
    const zeile = (f, y, x0, x1) => px(f, x0, y, x1 - x0 + 1, 1);
    const haut = a.haut || "#f0c8a0", hautS = a.hautSchatten || "#d49c7c";
    const haare = a.haare || "#5a3a24", jacke = a.jacke || sp.farbe, jacke2 = a.jacke2 || "#202428";

    // Hintergrund in der Spielerfarbe, mit Raster
    if (!ohneHintergrund) {
      px("#141820", 0, 0, 32, 32);
      for (let y = 0; y < 32; y++) for (let x = (y % 2); x < 32; x += 2) px(sp.farbe + "40", x, y);
    }

    // Oberkörper
    const schultern = [[24, 8, 23], [25, 6, 25], [26, 5, 26]];
    for (const [y, x0, x1] of schultern) zeile(jacke, y, x0, x1);
    for (let y = 27; y < 32; y++) zeile(jacke, y, 4, 27);
    if (a.weste) {
      // Shirt unter der Steppweste, Ärmel in Shirtfarbe
      for (let y = 24; y < 32; y++) zeile(jacke2, y, 12, 19);
      for (let y = 26; y < 32; y++) { zeile(jacke2, y, 4, 6); zeile(jacke2, y, 25, 27); }
      for (let y = 26; y < 32; y += 2) { zeile("#5c6574", y, 8, 10); zeile("#5c6574", y, 21, 23); }
      for (let y = 24; y < 32; y++) { px("#d8dce4", 11, y); px("#d8dce4", 20, y); }
    } else {
      // Kragen / Shirt am Hals
      zeile(jacke2, 24, 13, 18); zeile(jacke2, 25, 14, 17); px(jacke2, 15, 26, 2, 1);
      for (let y = 26; y < 32; y++) px(a.reissverschluss || jacke2, 15, y);
    }
    if (a.fleece) for (let y = 25; y < 32; y++) for (let x = 5 + (y % 3); x < 27; x += 3) px("#2e2e34", x, y);
    if (a.riemen) for (let i = 0; i < 7; i++) px(a.riemen, 7 + i, 30 - i, 2, 1);
    if (a.kordel) { px(a.kordel, 13, 26, 1, 3); px(a.kordel, 18, 26, 1, 3); }

    // Hals
    px(hautS, 13, 21, 6, 3);

    // Gesicht
    const gesicht = [[8, 11, 20], [9, 10, 21], [10, 10, 21], [11, 10, 21], [12, 10, 21], [13, 10, 21], [14, 10, 21], [15, 10, 21],
      [16, 10, 21], [17, 10, 21], [18, 11, 20], [19, 11, 20], [20, 12, 19], [21, 13, 18]];
    for (const [y, x0, x1] of gesicht) zeile(haut, y, x0, x1);
    px(haut, 9, 13, 1, 3); px(haut, 22, 13, 1, 3); px(hautS, 9, 14); px(hautS, 22, 14); // Ohren

    // Augen, Brauen, Nase
    px("#ffffff", 12, 14, 2, 1); px("#ffffff", 17, 14, 2, 1);
    px(a.augen || "#3a2a20", 13, 14); px(a.augen || "#3a2a20", 18, 14);
    zeile(haare, 12, 12, 14); zeile(haare, 12, 17, 19);
    px(hautS, 15, 15, 1, 2); px(hautS, 16, 17);

    // Bart
    const bf = a.bartfarbe || haare;
    if (a.bart === "vollbart") {
      for (let y = 16; y <= 21; y++) for (let x = 10; x <= 21; x++) {
        const imGesicht = gesicht.some(([gy, x0, x1]) => gy === y && x >= x0 && x <= x1);
        if (imGesicht && !(y === 16 && x > 12 && x < 19)) px(bf, x, y);
      }
      px(bf, 10, 15); px(bf, 21, 15);
    } else if (a.bart === "kurz") {
      // kurz getrimmt: dünner Rand am Kiefer, Kinn und schmaler Oberlippenbart
      for (const [gy, x0, x1] of gesicht) if (gy >= 15) { px(bf, x0, gy); px(bf, x1, gy); }
      zeile(bf, 21, 13, 18); zeile(bf, 20, 12, 13); zeile(bf, 20, 18, 19);
      zeile(bf, 18, 13, 18);
    } else if (a.bart === "schnurrbart") {
      zeile(bf, 18, 12, 19); px(bf, 11, 19); px(bf, 20, 19);
    } else if (a.bart === "stoppeln") {
      for (let y = 17; y <= 21; y++) for (let x = 11 + (y % 2); x <= 20; x += 2)
        if (gesicht.some(([gy, x0, x1]) => gy === y && x >= x0 && x <= x1)) px(bf + "b0", x, y);
    }
    // Lachen
    zeile("#5a1e1e", 19, 13, 18); zeile("#ffffff", 19, 14, 17); px("#5a1e1e", 14, 20, 4, 1);

    // Brille
    if (a.brille) {
      // schmale Fassung mit runden Ecken (Ecken frei), Steg und Bügel
      const b = a.brille;
      for (const x0 of [11, 16]) {
        px(b, x0 + 1, 13, 2, 1); px(b, x0 + 1, 15, 2, 1); // oben, unten
        px(b, x0, 14); px(b, x0 + 3, 14);                  // Seiten
      }
      px(b, 15, 14); px(b, 10, 14); px(b, 21, 14);
    }

    // Haare und Kopfbedeckung
    const k = a.kopf || {};
    if (k.typ === "cap") {
      for (let y = 3; y <= 9; y++) zeile(k.farbe, y, y < 5 ? 10 : 9, y < 5 ? 21 : 22);
      zeile(k.farbe, 10, 7, 24); zeile("#000000", 11, 8, 23); // Schirm mit Schatten
      zeile(haare, 11, 9, 10); zeile(haare, 11, 21, 22); px(haare, 9, 12, 1, 2); px(haare, 22, 12, 1, 2);
      // runder Aufnäher
      zeile(k.abzeichen, 4, 15, 16); zeile(k.abzeichen, 5, 14, 17); zeile(k.abzeichen, 6, 14, 17); zeile(k.abzeichen, 7, 15, 16);
      px(k.farbe, 15, 5, 2, 2);
    } else if (k.typ === "stirnband") {
      // wuschelige Haare oben, Band über der Stirn
      for (let y = 3; y <= 8; y++) zeile(haare, y, 9, 22);
      for (const x of [8, 10, 13, 16, 19, 22, 23]) px(haare, x, 2 + (x % 3), 1, 2);
      zeile(k.farbe, 8, 9, 22); zeile(k.farbe, 9, 9, 22); zeile(k.farbe, 10, 9, 22);
      for (let x = 10; x < 22; x += 3) px("#4a6676", x, 9);
      px(haare, 9, 11, 1, 3); px(haare, 22, 11, 1, 3);
    } else {
      // kurze Haare (etwas zerzaust)
      zeile(haare, 4, 12, 19); zeile(haare, 5, 10, 21); zeile(haare, 6, 9, 22); zeile(haare, 7, 9, 22);
      zeile(haare, 8, 9, 22); zeile(haare, 9, 9, 11); zeile(haare, 9, 20, 22); px(haare, 9, 10, 1, 3); px(haare, 22, 10, 1, 3);
      if (a.frisur === "zerzaust") { px(haare, 13, 3); px(haare, 17, 3, 2, 1); px(haare, 15, 9, 2, 1); }
      if (a.frisur === "geheimratsecken") { px(haut, 11, 8); px(haut, 20, 8); }
    }
  }

  // ---------- Feine Fassung (64 × 64, 16-Bit-Optik) ----------
  // Gleiche Gestaltung wie oben, doppelt so fein: Licht oben links und Schatten unten rechts an allen
  // Flächenkanten, dunkler Umriss, Haarsträhnen, Bartstruktur, Glanzlicht in den Augen, Wangen,
  // Falten in der Jacke und ein Hintergrund mit Verlauf und Lichtschein in der Spielerfarbe.
  const rgbVon = f => {
    if (f[0] === "#") { const h = f.length === 4 ? f.replace(/#(.)(.)(.)/, "#$1$1$2$2$3$3") : f; return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); }
    const m = f.match(/\d+/g); return m ? m.slice(0, 3).map(Number) : [0, 0, 0];
  };
  const stufe = (rgb, t) => rgb.map(v => Math.max(0, Math.min(255, Math.round(t > 0 ? v + (255 - v) * t : v * (1 + t)))));
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5], bay = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;

  function zeichnePortraitFein(c, sp) {
    const a = sp.aussehen || {}, N = 64;
    // grobe Fassung ohne Hintergrund als Vorlage
    const v = document.createElement("canvas"); v.width = v.height = 32;
    zeichnePortrait(v.getContext("2d"), sp, true);
    const q = v.getContext("2d").getImageData(0, 0, 32, 32).data;
    const farbe = (x, y) => { if (x < 0 || y < 0 || x >= N || y >= N) return null; const i = ((y >> 1) * 32 + (x >> 1)) * 4; return q[i + 3] > 20 ? [q[i], q[i + 1], q[i + 2]] : null; };
    const gleich = (p, r) => p && r && p[0] === r[0] && p[1] === r[1] && p[2] === r[2];
    const ist = (p, f) => f && gleich(p, rgbVon(f));
    const haut = a.haut || "#f0c8a0", haare = a.haare || "#5a3a24", bart = a.bartfarbe || haare, jacke = a.jacke || sp.farbe;
    // kleine Einzelheiten (Augen, Mund, Brille, Aufnäher) bekommen keine Kantenschattierung
    const ohneKante = ["#ffffff", a.augen || "#3a2a20", "#5a1e1e", a.brille, (a.kopf || {}).abzeichen, "#000000"].filter(Boolean).map(rgbVon);
    const bild = c.createImageData(N, N), d = bild.data;
    const setze = (x, y, rgb) => { const i = (y * N + x) * 4; d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255; };

    // Hintergrund: Verlauf in der Spielerfarbe (oben heller), gedithert, Lichtschein hinter dem Kopf
    const sf = rgbVon(sp.farbe), dunkel = [20, 24, 32];
    const RAMPE = [0.34, 0.27, 0.2, 0.14, 0.09].map(t => dunkel.map((v, i) => Math.round(v + (sf[i] - v) * t)));
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const schein = Math.max(0, 1 - Math.hypot(x - 32, y - 26) / 30) * 0.6;
      const t = Math.min(1, Math.max(0, y / N * 0.9 - schein + 0.25)) * (RAMPE.length - 1);
      let i = Math.floor(t); if (t - i > bay(x, y)) i++;
      setze(x, y, RAMPE[Math.min(RAMPE.length - 1, i)]);
    }

    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const p = farbe(x, y);
      if (!p) {
        // Umriss: dunkle Stufe der Nachbarfarbe
        const n = farbe(x + 1, y) || farbe(x - 1, y) || farbe(x, y + 1) || farbe(x, y - 1);
        if (n) setze(x, y, stufe(n, -0.7));
        continue;
      }
      let f = p;
      if (!ohneKante.some(o => gleich(o, p))) {
        const oben = !gleich(farbe(x, y - 1), p), links = !gleich(farbe(x - 1, y), p);
        const unten = !gleich(farbe(x, y + 1), p), rechts = !gleich(farbe(x + 1, y), p);
        if (oben || links) f = stufe(p, oben && links ? 0.3 : 0.18);
        else if (unten || rechts) f = stufe(p, unten && rechts ? -0.3 : -0.2);
        // Haare: Strähnen schräg, oben ein Glanz
        if (ist(p, haare) && !oben && !unten && !links && !rechts && (x - y * 2 + 64) % 7 === 0) f = stufe(p, -0.2);
        // Bart: unruhige Struktur
        if (ist(p, bart) && !ist(p, haare) || (ist(p, bart) && y > 30)) { if ((x * 3 + y * 5) % 7 === 0) f = stufe(p, -0.25); else if ((x + y * 3) % 9 === 0) f = stufe(p, 0.15); }
        // Haut: Licht von links oben, Schatten zur rechten Seite des Gesichts
        if (ist(p, haut)) { if (x > 39 && bay(x, y) < (x - 39) / 8) f = stufe(p, -0.12); if (x < 25 && y < 34 && bay(x, y) < 0.3) f = stufe(p, 0.1); }
        // Jacke: zwei Falten und Licht auf der linken Schulter
        if (ist(p, jacke) && y > 50) { if ((x === 20 || x === 43) && y > 54) f = stufe(p, -0.2); if (x < 18 && y < 56 && bay(x, y) < 0.4) f = stufe(p, 0.14); }
      }
      setze(x, y, f);
    }
    // Wangen (nur auf freier Haut) und Glanzlicht in den Augen
    for (const [cx, cy] of [[23, 34], [40, 34]]) for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) {
      const x = cx + i, y = cy + j;
      if (ist(farbe(x, y), haut) && bay(x, y) < 0.45) setze(x, y, stufe(rgbVon(haut), -0.08).map((v, k) => k === 0 ? Math.min(255, v + 18) : v));
    }
    for (const x of [27, 37]) if (gleich(farbe(x, 28), rgbVon(a.augen || "#3a2a20"))) setze(x, 28, [255, 255, 255]);
    c.putImageData(bild, 0, 0);
  }

  g.zeichnePortrait = zeichnePortrait;
  g.zeichnePortraitFein = zeichnePortraitFein;
})(window);
