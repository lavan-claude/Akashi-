// Gemeinsame Regeln der Online-Bestellung. Dieses Modul nutzen der Warenkorb im
// Browser (js/bestellen.mjs) und die Server-Funktion (netlify/functions/bestellung.mjs).
// Der Server rechnet alle Preise selbst nach, der Browser zeigt sie nur an.

// Platzhalter für die Vorführung. Mit dem Wirt festlegen, bevor es echt läuft.
export const EINSTELLUNGEN = {
  zeitzone: "Europe/Berlin",
  mindestwertLieferung: 20,
  liefergebuehr: 2.5,
  liefergebiet: ["28195", "28197", "28199", "28215", "28217", "28219", "28237", "28239"],
  vorlaufAbholung: 25, // Minuten bis frühestens abgeholt werden kann
  vorlaufLieferung: 45,
  schritt: 15, // Zeitfenster im Viertelstundentakt
  letzteVorSchluss: 30, // letzte Bestellung so viele Minuten vor Schluss
  maxPositionen: 40,
  maxMenge: 20,
};

// Muss zu OEFFNUNGSZEITEN in js/reservierung.js und in der Reservierungsfunktion passen. 0 = Sonntag.
export const OEFFNUNGSZEITEN = {
  0: [],
  1: [["12:00", "14:30"], ["17:00", "21:00"]],
  2: [["12:00", "14:30"], ["17:00", "21:00"]],
  3: [["12:00", "14:30"], ["17:00", "21:00"]],
  4: [["12:00", "14:30"], ["17:00", "21:00"]],
  5: [["12:00", "14:30"], ["17:00", "21:30"]],
  6: [["17:00", "21:30"]],
};

// ── Geld ───────────────────────────────────────────────────────────────────
export const zuCent = (euro) => Math.round(Number(euro) * 100);
export const euro = (cent) => (cent / 100).toFixed(2).replace(".", ",") + " €";
const zahl = (text) => Number(String(text).replace(",", "."));

// ── Gerichte ───────────────────────────────────────────────────────────────
const slug = (text) =>
  text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Eindeutige Kennung: die Nummer der Karte, sonst Kategorie plus Name.
export const gerichtId = (kategorie, nr, name) => (nr ? slug(nr) : `${kategorie}-${slug(name)}`);

// Hinweise, die in der Karte bei den Optionen stehen, aber nichts zum Auswählen sind.
const NUR_HINWEIS = /^(kein roher fisch|weiches ei)$/i;

// Liest eine Options-Zeile der Karte und macht daraus etwas Auswählbares:
//   { art: "wahl", titel, auswahl: [{ name, aufpreis }] }  genau eins wählen
//   { art: "extra", name, aufpreis }                         ankreuzen, ggf. mit Aufpreis
//   { art: "hinweis", text }                                 nur anzeigen
// Aufpreise in Cent. Eine Zahl ohne Plus, die über dem Grundpreis liegt, ist ein
// Endpreis („Doppelte Portion Aal 37,5“), daraus wird der Aufpreis berechnet.
export function optionLesen(text, grundpreisCent) {
  const roh = text.trim();
  if (NUR_HINWEIS.test(roh)) return { art: "hinweis", text: roh };

  const ohneVorspann = roh.replace(/^(bitte wählen|optional):\s*/i, "");
  const preisTreffer = ohneVorspann.match(/\(?\s*(\+)?\s*(\d+(?:,\d+)?)\s*\)?\s*$/);
  let aufpreis = 0;
  let name = ohneVorspann;
  if (preisTreffer) {
    const wert = zuCent(zahl(preisTreffer[2]));
    aufpreis = !preisTreffer[1] && wert > grundpreisCent ? wert - grundpreisCent : wert;
    name = ohneVorspann.slice(0, preisTreffer.index).trim();
  }

  if (/\soder\s/i.test(name)) {
    const teile = name.split(/\s+oder\s+/i).map((t) => t.trim());
    // Ein Aufpreis hinter „A oder B (+x)“ gilt für die zweite Wahl.
    return {
      art: "wahl",
      titel: roh.match(/^bitte wählen/i) ? "Bitte wählen" : "Deine Wahl",
      auswahl: teile.map((t, i) => ({ name: t.charAt(0).toUpperCase() + t.slice(1), aufpreis: i === teile.length - 1 ? aufpreis : 0 })),
    };
  }
  return { art: "extra", name: name.replace(/^auch\s+/i, "").replace(/\s+verfügbar$/i, "").replace(/^\w/, (z) => z.toUpperCase()), aufpreis };
}

