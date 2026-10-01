// Nimmt eine Online-Bestellung entgegen, rechnet sie mit der Speisekarte aus
// daten/speisekarte.json komplett neu und reicht sie an n8n weiter
// (BESTELLUNG_WEBHOOK_URL, nur in Netlify). Preise aus dem Browser zählen nicht.
//
// Fehlermeldungen aus dieser Funktion zeigt der Warenkorb dem Gast an.

import karte from "../../daten/speisekarte.json" with { type: "json" };
import {
  EINSTELLUNGEN,
  optionLesen,
  gerichtId,
  positionBerechnen,
  summenBerechnen,
  zuCent,
  euro,
  zeitErlaubt,
  datumText,
} from "../../site/js/bestellung-regeln.mjs";

const TELEFON = "0421 43093028";

// Speisekarte einmal beim Start der Funktion aufbereiten
const GERICHTE = new Map();
for (const k of karte.kategorien) {
  for (const g of k.gerichte) {
    const preisCent = zuCent(Number(String(g.preis).replace(",", ".")));
    const id = gerichtId(k.id, g.nr, g.name);
    GERICHTE.set(id, { id, nr: g.nr ?? "", name: g.name, preisCent, optionen: (g.optionen ?? []).map((o) => optionLesen(o, preisCent)) });
  }
}

class EingabeFehler extends Error {}
const text = (w, max = 200) => (typeof w === "string" ? w.trim().slice(0, max) : "");

// Einfache Ratenbegrenzung je IP, nur im Arbeitsspeicher der Funktion.
const anfragen = new Map();
function zuViele(ip) {
  const jetzt = Date.now();
  const liste = (anfragen.get(ip) ?? []).filter((t) => jetzt - t < 60_000);
  liste.push(jetzt);
  anfragen.set(ip, liste);
  if (anfragen.size > 1000) anfragen.clear();
  return liste.length > 5;
}

