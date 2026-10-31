// Flugmodell: Flugzahlen (Speed/Glide/Turn/Fade), Abwurfwinkel, Wind und Streuung
(function (g) {
  "use strict";
  const DEG = Math.PI / 180;

  function gauss() {
    let u = 0, v = 0;
    while (!u) u = Math.random();
    while (!v) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // Stellschrauben für die Entwicklung (im Spiel unter "Einstellungen" änderbar)
  const STANDARD = { winkel: 1.6, turn: 1.5, fade: 1.5, weite: 1, streuung: 1, wind: 1, tempo: 0.55, kick: 1, zoomStufe: 3 };
  const E = Object.assign({}, STANDARD);
  const abstand = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  function imRechteck(p, r) {
    return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  }

  // Liegt p auf der Bowlingbahn (Rechteck entlang einer Strecke)?
  function aufBowlingbahn(p, bahn) {
    const l = bahn.bowlingbahn;
    if (!l) return false;
    const dx = l.x2 - l.x1, dy = l.y2 - l.y1, len2 = dx * dx + dy * dy;
    const t = ((p.x - l.x1) * dx + (p.y - l.y1) * dy) / len2;
    if (t < 0 || t > 1.03) return false;
    const qx = l.x1 + t * dx, qy = l.y1 + t * dy;
    return Math.hypot(p.x - qx, p.y - qy) <= l.breite / 2;
  }

  function imPolygon(p, poly) {
    let drin = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > p.y) !== (yj > p.y) && p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi) drin = !drin;
    }
    return drin;
  }

  // Seite einer Linie: Vorzeichen bezogen auf das nächstgelegene Linienstück
  function seiteVonLinie(p, linie) {
    let best = Infinity, seite = 0;
    for (let i = 0; i < linie.length - 1; i++) {
      const [ax, ay] = linie[i], [bx, by] = linie[i + 1], dx = bx - ax, dy = by - ay;
      const t = clamp(((p.x - ax) * dx + (p.y - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
      const d = Math.hypot(p.x - ax - t * dx, p.y - ay - t * dy);
      // jenseits der Linienenden gilt die Linie nicht (kein endloses Verlängern)
      const amEnde = (i === 0 && t === 0) || (i === linie.length - 2 && t === 1);
      if (d < best) { best = d; seite = amEnde ? null : Math.sign(dx * (p.y - ay) - dy * (p.x - ax)); }
    }
    return seite;
  }

  // OB-Zonen: Rechteck {x, y, w, h}, Polygon {punkte: [[x, y], ...]} oder Grenzlinie {linie, innen}
  function obZone(p, bahn) {
    return (bahn.ob || []).find(o => {
      if (o.insel) return p.x >= o.ab && !imPolygon(p, o.insel);
      if (!o.linie) return o.punkte ? imPolygon(p, o.punkte) : imRechteck(p, o);
      const sp = seiteVonLinie(p, o.linie);
      o._innen ??= seiteVonLinie({ x: o.innen[0], y: o.innen[1] }, o.linie);
      return sp !== null && o._innen !== null && sp !== o._innen;
    }) || null;
  }

  function istOB(p, bahn) {
    if (p.x < 0 || p.y < 0 || p.x > bahn.welt.breite || p.y > bahn.welt.hoehe) return true;
    return !!obZone(p, bahn);
  }

  // Je mehr Kraft, desto stärker die Streuung von Richtung, Kraft und Winkel
  // (Vorhand streut etwas mehr)
  function streue(wurf) {
    const p = wurf.kraft, vh = wurf.wurfart === "vorhand" ? 1.2 : 1, st = E.streuung;
    return Object.assign({}, wurf, {
      richtung: wurf.richtung + gauss() * (0.8 + 7 * Math.pow(p, 2.5)) * vh * st * DEG,
      kraft: clamp(p * (1 + gauss() * (0.02 + 0.05 * p) * st), 0.05, 1.08),
      winkel: wurf.winkel + gauss() * (1 + 6 * p * p) * st,
    });
  }

  // Ungefähre Weite bei voller Kraft, flach und ohne Wind (gleiche Formel wie in simuliere)
  function reichweite(s) {
    return (30 + s.speed * 6.5 + s.glide * 2) * E.weite;
  }

  // wurf: {x, y, richtung (rad), kraft 0..1, winkel (Grad, + = Hyzer, - = Anhyzer), scheibe, hand, wurfart}
  // wind: {x, y} in m/s (Richtung, in die der Wind weht)
  function simuliere(bahn, wurf, wind) {
    const s = wurf.scheibe, kraft = wurf.kraft, winkel = wurf.winkel;
    wind = { x: wind.x * E.wind, y: wind.y * E.wind };
    // Linkshänder und Vorhand spiegeln die Kurven (beides zusammen hebt sich auf)
    const seite = (wurf.hand === "links" ? -1 : 1) * (wurf.wurfart === "vorhand" ? -1 : 1);
    const gegen = -(wind.x * Math.cos(wurf.richtung) + wind.y * Math.sin(wurf.richtung)); // Gegenwind > 0

    let D = reichweite(s) / E.weite * (0.25 + 0.75 * kraft);
    D *= 1 - Math.min(Math.abs(winkel), 40) / 40 * 0.12;
    if (wurf.wurfart === "vorhand") D *= 0.9;
    D *= E.weite;
    D *= clamp(1 - 0.03 * gegen, 0.7, 1.15);

    // Gegenwind macht Scheiben instabiler (mehr Turn), Rückenwind stabiler
    // Gesamte Richtungsänderung (rad) durch Turn, Fade und Abwurfwinkel
    const turnK = -s.turn * 0.2 * (0.3 + kraft) * clamp(1 + 0.15 * gegen, 0.3, 2) * E.turn;
    const fadeK = s.fade * 2.2 * (1.2 - 0.4 * kraft) * clamp(1 + 0.08 * gegen, 0.5, 1.6) * E.fade;
    const winkK = -winkel * DEG * 1.2 * E.winkel;
    // Fade-Haken: am Ende rutscht die langsame Scheibe seitlich weg (Meter, nach links bei RHBH)
    const haken = s.fade * D * 0.03 * E.fade * (1.2 - 0.4 * kraft) / 0.8 * clamp(1 + 0.08 * gegen, 0.5, 1.6);
    const H = 1.5 + 6 * kraft * (1 - winkel / 80);
    const T = 1.2 + 2.6 * kraft + 0.15 * s.glide;
    const N = 160;
    const f = u => 2 * u - u * u; // zurückgelegter Anteil bei linearer Abbremsung

    const pfad = [{ x: wurf.x, y: wurf.y, z: 1.3, t: 0 }];
    let px = wurf.x, py = wurf.y, th = wurf.richtung, z = 1.3, u = 0;
    let ereignis = null;
    const gepruefteBaeume = new Set();

    flug: for (let i = 1; i <= N; i++) {
      const u0 = (i - 1) / N;
      u = i / N;
      const ds = D * (f(u) - f(u0));
      const wT = u < 0.75 ? Math.sin(Math.PI * u / 0.75) : 0;
      const wF = u > 0.45 ? Math.pow((u - 0.45) / 0.55, 1.5) : 0;
      th += seite * (turnK * wT - fadeK * wF + winkK * (1 - 0.5 * u)) / N;
      // höchstens 80° von der Abwurfrichtung weg: die Scheibe fliegt nie rückwärts
      th = wurf.richtung + clamp(th - wurf.richtung, -80 * DEG, 80 * DEG);
      const qx = -Math.sin(th), qy = Math.cos(th);
      const quer = wind.x * qx + wind.y * qy;
      // Fade-Haken quer zur Abwurfrichtung (nie nach hinten); wF wächst, je langsamer die Scheibe wird
      const hs = seite * haken * wF / (0.22 * N); // Summe aller wF ≈ 0,22·N
      px += Math.cos(th) * ds + qx * quer * 0.2 * T / N + Math.sin(wurf.richtung) * hs;
      py += Math.sin(th) * ds + qy * quer * 0.2 * T / N - Math.cos(wurf.richtung) * hs;
      z = 1.3 * (1 - u) + H * Math.sin(Math.PI * u);
      pfad.push({ x: px, y: py, z, t: u * T });

      const p = { x: px, y: py };
      if (abstand(p, wurf) > 5) { // Bäume in den ersten 5 m ab Abwurfpunkt zählen nicht
        for (let b = 0; b < bahn.baeume.length; b++) {
          const baum = bahn.baeume[b];
          if (gepruefteBaeume.has(b)) continue;
          if (abstand(p, baum) < baum.r && z < (baum.h || 9)) {
            gepruefteBaeume.add(b);
            if (Math.random() < 0.65) { ereignis = { typ: "baum", baum }; break flug; }
          }
        }
      }
      if (abstand(p, bahn.korb) < 0.45 && z < 1.7) {
        ereignis = { typ: Math.random() < (u > 0.6 ? 0.8 : 0.35) ? "korb" : "abpraller" };
        break flug;
      }
    }

    let t = pfad[pfad.length - 1].t;
    let drin = false, typ = ereignis ? ereignis.typ : "landung";

    const fallen = (zx, zy, dauer) => {
      const start = pfad[pfad.length - 1], n = 10;
      for (let k = 1; k <= n; k++) {
        const a = k / n;
        pfad.push({ x: start.x + (zx - start.x) * a, y: start.y + (zy - start.y) * a, z: start.z * (1 - a * a), t: t + a * dauer });
      }
      t += dauer;
    };

    if (typ === "korb") {
      fallen(bahn.korb.x, bahn.korb.y, 0.25);
      drin = true;
    } else if (typ === "abpraller") {
      const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 2.5;
      fallen(bahn.korb.x + Math.cos(a) * r, bahn.korb.y + Math.sin(a) * r, 0.5);
    } else if (typ === "baum") {
      // Kick: die Scheibe prallt wie von einer Wand ab (Einfallswinkel = Ausfallswinkel, plus Zufall)
      // und fliegt je nach Restgeschwindigkeit ein paar Meter weg, statt am Stamm liegen zu bleiben
      const b = ereignis.baum, nl = Math.hypot(px - b.x, py - b.y) || 1;
      const nx = (px - b.x) / nl, ny = (py - b.y) / nl;
      const vx = Math.cos(th), vy = Math.sin(th), dot = vx * nx + vy * ny;
      const ab = Math.atan2(vy - 2 * dot * ny, vx - 2 * dot * nx) + gauss() * 0.6;
      let weit = (1 + (1 - u) * D * 0.045) * (0.7 + Math.random() * 0.6) * E.kick;
      // mindestens ein Stück aus der Krone heraus
      const zx = px + Math.cos(ab) * weit, zy = py + Math.sin(ab) * weit;
      const raus = Math.hypot(zx - b.x, zy - b.y) < b.r * 0.8 ? b.r * 0.8 : 0;
      const ex = zx + Math.cos(ab) * raus, ey = zy + Math.sin(ab) * raus;
      const start = pfad[pfad.length - 1], n = 14, dauer = 0.35 + weit * 0.05;
      for (let k = 1; k <= n; k++) {
        const a = k / n;
        // fällt ab und hüpft einmal kurz auf
        const hz = start.z * (1 - a) * (1 - a) + Math.sin(Math.PI * a) * 0.6;
        pfad.push({ x: start.x + (ex - start.x) * a, y: start.y + (ey - start.y) * a, z: Math.max(0, hz), t: t + a * dauer });
      }
      t += dauer;
    } else {
      // Landung, dann Rutschen – auf der Bowlingbahn sehr weit
      const ende = pfad[pfad.length - 1];
      ende.z = 0;
      let dx = Math.cos(th), dy = Math.sin(th);
      const bowling = aufBowlingbahn(ende, bahn);
      let L = (0.5 + D * 0.025) * (0.5 + Math.random()) * (1 - clamp(winkel, -30, 30) / 60);
      if (bowling) {
        const l = bahn.bowlingbahn;
        let ax = l.x2 - l.x1, ay = l.y2 - l.y1;
        const n = Math.hypot(ax, ay);
        ax /= n; ay /= n;
        const vor = Math.sign(ax * dx + ay * dy) || 1;
        dx = ax * vor; dy = ay * vor;
        L = (1 + D * 0.03) * 3 * (0.6 + Math.random() * 0.8);
      }
      const schritte = Math.max(1, Math.round(L / 0.2));
      let sx = ende.x, sy = ende.y;
      for (let k = 1; k <= schritte; k++) {
        const v = 1 - k / schritte;
        sx += dx * L / schritte;
        sy += dy * L / schritte;
        t += 0.015 + 0.05 * (1 - v);
        pfad.push({ x: sx, y: sy, z: 0, t });
        const dk = abstand({ x: sx, y: sy }, bahn.korb);
        if (dk < 0.45) {
          if (aufBowlingbahn({ x: sx, y: sy }, bahn)) { drin = true; typ = "bowling"; pfad.push({ x: bahn.korb.x, y: bahn.korb.y, z: 0, t: t + 0.05 }); }
          break;
        }
        if (istOB({ x: sx, y: sy }, bahn)) break;
      }
    }

    const letzte = pfad[pfad.length - 1];
    let lie = { x: letzte.x, y: letzte.y }, ob = false;
    let obIndex = -1;
    if (!drin && istOB(lie, bahn)) {
      ob = true;
      obIndex = pfad.findIndex(p => istOB(p, bahn)); // hier fliegt die Scheibe ins Aus
      // dort weiterspielen, wo die Scheibe zuletzt im Spiel war
      for (let k = pfad.length - 1; k >= 0; k--) {
        if (!istOB(pfad[k], bahn)) { lie = { x: pfad[k].x, y: pfad[k].y }; break; }
      }
      if (istOB(lie, bahn)) lie = { x: wurf.x, y: wurf.y };
    }
    if (drin) lie = { x: bahn.korb.x, y: bahn.korb.y };

    return { pfad, lie, drin, ob, obIndex, typ, dauer: t, distanz: abstand(lie, wurf) };
  }

  g.Physik = { simuliere, streue, gauss, abstand, istOB, obZone, imPolygon, seiteVonLinie, aufBowlingbahn, DEG, einstellungen: E, STANDARD, reichweite };
})(typeof window !== "undefined" ? window : globalThis);
