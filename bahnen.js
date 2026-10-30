// ============================================================
//  BAHNEN  –  Hyzernauts Discgolfparcours, Volkspark Potsdam
// ============================================================
//  Koordinaten in Metern, Draufsicht: x nach rechts, y nach unten.
//  Die Spielfläche ist welt.breite × welt.hoehe Meter groß und wird
//  auf den Bildschirm skaliert – hoehe muss breite × 9/16 sein.
//
//  Länge und Par stammen aus UDisc (Layout "2025.08 15 Bahnen").
//  Lage von Abwurf, Korb und Bäumen ist noch nachempfunden – UDisc
//  zeigt die Karte nur eingeloggt.
//
//  Alle Bahnen laut UDisc (Meter, Par):
//   1: 86,9 / 3    2: 94,1 / 3    3: 74,2 / 3    4: 74,4 / 3    5: 107,3 / 3
//   6: 75,5 / 3    7: 68,2 / 3    8: 118,5 / 3   9: 86,7 / 3   10: 139,3 / 3
//  11: 57,8 / 3   12: 91,2 / 3   13: 94,4 / 3   14: 83,4 / 3   15: 88,0 / 3
// ============================================================

window.BAHNEN = [
  {
    nummer: 1,
    name: "Bowling",
    ort: "Hyzernauts Parcours · Volkspark",
    par: 3,
    welt: { breite: 120, hoehe: 67.5 },
    abwurf: { x: 12, y: 41 },
    korb: { x: 97, y: 23 }, // 86,9 m wie in UDisc
    // gemähte Spielbahn (Polygon)
    fairway: [[2, 31], [30, 28], [52, 22], [70, 19], [90, 17], [101, 20], [101, 30], [70, 30], [52, 34], [30, 45], [2, 45]],
    // die Bowlingbahn vor dem Korb: hier rutschen Scheiben sehr weit
    bowlingbahn: { x1: 79, y1: 23, x2: 97, y2: 23, breite: 3 },
    // Bäume: Mittelpunkt, Kronenradius r, Höhe h (Meter)
    baeume: [
      // Baumreihe oben
      { x: 8, y: 9, r: 3 }, { x: 18, y: 6, r: 4 }, { x: 27, y: 13, r: 3 }, { x: 37, y: 8, r: 4 },
      { x: 47, y: 12, r: 3 }, { x: 57, y: 8, r: 3.5 }, { x: 67, y: 11, r: 3 }, { x: 78, y: 7, r: 4 },
      { x: 89, y: 9, r: 3 }, { x: 100, y: 8, r: 4 },
      // Baumreihe unten
      { x: 14, y: 52, r: 3 }, { x: 26, y: 53, r: 3.5 }, { x: 43, y: 50, r: 3 }, { x: 56, y: 45, r: 3 },
      { x: 68, y: 42, r: 3.5 }, { x: 81, y: 40, r: 3 }, { x: 93, y: 45, r: 4 },
      // Hindernisse auf der Bahn
      { x: 42, y: 33, r: 2.5 }, { x: 60, y: 33, r: 2 }, { x: 52, y: 17, r: 2.5 },
      // rund um die Bowlingbahn und hinter dem Korb
      { x: 84, y: 18.5, r: 2 }, { x: 86, y: 28.5, r: 2 }, { x: 91, y: 14, r: 3 }, { x: 92, y: 31, r: 3 },
      { x: 105, y: 23, r: 3.5 }, { x: 100, y: 38, r: 3.5 },
      // rechter Rand
      { x: 111, y: 9, r: 4 }, { x: 114, y: 33, r: 3.5 }, { x: 112, y: 47, r: 4 }, { x: 106, y: 53, r: 3 },
    ],
    // Aus (OB): Rechtecke
    ob: [{ x: 0, y: 55, w: 120, h: 12.5, name: "Weg" }],
  },
  {
    // Offene Wiese zum Weitwurf-Üben: 200 m bis zum Korb, keine Bäume
    nummer: 2,
    kurz: "FELD",
    name: "Freies Feld",
    ort: "Übungswiese",
    par: 4,
    welt: { breite: 240, hoehe: 135 },
    abwurf: { x: 24, y: 67.5 },
    korb: { x: 224, y: 67.5 },
    fairway: [[0, 37.5], [240, 37.5], [240, 97.5], [0, 97.5]],
    baeume: [],
    ob: [],
    distanzmarken: 25, // alle 25 m eine Markierung
  },
];
