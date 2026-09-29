// Nimmt eine Reservierungsanfrage aus dem Formular entgegen und stellt sie zu:
//
// 1. Ist RESEND_API_KEY gesetzt, verschickt die Funktion selbst eine E-Mail ans
//    Restaurant (RESERVIERUNG_AN) über Resend. Mit RESERVIERUNG_VON (Absender auf
//    der eigenen, bei Resend bestätigten Domain) bekommt auch der Gast eine
//    Bestätigung. Ohne eigene Domain darf Resend nur an die Adresse des
//    Resend-Kontos schicken, deshalb geht die Gästemail dann nicht raus.
// 2. Sonst, falls RESERVIERUNG_WEBHOOK_URL gesetzt ist, an einen n8n-Workflow.
// 3. Ist beides leer, bekommt der Gast den Hinweis anzurufen.
//
// Der Aufruf läuft bewusst über den Server: So landet die Webhook-Adresse nie
// im Browser und kann von außen weder ausgelesen noch direkt beschickt werden.
//
// Schlüssel und Adressen nur über Umgebungsvariablen in Netlify. Sie stehen
// bewusst nicht im Code, weil das Repo öffentlich sein kann.
//
// Fehlermeldungen aus dieser Funktion zeigt das Formular dem Gast an. Also
// nichts hineinschreiben, was Besucher nicht sehen sollen.

const ZEITZONE = "Europe/Berlin";

// Muss zu OEFFNUNGSZEITEN in site/js/reservierung.js passen. 0 = Sonntag.
const OEFFNUNGSZEITEN = {
  0: [],
  1: [["12:00", "14:30"], ["17:00", "21:00"]],
  2: [["12:00", "14:30"], ["17:00", "21:00"]],
  3: [["12:00", "14:30"], ["17:00", "21:00"]],
  4: [["12:00", "14:30"], ["17:00", "21:00"]],
  5: [["12:00", "14:30"], ["17:00", "21:30"]],
  6: [["17:00", "21:30"]],
};
const LETZTE_VOR_SCHLUSS_MINUTEN = 60;
const MAX_TAGE_IM_VORAUS = 90;

// Einfache Ratenbegrenzung je IP. Der Speicher lebt nur so lange wie die
// Funktionsinstanz, bremst Massenanfragen also nur ab und ersetzt keinen
// echten Spamschutz.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
const recentRequests = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const timestamps = (recentRequests.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);

  if (timestamps.length >= MAX_PER_WINDOW) {
    recentRequests.set(ip, timestamps);
    return true;
  }

  timestamps.push(now);
  recentRequests.set(ip, timestamps);

  // Die Map wächst sonst unbegrenzt, solange die Instanz lebt.
  if (recentRequests.size > 1000) {
    for (const [key, times] of recentRequests) {
      if (times.every((t) => now - t >= WINDOW_MS)) recentRequests.delete(key);
    }
  }

  return false;
}

class EingabeFehler extends Error {}

const inMinuten = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

// Heutiges Datum und aktuelle Uhrzeit in Bremen, unabhängig von der Serverzeit.
function jetztInBerlin() {
  const teile = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: ZEITZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map((t) => [t.type, t.value]),
  );
  return { datum: `${teile.year}-${teile.month}-${teile.day}`, minuten: Number(teile.hour) * 60 + Number(teile.minute) };
}

// Versatz von Europe/Berlin zu UTC am gegebenen Tag, z. B. "+02:00".
function berlinVersatz(datum, uhrzeit) {
  const teil = new Intl.DateTimeFormat("en-US", { timeZone: ZEITZONE, timeZoneName: "longOffset" })
    .formatToParts(new Date(`${datum}T${uhrzeit}:00Z`))
    .find((t) => t.type === "timeZoneName");
  const versatz = teil?.value.replace("GMT", "") ?? "";
  return versatz || "+00:00";
}

function tageZwischen(von, bis) {
  return Math.round((Date.parse(`${bis}T00:00:00Z`) - Date.parse(`${von}T00:00:00Z`)) / 86_400_000);
}

const text = (wert) => (typeof wert === "string" ? wert.trim() : "");

