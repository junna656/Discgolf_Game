# Multiplayer-Server

Cloudflare Worker mit einem Durable Object pro Raum (4-Buchstaben-Code, bis zu 4 Geräte).
Wird per GitHub Action (`.github/workflows/server.yml`) bei Änderungen in `server/` deployt.

Benötigte Repository-Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

Lokal testen: `npx wrangler dev` (Port 8787).
