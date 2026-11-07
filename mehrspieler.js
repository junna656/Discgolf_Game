// ---------- Online-Multiplayer ----------
// Bis zu vier Geräte spielen live eine Runde. Ein kleiner Cloudflare-Server (server/) verwaltet
// Räume mit 4-Buchstaben-Code und reicht Nachrichten weiter. Gerechnet wird auf den Geräten:
// wer wirft, berechnet den Flug und schickt das Ergebnis an alle; der Wind kommt aus einem
// gemeinsamen Startwert. Computer-Spieler (und Spieler ohne Verbindung) rechnet der Gastgeber.

// Adresse des Servers (wird nach dem ersten Deploy eingetragen)
const MP_SERVER_STANDARD = "wss://boogie-garanten-mp.boogiegaranten.workers.dev";

function mpServer() {
  // zum Testen: ?server=ws://localhost:8787 (nur lokale Adressen oder workers.dev)
  try {
    const u = new URLSearchParams(location.search).get("server");
    if (u && /^(wss:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev|ws:\/\/(localhost|127\.0\.0\.1):\d+)$/.test(u)) return u;
  } catch (e) { /* egal */ }
  return MP_SERVER_STANDARD;
}

function mpGeraet() {
  let id = "";
  try { id = localStorage.getItem("discgolf-geraet") || ""; } catch (e) { /* egal */ }
  if (!/^[A-Za-z0-9]{12,40}$/.test(id)) {
    const z = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    id = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => z[b % z.length]).join("");
    try { localStorage.setItem("discgolf-geraet", id); } catch (e) { /* egal */ }
  }
  return id;
}
const MP_ICH = mpGeraet();

function mpNeuerCode() {
  const z = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // ohne I und O
  return Array.from(crypto.getRandomValues(new Uint8Array(4)), b => z[b % z.length]).join("");
}

// ---------- Verbindung ----------
function mpVerbinde(code, neu) {
  const server = mpServer();
  if (!server) { mpStatus("Der Online-Server ist noch nicht eingerichtet."); return; }
  const name = (el("mp-name").value || "").trim() || "Gast";
  try { localStorage.setItem("discgolf-name", name); } catch (e) { /* egal */ }
  if (online && online.ws) { online.beendet = true; try { online.ws.close(); } catch (e) { /* egal */ } }
  online = { ich: MP_ICH, code, name, neu, raum: null, laufend: null, start: null, durchgang: 0, versuche: 0, beendet: false, ki: {}, kiLauf: "", zug: 0 };
  mpOeffne();
}

function mpOeffne() {
  const o = online;
  if (!o || o.beendet) return;
  mpStatus(o.versuche ? "Verbindung verloren – verbinde neu …" : "Verbinde …");
  const url = `${mpServer()}/raum/${o.code}?id=${encodeURIComponent(o.ich)}&name=${encodeURIComponent(o.name)}${o.neu ? "&neu=1" : ""}`;
  let ws;
  try { ws = new WebSocket(url); } catch (e) { mpStatus("Keine Verbindung zum Server."); return; }
  o.ws = ws;
  ws.onopen = () => { o.versuche = 0; o.neu = false; mpStatus(""); };
  ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (err) { return; } mpNachricht(m); };
  ws.onclose = () => {
    if (online !== o || o.beendet) return;
    o.versuche++;
    if (o.versuche > 12) { mpStatus("Keine Verbindung. Bitte später nochmal beitreten."); return; }
    setTimeout(mpOeffne, Math.min(8000, 500 * 2 ** o.versuche));
  };
}

function mpSende(m) {
  if (online && online.ws && online.ws.readyState === 1) online.ws.send(JSON.stringify(m));
}
setInterval(() => mpSende({ typ: "ping" }), 25000);

function mpStatus(t) { el("mp-status").textContent = t || ""; }
const mpIchHost = () => !!(online && online.raum && online.raum.host === online.ich);
const mpMitglied = id => online && online.raum ? online.raum.mitglieder.find(x => x.id === id) : null;

