// ============================================================
//  WOCHENBAHN: wählt aus WOCHENBAHNEN (wochenbahnen.js) die Bahn dieser Woche
// ============================================================
//  - Live: der jüngste Eintrag mit "ab" <= heute (Montag 0:00 deutsche Zeit schaltet um).
//  - Vorschau (/dev/, lokal): immer der jüngste Eintrag, auch wenn er erst nächste Woche gilt –
//    zum Testen vor dem Wochenwechsel. Ergebnisse landen dann in einer Test-Bestenliste.
//  - Archiv: ?woche=<jahr>-<kw> spielt eine ältere Wochenbahn (ohne Bestenliste), siehe archiv/.
//  Die Wochenbahn ist ein eigener Kurs in KURSE (id "woche-<jahr>-<kw>", eigene Bestenliste).
// ============================================================
"use strict";
(function () {
  const heuteBerlin = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(d); // JJJJ-MM-TT
  const vorschau = /^\/(dev(?:-graphic)?)(\/|$)/.test(location.pathname) || location.protocol === "file:" || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const liste = (window.WOCHENBAHNEN || []).slice().sort((a, b) => a.ab < b.ab ? -1 : a.ab > b.ab ? 1 : 0);
  const heute = heuteBerlin();
  const gueltig = liste.filter(e => e.ab <= heute);
  const kw = e => e.woche.split("-")[1].padStart(2, "0");
  const datum = t => t.split("-").reverse().join(".");

  function kursVon(e, art) {
    const bahn = Object.assign({}, e.bahn, { optik: e.bahn.optik || e.optik });
    return {
      id: (art === "test" ? "test-" : "") + "woche-" + e.woche,
      name: "Wochenbahn KW" + kw(e) + (art === "archiv" ? " (Archiv)" : art === "test" && e.ab > heute ? " (Vorschau)" : ""),
      ort: "Thema " + e.thema + " · ab " + datum(e.ab),
      woche: e.woche, thema: e.thema, ab: e.ab,
      // Archiv: nur zum Spielen, keine Meldung an die Bestenliste
      bestenliste: art !== "archiv",
      bahnen: [bahn],
    };
  }

  let aktuell = vorschau ? liste[liste.length - 1] : gueltig[gueltig.length - 1];
  let art = vorschau ? "test" : "live";
  // aus dem Archiv: ?woche=2026-46
  const gewuenscht = new URLSearchParams(location.search).get("woche");
  const ausArchiv = gewuenscht && liste.find(e => e.woche === gewuenscht && e !== aktuell && (vorschau || e.ab <= heute));
  if (ausArchiv) { aktuell = ausArchiv; art = "archiv"; }

  const kurs = aktuell ? kursVon(aktuell, art) : null;
  if (kurs) {
    window.KURSE.push(kurs);
    const bl = window.BAHNEN, frei = bl.indexOf(window.FREIES_FELD);
    bl.splice(frei < 0 ? bl.length : frei, 0, kurs.bahnen[0]);
  }
  window.WOCHE = { kurs, ausArchiv: !!ausArchiv, vorschau, heute, liste, kursVon };
})();
