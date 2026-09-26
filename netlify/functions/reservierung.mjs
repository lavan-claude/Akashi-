// Nimmt eine Reservierungsanfrage aus dem Formular entgegen und reicht sie an
// den n8n-Workflow weiter – nach demselben Prinzip wie das Leadflow-Formular.
//
// Der Aufruf läuft bewusst über den Server: So landet die Webhook-Adresse nie
// im Browser und kann von außen weder ausgelesen noch direkt beschickt werden.
//
// Adresse nur über die Umgebungsvariable RESERVIERUNG_WEBHOOK_URL in Netlify.
// Sie steht bewusst nicht im Code, weil das Repo öffentlich sein kann.
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

  const webhookUrl = process.env.RESERVIERUNG_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error("RESERVIERUNG_WEBHOOK_URL ist nicht gesetzt.");
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
