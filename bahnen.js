// ============================================================
//  BAHNEN  –  Hyzernauts Discgolfparcours, Volkspark Potsdam
// ============================================================
//  Koordinaten in Metern, Draufsicht: x nach rechts, y nach unten.
//  Die Spielfläche ist welt.breite × welt.hoehe Meter groß und wird
//  auf den Bildschirm skaliert – hoehe muss breite × 9/16 sein.
//
//  Bahn 1 ist nach dem aktuellen Bahnschild (Par 3, 97 m), dem Übersichtsplan
//  und Fotos nachgebaut. Die Liste unten stammt aus UDisc.
//
//  Alle Bahnen laut UDisc (Meter, Par):
//   1: 86,9 / 3    2: 94,1 / 3    3: 74,2 / 3    4: 74,4 / 3    5: 107,3 / 3
//   6: 75,5 / 3    7: 68,2 / 3    8: 118,5 / 3   9: 86,7 / 3   10: 139,3 / 3
//  11: 57,8 / 3   12: 91,2 / 3   13: 94,4 / 3   14: 83,4 / 3   15: 88,0 / 3
// ============================================================

window.BAHNEN = [
  {
    // Nachgebaut nach Bahnschild (2026), Übersichtsplan und Fotos aus UDisc
    nummer: 1,
    name: "Bowling",
    ort: "Hyzernauts Parcours · Volkspark",
    par: 3,
    welt: { breite: 125, hoehe: 70.3125 },
    abwurf: { x: 12, y: 36 },
    korb: { x: 109, y: 32.6 }, // 97 m laut Bahnschild (UDisc-Layout: 86,9 m)
    // heller Korridor wie auf dem Schild: am Abwurf schmal, zum Korb breiter
    fairway: [[12, 34], [12, 38], [59, 43.6], [105, 39.6], [118, 37], [121, 33], [118, 28.6], [105, 26.6], [59, 29.6]],
    // Holzdeck, in das der Korb eingelassen ist: Scheiben rutschen weit und können hineinrutschen
    bowlingbahn: { x1: 87, y1: 33.4, x2: 112, y2: 32.5, breite: 4 },
    baeume: [
      // im Spiel, links der Bahn
      { x: 36.6, y: 29.6, r: 4.5 }, { x: 51.6, y: 28, r: 4 }, { x: 70.4, y: 26.6, r: 4.5 },
      { x: 108, y: 24, r: 3 },
      // im Spiel, rechts der Bahn
      { x: 42.6, y: 49.2, r: 3 }, { x: 59.4, y: 41, r: 2.5 }, { x: 104, y: 37.2, r: 2.5 },
      // hinter dem Zaun (OB)
      { x: 70, y: 54.2, r: 4.5 }, { x: 53, y: 65.6, r: 3.5 }, { x: 44.4, y: 67.6, r: 3 },
      { x: 92.6, y: 50, r: 2.5 }, { x: 100.6, y: 48.2, r: 2.5 }, { x: 106.4, y: 46.2, r: 2.5 }, { x: 117.4, y: 42.8, r: 2.5 },
      // jenseits des Weges links (OB)
      { x: 119, y: 8.2, r: 4 }, { x: 99.4, y: 3, r: 4 }, { x: 64.4, y: 12.2, r: 3.5 }, { x: 72.6, y: 8.6, r: 1.8 },
      // am Abwurf
      { x: 3, y: 27, r: 2 },
    ],
    // Wege (nur Bild): Weg links der Bahn, Querweg vor dem Abwurf, Weg schräg unten
    wege: [
      { punkte: [[30, 20.6], [125, 17.6]], breite: 3 },
      { punkte: [[29, 0], [30, 70.3]], breite: 2.5 },
      { punkte: [[27.5, 50], [2, 61]], breite: 2.5 },
    ],
    // OB: links der Weg und alles dahinter, rechts hinter dem Zaun
    ob: [
      { name: "Weg", art: "linie", punkte: [[30, 22.4], [125, 19.4], [125, 0], [30, 0]] },
      { name: "Zaun", art: "zaun", punkte: [[125, 37.4], [108.6, 40.6], [79, 46.6], [64, 48.6], [39, 55.6], [38.4, 70.3125], [125, 70.3125]] },
    ],
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
