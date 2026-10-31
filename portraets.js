// 8-Bit-Porträts der Spieler (32 × 32 Pixel), gezeichnet aus "aussehen" in taschen.js
(function (g) {
  "use strict";

  function zeichnePortrait(c, sp) {
    const a = sp.aussehen || {};
    const px = (f, x, y, w = 1, h = 1) => { c.fillStyle = f; c.fillRect(x, y, w, h); };
    const zeile = (f, y, x0, x1) => px(f, x0, y, x1 - x0 + 1, 1);
    const haut = a.haut || "#f0c8a0", hautS = a.hautSchatten || "#d49c7c";
    const haare = a.haare || "#5a3a24", jacke = a.jacke || sp.farbe, jacke2 = a.jacke2 || "#202428";

    // Hintergrund in der Spielerfarbe, mit Raster
    px("#141820", 0, 0, 32, 32);
    for (let y = 0; y < 32; y++) for (let x = (y % 2); x < 32; x += 2) px(sp.farbe + "40", x, y);

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
      const b = a.brille;
      px(b, 11, 13, 4, 1); px(b, 11, 15, 4, 1); px(b, 11, 13, 1, 3); px(b, 14, 13, 1, 3);
      px(b, 16, 13, 4, 1); px(b, 16, 15, 4, 1); px(b, 16, 13, 1, 3); px(b, 19, 13, 1, 3);
      px(b, 15, 14); px(b, 10, 13); px(b, 21, 13);
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

  g.zeichnePortrait = zeichnePortrait;
})(window);
