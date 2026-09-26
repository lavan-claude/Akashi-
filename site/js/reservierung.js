// Reservierungsanfrage: Prüfung im Browser und Versand an die Serverfunktion
// /api/reservierung, die sie an den n8n-Workflow weiterreicht.
// Ohne JavaScript schickt das Formular klassisch ab und landet auf /danke.html.

(function () {
  "use strict";

  // Öffnungszeiten je Wochentag, 0 = Sonntag. Leere Liste = geschlossen.
  // Muss zu OEFFNUNGSZEITEN in netlify/functions/reservierung.mjs passen.
  // Stand: Angaben des Restaurants, September 2026.
  const OEFFNUNGSZEITEN = {
    0: [],
    1: [["12:00", "14:30"], ["17:00", "21:00"]],
    2: [["12:00", "14:30"], ["17:00", "21:00"]],
    3: [["12:00", "14:30"], ["17:00", "21:00"]],
    4: [["12:00", "14:30"], ["17:00", "21:00"]],
    5: [["12:00", "14:30"], ["17:00", "21:30"]],
    6: [["17:00", "21:30"]],
  };

  const EINSTELLUNGEN = {
    // Wie weit im Voraus reserviert werden kann.
    maxTageImVoraus: 90,
    // Heute nur Uhrzeiten, die mindestens so viele Minuten in der Zukunft liegen.
    vorlaufMinuten: 60,
    // Letzte Reservierung so viele Minuten vor Schluss.
    letzteVorSchlussMinuten: 60,
    // Abstand der wählbaren Uhrzeiten.
    rasterMinuten: 30,
    telefon: "0421 43093028",
    telefonLink: "tel:+4942143093028",
  };

  const form = document.getElementById("reservierung");
  if (!form) return;

  const datum = form.elements.namedItem("datum");
  const uhrzeit = form.elements.namedItem("uhrzeit");
  const knopf = form.querySelector('button[type="submit"]');
  const status = document.getElementById("formular-status");
  const bestaetigung = document.getElementById("bestaetigung");
  const bestaetigungText = document.getElementById("bestaetigung-text");
  const gruppenHinweis = document.getElementById("gruppen-hinweis");

  const heute = new Date();
  datum.min = alsIsoDatum(heute);
  datum.max = alsIsoDatum(new Date(heute.getFullYear(), heute.getMonth(), heute.getDate() + EINSTELLUNGEN.maxTageImVoraus));

  function alsIsoDatum(d) {
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const t = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${t}`;
  }

  function alsLesbaresDatum(iso) {
    const [j, m, t] = iso.split("-").map(Number);
    return new Date(j, m - 1, t).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
  }

  const inMinuten = (hhmm) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };
  const alsUhrzeit = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

  function wochentag(iso) {
    const [j, m, t] = iso.split("-").map(Number);
    return new Date(j, m - 1, t).getDay();
  }

  // Wählbare Uhrzeiten für einen Tag, heute ohne die bereits vergangenen.
  function uhrzeitenFuer(iso) {
    const jetzt = new Date();
    const grenze = iso === alsIsoDatum(jetzt) ? jetzt.getHours() * 60 + jetzt.getMinutes() + EINSTELLUNGEN.vorlaufMinuten : -1;
    const zeiten = [];
    for (const [von, bis] of OEFFNUNGSZEITEN[wochentag(iso)]) {
      const letzte = inMinuten(bis) - EINSTELLUNGEN.letzteVorSchlussMinuten;
      for (let min = inMinuten(von); min <= letzte; min += EINSTELLUNGEN.rasterMinuten) {
        if (min >= grenze) zeiten.push(alsUhrzeit(min));
      }
    }
    return zeiten;
  }

  function uhrzeitenAktualisieren() {
    const vorher = uhrzeit.value;
    const zeiten = datum.value ? uhrzeitenFuer(datum.value) : [];
    const platzhalter = !datum.value
      ? "Erst Datum wählen"
      : zeiten.length ? "Bitte wählen" : "Geschlossen";
    uhrzeit.replaceChildren(new Option(platzhalter, ""), ...zeiten.map((z) => new Option(z, z)));
    uhrzeit.disabled = !zeiten.length;
    if (zeiten.includes(vorher)) uhrzeit.value = vorher;
  }

  uhrzeitenAktualisieren();
  datum.addEventListener("change", uhrzeitenAktualisieren);

  form.addEventListener("change", (e) => {
    if (e.target.name === "personen") gruppenHinweis.hidden = e.target.value !== "9+";
  });

  function pruefen() {
    const fehler = {};
    const werte = Object.fromEntries(new FormData(form));

    if (!werte.datum) {
      fehler.datum = "Wähl bitte ein Datum.";
    } else if (werte.datum < datum.min) {
      fehler.datum = "Das Datum liegt in der Vergangenheit.";
    } else if (werte.datum > datum.max) {
      fehler.datum = `Reservierungen sind bis zu ${EINSTELLUNGEN.maxTageImVoraus} Tage im Voraus möglich.`;
    } else if (!OEFFNUNGSZEITEN[wochentag(werte.datum)].length) {
      fehler.datum = "Sonntags haben wir geschlossen. Wähl bitte einen anderen Tag.";
    } else if (!uhrzeitenFuer(werte.datum).length) {
      fehler.datum = "Für heute nehmen wir online keine Reservierungen mehr an. Ruf uns gern an.";
    }

    if (!werte.uhrzeit && !fehler.datum) fehler.uhrzeit = "Wähl bitte eine Uhrzeit.";
    if (!werte.personen) fehler.personen = "Wähl bitte die Anzahl der Personen.";

    if (!werte.name || werte.name.trim().length < 2) fehler.name = "Gib bitte deinen Namen an.";

    const ziffern = (werte.telefon || "").replace(/\D/g, "");
    if (ziffern.length < 6) fehler.telefon = "Gib bitte eine Telefonnummer an, unter der wir dich erreichen.";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((werte.email || "").trim())) {
      fehler.email = "Die E-Mail-Adresse sieht unvollständig aus.";
    }

    if (!werte.einwilligung) fehler.einwilligung = "Ohne dein Einverständnis können wir die Anfrage nicht bearbeiten.";

    return { werte, fehler };
  }

  function fehlerAnzeigen(fehler) {
    for (const name of ["datum", "uhrzeit", "personen", "name", "telefon", "email", "einwilligung"]) {
      const ausgabe = document.getElementById(`${name}-fehler`);
      const feld = form.elements.namedItem(name);
      const text = fehler[name];
      ausgabe.hidden = !text;
      ausgabe.textContent = text || "";
      if (feld && !(feld instanceof RadioNodeList)) feld.setAttribute("aria-invalid", text ? "true" : "false");
    }
    const erstes = Object.keys(fehler)[0];
    if (erstes) {
      const feld = form.elements.namedItem(erstes);
      (feld instanceof RadioNodeList ? feld[0] : feld).focus();
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.hidden = true;

    const { werte, fehler } = pruefen();
    fehlerAnzeigen(fehler);
    if (Object.keys(fehler).length) return;

    knopf.disabled = true;
    knopf.textContent = "Wird gesendet";

    try {
      const antwort = await fetch(form.action, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ ...werte, einwilligung: werte.einwilligung === "ja" }),
      });
      const ergebnis = await antwort.json().catch(() => ({}));
      if (!antwort.ok || !ergebnis.ok) throw new Error(ergebnis.fehler || "");

      const personen = werte.personen === "9+" ? "9 oder mehr Personen" : werte.personen === "1" ? "1 Person" : `${werte.personen} Personen`;
      bestaetigungText.textContent =
        `${alsLesbaresDatum(werte.datum)}, ${werte.uhrzeit} Uhr, ${personen}. ` +
        `Wir melden uns mit der Bestätigung an ${werte.email.trim()} oder telefonisch.`;
      form.hidden = true;
      bestaetigung.hidden = false;
      bestaetigung.focus();
    } catch (error) {
      // Meldungen der Serverfunktion sind für Gäste geschrieben und werden direkt angezeigt.
      if (error instanceof Error && error.message) {
        status.textContent = error.message;
      } else {
        status.innerHTML =
          `Die Anfrage ist nicht bei uns angekommen. Versuch es gleich noch einmal oder ruf an unter ` +
          `<a href="${EINSTELLUNGEN.telefonLink}">${EINSTELLUNGEN.telefon}</a>.`;
      }
      status.hidden = false;
      knopf.disabled = false;
      knopf.textContent = "Anfrage senden";
    }
  });
})();
