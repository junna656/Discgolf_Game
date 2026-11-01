# Plan: Boogie Garanten als Game-Boy-Advance-Spiel (C++)

Ziel: eine GBA-ROM, die auf dem **Analogue Pocket** (openFPGA-GBA-Kern), in Emulatoren
(mGBA) und auf echten GBAs per Flash-Modul läuft – und die **mit der HTML-Version
synchron bleibt**, ohne alles doppelt pflegen zu müssen.

---

## 1. Grundidee für die Synchronität

Jedes Teil des Spiels bekommt **genau eine Quelle**. Die GBA-Version erzeugt so viel wie möglich
automatisch aus der Webversion. Von Hand übersetzt wird nur, was nicht anders geht, und das
überwacht ein Test.

| Teil | Quelle (wird bearbeitet) | GBA bekommt es durch … |
|---|---|---|
| Kurse und Bahnen | `bahnen.js` | Generator → `gba/include/gen_bahnen.h` |
| Spieler, Bags, Stärken | `taschen.js` | Generator → `gba/include/gen_taschen.h` |
| Stellschrauben (`STANDARD`) | `physik.js` | Generator → `gba/include/gen_einstellungen.h` |
| Porträts (32 × 32) | `portraets.js` | im Headless-Browser rendern → BMP → Sprites |
| Bahn-Grafik (Draufsicht) | Zeichencode in `index.html` | im Headless-Browser auf GBA-Größe rendern → Hintergrund-Kacheln |
| Rufe | `rufe/*.m4a` | `ffmpeg` → 8-Bit-WAV für Butano |
| **Flugmodell** | `physik.js` (Referenz) | **von Hand nach C++** – überwacht durch **Golden-Tests** |
| Menü, Steuerung, Scorekarte | getrennt | eigene GBA-Oberfläche (die Bildschirme sind zu verschieden) |
| Versionsnummer | `index.html` (`?v=`) | Generator → in der ROM sichtbar |

Bahnen, Bags, Porträts und Stellschrauben sind damit **automatisch synchron**.
Bekommt `bahnen.js` eine neue Bahn oder ein neuer Kurs dazu, enthält ihn die nächste ROM ohne
jede Arbeit am C++-Code.

---

## 2. Die Physik synchron halten

`physik.js` hat schon eine gute Ausgangslage: Die Datei braucht kein DOM und läuft auch in Node
(`globalThis`). Zwei Dinge fehlen noch:

### 2.1 Zufall mit Startwert (Änderung an der Webversion)
`physik.js` ruft an 9 Stellen `Math.random()` auf. Dafür kommt ein **einfacher, deterministischer
Zufallsgenerator** (z. B. *mulberry32*) hinein, der in JS und C++ Bit für Bit gleich ist:

```js
Physik.zufall = erzeugeZufall(startwert);   // statt Math.random()
```

Für den Online-Multiplayer ist das ebenfalls nützlich: Wenn der Server einen Startwert vorgibt,
fliegt derselbe Wurf bei allen Spielern exakt gleich.

`gauss()` nutzt `log`/`cos`. Auf dem GBA wird das per Tabelle oder Näherung gelöst. Der
Golden-Test prüft dort nur die statistische Verteilung, nicht jeden einzelnen Wert.

### 2.2 Golden-Tests (Referenzwürfe)
1. Ein Node-Skript `werkzeuge/referenzwuerfe.mjs` lädt `bahnen.js`, `taschen.js` und `physik.js`
   und simuliert ~500 festgelegte Würfe: jede Scheibe, Vorhand und Rückhand, Hyzer, Anhyzer und
   flach, mit und ohne Wind, auf allen Bahnen, alle mit festem Startwert.
2. Die Ergebnisse (Landepunkt, OB ja/nein, Baumtreffer, Korb) landen in `tests/referenz.json`.
3. Ein kleines Testprogramm kompiliert die **C++-Physik nativ mit g++** (gleicher Code wie in der
   ROM, nur auf dem PC) und vergleicht mit `referenz.json`.
   Umgesetzt (Etappe 3): Die C++-Physik rechnet in `double` mit eigenen Mathefunktionen (`gba/include/mathe.h`,
   Butano bindet keine libm ein). Dadurch rechnen GBA und PC-Test gleich, und alle 600 Würfe stimmen bis auf
   ca. 2 mm mit physik.js überein (Toleranz im Test: 1 cm). Festkomma (`bn::fixed`) nur, falls die Rechenzeit
   auf dem GBA zu lang wird.