export function validate(input) {
  const name = text(input.name);
  const email = text(input.email);
  const telefon = text(input.telefon);
  const nachricht = text(input.nachricht);
  const datum = text(input.datum);
  const uhrzeit = text(input.uhrzeit);
  const personenRoh = text(input.personen);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || Number.isNaN(Date.parse(`${datum}T00:00:00Z`))) {
    throw new EingabeFehler("Wähl bitte ein Datum.");
  }
  const heute = jetztInBerlin();
  const abstand = tageZwischen(heute.datum, datum);
  if (abstand < 0) throw new EingabeFehler("Das Datum liegt in der Vergangenheit.");
  if (abstand > MAX_TAGE_IM_VORAUS) {
    throw new EingabeFehler(`Reservierungen sind bis zu ${MAX_TAGE_IM_VORAUS} Tage im Voraus möglich.`);
  }

  const wochentag = new Date(`${datum}T12:00:00Z`).getUTCDay();
  const zeiten = OEFFNUNGSZEITEN[wochentag];
  if (!zeiten.length) throw new EingabeFehler("Sonntags haben wir geschlossen. Wähl bitte einen anderen Tag.");

  if (!/^\d{2}:\d{2}$/.test(uhrzeit)) throw new EingabeFehler("Wähl bitte eine Uhrzeit.");
  const minute = inMinuten(uhrzeit);
  const offen = zeiten.some(([von, bis]) => minute >= inMinuten(von) && minute <= inMinuten(bis) - LETZTE_VOR_SCHLUSS_MINUTEN);
  if (!offen) throw new EingabeFehler("Zu dieser Uhrzeit können wir keinen Tisch anbieten. Wähl bitte eine andere.");
  if (abstand === 0 && minute < heute.minuten) {
    throw new EingabeFehler("Diese Uhrzeit ist heute schon vorbei. Ruf uns für kurzfristige Tische gern an.");
  }

  const grosseGruppe = personenRoh === "9+";
  const personen = grosseGruppe ? 9 : Number(personenRoh);
  if (!Number.isInteger(personen) || personen < 1 || personen > 9) {
    throw new EingabeFehler("Wähl bitte die Anzahl der Personen.");
  }

  if (name.length < 2 || name.length > 80) throw new EingabeFehler("Gib bitte deinen Namen an.");
  if (telefon.replace(/\D/g, "").length < 6 || telefon.length > 30) {
    throw new EingabeFehler("Gib bitte eine Telefonnummer an, unter der wir dich erreichen.");
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email) || email.length > 120) {
    throw new EingabeFehler("Die E-Mail-Adresse sieht unvollständig aus.");
  }
  if (nachricht.length > 1000) throw new EingabeFehler("Deine Anmerkungen sind zu lang. Bitte kürz sie etwas.");
  if (input.einwilligung !== true && input.einwilligung !== "ja") {
    throw new EingabeFehler("Ohne dein Einverständnis können wir die Anfrage nicht bearbeiten.");
  }

  return {
    name,
    email,
    telefon,
    datum,
    uhrzeit,
    beginn: `${datum}T${uhrzeit}:00${berlinVersatz(datum, uhrzeit)}`,
    personen,
    grosse_gruppe: grosseGruppe,
    nachricht,
    einwilligung: true,
    website: text(input.website),
  };
}

// ── E-Mails ───────────────────────────────────────────────────────────────
const TELEFON = "0421 43093028";
const RESEND_TEST_ABSENDER = "Akashi Reservierung <onboarding@resend.dev>";