// ---------- Nachrichten ----------
function mpNachricht(m) {
  const o = online;
  if (!o) return;
  if (m.typ === "pong") return;
  if (m.typ === "fehler") {
    if (m.text === "belegt" && o.neu) { o.code = mpNeuerCode(); mpOeffne(); return; }
    o.beendet = true;
    try { sessionStorage.removeItem("discgolf-raum"); } catch (e) { /* egal */ }
    online = null;
    mpZeigeEinstieg();
    mpStatus(m.text === "Raum nicht gefunden" ? "Diesen Raum gibt es nicht (mehr). Code prüfen?" : m.text);
    return;
  }
  if (m.typ === "raum") {
    const vorher = o.raum;
    o.raum = m;
    o.code = m.code;
    try { sessionStorage.setItem("discgolf-raum", m.code); } catch (e) { /* egal */ }
    if (m.start && o.laufend !== m.start.seed) { mpStarteSpiel(m.start, m.stand); return; }
    if (!m.start && o.laufend) { mpZurLobby(); return; }
    if (!o.laufend) mpZeigeLobby();
    else mpKiAnstoss(vorher);
    return;
  }
  if (!o.laufend || modus !== "online" || !spieler) return;
  if (m.typ === "wurf") {
    spielNr++; // offene Zeitschalter (z. B. "nächster") verwerfen – der Stand kommt mit
    mpWendeAn(m.vorher);
    aktiv = m.aktiv;
    const s = ich();
    s.scheibe = m.scheibe; s.wurfart = m.wurfart;
    winkel = m.winkel; ziel = m.ziel; puttModus = false; putt = null;
    s.wuerfe++; online.zug++;
    flug = { erg: m.erg, t0: uhr, kraftAngezeigt: m.kraft, verzogen: m.verzogen, start: { x: s.lie.x, y: s.lie.y }, lokal: false };
    zustand = "flug";
    sfx.wurf();
    aktualisierePanel();
  } else if (m.typ === "putt") {
    spielNr++;
    mpWendeAn(m.vorher);
    aktiv = m.aktiv;
    const s = ich();
    puttModus = true; puttStil = m.puttStil; flug = null;
    s.scheibe = Math.max(0, s.tasche.indexOf(putter(s)));
    s.wuerfe++; online.zug++;
    putt = { t0: uhr, flug: { t0: uhr, o: m.o, ergebnis: m.ergebnis, lie: m.lie, lokal: false } };
    zustand = "puttflug";
    sfx.wurf();
    aktualisierePanel();
  } else if (m.typ === "weiter") {
    spielNr++;
    mpWendeAn(m.vorher);
    weiter();
  } else if (m.typ === "stand") {
    // jemand ist weiter als wir (z. B. nach dem Neuladen mitten im Flug): übernehmen
    if (m.stand && m.stand.zug > online.zug) { spielNr++; mpWendeAn(m.stand); flug = null; putt = null; naechster(); }
  } else if (m.typ === "springe") {
    springeZu(m.i);
  } else if (m.typ === "ziel") {
    // Zielvorschau: die anderen sehen, wohin gerade gezielt wird
    if (m.aktiv === aktiv && (zustand === "zielen" || zustand === "laden") && fernAmZug()) {
      ziel = m.ziel; winkel = m.winkel;
      const s = ich();
      if (s.scheibe !== m.scheibe || s.wurfart !== m.wurfart) { s.scheibe = m.scheibe; s.wurfart = m.wurfart; aktualisierePanel(); }
    }
  }
}

// eigene Zielrichtung regelmäßig an die anderen
let mpLetztesZiel = "";
setInterval(() => {
  if (!online || !online.laufend || modus !== "online" || !spieler || gesperrt()) return;
  if (zustand !== "zielen" && zustand !== "laden") return;
  const s = ich(), k = [aktiv, ziel.toFixed(3), winkel, s.scheibe, s.wurfart].join("|");
  if (k === mpLetztesZiel) return;
  mpLetztesZiel = k;
  mpSende({ typ: "ziel", aktiv, ziel, winkel, scheibe: s.scheibe, wurfart: s.wurfart });
}, 250);

