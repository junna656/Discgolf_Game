# Arbeitsweise in diesem Repo

## Branches
- Alle Änderungen immer im Branch `dev` umsetzen, committen und nach `origin/dev` pushen.
- Niemals direkt auf `main` committen oder pushen – außer beim Release (siehe unten).
- Keine eigenen Feature-Branches anlegen, sofern nicht ausdrücklich gewünscht.

## Release (nur auf ausdrücklichen Befehl „Release“)
1. Versionsnummer inkrementieren (Minor, z. B. 0.6.0 → 0.7.0; Patch nur wenn gewünscht) an allen Stellen:
   - `index.html`: Untertitel „Version x.y.z“ und alle `?v=x.y.z` an den `<script src=…>`
   - `gba/include/gen_version.h`: `BG_VERSION`
2. Commit „Version x.y.z“ auf `dev`, pushen.
3. `dev` in `main` mergen (Merge-Commit „Release x.y.z: <kurze Zusammenfassung>“ mit Stichpunkten der Änderungen) und `main` pushen.
