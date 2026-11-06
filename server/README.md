# Multiplayer-Server

Cloudflare Worker mit einem Durable Object pro Raum (4-Buchstaben-Code, bis zu 4 Geräte).
Wird per GitHub Action (`.github/workflows/server.yml`) bei Änderungen in `server/` deployt.

Benötigte Repository-Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

Lokal testen: `npx wrangler dev` (Port 8787).

Endpunkte:
- `wss://…/raum/<CODE>` – Online-Raum (WebSocket)
- `GET /bestenliste?kurs=<id>` – ewige Bestenliste eines Kurses
- `POST /bestenliste` mit `{ kurs, name, karte, par, runde }` – Ergebnis einer ganzen Runde melden; pro Person zählt die beste Runde