// ---------- Spielstand ----------
function mpSchnappschuss() {
  return {
    rundenIndex, durchgang: online ? online.durchgang : 0, zug: online ? online.zug : 0,
    reihenfolge: spieler.map(s => s.name),
    spieler: spieler.map(s => ({ name: s.name, lie: { x: s.lie.x, y: s.lie.y }, wuerfe: s.wuerfe, fertig: s.fertig, mandoOk: !!s.mandoOk, karte: [...s.karte], scheibe: s.scheibe, wurfart: s.wurfart })),
  };
}

function mpWendeAn(st) {
  if (!st) return;
  if (typeof st.zug === "number") online.zug = st.zug;
  if (st.rundenIndex !== rundenIndex || st.durchgang !== online.durchgang || bahn !== runde[st.rundenIndex]) {
    rundenIndex = st.rundenIndex;
    online.durchgang = st.durchgang;
    setzeBahn(runde[rundenIndex]);
    const zz = mpWindZufall(), stk = 1 + zz() * 5, ri = zz() * Math.PI * 2;
    wind = { x: Math.cos(ri) * stk, y: Math.sin(ri) * stk };
    marken = []; kamera = null; banner = null; fertigText = null;
  }
  const nachName = Object.fromEntries(spieler.map(s => [s.name, s]));
  spieler = st.reihenfolge.map(n => nachName[n]).filter(Boolean);
  for (const d of st.spieler) {
    const s = nachName[d.name];
    if (!s) continue;
    s.lie = { x: d.lie.x, y: d.lie.y }; s.wuerfe = d.wuerfe; s.fertig = d.fertig; s.mandoOk = d.mandoOk;
    s.karte = [...d.karte]; s.scheibe = d.scheibe; s.wurfart = d.wurfart;
  }
}

