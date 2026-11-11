// ============================================================
//  SPIELERFIGUREN ALS SPRITES (hohe Auflösung)
// ============================================================
//  Läuft im Kontext von index.html (nutzt hellerDunkler aus grafik.js, PAL).
//  Zwei Größen: "klein" (6 × 16 echte Pixel, Übersicht und mittel) und "gross" (12 × 32, nahe Zoomstufe).
//  - Kopf: pixelgenaue Vorlagen je Größe; Frisur, Bart, Brille, Cap/Stirnband als Ebenen darüber
//  - Körper, Arme und Beine aus Gelenkpunkten (Posen), damit dieselbe Pose in beiden Größen gilt
//  - automatische Kontur ("selective outline": dunklere Stufe der Nachbarfarbe), Licht von links oben
//  - Posen: stehen (2 Bilder, atmet in groß), ausholen (Rückhand/Vorhand, 2 Stufen nach Kraft), wurf
//  - jede Figur schaut zum Ziel: nach links gespiegelt, wenn das Ziel links liegt
//  Fertige Bilder werden gemerkt (je Spieler, Pose, Bild, Größe, Richtung und Scheibenfarbe).
// ============================================================
"use strict";

// ---------- Kopf-Vorlagen ----------
// Zeichen: a Haare, B Haare hell, A Haare dunkel, h Haut, L Haut hell, H Haut dunkel, w Augenweiß, e Auge,
// m Mund, b Bart, c Bart dunkel, g Brille, u Kopfbedeckung, y Kopfbedeckung hell, U Kopfbedeckung dunkel,
// i Abzeichen, . nichts (in Ebenen: unverändert)
// Jede Vorlage: { y: oberste Zeile (relativ zum Fuß), x: linke Spalte, z: Zeilen }
const KOPF = {
  klein: {
    basis: { x: 0, y: -16, z: [
      ".aaaa.",
      "aaaaaa",
      "ahhhha",
      "LweewH",
      "LhhhhH",
      "hhmmhH",
      ".hhhH.",
    ] },
    frisur: {
      geheimratsecken: { x: 0, y: -15, z: [".h..h.", "L....H"] },
      zerzaust: { x: -1, y: -17, z: [".a..a..", ".......a", "a......."] },
    },
    bart: {
      vollbart: { x: 0, y: -12, z: [".b..b.", "bbmmbc", ".bbbc."] },
      kurz: { x: 0, y: -12, z: ["b....c", "b.mm.c", ".bbbc."] },
      schnurrbart: { x: 0, y: -11, z: [".bbbc.", "..mm.."] },
      stoppeln: { x: 0, y: -11, z: ["c.mm.c", ".c.c.."] },
    },
    brille: { x: 0, y: -14, z: [".gggg.", "g....g"] },
    cap: { x: 0, y: -17, z: ["uyyuuu", "uuiuuU", "....uuuu"] },
    stirnband: { x: -1, y: -15, z: [".uuuuuu", "u......"] },
  },
  gross: {
    basis: { x: 0, y: -32, z: [
      "...aaaaaa...",
      ".aaBBaaaaaa.",
      "aaBaaaaaaaAA",
      "aaahhhhhhaAA",
      "aLhhhhhhhhhA",
      "aLhhhhhhhhHA",
      "LLwwehhewwHH",
      "LLhhhhhhhhHH",
      "LhhhhhhhhhhH",
      ".hhhhhHhhhH.",
      ".hhhmmmmhhH.",
      "..hhhhhhhH..",
      "...HhhhhH...",
      "....HhhH....",
    ] },
    frisur: {
      geheimratsecken: { x: 0, y: -30, z: ["..L......h..", ".Lh......hH."] },
      zerzaust: { x: -1, y: -35, z: ["...a....a..a..", "..aa..aaa.aa..", "aaaaaaaaaaaaaa", "a............a"] },
    },
    bart: {
      vollbart: { x: 0, y: -27, z: [
        "b..........c",
        "bb........cc",
        "bb........cc",
        "bbb......ccc",
        ".bbbmmmmbcc.",
        ".bbbbbbbbcc.",
        "..bbbbbbcc..",
        "...cbbbcc...",
      ] },
      kurz: { x: 0, y: -24, z: [
        "b..........c",
        "bb........cc",
        ".b..mmmm..c.",
        ".bbbbbbbbcc.",
        "..cbbbbbc...",
      ] },
      schnurrbart: { x: 0, y: -22, z: ["...bbbbbbc..", "...mmmmmm..."] },
      stoppeln: { x: 0, y: -23, z: [".c........c.", "..c.mmmm.c..", ".c.c.c.c.c..", "...c.c.c...."] },
    },
    brille: { x: 0, y: -27, z: [".gggggggggg.", "gg...gg...gg", ".gggg..gggg."] },
    cap: { x: 0, y: -35, z: [
      "...uuuuuu...",
      "..uyyuuuuu..",
      ".uyuuuiiuuU.",
      ".uuuuuiiuuUU",
      "uuuuuuuuuuUUUUUU",
    ] },
    stirnband: { x: -2, y: -30, z: ["..yyyyyyyyyyyy", "uuuuuuuuuuuuUU", "uu............"] },
  },
};

