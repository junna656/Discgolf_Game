// ============================================================
//  BAHNEN  –  Hyzernauts Discgolfparcours, Volkspark Potsdam
// ============================================================
//  Koordinaten in Metern, Draufsicht: x nach rechts, y nach unten.
//  Die Spielfläche ist welt.breite × welt.hoehe Meter groß.
//
//  ACHTUNG: Bahn 1 ist eine Annäherung an das Signature-Hole
//  ("Bowling-Bahn", die Scheibe kann in den Korb rutschen).
//  Die echten Maße aus UDisc (Layout "Main") hier nachtragen:
//  Abwurf, Korb, Länge, Par und Bäume.
// ============================================================

window.BAHNEN = [
  {
    nummer: 1,
    name: "Bowling",
    par: 3,
    welt: { breite: 320 / 3, hoehe: 60 },
    abwurf: { x: 6, y: 38 },
    korb: { x: 82, y: 24 },
    // gemähte Spielbahn (Polygon)
    fairway: [[2, 31], [30, 28], [52, 22], [70, 19], [90, 17], [97, 21], [97, 30], [70, 30], [52, 34], [30, 45], [2, 45]],
    // die Bowlingbahn vor dem Korb: hier rutschen Scheiben sehr weit
    bowlingbahn: { x1: 64, y1: 24, x2: 82, y2: 24, breite: 3 },
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
      { x: 40, y: 30, r: 2.5 }, { x: 60, y: 33, r: 2 }, { x: 52, y: 17, r: 2.5 },
      // rund um die Bowlingbahn und hinter dem Korb
      { x: 72, y: 19, r: 2 }, { x: 75, y: 29.5, r: 2 }, { x: 91, y: 14, r: 3 }, { x: 92, y: 31, r: 3 },
      { x: 102, y: 23, r: 3.5 }, { x: 100, y: 38, r: 3.5 },
    ],
    // Aus (OB): Rechtecke
    ob: [{ x: 0, y: 55, w: 320 / 3, h: 5, name: "Weg" }],
  },
];
