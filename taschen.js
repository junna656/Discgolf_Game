// ============================================================
//  SPIELER & TASCHEN  –  diese Datei darfst du frei anpassen!
// ============================================================
//  Jede Scheibe hat die Flugzahlen, die auf ihr aufgedruckt sind:
//    speed  1..14   wie schnell/weit (Putter ~2, Driver ~12)
//    glide  1..7    wie lange sie segelt
//    turn   +1..-5  Kurve nach rechts bei hoher Geschwindigkeit (negativ = mehr)
//    fade   0..5    Haken nach links am Ende des Flugs
//  typ: "Driver", "Fairway", "Midrange" oder "Putter"
//  hand: "rechts" oder "links" (links spiegelt alle Kurven)
//  wurfart (optional): "rueckhand" oder "vorhand" – Startwert, im Spiel umschaltbar
//  Der erste Putter in der Tasche wird automatisch zum Putten genommen.
//  standard: true – diese Scheibe ist zu Beginn ausgewählt.
//  ruf (optional): was der Spieler ruft, wenn ein Wurf schiefgeht (Baum, OB,
//    stark verzogen durch Streuung) oder ein Putt danebengeht
//  rufDatei (optional): eigene Aufnahme, z. B. "rufe/thomas.m4a" (mp3/m4a/wav)
//    – klingt viel echter als die Computerstimme. Ohne Datei spricht der Browser.
//  aussehen: für das 8-Bit-Porträt und die Figur im Spiel (Haut, Haare, Bart: vollbart/kurz/
//    schnurrbart/stoppeln, Brille,
//    Kopf: cap/stirnband, Jacke …)
//  karte: Infos für die Spielerkarte – spitzname, lieblingsscheibe und infos (Liste kurzer Texte)
//  staerken (optional): was der Spieler besonders gut kann (1 = normal, kleiner = besser)
//    putten: Wackeln des Putt-Fadenkreuzes
//    rueckhand / vorhand / hyzer / anhyzer: { streuung, weite } für Würfe dieser Art
//    sline: Rückhand-S-Line/Flex – mit Anhyzer oder flach mit einer unterstabilen Scheibe (Turn ≤ -2)
// ============================================================