// ---------- Posen ----------
// Gelenkpunkte in Einheiten der kleinen Figur (Fuß bei y = 0, Körper x 0…6), Blick nach rechts.
// arm: [Schulter, Ellbogen, Hand], vorne: Arm vor dem Körper zeichnen; bein: [Hüfte, Fuß]
const POSEN = {
  stehen: {
    armL: [[-0.5, -8.5], [-0.5, -6.5], [-0.5, -4.5]], armR: [[6.5, -8.5], [6.5, -6.5], [6.5, -4.5]],
    beinL: [[1, -3], [1, -1]], beinR: [[5, -3], [5, -1]],
  },
  // Rückhand: Wurfarm quer vor der Brust nach hinten, Scheibe auf Hüfthöhe hinter dem Körper
  ausholenRH1: {
    armL: [[-0.5, -8.5], [-1, -6.5], [-1.5, -4.5]], armR: [[6.5, -8.5], [4.5, -6.5], [1.5, -6.5]], vorneR: true,
    beinL: [[1, -3], [0.5, -1]], beinR: [[5, -3], [5.5, -1]],
  },
  ausholenRH2: {
    armL: [[-0.5, -8.5], [0, -6.5], [1, -5]], armR: [[6.5, -8.5], [3, -7], [-2.5, -6.5]], vorneR: true,
    beinL: [[1, -3], [0, -1]], beinR: [[5, -3], [6, -1]],
  },
  // Vorhand: Wurfarm angewinkelt seitlich, Scheibe tief neben der Hüfte
  ausholenVH1: {
    armL: [[-0.5, -8.5], [-1, -6.5], [-1, -4.5]], armR: [[6.5, -8.5], [8, -7], [8, -5]],
    beinL: [[1, -3], [0.5, -1]], beinR: [[5, -3], [5.5, -1]],
  },
  ausholenVH2: {
    armL: [[-0.5, -8.5], [-2, -7], [-3, -6]], armR: [[6.5, -8.5], [8.5, -6.5], [9.5, -4]],
    beinL: [[1, -3], [0, -1]], beinR: [[5, -3], [6, -1]],
  },
  // nach dem Abwurf: Wurfarm zum Ziel gestreckt, Ausfallschritt
  wurf: {
    armL: [[-0.5, -8.5], [-2, -7.5], [-3.5, -6.5]], armR: [[6.5, -8.5], [9, -8.5], [11.5, -8]],
    beinL: [[1, -3], [-0.5, -1]], beinR: [[5, -3], [7, -1]], beugen: 1,
  },
};

