// Online-Bestellung auf der Speisekarte: „+“ an jedem Gericht, Optionen im Dialog,
// Warenkorb unten am Rand, Kasse mit Abholen oder Lieferung. Abgeschickt wird an
// /api/bestellung, dort werden alle Preise neu berechnet.
// Ohne JavaScript bleibt die Speisekarte eine reine Karte.

import {
  EINSTELLUNGEN,
  optionLesen,
  gerichtId,
  positionBerechnen,
  summenBerechnen,
  zuCent,
  euro,
  zeitfenster,
  datumText,
} from "./bestellung-regeln.mjs";

const SPEICHER = "akashi-warenkorb";
const esc = (w) => String(w).replace(/[&<>"']/g, (z) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[z]);

// ── Gerichte aus der Karte lesen ──────────────────────────────────────────
const gerichte = new Map();
for (const li of document.querySelectorAll(".kategorie .gericht")) {
  const kategorie = li.closest(".kategorie")?.id.replace(/^karte-/, "") ?? "";
  const nr = li.querySelector(".gericht__nr")?.textContent.trim() ?? "";
  const kopf = li.querySelector(".gericht__name");
  const name = [...kopf.childNodes].filter((n) => !n.classList?.contains("gericht__nr")).map((n) => n.textContent).join("").trim();
  const preisCent = zuCent(li.querySelector(".gericht__preis data")?.value);
  if (!name || !preisCent) continue;
  const zeile = li.querySelector(".gericht__optionen")?.textContent ?? "";
  const optionen = zeile ? zeile.split(", ").map((o) => optionLesen(o, preisCent)) : [];
  const id = gerichtId(kategorie, nr, name);
  gerichte.set(id, { id, nr, name, preisCent, optionen });

  const knopf = document.createElement("button");
  knopf.type = "button";
  knopf.className = "gericht__dazu";
  knopf.dataset.gericht = id;
  knopf.setAttribute("aria-label", `${name} in den Warenkorb`);
  knopf.innerHTML = `<span aria-hidden="true">+</span>`;
  li.querySelector(".gericht__kopf").append(knopf);
}
if (!gerichte.size) throw new Error("Keine Gerichte gefunden");

// ── Warenkorb ──────────────────────────────────────────────────────────────
// Position: { id, wahl: { optionsIndex: auswahlIndex | true }, menge }
let korb = [];
try {
  korb = JSON.parse(localStorage.getItem(SPEICHER) ?? "[]").filter((p) => gerichte.has(p.id));
} catch {}
const speichern = () => {
  try {
    localStorage.setItem(SPEICHER, JSON.stringify(korb));
  } catch {}
};
const schluessel = (p) => p.id + JSON.stringify(p.wahl);

function hinzufuegen(id, wahl, menge) {
  const neu = { id, wahl, menge };
  const vorhanden = korb.find((p) => schluessel(p) === schluessel(neu));
  if (vorhanden) vorhanden.menge = Math.min(EINSTELLUNGEN.maxMenge, vorhanden.menge + menge);
  else korb.push(neu);
  speichern();
  aktualisieren();
  leiste.classList.remove("korbleiste--hupf");
  void leiste.offsetWidth;
  leiste.classList.add("korbleiste--hupf");
}

const position = (p) => ({ ...positionBerechnen(gerichte.get(p.id), p.wahl, p.menge), gericht: gerichte.get(p.id) });
const zwischensumme = () => korb.reduce((s, p) => s + position(p).summeCent, 0);
const anzahl = () => korb.reduce((s, p) => s + p.menge, 0);

// ── Leiste am unteren Rand ─────────────────────────────────────────────────
const leiste = document.createElement("div");
leiste.className = "korbleiste";
leiste.hidden = true;
leiste.innerHTML = `<button type="button" class="korbleiste__knopf"><span class="korbleiste__zahl"></span><span class="korbleiste__text">Warenkorb ansehen</span><span class="korbleiste__summe"></span></button>`;
document.body.append(leiste);

// ── Dialog für Optionen ────────────────────────────────────────────────────
const wahlDialog = document.createElement("dialog");
wahlDialog.className = "bestelldialog";
wahlDialog.setAttribute("aria-labelledby", "wahl-titel");
document.body.append(wahlDialog);

function wahlOeffnen(id) {
  const g = gerichte.get(id);
  let menge = 1;
  const gruppen = g.optionen
    .map((opt, i) => {
      if (opt.art === "wahl") {
        return `<fieldset class="wahl"><legend>${esc(opt.titel)}</legend>${opt.auswahl
          .map((a, j) => `<label class="wahl__punkt"><input type="radio" name="o${i}" value="${j}" ${j === 0 ? "checked" : ""}><span>${esc(a.name)}</span>${a.aufpreis ? `<span class="wahl__preis">+${euro(a.aufpreis)}</span>` : ""}</label>`)
          .join("")}</fieldset>`;
      }
      if (opt.art === "extra") {
        return `<label class="wahl__punkt wahl__punkt--extra"><input type="checkbox" name="o${i}"><span>${esc(opt.name)}</span>${opt.aufpreis ? `<span class="wahl__preis">+${euro(opt.aufpreis)}</span>` : ""}</label>`;
      }
      return `<p class="wahl__hinweis">${esc(opt.text)}</p>`;
    })
    .join("");
  wahlDialog.innerHTML = `
    <form method="dialog" class="bestelldialog__inhalt">
      <button class="dialog__zu" value="abbruch" aria-label="Schließen">×</button>
      <p class="bestelldialog__nr">${esc(g.nr)}</p>
      <h2 class="bestelldialog__titel" id="wahl-titel">${esc(g.name)}</h2>
      <div class="bestelldialog__optionen">${gruppen}</div>
      <div class="bestelldialog__fuss">
        <div class="menge" role="group" aria-label="Anzahl">
          <button type="button" class="menge__knopf" data-schritt="-1" aria-label="Eins weniger">−</button>
          <output class="menge__zahl" aria-live="polite">1</output>
          <button type="button" class="menge__knopf" data-schritt="1" aria-label="Eins mehr">+</button>
        </div>
        <button class="knopf bestelldialog__dazu" value="dazu">In den Warenkorb · <span class="bestelldialog__preis"></span></button>
      </div>
    </form>`;
  const form = wahlDialog.querySelector("form");
  const lesen = () => {
    const wahl = {};
    g.optionen.forEach((opt, i) => {
      const feld = form.elements[`o${i}`];
      if (opt.art === "wahl") wahl[i] = Number(form.querySelector(`input[name="o${i}"]:checked`)?.value ?? 0);
      if (opt.art === "extra" && feld?.checked) wahl[i] = true;
    });
    return wahl;
  };
  const neuRechnen = () => {
    form.querySelector(".menge__zahl").textContent = menge;
    form.querySelector(".bestelldialog__preis").textContent = euro(positionBerechnen(g, lesen(), menge).summeCent);
  };
  form.addEventListener("change", neuRechnen);
  form.querySelectorAll(".menge__knopf").forEach((k) =>
    k.addEventListener("click", () => {
      menge = Math.min(EINSTELLUNGEN.maxMenge, Math.max(1, menge + Number(k.dataset.schritt)));
      neuRechnen();
    }),
  );
  wahlDialog.onclose = () => {
    if (wahlDialog.returnValue === "dazu") hinzufuegen(id, lesen(), menge);
  };
  neuRechnen();
  wahlDialog.returnValue = "";
  wahlDialog.showModal();
}

document.addEventListener("click", (e) => {
  const knopf = e.target.closest(".gericht__dazu");
  if (!knopf) return;
  const g = gerichte.get(knopf.dataset.gericht);
  if (g.optionen.some((o) => o.art !== "hinweis")) return wahlOeffnen(g.id);
  hinzufuegen(g.id, {}, 1);
  knopf.classList.add("gericht__dazu--ok");
  knopf.innerHTML = `<span aria-hidden="true">✓</span>`;
  setTimeout(() => {
    knopf.classList.remove("gericht__dazu--ok");
    knopf.innerHTML = `<span aria-hidden="true">+</span>`;
  }, 1200);
});

// ── Warenkorb und Kasse ────────────────────────────────────────────────────
const korbDialog = document.createElement("dialog");
korbDialog.className = "bestelldialog korb";
korbDialog.setAttribute("aria-labelledby", "korb-titel");
korbDialog.innerHTML = `
  <div class="bestelldialog__inhalt">
    <button type="button" class="dialog__zu" aria-label="Schließen">×</button>

    <section class="korb__schritt" data-schritt="korb">
      <h2 class="bestelldialog__titel" id="korb-titel">Dein Warenkorb</h2>
      <ul class="korb__liste"></ul>
      <p class="korb__leer" hidden>Noch nichts ausgewählt. Tippe bei einem Gericht auf +.</p>
      <dl class="korb__summen"></dl>
      <button type="button" class="knopf korb__weiter">Weiter zur Bestellung</button>
    </section>

    <form class="korb__schritt korb__kasse" data-schritt="kasse" hidden novalidate>
      <button type="button" class="korb__zurueck">← Zurück zum Warenkorb</button>
      <h2 class="bestelldialog__titel">Bestellung abschließen</h2>

      <fieldset class="umschalter">
        <legend class="visually-hidden">Abholen oder liefern</legend>
        <label><input type="radio" name="art" value="abholung" checked><span>Abholen</span></label>
        <label><input type="radio" name="art" value="lieferung"><span>Liefern lassen</span></label>
      </fieldset>

      <div class="feld">
        <label for="b-zeit">Wann</label>
        <select id="b-zeit" name="zeit" required></select>
      </div>

      <div class="kasse__raster">
        <div class="feld"><label for="b-name">Name</label><input id="b-name" name="name" autocomplete="name" required></div>
        <div class="feld"><label for="b-telefon">Telefon</label><input id="b-telefon" name="telefon" type="tel" autocomplete="tel" required></div>
        <div class="feld kasse__voll"><label for="b-email">E-Mail</label><input id="b-email" name="email" type="email" autocomplete="email" required></div>
      </div>

      <div class="kasse__raster kasse__adresse" hidden>
        <div class="feld kasse__voll"><label for="b-strasse">Straße und Hausnummer</label><input id="b-strasse" name="strasse" autocomplete="street-address"></div>
        <div class="feld"><label for="b-plz">PLZ</label><input id="b-plz" name="plz" inputmode="numeric" autocomplete="postal-code" maxlength="5"></div>
        <div class="feld"><label for="b-ort">Ort</label><input id="b-ort" name="ort" autocomplete="address-level2" value="Bremen"></div>
        <p class="feld__hilfe kasse__voll kasse__gebiet"></p>
      </div>

      <div class="feld">
        <label for="b-anmerkung">Anmerkungen <span class="optional">optional</span></label>
        <textarea id="b-anmerkung" name="anmerkung" maxlength="500" placeholder="Klingel, Allergien, Besteck …"></textarea>
      </div>

      <fieldset class="umschalter umschalter--klein">
        <legend>Bezahlung bei Übergabe</legend>
        <label><input type="radio" name="zahlung" value="bar" checked><span>Bar</span></label>
        <label><input type="radio" name="zahlung" value="karte"><span>Karte</span></label>
      </fieldset>

      <input class="visually-hidden" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">

      <label class="einwilligung"><input type="checkbox" name="einwilligung" required>
        <span>Ich bin einverstanden, dass das Akashi meine Angaben speichert, um die Bestellung zu bearbeiten. Mehr dazu in der <a href="/datenschutz.html" target="_blank" rel="noopener">Datenschutzerklärung</a>.</span></label>

      <dl class="korb__summen"></dl>
      <p class="kasse__fehler" role="alert" hidden></p>
      <button class="knopf kasse__absenden" type="submit">Zahlungspflichtig bestellen</button>
      <p class="feld__hilfe">Bezahlt wird bei Abholung oder an der Tür. Fragen zu Allergenen: <a href="tel:+4942143093028">0421 43093028</a></p>
    </form>

    <section class="korb__schritt korb__danke" data-schritt="danke" hidden tabindex="-1">
      <span class="stempel" aria-hidden="true">受付</span>
      <h2 class="bestelldialog__titel">Danke für deine Bestellung</h2>
      <p class="korb__danke-text"></p>
      <button type="button" class="knopf knopf--linie korb__fertig">Fertig</button>
    </section>
  </div>`;
document.body.append(korbDialog);

const $ = (s) => korbDialog.querySelector(s);
const kasse = $(".korb__kasse");
const art = () => kasse.elements.art.value;

function schritt(name) {
  korbDialog.querySelectorAll(".korb__schritt").forEach((s) => (s.hidden = s.dataset.schritt !== name));
  korbDialog.querySelector(".bestelldialog__inhalt").scrollTop = 0;
}

function summenHtml() {
  const z = zwischensumme();
  const s = summenBerechnen(z, art());
  const fehlt = zuCent(EINSTELLUNGEN.mindestwertLieferung) - z;
  return `<dt>Zwischensumme</dt><dd>${euro(s.zwischensummeCent)}</dd>${
    art() === "lieferung" ? `<dt>Liefergebühr</dt><dd>${euro(s.gebuehrCent)}</dd>` : ""
  }<dt class="korb__gesamt">Gesamt</dt><dd class="korb__gesamt">${euro(s.gesamtCent)}</dd>${
    art() === "lieferung" && fehlt > 0 ? `<p class="korb__mindest">Noch ${euro(fehlt)} bis zum Mindestbestellwert für Lieferung (${euro(zuCent(EINSTELLUNGEN.mindestwertLieferung))}).</p>` : ""
  }`;
}

function aktualisieren() {
  const n = anzahl();
  leiste.hidden = n === 0;
  leiste.querySelector(".korbleiste__zahl").textContent = n;
  leiste.querySelector(".korbleiste__summe").textContent = euro(zwischensumme());
  leiste.querySelector(".korbleiste__knopf").setAttribute("aria-label", `Warenkorb ansehen, ${n} ${n === 1 ? "Gericht" : "Gerichte"}, ${euro(zwischensumme())}`);

  $(".korb__liste").innerHTML = korb
    .map((p, i) => {
      const pos = position(p);
      return `<li class="korb__posten">
        <div class="korb__name"><strong>${esc(pos.gericht.name)}</strong>${pos.details.length ? `<span>${esc(pos.details.join(", "))}</span>` : ""}</div>
        <div class="menge menge--klein" role="group" aria-label="Anzahl ${esc(pos.gericht.name)}">
          <button type="button" class="menge__knopf" data-posten="${i}" data-schritt="-1" aria-label="${p.menge === 1 ? "Entfernen" : "Eins weniger"}">${p.menge === 1 ? "×" : "−"}</button>
          <output class="menge__zahl">${p.menge}</output>
          <button type="button" class="menge__knopf" data-posten="${i}" data-schritt="1" aria-label="Eins mehr">+</button>
        </div>
        <span class="korb__preis">${euro(pos.summeCent)}</span>
      </li>`;
    })
    .join("");
  $(".korb__leer").hidden = korb.length > 0;
  $(".korb__weiter").hidden = korb.length === 0;
  korbDialog.querySelectorAll(".korb__summen").forEach((dl) => (dl.innerHTML = korb.length ? summenHtml() : ""));
}

function zeitenFuellen() {
  const auswahl = kasse.elements.zeit;
  const vorher = auswahl.value;
  const tage = zeitfenster(art());
  auswahl.innerHTML = tage.length
    ? tage.map((t) => `<optgroup label="${datumText(t.datum)}">${t.zeiten.map((z) => `<option value="${t.datum} ${z}">${datumText(t.datum)}, ${z} Uhr</option>`).join("")}</optgroup>`).join("")
    : `<option value="">Gerade keine Zeiten verfügbar</option>`;
  if ([...auswahl.options].some((o) => o.value === vorher)) auswahl.value = vorher;
}

function gebietPruefen() {
  const plz = kasse.elements.plz.value.trim();
  const hinweis = $(".kasse__gebiet");
  if (plz.length < 5) return (hinweis.textContent = "Wir liefern in die Überseestadt und angrenzende Stadtteile.");
  hinweis.textContent = EINSTELLUNGEN.liefergebiet.includes(plz) ? "✓ Wir liefern zu dir." : "Diese PLZ liegt leider außerhalb unseres Liefergebiets. Abholen geht natürlich.";
}

function artGeaendert() {
  const liefern = art() === "lieferung";
  $(".kasse__adresse").hidden = !liefern;
  for (const n of ["strasse", "plz", "ort"]) kasse.elements[n].required = liefern;
  zeitenFuellen();
  gebietPruefen();
  aktualisieren();
}

leiste.addEventListener("click", () => {
  aktualisieren();
  schritt("korb");
  korbDialog.showModal();
});
$(".dialog__zu").addEventListener("click", () => korbDialog.close());
korbDialog.addEventListener("click", (e) => {
  if (e.target === korbDialog) korbDialog.close();
  const k = e.target.closest(".menge__knopf[data-posten]");
  if (!k) return;
  const p = korb[Number(k.dataset.posten)];
  p.menge += Number(k.dataset.schritt);
  if (p.menge <= 0) korb.splice(Number(k.dataset.posten), 1);
  p.menge = Math.min(EINSTELLUNGEN.maxMenge, p.menge);
  speichern();
  aktualisieren();
});
wahlDialog.addEventListener("click", (e) => {
  if (e.target === wahlDialog) wahlDialog.close();
});
$(".korb__weiter").addEventListener("click", () => {
  artGeaendert();
  schritt("kasse");
  kasse.elements.name.focus({ preventScroll: true });
});
$(".korb__zurueck").addEventListener("click", () => schritt("korb"));
$(".korb__fertig").addEventListener("click", () => korbDialog.close());
kasse.addEventListener("change", (e) => {
  if (e.target.name === "art") artGeaendert();
});
kasse.elements.plz.addEventListener("input", gebietPruefen);

function fehler(text) {
  const f = $(".kasse__fehler");
  f.textContent = text;
  f.hidden = !text;
}

kasse.addEventListener("submit", async (e) => {
  e.preventDefault();
  fehler("");
  const f = kasse.elements;
  for (const feld of kasse.querySelectorAll("input, select, textarea")) feld.removeAttribute("aria-invalid");
  const ungueltig = [...kasse.querySelectorAll("[required]")].find((feld) => (feld.type === "checkbox" ? !feld.checked : !feld.value.trim()) || !feld.checkValidity());
  if (ungueltig) {
    ungueltig.setAttribute("aria-invalid", "true");
    ungueltig.focus();
    return fehler(ungueltig.name === "einwilligung" ? "Bitte bestätige noch die Einwilligung." : "Bitte fülle alle Felder aus.");
  }
  if (art() === "lieferung" && !EINSTELLUNGEN.liefergebiet.includes(f.plz.value.trim())) {
    f.plz.setAttribute("aria-invalid", "true");
    return fehler("In diese PLZ liefern wir leider nicht. Wähl gern „Abholen“.");
  }
  if (art() === "lieferung" && zwischensumme() < zuCent(EINSTELLUNGEN.mindestwertLieferung)) {
    return fehler(`Für Lieferung brauchen wir mindestens ${euro(zuCent(EINSTELLUNGEN.mindestwertLieferung))}.`);
  }
  const [datum, uhrzeit] = f.zeit.value.split(" ");
  const knopf = $(".kasse__absenden");
  knopf.disabled = true;
  knopf.textContent = "Wird gesendet …";
  try {
    const antwort = await fetch("/api/bestellung", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        art: art(),
        datum,
        uhrzeit,
        name: f.name.value,
        telefon: f.telefon.value,
        email: f.email.value,
        strasse: f.strasse.value,
        plz: f.plz.value,
        ort: f.ort.value,
        anmerkung: f.anmerkung.value,
        zahlung: f.zahlung.value,
        einwilligung: f.einwilligung.checked,
        website: f.website.value,
        positionen: korb.map(({ id, wahl, menge }) => ({ id, wahl, menge })),
        gesamtAngezeigt: summenBerechnen(zwischensumme(), art()).gesamtCent,
      }),
    });
    const daten = await antwort.json().catch(() => ({}));
    if (!antwort.ok || !daten.ok) throw new Error(daten.fehler || "Das hat leider nicht geklappt. Ruf uns gern an unter 0421 43093028.");
    $(".korb__danke-text").innerHTML = `Bestellnummer <strong>${esc(daten.nummer)}</strong>. ${
      art() === "lieferung" ? "Wir liefern" : "Abholbereit"
    } ${esc(daten.wannText)}. Gesamt ${esc(euro(daten.gesamtCent))}, bezahlt wird ${f.zahlung.value === "bar" ? "bar" : "mit Karte"} bei Übergabe. Eine Bestätigung kommt per E-Mail.`;
    korb = [];
    speichern();
    aktualisieren();
    schritt("danke");
    $(".korb__danke").focus();
  } catch (err) {
    fehler(err.message);
  } finally {
    knopf.disabled = false;
    knopf.textContent = "Zahlungspflichtig bestellen";
  }
});

// Link „Online bestellen“ oben auf der Seite: zum ersten Gericht springen und kurz zeigen, wie es geht.
if (location.hash === "#bestellen") document.querySelector(".kategorie")?.scrollIntoView();

aktualisieren();
