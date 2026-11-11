# Arbeitsweise in diesem Repo

## Branches
- Alle Änderungen immer im Branch `dev` umsetzen, committen und nach `origin/dev` pushen.
- Niemals direkt auf `main` committen oder pushen – außer beim Release (siehe unten).
- Keine eigenen Feature-Branches anlegen, sofern nicht ausdrücklich gewünscht.

## Release (nur auf ausdrücklichen Befehl „Release“)
1. Versionsnummer inkrementieren (Minor, z. B. 0.6.0 → 0.7.0; Patch nur wenn gewünscht) an allen Stellen:
   - `index.html`: Untertitel „Version x.y.z“ und alle `?v=x.y.z` an den `<script src=…>`
2. Commit „Version x.y.z“ auf `dev`, pushen.
3. `dev` in `main` mergen (Merge-Commit „Release x.y.z: <kurze Zusammenfassung>“ mit Stichpunkten der Änderungen) und `main` pushen.

## Wochenbahn (Ausnahme vom Release-Ablauf)
- Ablauf und Werkzeug: `docs/WOCHENBAHN.md`.
- Wochenbahnen werden auf `dev` gebaut (`node werkzeuge/wochenbahn.mjs --thema …`) und dort getestet (www.discgolf-game.de/dev/).
- Nach `main` kommt **nur `wochenbahnen.js`**, und zwar automatisch sonntags ab 20:00 durch die Action „Wochenbahn live“.
  Dafür ist kein „Release“-Befehl nötig; alles andere bleibt beim normalen Release-Ablauf.
- Braucht ein Thema neuen Spiel-Code (neue Zeichenarten), vorher den Nutzer auf ein Release hinweisen – oder die Optik als `optikDaten` mitgeben.
- Neue Gegenstände eines Themas als Art in `optikDaten.objekte` (Form + Farben) anlegen, dann sind sie ohne Release in 3/4 live; nur eine neue Form braucht Code und Release (`docs/WOCHENBAHN.md`).

## GBA
- Die GBA-Version ist eingefroren (Branch `V1.0_GBA`), keine Synchronisierung mehr. Reaktivieren: `docs/GBA-REAKTIVIEREN.md`.