// ---------- Bild bauen ----------
const figurSpeicher = new Map();
window.figurSprite = function (s, pose, bild, gross, links, scheibe) {
  const key = s.name + "|" + pose + "|" + bild + "|" + (gross ? 1 : 0) + "|" + (links ? 1 : 0) + "|" + (scheibe || "");
  let b = figurSpeicher.get(key);
  if (!b) {
    if (figurSpeicher.size > 400) figurSpeicher.clear();
    b = figurBauen(s, POSEN[pose] || POSEN.stehen, bild, gross, links, scheibe);
    figurSpeicher.set(key, b);
  }
  return b;
};

function figurBauen(s, P, bild, gross, links, scheibe) {
  const k = gross ? 2 : 1, a = s.aussehen || {}, kopf = a.kopf || {};
  const haut = a.haut || "#f0c8a0", haare = a.haare || "#5a3a24", jacke = a.jacke || s.farbe, jacke2 = a.jacke2 || "#2a2e3a";
  const hose = a.weste ? "#2a2e3a" : hellerDunkler(jacke2, -0.1), bart = a.bartfarbe || haare, kf = kopf.farbe || "#202020";
  const FARBE = {
    a: haare, B: hellerDunkler(haare, 0.22), A: hellerDunkler(haare, -0.3),
    h: haut, L: hellerDunkler(haut, 0.14), H: hellerDunkler(haut, -0.16),
    w: PAL.weiss, e: a.augen || PAL.schwarz, m: hellerDunkler(haut, -0.38),
    b: bart, c: hellerDunkler(bart, -0.28), g: a.brille || "#141414",
    u: kf, y: hellerDunkler(kf, 0.3), U: hellerDunkler(kf, -0.3), i: kopf.abzeichen || kf,
  };
  // Raster: Platz für ausgestreckte Arme und Scheibe; Ursprung (0,0) = Fuß links, Mitte bei 3k
  const RX = 8 * k, RY = 36 * k / 2 + 2 * k, B = 6 * k + 2 * RX, Hh = RY + 5 * k;
  const zellen = new Array(B * Hh).fill(null);
  const set = (x, y, f) => { x = Math.floor(x) + RX; y = Math.floor(y) + RY; if (f && x >= 0 && y >= 0 && x < B && y < Hh) zellen[y * B + x] = f; };
  const rect = (x, y, w, h, f) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, f); };
  const vorlage = (v, dy = 0) => {
    if (!v) return;
    v.z.forEach((z, j) => { for (let i = 0; i < z.length; i++) if (z[i] !== ".") set(v.x + i, v.y + j + dy, FARBE[z[i]]); });
  };
  // dicke Linie zwischen zwei Punkten (Einheiten der kleinen Figur), Farbe je Querschnitt: [Licht, Mitte, Schatten]
  // Punkte sind Pixelmitten der kleinen Figur (y + 1: Zeile unter dem Wert); Pinsel d × d,
  // Licht/Schatten quer zur Richtung (senkrechte Glieder: links hell, waagrechte: oben hell)
  const mitte = pt => [pt[0] * k, (pt[1] + 1) * k];
  const pinsel = (x, y, d, farben, quer) => {
    for (let r = 0; r < d; r++) for (let q = 0; q < d; q++) {
      const i = quer ? r : q;
      set(x - d / 2 + q, y - d / 2 + r, farben[Math.min(farben.length - 1, Math.floor(i * farben.length / d))]);
    }
  };
  const glied = (p0, p1, d, farben, dy = 0) => {
    const [x0, ya] = mitte(p0), [x1, yb] = mitte(p1), y0 = ya + dy, y1 = yb + dy;
    const quer = Math.abs(x1 - x0) > Math.abs(y1 - y0);
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
    for (let t = 0; t <= n; t++) pinsel(x0 + (x1 - x0) * t / n, y0 + (y1 - y0) * t / n, d, farben, quer);
  };
  const atem = gross && bild === 1 ? 1 : 0; // zweites Bild beim Stehen: Oberkörper 1 Pixel tiefer
  const beuge = P.beugen ? k : 0;

  // Beine und Schuhe
  for (const bein of [P.beinL, P.beinR]) {
    glied([bein[0][0], bein[0][1]], [bein[1][0], bein[1][1]], 2 * k, gross ? [hellerDunkler(hose, 0.18), hose, hose, hellerDunkler(hose, -0.25)] : [hellerDunkler(hose, 0.15), hose]);
    const fx = bein[1][0] * k - k, fy = 0;
    rect(fx, fy, 2 * k + (gross ? 1 : 0), 2 * k, "#1a1a1e");
    rect(fx, fy, gross ? 2 : 1, gross ? 2 : 1, "#4a4a52");
    if (gross) rect(fx, fy + 3, 2 * k + 1, 1, "#d8dce0"); // helle Sohle
  }
  rect(1 * k + (P.beinL[0][0] - 1) * k, -3 * k, 4 * k, k, hose); // Schritt

  // Oberkörper: Licht links, Schatten rechts; Saum unten dunkler
  const oy = -9 * k + atem + beuge;
  for (let j = 0; j < 6 * k; j++) for (let i = 0; i < 6 * k; i++) {
    if (gross && j === 0 && (i === 0 || i === 6 * k - 1)) continue; // runde Schultern
    let f = jacke;
    if (i < (gross ? 2 : 1)) f = hellerDunkler(jacke, i ? 0.12 : 0.25);
    else if (i >= 6 * k - (gross ? 2 : 1)) f = hellerDunkler(jacke, i === 6 * k - 1 ? -0.35 : -0.2);
    if (gross && j === 6 * k - 1) f = hellerDunkler(f, -0.15);
    set(i, oy + j, f);
  }
  if (a.weste) { rect(k, oy, 4 * k, 6 * k, jacke2); rect(2 * k, oy, gross ? 1 : 1, 5 * k, hellerDunkler(jacke2, 0.2)); }
  if (a.fleece) for (let j = 0; j < 6 * k; j += 2) for (let i = 1 + (j / 2) % 2; i < 6 * k - 1; i += gross ? 3 : 2) set(i, oy + j, hellerDunkler(jacke, 0.12));
  if (a.reissverschluss) for (let j = 0; j < 6 * k; j++) set(3 * k - (gross ? 1 : 0), oy + j, j % 2 && gross ? hellerDunkler(a.reissverschluss, -0.3) : a.reissverschluss);
  if (a.kordel) { rect(2 * k, oy + k, gross ? 1 : 1, 2 * k, a.kordel); rect(3 * k + (gross ? 1 : 0), oy + k, 1, 2 * k, a.kordel); }
  if (a.riemen) for (let j = 0; j < 6 * k; j++) rect(6 * k - 1 - j, oy + j, gross ? 2 : 1, 1, a.riemen);

  // Arme: Ärmel mit Licht/Schatten, Hand in Hautfarbe; Wurfarm vor dem Kopf, wenn er quer vor der Brust liegt
  const arm = (pk, hand) => {
    const dy = atem + beuge, d = gross ? 2 : 1;
    const AF = gross ? [hellerDunkler(jacke, 0.05), hellerDunkler(jacke, -0.25)] : [hellerDunkler(jacke, -0.15)];
    glied(pk[0], pk[1], d, AF, dy); glied(pk[1], pk[2], d, AF, dy);
    const [hx, hy0] = mitte(pk[2]), hy = hy0 + dy;
    pinsel(hx, hy, d, gross ? [hellerDunkler(haut, 0.1), haut] : [haut], false);
    return [hx, hy];
  };
  const handL = arm(P.armL), handR = P.vorneR ? null : arm(P.armR);

  // Kopf mit Frisur, Bart, Brille und Kopfbedeckung
  const KV = KOPF[gross ? "gross" : "klein"], kdy = atem + beuge;
  vorlage(KV.basis, kdy);
  if (KV.frisur[a.frisur] && kopf.typ !== "cap") vorlage(KV.frisur[a.frisur], kdy);
  if (a.frisur === "geheimratsecken" && KV.frisur.geheimratsecken) vorlage(KV.frisur.geheimratsecken, kdy);
  if (KV.bart[a.bart]) vorlage(KV.bart[a.bart], kdy);
  if (a.brille) vorlage(KV.brille, kdy);
  if (kopf.typ === "cap") vorlage(KV.cap, kdy);
  else if (kopf.typ === "stirnband") vorlage(KV.stirnband, kdy);

  const hR = P.vorneR ? arm(P.armR) : handR;
  // Scheibe in der Wurfhand (Typfarbe), flach von der Seite: Kontur entsteht beim Umriss
  if (scheibe) {
    const [x, y] = hR, w = gross ? 6 : 3, h = gross ? 3 : 2;
    const sx = Math.round(x - w / 2), sy = Math.round(y - h / 2);
    rect(sx, sy, w, h, scheibe);
    rect(sx + 1, sy, w - 2, 1, hellerDunkler(scheibe, 0.4));
    if (gross) rect(sx + 1, sy + h - 1, w - 2, 1, hellerDunkler(scheibe, -0.35));
  }
  void handL;

  // Kontur: jede leere Zelle neben einer Figurzelle bekommt die dunkle Stufe der Nachbarfarbe
  const umriss = zellen.slice();
  for (let y = 0; y < Hh; y++) for (let x = 0; x < B; x++) {
    if (zellen[y * B + x]) continue;
    let n = null;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < B && yy < Hh && zellen[yy * B + xx]) { n = zellen[yy * B + xx]; if (dy === -1 || dx === 1) break; }
    }
    if (n) umriss[y * B + x] = hellerDunkler(n, -0.62);
  }

  const cv = document.createElement("canvas"); cv.width = B; cv.height = Hh;
  const c = cv.getContext("2d");
  for (let y = 0; y < Hh; y++) for (let x = 0; x < B; x++) {
    const f = umriss[y * B + x]; if (!f) continue;
    c.fillStyle = f; c.fillRect(links ? B - 1 - x : x, y, 1, 1);
  }
  // mitteX: Spalte der Körpermitte im Bild; fussY: Zeile des Fußes
  return { c: cv, mitteX: links ? B - 1 - (RX + 3 * k) + 1 : RX + 3 * k, fussY: RY };
}