4. **GitHub Actions** führt das bei jedem Push aus. Ändert jemand `physik.js` und vergisst die
   C++-Seite, wird der Test rot.

### 2.3 Späterer Ausbau (optional)
Ist die C++-Physik stabil, kann sie per **Emscripten nach WebAssembly** übersetzt und in der
Webversion statt `physik.js` genutzt werden. Dann gibt es nur noch eine Physik. Dafür braucht die
bisher build-freie Website aber einen Build-Schritt. Das lohnt sich erst, wenn die Doppelpflege
wirklich stört.

---

## 3. Technik auf dem GBA

- **Engine: [Butano](https://github.com/GValiente/butano)** (C++, zlib-Lizenz, sehr gut dokumentiert)
  mit **devkitARM**.
- **Bildschirm 240 × 160** (3:2). Die Bahnen sind 16:9 – man scrollt bzw. zoomt in der Draufsicht,
  ähnlich wie beim „Umsehen“ in der Webversion.
- **Bahn-Hintergrund:** Playwright rendert jede Bahn mit dem echten Zeichencode der Webversion in
  passender Auflösung (z. B. 512 × 288 px). Danach wird auf eine 256-Farben-Palette reduziert und
  als großer Butano-Hintergrund (`regular_bg`) eingebunden. Ändert sich die Grafik im Web, ändert sie
  sich auch auf dem GBA.
- **Scheibe, Spielerfigur, Korb, Zielpfeil:** Sprites. Die Porträts sind schon 32 × 32 groß –
  genau eine GBA-Spritegröße.
- **Speichern:** SRAM für Scorekarten, Bestwerte und Einstellungen.
- **Ton:** die Rufe als Samples, dazu ein paar Effekte (Kette, Baum, Wasser).

### Steuerung
| Taste | Funktion |
|---|---|
| ◀ ▶ | zielen (mit R gedrückt: fein) |
| ▲ ▼ | Scheibe wählen |
| **A halten, loslassen** | Kraft laden, werfen |
| L / R | Abwurfwinkel Hyzer / Anhyzer |
| B | Vorhand / Rückhand |
| Select | Umsehen / Karte |
| Start | Menü, Scorekarte |

### Modi
- Freies Werfen, Single Flight und **Vierer Flight als Hot-Seat** (der Pocket wird weitergereicht)
- Online-Multiplayer ist **nicht möglich** (keine Netzwerkverbindung).
  Link-Kabel-Multiplayer wäre eine spätere Option.

---

## 4. Ordnerstruktur (im selben Repository)

```
/                       Webversion wie bisher (GitHub Pages bleibt unverändert)
├─ bahnen.js, taschen.js, physik.js, …
├─ gba/                 Butano-Projekt
│  ├─ src/              Spiel (main.cpp, physik.cpp, bahn_szene.cpp, menue.cpp …)
│  ├─ include/gen_*.h   ERZEUGT – nicht von Hand bearbeiten
│  ├─ graphics/         ERZEUGT (Bahnen, Porträts) + handgemachte Sprites
│  └─ audio/            ERZEUGT aus rufe/
├─ werkzeuge/
│  ├─ exportiere_daten.mjs      bahnen/taschen/physik → gen_*.h
│  ├─ rendere_grafik.mjs        Playwright → Bahn-Bilder, Porträts
│  └─ referenzwuerfe.mjs        → tests/referenz.json
├─ tests/
│  ├─ referenz.json
│  └─ physik_test.cpp           C++-Physik nativ gegen Referenz
└─ .github/workflows/gba.yml    Daten erzeugen → Tests → ROM bauen
```

Wichtig für GitHub Pages: `gba/`, `werkzeuge/` und `tests/` werden mit ausgeliefert, stören
aber nicht. Wer will, schließt sie aus oder legt sie nach `_gba/` (Jekyll ignoriert `_`-Ordner).

---

## 5. Arbeitsablauf (dev → main)

1. Wie bisher wird auf `dev` entwickelt.
2. **Ändert sich nur der Inhalt** (Bahn, Scheibe, Spieler, Stellschraube), passiert nichts von Hand.
   Die CI erzeugt die Header neu und baut die ROM.
3. **Ändert sich `physik.js`:** `referenzwuerfe.mjs` erneut laufen lassen. Der Test zeigt dann,
   welche Würfe auf dem GBA abweichen. `physik.cpp` wird im selben Commit angepasst.
4. **Release:** Bei einem Release (`dev` → `main`, Version erhöht) hängt die CI die ROM
   `boogie-garanten-0.x.y.gba` an ein **GitHub-Release** an. Web und ROM tragen dieselbe
   Versionsnummer.
5. Auf dem Pocket kommt die Datei auf die SD-Karte, in den Ordner des GBA-Kerns
   (meist `Assets/gba/common/`).

---

## 6. Etappen

| # | Etappe | Ergebnis | Aufwand (grob) |
|---|---|---|---|
| 0 ✅ | **Vorbereitung in der Webversion:** Zufall mit Startwert, `referenzwuerfe.mjs` | Webspiel unverändert spielbar, Referenzdaten vorhanden | 1–2 Abende |
| 1 ✅ | **Werkzeugkette:** Butano + devkitARM in GitHub Actions, „Hallo Welt“-ROM | ROM läuft in mGBA und auf dem Pocket | 1 Abend |
| 2 ✅ | **Daten-Generator** für Bahnen, Taschen, Stellschrauben | `gen_*.h` werden automatisch erzeugt | 1–2 Abende |
| 3 ✅ | **Physik in C++** (`double`, eigene Mathefunktionen) + Golden-Tests grün | Würfe fliegen wie im Browser | 3–5 Abende |
| 4 | **Bahn 1 spielbar:** gerenderter Hintergrund, zielen, werfen, putten, OB | erster echter Test auf dem Pocket | 3–4 Abende |
| 5 | **Alle Bahnen**, Spielerwahl, Bags, Scorekarte, Single und Vierer Flight (Hot-Seat) | vollständige Runde | 4–6 Abende |
| 6 | **Feinschliff:** Porträts, Rufe, Speichern, Freies Werfen, Titelbild | Release 1.0 als ROM | 3–5 Abende |

Insgesamt grob **4–8 Wochen** nebenbei. Etappe 0 verbessert auch die Webversion
(deterministische Würfe für den Multiplayer).

---

## 7. Risiken und offene Fragen

- **Rechenzeit:** Die Physik rechnet in `double` ohne Hardware-Gleitkomma. Die ROM zeigt die Zeit je Wurf an;
  ist sie zu lang, Festkomma oder Verteilen auf mehrere Bilder. (Früher: Festkomma-Genauigkeit –
  Lange Flüge mit vielen Schritten können sich leicht aufsummieren.)
  Gegenmittel sind mehr Nachkommabits für Geschwindigkeiten oder eine Toleranz im Golden-Test.
- **Leistung:** Die Physik berechnet den ganzen Flug vorab (`simuliere`). Auf dem GBA (16 MHz)
  sollte das in wenigen Frames gehen. Sonst wird über mehrere Frames verteilt, während die
  Scheibe schon fliegt.
- **Grafik-Paletten:** Bahnen mit vielen Grüntönen müssen auf ≤ 256 Farben (bzw. 16 × 16er-Paletten)
  reduziert werden. Das Ergebnis muss auf dem Pocket-Display geprüft werden.
- **Pocket-GBA-Kern:** Für den openFPGA-GBA-Kern zuerst mit der „Hallo Welt“-ROM prüfen (Etappe 1),
  ob alles läuft (Speichern, Ton).
- **Echte Personen und Kurs:** Für eine private ROM kein Problem. Vor einer öffentlichen
  Verbreitung die vier Spieler und die Hyzernauts fragen.