window.SPIELER = [
  {
    name: "Thomas",
    aussehen: { haut: "#f2c4a4", haare: "#4a3020", frisur: "geheimratsecken", bart: "kurz", bartfarbe: "#4a3020",
      brille: "#141414", jacke: "#2b7bd8", jacke2: "#1f5c66", riemen: "#151515", augen: "#5a7a6a" },
    karte: { lieblingsscheibe: "Valkyrie", infos: ["Starke Rückhand – weit und präzise", "Rechtshänder, Rückhandspieler"] },
    staerken: { rueckhand: { streuung: 0.5, weite: 1.08 } },   // Rückhand: halbe Streuung, 8 % weiter
    farbe: "#e8483c",
    hand: "rechts",
    ruf: "Achtung, zweite Scheibe!",
    rufDatei: "rufe/thomas.mp3",   // KI-Stimme; eigene Aufnahme einfach unter gleichem Namen ersetzen
    tasche: [
      { name: "Donnerkeil", typ: "Driver",   speed: 12, glide: 5, turn: -1, fade: 2 },
      { name: "Trace", typ: "Driver", speed: 11, glide: 5, turn: -1, fade: 2 }, // Streamline Discs Trace (Neutron)
      { name: "Valkyrie", typ: "Driver", speed: 9, glide: 4, turn: -2, fade: 2, standard: true }, // Innova – Lieblingsscheibe
      { name: "River", typ: "Fairway", speed: 7, glide: 7, turn: -1, fade: 1 }, // Latitude 64°
      { name: "Pfeil",      typ: "Fairway",  speed: 7,  glide: 5, turn: -1, fade: 1 },
      { name: "Fels",       typ: "Midrange", speed: 5,  glide: 4, turn: 0,  fade: 2 },
      { name: "Kiesel",     typ: "Putter",   speed: 2,  glide: 3, turn: 0,  fade: 1 },
    ],
  },
  {
    name: "Daniel",
    aussehen: { haut: "#efc09c", haare: "#b08850", bart: "vollbart", bartfarbe: "#9a8468", kopf: { typ: "stirnband", farbe: "#6e8ea0" },
      jacke: "#f2c230", jacke2: "#1e2438", kordel: "#1e2438", augen: "#4a6a8a" },
    karte: { lieblingsscheibe: "River", infos: ["Sehr stark im Putten – auch aus der Ferne ruhig und sicher", "Rückhandspieler"] },
    staerken: { putten: 0.35 },   // Putt-Fadenkreuz wackelt viel weniger, Wind stört kaum
    farbe: "#3c8ce8",
    hand: "rechts",
    tasche: [
      { name: "River", typ: "Fairway", speed: 7, glide: 7, turn: -1, fade: 1, standard: true }, // Latitude 64°
      { name: "Berg",      typ: "Putter",   speed: 1,  glide: 1, turn: 1,  fade: 1 },
    ],
  },
  {
    name: "André",
    aussehen: { haut: "#eebd9a", haare: "#6a4428", frisur: "zerzaust", bart: "vollbart", bartfarbe: "#5e3c22",
      jacke: "#7c8696", jacke2: "#18181c", weste: true, augen: "#4a3a2a" },
    karte: { lieblingsscheibe: "Shryke", infos: ["Sehr starke Vorhand – weit und präzise", "Rechtshänder"] },
    staerken: { vorhand: { streuung: 0.5, weite: 1.15 } },   // Vorhand: halbe Streuung, 15 % weiter
    farbe: "#f0c030",
    hand: "rechts",
    wurfart: "vorhand",
    tasche: [
      { name: "Hammer",     typ: "Driver",   speed: 13, glide: 5, turn: -1, fade: 3 },
      { name: "Shryke", typ: "Driver", speed: 13, glide: 6, turn: -2, fade: 2, standard: true }, // Innova – Lieblingsscheibe
      { name: "River", typ: "Fairway", speed: 7, glide: 7, turn: -1, fade: 1 }, // Latitude 64°
      { name: "Möwe",       typ: "Fairway",  speed: 7,  glide: 6, turn: -1, fade: 2 },
      { name: "Kompass",    typ: "Midrange", speed: 5,  glide: 5, turn: 0,  fade: 1 },
      { name: "Muschel",    typ: "Putter",   speed: 2,  glide: 4, turn: 0,  fade: 0 },
      { name: "Zange",      typ: "Putter",   speed: 3,  glide: 2, turn: 0,  fade: 3 },
    ],
  },
  {
    name: "Gunnar",
    aussehen: { haut: "#f0c0a0", haare: "#5a3a24", bart: "schnurrbart", bartfarbe: "#7a4a2a", kopf: { typ: "cap", farbe: "#151515", abzeichen: "#f0f0f0" },
      jacke: "#1c1c1e", jacke2: "#3a3a40", reissverschluss: "#8a8a96", fleece: true, augen: "#4a7ab8" },
    karte: { lieblingsscheibe: "Heat", infos: ["S-Line- und Flex-Shots mit der Rückhand – sehr präzise", "Rückhandspieler"] },
    staerken: { sline: { streuung: 0.45 } },   // Rückhand-S-Line/Flex: weniger als halbe Streuung
    farbe: "#9c5ce0",
    hand: "rechts",
    tasche: [
      { name: "Katana",      typ: "Driver",   speed: 13, glide: 5, turn: -3, fade: 3 },
      { name: "Trace", typ: "Driver", speed: 11, glide: 5, turn: -1, fade: 2 }, // Streamline Discs Trace (Neutron)
      { name: "Heat",      typ: "Driver",   speed: 9, glide: 3, turn: -3, fade: 1, standard: true }, // Lieblingsscheibe
      { name: "River", typ: "Fairway", speed: 7, glide: 7, turn: -1, fade: 1 }, // Latitude 64°
      { name: "Sense",      typ: "Fairway",  speed: 9,  glide: 4, turn: 0,  fade: 3 },
      { name: "Eule",       typ: "Midrange", speed: 4,  glide: 6, turn: -1, fade: 0 },
      { name: "Bolzen",     typ: "Putter",   speed: 2,  glide: 3, turn: 0,  fade: 1 },
    ],
  },
];
