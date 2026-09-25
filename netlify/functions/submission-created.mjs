// Netlify ruft diese Funktion automatisch nach jeder angenommenen
// Formular-Einsendung auf (Spam ist dann bereits aussortiert).
// Sie reicht Reservierungsanfragen als einheitliches JSON an das
// Reservierungssystem weiter – etwa n8n, Make, Zapier oder direkt an eine API.
//
// Umgebungsvariablen (Netlify > Site configuration > Environment variables):
//   RESERVIERUNG_WEBHOOK_URL     Ziel-Adresse. Ohne sie wird nichts weitergeleitet,
//                                die Anfrage liegt dann nur in Netlify Forms und
//                                kommt per E-Mail-Benachrichtigung an.
//   RESERVIERUNG_WEBHOOK_SECRET  optional. Signiert den Inhalt per HMAC-SHA256,
//                                Kopfzeile X-Akashi-Signatur: sha256=<hex>.
//
// Aufbau der Daten: docs/reservierung-schnittstelle.md

import { createHmac } from "node:crypto";

const FORMULAR = "reservierung";
const ZEITZONE = "Europe/Berlin";

// Versatz von Europe/Berlin zu UTC am gegebenen Tag, z. B. "+02:00".
function berlinVersatz(datum, uhrzeit) {
  const probe = new Date(`${datum}T${uhrzeit}:00Z`);
  const teil = new Intl.DateTimeFormat("en-US", { timeZone: ZEITZONE, timeZoneName: "longOffset" })
    .formatToParts(probe)
    .find((t) => t.type === "timeZoneName");
  const versatz = teil?.value.replace("GMT", "") || "+00:00";
  return versatz === "" ? "+00:00" : versatz;
}

function text(wert, max) {
  return typeof wert === "string" ? wert.trim().slice(0, max) : "";
}

export function alsReservierung(payload) {
  const d = payload.data || {};
  const datum = text(d.datum, 10);
  const uhrzeit = text(d.uhrzeit, 5);
  const personenRoh = text(d.personen, 3);
  const grosseGruppe = personenRoh === "9+";

  return {
    typ: "reservierungsanfrage",
    version: 1,
    id: payload.id || null,
    eingegangen_am: payload.created_at || new Date().toISOString(),
    quelle: text(d.quelle, 40) || "website",
    datum,
    uhrzeit,
    beginn: /^\d{4}-\d{2}-\d{2}$/.test(datum) && /^\d{2}:\d{2}$/.test(uhrzeit)
      ? `${datum}T${uhrzeit}:00${berlinVersatz(datum, uhrzeit)}`
      : null,
    zeitzone: ZEITZONE,
    personen: grosseGruppe ? 9 : Number.parseInt(personenRoh, 10) || null,
    grosse_gruppe: grosseGruppe,
    gast: {
      name: text(d.name, 80),
      telefon: text(d.telefon, 30),
      email: text(d.email, 120),
    },
    anmerkungen: text(d.nachricht, 1000),
    einwilligung: d.einwilligung === "ja",
  };
}

const ok = (body, statusCode = 200) => ({ statusCode, body });

export const handler = async (event) => {
  const { payload } = JSON.parse(event.body || "{}");
  if (payload?.form_name !== FORMULAR) return ok("übersprungen");

  const ziel = process.env.RESERVIERUNG_WEBHOOK_URL;
  if (!ziel) return ok("kein Ziel konfiguriert");

  const inhalt = JSON.stringify(alsReservierung(payload));
  const kopf = { "Content-Type": "application/json" };
  const geheimnis = process.env.RESERVIERUNG_WEBHOOK_SECRET;
  if (geheimnis) {
    kopf["X-Akashi-Signatur"] = `sha256=${createHmac("sha256", geheimnis).update(inhalt).digest("hex")}`;
  }

  const antwort = await fetch(ziel, {
    method: "POST",
    headers: kopf,
    body: inhalt,
    signal: AbortSignal.timeout(8000),
  });

  if (!antwort.ok) {
    // Taucht im Funktions-Log auf. Die Anfrage selbst bleibt in Netlify Forms erhalten.
    console.error(`Weiterleitung fehlgeschlagen: HTTP ${antwort.status}`);
    return ok("Weiterleitung fehlgeschlagen", 502);
  }
  return ok("weitergeleitet");
};
