// Reservierungsanfrage: Prüfung im Browser und Versand an Netlify Forms.
// Ohne JavaScript schickt das Formular klassisch ab und landet auf /danke.html.

(function () {
  "use strict";

  const EINSTELLUNGEN = {
    // Wie weit im Voraus reserviert werden kann.
    maxTageImVoraus: 90,
    // Heute nur Uhrzeiten, die mindestens so viele Minuten in der Zukunft liegen.
    vorlaufMinuten: 60,
    // Ruhetage als Wochentag, 0 = Sonntag. Noch mit dem Restaurant klären.
    ruhetage: [],
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

  // Heute vergangene Uhrzeiten ausgrauen.
  function uhrzeitenAktualisieren() {
    const istHeute = datum.value === alsIsoDatum(new Date());
    const grenze = new Date(Date.now() + EINSTELLUNGEN.vorlaufMinuten * 60000);
    for (const option of uhrzeit.options) {
      if (!option.value) continue;
      const [h, min] = option.value.split(":").map(Number);
      const zeit = new Date();
      zeit.setHours(h, min, 0, 0);
      option.disabled = istHeute && zeit < grenze;
    }
    if (uhrzeit.selectedOptions[0]?.disabled) uhrzeit.value = "";
  }

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
    } else {
      const [j, m, t] = werte.datum.split("-").map(Number);
      if (EINSTELLUNGEN.ruhetage.includes(new Date(j, m - 1, t).getDay())) {
        fehler.datum = "An diesem Tag haben wir geschlossen.";
      }
    }

    if (!werte.uhrzeit) fehler.uhrzeit = "Wähl bitte eine Uhrzeit.";
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
      const antwort = await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(new FormData(form)).toString(),
      });
      if (!antwort.ok) throw new Error(String(antwort.status));

      const personen = werte.personen === "9+" ? "9 oder mehr Personen" : werte.personen === "1" ? "1 Person" : `${werte.personen} Personen`;
      bestaetigungText.textContent =
        `${alsLesbaresDatum(werte.datum)}, ${werte.uhrzeit} Uhr, ${personen}. ` +
        `Wir melden uns mit der Bestätigung an ${werte.email.trim()} oder telefonisch.`;
      form.hidden = true;
      bestaetigung.hidden = false;
      bestaetigung.focus();
    } catch {
      status.innerHTML =
        `Die Anfrage ist nicht bei uns angekommen. Versuch es gleich noch einmal oder ruf an unter ` +
        `<a href="${EINSTELLUNGEN.telefonLink}">${EINSTELLUNGEN.telefon}</a>.`;
      status.hidden = false;
      knopf.disabled = false;
      knopf.textContent = "Anfrage senden";
    }
  });
})();