export function pruefen(input, jetzt = new Date()) {
  const art = input.art === "lieferung" ? "lieferung" : input.art === "abholung" ? "abholung" : null;
  if (!art) throw new EingabeFehler("Wähl bitte Abholen oder Liefern.");

  const datum = text(input.datum, 10);
  const uhrzeit = text(input.uhrzeit, 5);
  if (!zeitErlaubt(art, datum, uhrzeit, jetzt)) {
    throw new EingabeFehler("Diese Zeit ist nicht mehr verfügbar. Wähl bitte eine andere.");
  }

  const name = text(input.name, 80);
  const telefon = text(input.telefon, 30);
  const email = text(input.email, 120);
  if (name.length < 2) throw new EingabeFehler("Gib bitte deinen Namen an.");
  if (telefon.replace(/\D/g, "").length < 6) throw new EingabeFehler("Gib bitte eine Telefonnummer an.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) throw new EingabeFehler("Die E-Mail-Adresse sieht unvollständig aus.");
  if (input.einwilligung !== true) throw new EingabeFehler("Ohne dein Einverständnis können wir die Bestellung nicht bearbeiten.");

  let adresse = null;
  if (art === "lieferung") {
    const strasse = text(input.strasse, 120);
    const plz = text(input.plz, 5);
    const ort = text(input.ort, 60) || "Bremen";
    if (strasse.length < 4 || !/\d/.test(strasse)) throw new EingabeFehler("Gib bitte Straße und Hausnummer an.");
    if (!EINSTELLUNGEN.liefergebiet.includes(plz)) throw new EingabeFehler("In diese PLZ liefern wir leider nicht.");
    adresse = { strasse, plz, ort };
  }

  if (!Array.isArray(input.positionen) || !input.positionen.length) throw new EingabeFehler("Dein Warenkorb ist leer.");
  if (input.positionen.length > EINSTELLUNGEN.maxPositionen) throw new EingabeFehler("Das sind zu viele Positionen. Ruf uns für große Bestellungen gern an.");

  const positionen = input.positionen.map((p) => {
    const gericht = GERICHTE.get(String(p?.id));
    if (!gericht) throw new EingabeFehler("Ein Gericht gibt es so nicht mehr. Bitte lade die Seite neu.");
    const menge = Number(p.menge);
    if (!Number.isInteger(menge) || menge < 1 || menge > EINSTELLUNGEN.maxMenge) throw new EingabeFehler("Bitte prüf die Anzahl im Warenkorb.");
    // Nur bekannte Optionen übernehmen, Werte streng prüfen
    const wahl = {};
    gericht.optionen.forEach((opt, i) => {
      const w = p.wahl?.[i];
      if (opt.art === "wahl" && Number.isInteger(w) && w >= 0 && w < opt.auswahl.length) wahl[i] = w;
      if (opt.art === "extra" && w === true) wahl[i] = true;
    });
    let rechnung;
    try {
      rechnung = positionBerechnen(gericht, wahl, menge);
    } catch (e) {
      throw new EingabeFehler(e.message);
    }
    return { nr: gericht.nr, name: gericht.name, menge, details: rechnung.details, einzelCent: rechnung.einzelCent, summeCent: rechnung.summeCent };
  });

  const zwischensumme = positionen.reduce((s, p) => s + p.summeCent, 0);
  if (art === "lieferung" && zwischensumme < zuCent(EINSTELLUNGEN.mindestwertLieferung)) {
    throw new EingabeFehler(`Für Lieferung brauchen wir mindestens ${euro(zuCent(EINSTELLUNGEN.mindestwertLieferung))}.`);
  }
  const summen = summenBerechnen(zwischensumme, art);

  return {
    art,
    datum,
    uhrzeit,
    wannText: `${datumText(datum, jetzt).replace(/^Heute$/, "heute").replace(/^Morgen$/, "morgen")} um ${uhrzeit} Uhr`,
    name,
    telefon,
    email,
    adresse,
    anmerkung: text(input.anmerkung, 500),
    zahlung: input.zahlung === "karte" ? "karte" : "bar",
    positionen,
    ...summen,
    preisGeaendert: Number(input.gesamtAngezeigt) !== summen.gesamtCent,
    website: text(input.website),
  };
}

// Kurze, gut vorlesbare Bestellnummer, z. B. A-4821
const bestellnummer = () => `A-${Math.floor(1000 + Math.random() * 9000)}`;

const antwort = (status, daten) => Response.json(daten, { status });

export default async (req, context) => {
  if (req.method !== "POST") return new Response("Nur POST", { status: 405, headers: { Allow: "POST" } });

  let b;
  try {
    b = pruefen(await req.json());
  } catch (error) {
    const meldung = error instanceof EingabeFehler ? error.message : "Die Bestellung war unvollständig. Bitte versuch es noch einmal.";
    return antwort(400, { ok: false, fehler: meldung });
  }

  const nummer = bestellnummer();
  // Honigtopf gefüllt: so tun, als wäre alles gut, und nichts weiterleiten.
  if (b.website) return antwort(200, { ok: true, nummer, wannText: b.wannText, gesamtCent: b.gesamtCent });

  const ip = context?.ip ?? req.headers.get("x-nf-client-connection-ip") ?? "unbekannt";
  if (zuViele(ip)) return antwort(429, { ok: false, fehler: "Zu viele Bestellungen in kurzer Zeit. Bitte versuch es gleich noch einmal." });

  const webhook = process.env.BESTELLUNG_WEBHOOK_URL;
  if (!webhook) {
    console.error("BESTELLUNG_WEBHOOK_URL ist nicht gesetzt.");
    return antwort(503, { ok: false, fehler: `Online-Bestellungen sind gerade nicht möglich. Ruf uns gern an unter ${TELEFON}.` });
  }

  try {
    const r = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nummer, quelle: "Website-Bestellung", ...b, website: undefined }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  } catch (error) {
    console.error(`Bestellungs-Webhook fehlgeschlagen: ${error.message}`);
    return antwort(502, { ok: false, fehler: `Das hat leider nicht geklappt. Versuch es gleich noch einmal oder ruf uns an unter ${TELEFON}.` });
  }

  return antwort(200, { ok: true, nummer, wannText: b.wannText, gesamtCent: b.gesamtCent });
};

export const config = { path: "/api/bestellung" };
