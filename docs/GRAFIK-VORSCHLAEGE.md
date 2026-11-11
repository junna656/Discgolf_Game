# Grafik-Update: Detailgrafik mit Jahreszeiten (Webversion)

Code: `grafik.js`, im Spiel eingebunden auf dem Branch `dev-graphic`
(Vorschau: www.discgolf-game.de/dev-graphic/). Gilt für alle Bahnen und das freie Feld.
Vorschau-Bilder neu erzeugen: `node werkzeuge/grafik_vorschau.mjs 1 docs/bilder`
(Spiellogik, Physik und Bahndaten bleiben unverändert, nur das Bild ändert sich).

**Einstellungen → Grafik und Jahreszeit:** „Nach Datum“ (Standard; Dez–Feb Winter, März–Mai Frühling,
Juni–Aug Sommer, Sep–Nov Herbst), eine feste Jahreszeit oder „Klassische Grafik“.

![Vergleich](bilder/grafik_bahn1_vergleich.png)

## Umgesetzt im Prototyp

| # | Vorschlag | Was sich ändert |
|---|---|---|
| 1 | **Größere Paletten** | 5–6 Stufen pro Fläche statt 2–3; Schatten kühler, Lichter wärmer |
| 2 | **Gras mit Struktur** | großflächiges Rauschen + Bayer-Dithering statt Pixelrauschen; Grasbüschel, Gänseblümchen, Löwenzahn, Klee, Maulwurfshügel |
| 3 | **Fairway** | Mähstreifen in Wurfrichtung, ausgefranste Kante zum Rough, abgelaufene Stelle vor dem Abwurf |
| 4 | **Wege** | dunkler Rand, hellere Mitte, einzelne Kiesel |
| 5 | **Bäume** | Krone aus mehreren Blättergruppen mit Kontur und Licht von links oben; ~30 % Kiefern (bläulich, Nadelbüschel); Schatten als dunklere Palettenstufe nach rechts unten |
| 6 | **Bowling-Deck** | Querdielen mit Fugen, Maserung, Nägeln, Schatten; Bowling-Pfeile als Dreiecke |
| 7 | **Abwurf** | Betonplatte mit Kante, Sprenkeln, Abwurflinie und Schatten |
| 9 | **Korb** | Putt-Ansicht: runder Ring mit Licht und Schatten, Ketten in zwei Lagen mit einzelnen Gliedern bis zum Kragen, Korb mit Gitter und gelbem Band, glänzende Stange mit Fuß, Schatten; auf der Bahn schräg von oben mit Ring, Ketten und Korb, wird beim Reinzoomen größer und feiner; im Winter Schnee auf dem Ring |
| 8 | **Deko** | Bahnschild mit Bahnnummer, Bank und Mülleimer am Abwurf – sie suchen sich einen freien Platz neben dem Abwurf (nicht auf Weg, Fairway, OB oder unter Bäumen) |

## Vier Jahreszeiten

`zeichneHintergrundDetail(z, { jahreszeit })` mit `fruehling`, `sommer`, `herbst` oder `winter`.
Paletten und Deko stehen in `JAHRESZEITEN` am Ende von `werkzeuge/grafik_vorschau.js`.

![Jahreszeiten](bilder/grafik_bahn1_jahreszeiten.png)

| Jahreszeit | Boden | Bäume | Deko |
|---|---|---|---|
| Frühling | frisches Gelbgrün | hellgrün, ~30 % blühen rosa | viele Blumen (weiß, gelb, lila, blau), Blütenblätter unter Blütenbäumen |
| Sommer | sattes Grün (Standard) | dunkelgrün | Gänseblümchen, Löwenzahn, Klee |
| Herbst | olivgrün | orange, rot, gelb, braun gemischt | viel Laub am Boden, kaum Blumen; im Spiel fallen bunte Blätter aus den Kronen und treiben mit dem Wind |
| Winter | Schnee mit bläulichen Schatten, Wege matschig | Laubbäume kahl mit Ästen und Astschatten, Kiefern verschneit | Schnee auf dem Deck und der Bank, keine Blätter |

Auch die Putt-Ansicht (Seitenansicht am Korb) folgt der Jahreszeit: Himmel mit Sonne und Wolken,
Baumreihe in den Farben der Jahreszeit (im Winter kahl und verschneit), Wiese mit Mähstreifen,
Blumen, Laub oder Schnee; im Herbst fallen auch hier Blätter.

Themen-Optiken der Wochenbahnen stehen mit in `JAHRESZEITEN` (bisher `wueste`: Sand mit Windrippeln,
Kakteen und Felsen statt Bäumen, rissige Flussbetten als OB, in der Putt-Ansicht Dünen, Tafelberge und Saguaros).
Die klassische Grafik wurde mit dem Abschied von der GBA-Version entfernt (Stand: Branch `V1.0_GBA`).

## Hohe Auflösung (quer und hochkant)

Mit Detailgrafik ist das Canvas 640 × 360 statt 320 × 180 echte Pixel (hochkant 360 × 640 statt 180 × 320) (`AUF = 2` in index.html).
Bahnbild, Bäume, Korb und fallendes Laub werden in doppelter Pixeldichte gezeichnet; Schrift, Figuren,
Scheibe und Anzeigen bleiben im 8-Bit-Raster (scharf verdoppelt), Eingaben rechnen weiter in Spielpixeln.
Auch die Spielerfiguren werden dann in echten Pixeln gezeichnet (6 × 16 statt 3 × 8, gleiche Größe):
Frisur, Bart, Brille, Cap/Stirnband, Jacke mit Weste/Gurt/Kordel/Reißverschluss, Hose, Schuhe; wer dran ist,
hält die gewählte Scheibe in ihrer Typfarbe.