// Zeichnet die Figur mit Sockel, Schatten und Markierung. x, y: Mitte/Fuß in echten Pixeln
window.zeichneFigurSprite = function (c, x, y, s, marke, f, pose, bild, links, scheibe) {
  const gross = f > 1, k = gross ? 2 : 1;
  const p = (dx, dy, farbe, w = 1, h = 1) => { c.fillStyle = farbe; c.fillRect(Math.round(x + dx), Math.round(y + dy), w, h); };
  // Schatten (gedithert) und Sockel in der Spielerfarbe
  c.fillStyle = "rgba(0,20,0,.35)";
  for (let i = -5 * k; i <= 5 * k; i++) for (let j = 0; j < 2 * k; j++) if (((i + j) & 1) === 0 || Math.abs(i) < 3 * k) p(i + k, 2 * k + j, c.fillStyle);
  p(-4 * k, 2 * k, s.farbe, 8 * k, k); p(-3 * k, 3 * k, hellerDunkler(s.farbe, -0.35), 6 * k, k);
  if (gross) p(-4 * k, 2 * k, hellerDunkler(s.farbe, 0.3), 8 * k, 1);
  const b = figurSprite(s, pose, bild, gross, links, scheibe);
  c.drawImage(b.c, Math.round(x - b.mitteX), Math.round(y - b.fussY));
  // Markierung, wer dran ist: kleiner Pfeil über dem Kopf
  if (marke) {
    const oy = -23 * k;
    p(-3 * k, oy, PAL.schwarz, 6 * k, k); p(-3 * k, oy + k, PAL.weiss, 6 * k, k); p(-2 * k, oy + 2 * k, PAL.weiss, 4 * k, k); p(-k, oy + 3 * k, PAL.weiss, 2 * k, k);
  }
};
