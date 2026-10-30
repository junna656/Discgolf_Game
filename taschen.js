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
//  ruf (optional): was der Spieler nach jedem Wurf ruft (Sprechblase + Sprachausgabe)
// ============================================================

window.SPIELER = [
  {
    name: "Thomas",
    farbe: "#e8483c",
    hand: "rechts",
    ruf: "Achtung, zweite Scheibe!",
    tasche: [
      { name: "Donnerkeil", typ: "Driver",   speed: 12, glide: 5, turn: -1, fade: 2 },
      { name: "River", typ: "Fairway", speed: 7, glide: 7, turn: -1, fade: 1, standard: true }, // Latitude 64°
      { name: "Pfeil",      typ: "Fairway",  speed: 7,  glide: 5, turn: -1, fade: 1 },
      { name: "Fels",       typ: "Midrange", speed: 5,  glide: 4, turn: 0,  fade: 2 },
      { name: "Kiesel",     typ: "Putter",   speed: 2,  glide: 3, turn: 0,  fade: 1 },
    ],
  },
  {
    name: "Daniel",
    farbe: "#3c8ce8",
    hand: "rechts",
    tasche: [
      { name: "Komet",      typ: "Driver",   speed: 11, glide: 6, turn: -2, fade: 1 },
      { name: "River", typ: "Fairway", speed: 7, glide: 7, turn: -1, fade: 1, standard: true }, // Latitude 64°
      { name: "Falke",      typ: "Fairway",  speed: 8,  glide: 4, turn: 0,  fade: 2 },
      { name: "Feder",      typ: "Midrange", speed: 5,  glide: 5, turn: -1, fade: 0 },
      { name: "Anker",      typ: "Putter",   speed: 3,  glide: 3, turn: 0,  fade: 2 },
    ],
  },
  {
    name: "André",
    farbe: "#f0c030",
    hand: "rechts",
    tasche: [
      { name: "Hammer",     typ: "Driver",   speed: 13, glide: 5, turn: -1, fade: 3 },
      { name: "River", typ: "Fairway", speed: 7, glide: 7, turn: -1, fade: 1, standard: true }, // Latitude 64°
      { name: "Möwe",       typ: "Fairway",  speed: 7,  glide: 6, turn: -2, fade: 1 },
      { name: "Kompass",    typ: "Midrange", speed: 5,  glide: 5, turn: 0,  fade: 1 },
      { name: "Muschel",    typ: "Putter",   speed: 2,  glide: 4, turn: 0,  fade: 0 },
      { name: "Zange",      typ: "Putter",   speed: 3,  glide: 2, turn: 0,  fade: 3 },
    ],
  },
  {
    name: "Gunnar",
    farbe: "#9c5ce0",
    hand: "rechts",
    tasche: [
      { name: "Orkan",      typ: "Driver",   speed: 12, glide: 5, turn: -3, fade: 1 },
      { name: "River", typ: "Fairway", speed: 7, glide: 7, turn: -1, fade: 1, standard: true }, // Latitude 64°
      { name: "Sense",      typ: "Fairway",  speed: 9,  glide: 4, turn: 0,  fade: 3 },
      { name: "Eule",       typ: "Midrange", speed: 4,  glide: 6, turn: -1, fade: 0 },
      { name: "Bolzen",     typ: "Putter",   speed: 2,  glide: 3, turn: 0,  fade: 1 },
    ],
  },
];