// ── Preise einer Bestellung ────────────────────────────────────────────────
// gericht: { id, name, nr, preisCent, optionen: [Ergebnis von optionLesen] }
// wahl: { [optionsIndex]: auswahlIndex | true } für Wahl bzw. Extra
export function positionBerechnen(gericht, wahl = {}, menge = 1) {
  let einzel = gericht.preisCent;
  const details = [];
  gericht.optionen.forEach((opt, i) => {
    if (opt.art === "wahl") {
      const index = Number(wahl[i] ?? -1);
      const gewaehlt = opt.auswahl[index];
      if (!gewaehlt) throw new Error(`Bitte bei „${gericht.name}“ eine Auswahl treffen.`);
      einzel += gewaehlt.aufpreis;
      details.push(gewaehlt.name + (gewaehlt.aufpreis ? ` (+${euro(gewaehlt.aufpreis)})` : ""));
    } else if (opt.art === "extra" && wahl[i] === true) {
      einzel += opt.aufpreis;
      details.push(opt.name + (opt.aufpreis ? ` (+${euro(opt.aufpreis)})` : ""));
    }
  });
  return { einzelCent: einzel, summeCent: einzel * menge, details };
}

export function summenBerechnen(zwischensummeCent, art) {
  const gebuehr = art === "lieferung" ? zuCent(EINSTELLUNGEN.liefergebuehr) : 0;
  return { zwischensummeCent, gebuehrCent: gebuehr, gesamtCent: zwischensummeCent + gebuehr };
}

// ── Zeiten ─────────────────────────────────────────────────────────────────
const inMinuten = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const alsUhrzeit = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

// Datum und Uhrzeit in Bremen, unabhängig von Server- oder Gerätezeit.
export function jetztInBremen(jetzt = new Date()) {
  const t = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: EINSTELLUNGEN.zeitzone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(jetzt)
      .map((p) => [p.type, p.value]),
  );
  return { datum: `${t.year}-${t.month}-${t.day}`, minuten: Number(t.hour) * 60 + Number(t.minute) };
}

const tagDazu = (datum, tage) => {
  const d = new Date(`${datum}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().slice(0, 10);
};
const wochentag = (datum) => new Date(`${datum}T12:00:00Z`).getUTCDay();

// Wählbare Zeitfenster: heute ab Vorlauf, sonst der nächste Öffnungstag.
// Ergebnis: [{ datum, zeiten: ["17:30", …] }] höchstens zwei Tage.
export function zeitfenster(art, jetzt = new Date()) {
  const { datum: heute, minuten } = jetztInBremen(jetzt);
  const vorlauf = art === "lieferung" ? EINSTELLUNGEN.vorlaufLieferung : EINSTELLUNGEN.vorlaufAbholung;
  const tage = [];
  for (let i = 0; i < 8 && tage.length < 2; i++) {
    const datum = tagDazu(heute, i);
    const frueh = i === 0 ? minuten + vorlauf : 0;
    const zeiten = [];
    for (const [von, bis] of OEFFNUNGSZEITEN[wochentag(datum)]) {
      const start = inMinuten(von) + vorlauf;
      const ende = inMinuten(bis) - EINSTELLUNGEN.letzteVorSchluss;
      for (let m = Math.ceil(Math.max(start, frueh) / EINSTELLUNGEN.schritt) * EINSTELLUNGEN.schritt; m <= ende; m += EINSTELLUNGEN.schritt) {
        zeiten.push(alsUhrzeit(m));
      }
    }
    if (zeiten.length) tage.push({ datum, zeiten });
  }
  return tage;
}

export const zeitErlaubt = (art, datum, uhrzeit, jetzt = new Date()) =>
  zeitfenster(art, jetzt).some((t) => t.datum === datum && t.zeiten.includes(uhrzeit));

export function datumText(datum, jetzt = new Date()) {
  const heute = jetztInBremen(jetzt).datum;
  if (datum === heute) return "Heute";
  if (datum === tagDazu(heute, 1)) return "Morgen";
  return new Intl.DateTimeFormat("de-DE", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${datum}T12:00:00Z`));
}
