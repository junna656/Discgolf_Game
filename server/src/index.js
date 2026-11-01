// Boogie Garanten – Multiplayer-Server
// Ein Raum (Durable Object) pro 4-stelligem Code. Bis zu 4 Geräte. Der Server merkt sich
// Mitglieder, Gastgeber, die Startnachricht und den letzten Spielstand und leitet alle
// Spielnachrichten an die anderen weiter. Gerechnet wird auf den Geräten.

const MAX = 4;
const CODE = /^[A-Z]{4}$/;
const LEBENSDAUER = 6 * 3600 * 1000; // Raum verfällt 6 h nach der letzten Nachricht

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const herkunft = req.headers.get("Origin") || "";
    const erlaubt = (env.ERLAUBT || "").split(",").map(s => s.trim()).filter(Boolean);
    if (herkunft && erlaubt.length && !erlaubt.includes(herkunft)) return new Response("Herkunft nicht erlaubt", { status: 403 });

    if (url.pathname === "/" || url.pathname === "/status") return new Response("Boogie Garanten Multiplayer läuft", { headers: { "content-type": "text/plain; charset=utf-8" } });

    const m = url.pathname.match(/^\/raum\/([A-Za-z]{4})$/);
    if (!m) return new Response("Nicht gefunden", { status: 404 });
    if (req.headers.get("Upgrade") !== "websocket") return new Response("WebSocket erwartet", { status: 426 });
    const code = m[1].toUpperCase();
    return env.RAUM.get(env.RAUM.idFromName(code)).fetch(req);
  },
};

export class Raum {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async daten() {
    if (!this._d) this._d = (await this.ctx.storage.get("raum")) || null;
    return this._d;
  }
  async speichere(d) {
    this._d = d;
    await this.ctx.storage.put("raum", d);
    await this.ctx.storage.setAlarm(Date.now() + LEBENSDAUER);
  }

  async fetch(req) {
    const url = new URL(req.url);
    const code = url.pathname.slice(-4).toUpperCase();
    const id = (url.searchParams.get("id") || "").slice(0, 40);
    const name = (url.searchParams.get("name") || "Gast").slice(0, 20);
    const neu = url.searchParams.get("neu") === "1";
    if (!/^[A-Za-z0-9_-]{6,40}$/.test(id) || !CODE.test(code)) return new Response("Ungültig", { status: 400 });

    const paar = new WebSocketPair();
    const [client, server] = Object.values(paar);
    this.ctx.acceptWebSocket(server, [id]);

    let d = await this.daten();
    const fehler = text => { server.send(JSON.stringify({ typ: "fehler", text })); server.close(4000, text); return new Response(null, { status: 101, webSocket: client }); };

    if (neu) {
      if (d && d.mitglieder.some(x => this.online(x.id))) return fehler("belegt");
      d = { code, host: id, mitglieder: [], start: null, stand: null };
    } else if (!d) {
      return fehler("Raum nicht gefunden");
    }
    let mitglied = d.mitglieder.find(x => x.id === id);
    if (!mitglied) {
      if (d.mitglieder.length >= MAX) return fehler("Raum ist voll (4 Spieler)");
      if (d.start && !d.start.offen) return fehler("Spiel läuft schon");
      mitglied = { id, name, platz: null };
      d.mitglieder.push(mitglied);
    } else mitglied.name = name;
    // Gastgeber weg? Dann übernimmt dieses Gerät
    if (!d.mitglieder.some(x => x.id === d.host) || !this.online(d.host, server)) {
      if (!this.online(d.host, server)) d.host = id;
    }
    await this.speichere(d);
    this.sendeRaum(d);
    return new Response(null, { status: 101, webSocket: client });
  }

  // ist das Gerät verbunden? (ohne den gerade neuen Socket)
  online(id, ausser) {
    return this.ctx.getWebSockets(id).some(ws => ws !== ausser && ws.readyState === 1);
  }

  sendeRaum(d) {
    const msg = JSON.stringify({
      typ: "raum", code: d.code, host: d.host,
      mitglieder: d.mitglieder.map(x => ({ ...x, online: this.ctx.getWebSockets(x.id).length > 0 })),
      start: d.start, stand: d.stand,
    });
    for (const ws of this.ctx.getWebSockets()) { try { ws.send(msg); } catch (e) { /* weg */ } }
  }

  async webSocketMessage(ws, roh) {
    if (typeof roh !== "string" || roh.length > 200000) return;
    let m;
    try { m = JSON.parse(roh); } catch (e) { return; }
    const [id] = this.ctx.getTags(ws);
    const d = await this.daten();
    if (!d) return;
    const ich = d.mitglieder.find(x => x.id === id);
    if (!ich) return;

    if (m.typ === "ping") { ws.send('{"typ":"pong"}'); return; }
    if (m.typ === "platz") {
      // Spielfigur wählen (oder freigeben); jede Figur nur einmal
      const p = typeof m.platz === "string" ? m.platz.slice(0, 20) : null;
      if (p && d.mitglieder.some(x => x.platz === p && x.id !== id)) return;
      ich.platz = p;
      ich.tasche = p && Array.isArray(m.tasche) ? m.tasche.slice(0, 30) : null;
      ich.lieblingsscheibe = p && typeof m.lieblingsscheibe === "string" ? m.lieblingsscheibe.slice(0, 30) : null;
      await this.speichere(d); this.sendeRaum(d); return;
    }
    if (m.typ === "raus") {
      d.mitglieder = d.mitglieder.filter(x => x.id !== id);
      if (d.host === id && d.mitglieder.length) d.host = d.mitglieder[0].id;
      await this.speichere(d); this.sendeRaum(d);
      try { ws.close(1000, "raus"); } catch (e) { /* egal */ }
      return;
    }
    if (m.typ === "start" || m.typ === "lobby") {
      if (id !== d.host) return;
      d.start = m.typ === "start" ? m.start : null;
      d.stand = null;
      await this.speichere(d); this.sendeRaum(d); return;
    }
    // Spielnachricht: an alle anderen weiterreichen; Spielstand mitschreiben
    if (m.stand) { d.stand = m.stand; await this.speichere(d); }
    m.von = id;
    const text = JSON.stringify(m);
    for (const andere of this.ctx.getWebSockets()) if (andere !== ws) { try { andere.send(text); } catch (e) { /* weg */ } }
  }

  async webSocketClose(ws) {
    const d = await this.daten();
    if (!d) return;
    const [id] = this.ctx.getTags(ws);
    if (d.host === id && !this.online(id, ws)) {
      const neuerHost = d.mitglieder.find(x => x.id !== id && this.online(x.id, ws));
      if (neuerHost) { d.host = neuerHost.id; await this.speichere(d); }
    }
    this.sendeRaumOhne(d, ws);
  }
  async webSocketError(ws) { await this.webSocketClose(ws); }

  sendeRaumOhne(d, weg) {
    const msg = JSON.stringify({
      typ: "raum", code: d.code, host: d.host,
      mitglieder: d.mitglieder.map(x => ({ ...x, online: this.ctx.getWebSockets(x.id).some(w => w !== weg) })),
      start: d.start, stand: d.stand,
    });
    for (const ws of this.ctx.getWebSockets()) if (ws !== weg) { try { ws.send(msg); } catch (e) { /* weg */ } }
  }

  async alarm() {
    await this.ctx.storage.deleteAll();
    this._d = null;
  }
}