// gleicher Wind auf allen Geräten: aus Startwert, Durchgang und Bahn
function mpWindZufall() {
  let a = ((online.start.seed >>> 0) ^ Math.imul(online.durchgang + 1, 0x9E3779B1) ^ Math.imul(rundenIndex + 1, 0x85EBCA77)) >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mpSpieler() {
  online.durchgang++;
  return online.start.teilnehmer.map(t => {
    const sp = SPIELER.find(x => x.name === t.name) || SPIELER[0];
    return {
      name: sp.name, farbe: sp.farbe, hand: sp.hand || "rechts",
      tasche: Array.isArray(t.tasche) && t.tasche.length ? t.tasche : sp.tasche,
      wurfart: sp.wurfart || "rueckhand",
      lieblingswurf: sp.wurfart || "rueckhand",
      ruf: sp.ruf || "",
      staerken: sp.staerken || {},
      lieblingsscheibe: t.lieblingsscheibe ?? ((sp.karte || {}).lieblingsscheibe || ""),
      aussehen: sp.aussehen,
      steuerung: "mensch", besitzer: t.besitzer || null, ki: t.ki || null,
      karte: [], bester: 0,
    };
  });
}

// Computer rechnet nur der Gastgeber: für Computer-Spieler und für Spieler ohne Verbindung
function mpKiFuer(s) {
  if (!online || !online.laufend || !mpIchHost()) return false;
  if (s.ki) return true;
  const m = mpMitglied(s.besitzer);
  return !m || !m.online;
}
const mpKiStufe = s => s.ki || "solide";
// pro Zug nur einmal planen (Zug = Bahn, Spieler, Wurfzahl)
function mpKiDarf() {
  const k = [online.durchgang, rundenIndex, aktiv, ich().wuerfe, zustand].join("|");
  if (online.kiLauf === k) return false;
  online.kiLauf = k;
  return true;
}
function mpKiAnstoss() {
  // ist jemand weggefallen, während er dran war, übernimmt der Gastgeber
  if (kiAmZug() && (zustand === "zielen" || zustand === "putt")) spaeter(kiZug, 900);
  aktualisierePanel();
}

// ---------- Spiel starten / Lobby ----------
function mpStarteSpiel(start, stand) {
  modus = "online";
  online.start = start;
  online.laufend = start.seed;
  online.durchgang = 0;
  online.kiLauf = "";
  online.zug = 0;
  kurs = KURSE.find(k => k.id === start.kurs) || KURSE[0];
  runde = kurs.bahnen;
  startIndex = start.wahl ? start.wahl - 1 : 0;
  nurEine = !!start.wahl;
  el("menue").hidden = true;
  zeigeAnsicht("feld");
  weckeSprache();
  neuesSpiel();
  if (stand) { spielNr++; mpWendeAn(stand); naechster(); }
}

function mpZurLobby() {
  spielNr++;
  online.laufend = null;
  online.start = null;
  zustand = "ende";
  zeigeMenue();
  el("menue-start").hidden = true;
  el("menue-online").hidden = false;
  mpZeigeLobby();
}

// Hauptmenü während eines Online-Spiels
function mpMenue() {
  if (mpIchHost()) {
    if (confirm("Spiel für alle beenden und zurück in die Lobby?")) mpSende({ typ: "lobby" });
  } else if (confirm("Online-Spiel verlassen?")) mpVerlassen();
}

function mpVerlassen() {
  if (online) {
    mpSende({ typ: "raus" });
    online.beendet = true;
    try { online.ws.close(); } catch (e) { /* egal */ }
  }
  online = null;
  try { sessionStorage.removeItem("discgolf-raum"); } catch (e) { /* egal */ }
  if (modus === "online") { modus = "vierer"; spielNr++; zustand = "ende"; }
  zeigeMenue();
}

// ---------- Menü ----------
const MP_KI = [["", "Aus"], ["locker", "Locker"], ["solide", "Solide"], ["profi", "Profi"]];

function mpZeigeMenue() {
  zeigeMenue();
  el("menue-start").hidden = true;
  el("menue-online").hidden = false;
  try { el("mp-name").value = localStorage.getItem("discgolf-name") || ""; } catch (e) { /* egal */ }
  if (online && online.raum) mpZeigeLobby(); else mpZeigeEinstieg();
  if (!mpServer()) mpStatus("Der Online-Server ist noch nicht eingerichtet.");
  el("menue").scrollTop = 0;
}

function mpZeigeEinstieg() {
  el("mp-einstieg").hidden = false;
  el("mp-lobby").hidden = true;
  el("mp-raus").textContent = "← Zurück";
}

function mpZeigeLobby() {
  const o = online;
  if (!o || !o.raum) return;
  const r = o.raum, host = mpIchHost(), ich = mpMitglied(o.ich);
  el("mp-einstieg").hidden = true;
  el("mp-lobby").hidden = false;
  el("mp-raus").textContent = "Raum verlassen";
  el("mp-raumcode").textContent = r.code;
  el("mp-mitglieder").innerHTML = r.mitglieder.map(m => `
    <div class="klein" style="display:flex;justify-content:space-between;gap:8px;border:2px solid var(--rand);padding:6px 8px;background:#1a2029">
      <span><span style="color:${m.online ? "#7cd86a" : "#8a93a0"}">●</span> ${mpText(m.name)}${m.id === o.ich ? " (du)" : ""}${m.id === r.host ? " · Gastgeber" : ""}</span>
      <span>${m.platz ? mpText(m.platz) : "wählt …"}</span>
    </div>`).join("");
  el("mp-figuren").innerHTML = SPIELER.map((sp, i) => {
    const besitzer = r.mitglieder.find(m => m.platz === sp.name), meins = besitzer && besitzer.id === o.ich;
    let knoepfe = "";
    if (meins) knoepfe = `<button data-mp-frei="1" class="an">Du spielst ${sp.name}</button>`;
    else if (!besitzer) knoepfe = `<button data-mp-platz="${i}">Ich spiele ${sp.name}</button>`;
    else knoepfe = `<span class="klein">spielt ${mpText(besitzer.name)}</span>`;
    const ki = !besitzer && host ? `<div class="vwahl">${MP_KI.map(([k, t]) => `<button data-mp-ki="${i}" data-k="${k}" class="${(o.ki[sp.name] || "") === k ? "an" : ""}">${t}</button>`).join("")}</div>` : "";
    return `<div class="vzeile" style="--farbe:${sp.farbe}"><canvas class="mini" width="32" height="32"></canvas>
      <span class="vname">${sp.name}</span>
      <div class="liste" style="gap:4px">${knoepfe}${ki ? `<span class="klein">sonst Computer:</span>${ki}` : ""}</div></div>`;
  }).join("");
  document.querySelectorAll("#mp-figuren canvas.mini").forEach((c, i) => zeichnePortrait(c.getContext("2d"), SPIELER[i]));
  el("mp-hostbox").hidden = !host;
  el("mp-warte").hidden = host;
  if (host) {
    el("mp-kurs").innerHTML = KURSE.map((k, i) => `<option value="${i}" ${k === kurs ? "selected" : ""}>${mpText(k.name)}</option>`).join("");
    const alt = el("mp-runde").value;
    el("mp-runde").innerHTML = `<option value="0">Ganze Runde (${kurs.bahnen.length} ${kurs.bahnen.length === 1 ? "Bahn" : "Bahnen"})</option>` +
      (kurs.woche ? "" : kurs.bahnen.map((b, i) => `<option value="${i + 1}">Nur Bahn ${b.nummer}</option>`).join(""));
    if (alt && [...el("mp-runde").options].some(o => o.value === alt)) el("mp-runde").value = alt;
    const alleGewaehlt = r.mitglieder.every(m => m.platz), anzahl = mpTeilnehmer().length;
    el("mp-start").disabled = !alleGewaehlt || !anzahl || !(ich && ich.platz);
    el("mp-start").textContent = !(ich && ich.platz) ? "Erst eine Figur wählen" : !alleGewaehlt ? "Warten, bis alle gewählt haben" : `Spiel starten (${anzahl} Spieler)`;
  }
}

const mpText = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function mpTeilnehmer() {
  const r = online.raum;
  return SPIELER.map(sp => {
    const m = r.mitglieder.find(x => x.platz === sp.name);
    if (m) return { name: sp.name, besitzer: m.id, tasche: m.tasche || null, lieblingsscheibe: m.lieblingsscheibe ?? null };
    if (online.ki[sp.name]) return { name: sp.name, ki: online.ki[sp.name] };
    return null;
  }).filter(Boolean);
}

el("zu-online").addEventListener("click", () => { weckeSprache(); mpZeigeMenue(); });
el("mp-neu").addEventListener("click", () => { weckeSprache(); mpVerbinde(mpNeuerCode(), true); });
el("mp-beitreten").addEventListener("click", () => {
  const code = el("mp-code").value.trim().toUpperCase();
  if (!/^[A-Z]{4}$/.test(code)) { mpStatus("Der Code hat vier Buchstaben."); return; }
  weckeSprache();
  mpVerbinde(code, false);
});
el("mp-code").addEventListener("input", e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4); });
el("mp-raus").addEventListener("click", () => {
  if (online) mpVerlassen();
  else { el("menue-online").hidden = true; el("menue-start").hidden = false; mpStatus(""); }
});
el("mp-figuren").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b || !online) return;
  if (b.dataset.mpPlatz !== undefined) {
    const sp = SPIELER[+b.dataset.mpPlatz];
    mpSende({ typ: "platz", platz: sp.name, tasche: sp.tasche, lieblingsscheibe: (sp.karte || {}).lieblingsscheibe || "" });
  } else if (b.dataset.mpFrei) mpSende({ typ: "platz", platz: null });
  else if (b.dataset.mpKi !== undefined) {
    online.ki[SPIELER[+b.dataset.mpKi].name] = b.dataset.k;
    mpZeigeLobby();
  }
});
el("mp-kurs").addEventListener("change", e => {
  kurs = KURSE[+e.target.value] || KURSE[0];
  try { localStorage.setItem("discgolf-kurs", kurs.id); } catch (err) { /* egal */ }
  el("mp-runde").value = "0";
  zeigeKurse();
  mpZeigeLobby();
});
el("mp-start").addEventListener("click", () => {
  if (!mpIchHost()) return;
  const wahl = +el("mp-runde").value || 0;
  const start = { seed: crypto.getRandomValues(new Uint32Array(1))[0], kurs: kurs.id, wahl, teilnehmer: mpTeilnehmer() };
  mpSende({ typ: "start", start });
});

// nach dem Neuladen automatisch wieder in den Raum
(function () {
  let code = "";
  try { code = sessionStorage.getItem("discgolf-raum") || ""; } catch (e) { /* egal */ }
  if (/^[A-Z]{4}$/.test(code) && mpServer()) {
    mpZeigeMenue();
    mpVerbinde(code, false);
  }
})();