const esc = (w) =>
  String(w).replace(/[&<>"']/g, (z) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[z]);

function datumLang(datum) {
  return new Intl.DateTimeFormat("de-DE", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" })
    .format(new Date(`${datum}T12:00:00Z`));
}

const personenText = (d) => (d.grosse_gruppe ? "9 oder mehr Personen" : d.personen === 1 ? "1 Person" : `${d.personen} Personen`);

// Tabellenlayout mit Inline-Stilen, weil Mailprogramme kaum CSS können.
function mailRahmen(titel, inhalt) {
  return `<!doctype html><html lang="de"><body style="margin:0;padding:0;background:#eeebe5">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eeebe5;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#f8f6f1;border:1px solid #cbc4b8">
<tr><td style="background:#15120f;padding:22px 28px;border-bottom:3px solid #b3262b">
<span style="font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#eeebe5;letter-spacing:.02em">Akashi</span>
<span style="font-family:Georgia,serif;font-size:18px;color:#d8474c;padding-left:8px">明石</span>
</td></tr>
<tr><td style="padding:28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#15120f">
<h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:bold;color:#15120f">${esc(titel)}</h1>
${inhalt}
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #cbc4b8;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#57514a">
Akashi · Japanese Restaurant &amp; Izakaya · Ludwig-Franzius-Platz 13 · 28217 Bremen · ${TELEFON.replace(/ /g, "&nbsp;")}
</td></tr>
</table></td></tr></table></body></html>`;
}

function zeilen(paare) {
  const zeile = ([k, v]) =>
    `<tr><td style="padding:9px 0;border-bottom:1px solid #e0dbd2;color:#57514a;width:38%;vertical-align:top">${esc(k)}</td>` +
    `<td style="padding:9px 0;border-bottom:1px solid #e0dbd2;font-weight:bold;vertical-align:top">${v}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border-collapse:collapse">${paare.map(zeile).join("")}</table>`;
}

function mailAnsRestaurant(d) {
  const wann = `${datumLang(d.datum)}, ${d.uhrzeit} Uhr`;
  const tel = d.telefon.replace(/[^\d+]/g, "");
  const gruppe = d.grosse_gruppe ? ` <span style="color:#b3262b">(große Gruppe, bitte absprechen)</span>` : "";
  const html = mailRahmen(
    "Neue Reservierungsanfrage",
    `<p style="margin:0 0 18px">Über die Website ist eine Anfrage eingegangen. Bitte bestätige sie dem Gast per Telefon oder E-Mail.</p>
${zeilen([
  ["Wann", esc(wann)],
  ["Personen", esc(personenText(d)) + gruppe],
  ["Name", esc(d.name)],
  ["Telefon", `<a href="tel:${esc(tel)}" style="color:#b3262b">${esc(d.telefon)}</a>`],
  ["E-Mail", `<a href="mailto:${esc(d.email)}" style="color:#b3262b">${esc(d.email)}</a>`],
  ...(d.nachricht ? [["Anmerkung", esc(d.nachricht).replace(/\n/g, "<br>")]] : []),
])}
<p style="margin:0;color:#57514a;font-size:13px">Tipp: „Antworten“ schreibt direkt an den Gast.</p>`,
  );
  const text = [
    "Neue Reservierungsanfrage über die Website",
    "",
    `Wann: ${wann}`,
    `Personen: ${personenText(d)}`,
    `Name: ${d.name}`,
    `Telefon: ${d.telefon}`,
    `E-Mail: ${d.email}`,
    ...(d.nachricht ? [`Anmerkung: ${d.nachricht}`] : []),
  ].join("\n");
  return { subject: `Reservierung: ${wann}, ${personenText(d)}, ${d.name}`, html, text };
}

function mailAnGast(d) {
  const wann = `${datumLang(d.datum)}, ${d.uhrzeit} Uhr`;
  const html = mailRahmen(
    "Danke für deine Anfrage",
    `<p style="margin:0 0 18px">Hallo ${esc(d.name)},<br>wir haben deine Reservierungsanfrage erhalten und melden uns kurz zur Bestätigung.</p>
${zeilen([
  ["Wann", esc(wann)],
  ["Personen", esc(personenText(d))],
])}
<p style="margin:0 0 6px">Die Reservierung gilt, sobald wir sie bestätigt haben. Wenn sich etwas ändert, ruf uns gern an unter <a href="tel:+4942143093028" style="color:#b3262b">${TELEFON}</a>.</p>
<p style="margin:18px 0 0">Bis bald im Akashi</p>`,
  );
  const text = `Hallo ${d.name},\n\nwir haben deine Reservierungsanfrage für ${wann} (${personenText(d)}) erhalten und melden uns kurz zur Bestätigung.\nDie Reservierung gilt, sobald wir sie bestätigt haben. Bei Änderungen: ${TELEFON}\n\nBis bald im Akashi`;
  return { subject: `Deine Anfrage im Akashi: ${wann}`, html, text };
}

async function resendSenden(schluessel, mail) {
  const antwort = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${schluessel}`, "Content-Type": "application/json" },
    body: JSON.stringify(mail),
    signal: AbortSignal.timeout(10_000),
  });
  if (!antwort.ok) throw new Error(`Resend HTTP ${antwort.status}: ${(await antwort.text()).slice(0, 200)}`);
}

export async function perMailZustellen(d, senden = resendSenden) {
  const schluessel = process.env.RESEND_API_KEY;
  const an = process.env.RESERVIERUNG_AN;
  if (!an) throw new Error("RESERVIERUNG_AN ist nicht gesetzt.");
  const eigenerAbsender = process.env.RESERVIERUNG_VON;

  // Die Mail ans Restaurant muss ankommen, sonst ist die Anfrage verloren.
  await senden(schluessel, { from: eigenerAbsender || RESEND_TEST_ABSENDER, to: [an], reply_to: d.email, ...mailAnsRestaurant(d) });

  // Die Bestätigung an den Gast ist ein Extra: Schlägt sie fehl, bleibt die Anfrage gültig.
  if (eigenerAbsender) {
    try {
      await senden(schluessel, { from: eigenerAbsender, to: [d.email], reply_to: an, ...mailAnGast(d) });
    } catch (error) {
      console.error(`Bestätigung an den Gast fehlgeschlagen: ${error.message}`);
    }
  }
}

async function eingabeLesen(req) {
  const typ = req.headers.get("content-type") ?? "";
  if (typ.includes("application/json")) return { daten: await req.json(), alsFormular: false };
  // Ohne JavaScript schickt der Browser das Formular klassisch ab.
  return { daten: Object.fromEntries(await req.formData()), alsFormular: true };
}

function antwort(alsFormular, status, fehler) {
  if (alsFormular) {
    if (!fehler) return new Response(null, { status: 303, headers: { Location: "/danke.html" } });
    return new Response(`${fehler}\n\nZurück mit der Zurück-Taste des Browsers.`, {
      status,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return Response.json(fehler ? { ok: false, fehler } : { ok: true }, { status });
}

export default async (req, context) => {
  if (req.method !== "POST") return new Response("Nur POST", { status: 405, headers: { Allow: "POST" } });

  let alsFormular = false;
  let data;
  try {
    const eingabe = await eingabeLesen(req);
    alsFormular = eingabe.alsFormular;
    data = validate(eingabe.daten);
  } catch (error) {
    const meldung = error instanceof EingabeFehler ? error.message : "Die Anfrage war unvollständig. Bitte versuch es noch einmal.";
    return antwort(alsFormular, 400, meldung);
  }

  // Honigtopf gefüllt: so tun, als wäre alles gut, und nichts weiterleiten.
  if (data.website) return antwort(alsFormular, 200);

  const ip = context?.ip ?? req.headers.get("x-nf-client-connection-ip") ?? "unbekannt";
  if (isRateLimited(ip)) {
    return antwort(alsFormular, 429, "Zu viele Anfragen in kurzer Zeit. Bitte versuch es gleich noch einmal.");
  }

  if (process.env.RESEND_API_KEY) {
    try {
      await perMailZustellen(data);
    } catch (error) {
      console.error(`Reservierungsmail fehlgeschlagen: ${error.message}`);
      return antwort(
        alsFormular,
        502,
        "Das hat leider nicht geklappt. Versuch es gleich noch einmal oder ruf uns an unter 0421 43093028.",
      );
    }
    return antwort(alsFormular, 200);
  }

  const webhookUrl = process.env.RESERVIERUNG_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error("Weder RESEND_API_KEY noch RESERVIERUNG_WEBHOOK_URL ist gesetzt.");
    return antwort(
      alsFormular,
      503,
      "Online-Reservierungen sind gerade nicht möglich. Ruf uns gern an unter 0421 43093028.",
    );
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        telefon: data.telefon,
        datum: data.datum,
        uhrzeit: data.uhrzeit,
        beginn: data.beginn,
        personen: data.personen,
        grosse_gruppe: data.grosse_gruppe,
        nachricht: data.nachricht,
        quelle: "Website-Reservierung",
        einwilligung: data.einwilligung,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    console.error(`Reservierungs-Webhook fehlgeschlagen: ${error.message}`);
    return antwort(
      alsFormular,
      502,
      "Das hat leider nicht geklappt. Versuch es gleich noch einmal oder ruf uns an unter 0421 43093028.",
    );
  }

  return antwort(alsFormular, 200);
};

export const config = { path: "/api/reservierung" };