![Figuren](bilder/figuren_hd.png)

Abschaltbar unter Einstellungen → Hohe Auflösung.

### Proportionen Figur ↔ Korb

Figur und Korb wachsen gemeinsam mit dem Zoom (`figurMasstab()` in index.html): Übersicht und mittel ×1,
nah ×2 (ganzzahlig, damit die Figurpixel gleich groß bleiben). Der Korb ist immer 0,75 × so hoch wie die Figur
(echt: Korb ≈ 1,35 m, Mensch ≈ 1,8 m; `KORB_ZU_FIGUR` in grafik.js). Vorher war die Figur fest 16 px
und der Korb 22/33/44 px, also in der nahen Ansicht fast dreimal so groß wie der Spieler.

![Proportionen vorher/nachher](bilder/proportionen_vergleich.png)
(je Zeile links vorher, rechts nachher; Übersicht, mittel, nah)

### Einheitliches Pixelraster (16-Bit-Schritt 2)

Bei hoher Auflösung wird auch die Spieloberfläche im feinen Raster (echte Pixel) gezeichnet, statt im
verdoppelten 320er-Raster:
- **Schrift**: Pixelify Sans (OFL, `fonts/pixelify-sans-400.woff2`) in echten Pixeln, 1 px Kontur,
  etwas Buchstaben- und Wortabstand. Ohne hohe Auflösung bleibt Silkscreen. Maße bleiben in Spielpixeln
  (`textBreite()` statt `measureText`).
- **Rahmen** (`rahmen()`): Kontur mit abgeschnittenen Ecken, Licht oben links, Schatten unten rechts –
  Windanzeige, Kraftbalken, Sprechblase, Putt-Ansicht, Bahnende.
- **Kraftbalken** (`balkenStueck()`): Bereiche mit Licht- und Schattenkante, Zeiger mit Kontur.
- **Wind-Pfeil** (`feineLinie()`), **fliegende Scheibe** (runde Ellipse mit Rand, Licht und umlaufendem Glanzpunkt,
  runder Schatten), **Ziellinie**, **Fadenkreuz** und **Putter** im Putt bewegen sich in echten Pixeln.

![Oberfläche vorher/nachher](bilder/hud_16bit_vergleich.png)
(oben jeweils vorher, darunter nachher; unten Wind vorher/nachher und Scheibe im Flug)

Menüs und Rechtsseiten nutzen ebenfalls Pixelify Sans, als eigene Variante „Pixelify Menue“ mit
`size-adjust: 125%` (die Kleinbuchstaben sind kleiner als die Kapitälchen von Silkscreen).

### Putt-Ansicht in hoher Auflösung

`puttSzeneMalen(jz, bw, bh, A)` malt die Szene im feinen Raster: Himmel mit doppelt so vielen Farbstufen,
Sonne mit Schein, Wolken mit Licht und Schatten, Blätter, Rinde, Nadeln, Äste, Grashalme, Blumen und Laub
pixelgenau; Formen und Anordnung bleiben gleich (Details haben einen eigenen Zufall). Der Korb von der Seite
(`puttKorbFein`) hat mehr Ketten mit einzelnen Gliedern, feine Gitterstäbe und Bänder mit Verlauf.
Fallendes Laub fällt in echten Pixeln.

![Putt-Szene](bilder/putt_hd_jahreszeiten.png)
(oben bisher, unten hohe Auflösung)

Noch im groben Raster: die Sternframe-Porträts.
Bahnbild am Rechner: Übersicht 50–140 ms, nah (im Leerlauf vorbereitet) 0,3–0,5 s.

Die Physik ändert sich nicht (Schnee bremst die Scheibe z. B. nicht stärker) – das wäre ein eigener Schritt.

## Weitere Ideen (noch nicht gebaut)

- **Tageszeit**: abendliches Licht als Paletten-Tausch
- **Animation**: Wind bewegt Baumkronen und Gras leicht (2–3 Frames), Blätter fallen
- **Zaun**: höher wirkender Maschendraht mit deutlicheren Pfosten (im Prototyp noch zu dezent)
- **Detailstufen**: Deko erst ab Zoomstufe „mittel“ zeigen (Übersicht bleibt ruhig – schon so umgesetzt ab 5 px/m)
- **Handgezeichnete Sprites** für Schild, Bank, Korb statt Code-Grafik, als kleine PNG-Atlas-Datei
- **Fotos als Vorlage**: Deko-Positionen (Bank, Schild, Mülleimer) als optionale Felder in `bahnen.js`
  (z. B. `deko: [{ art: "bank", x, y }]`), damit jede Bahn eigene Details bekommt

## Offene Punkte

- Laufzeit: das Bahnbild wird pro Zoomstufe einmal vorgerendert. Normale Auflösung am Rechner
  12–65 ms (Übersicht) bzw. 100–310 ms (nah, im Leerlauf vorbereitet) je Bahn – auf dem Handy noch messen.
- Putt-Ansicht ist auch bei hoher Auflösung im normalen Raster gezeichnet.
