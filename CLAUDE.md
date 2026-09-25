# Akashi Bremen – Projektregeln

Website für **Akashi – Japanese Restaurant & Izakaya**, Ludwig-Franzius-Platz 13,
28217 Bremen, Telefon 0421 43093028. Sushi, Ramen, Izakaya-Küche. Vor Ort,
zum Mitnehmen, Lieferung. 20–40 € pro Person. Ziel der Seite: Tischreservierungen.

## Stack

Reines HTML, CSS und JavaScript ohne Build-Schritt, gehostet auf Netlify –
wie `mi-elevate`.

```
site/                 wird veröffentlicht (netlify.toml: publish = "site")
  index.html          Seite mit Reservierung
  danke.html          Bestätigung ohne JavaScript
  css/tokens.css      Designsystem: Farben, Schrift, Abstände, Radien
  css/site.css        Gestaltung
  js/reservierung.js  Prüfung und Versand des Formulars
  fonts/              selbst gehostete Schriften, keine Google-Fonts-Einbindung
netlify/functions/    Weiterleitung der Reservierung ans Restaurant-System
docs/                 Schnittstelle der Reservierung
```

Lokal ansehen: `npx netlify dev` (mit Formularen und Funktionen) oder
`npx serve site` (nur die Seite, Absenden schlägt dann fehl).

## Designsystem

Tusche, Washi-Papier und das Rot der Torii. Filmisch, ruhig, hochwertig.

- Farben nur als Variablen aus `css/tokens.css`. Keine Farbwerte in `site.css`.
- `--shu` (Torii-Rot) trägt nur Handlung und Stempel: Knopf, Kanji-Zeichen, Fehler.
- Schrift: **Shippori Mincho** für Überschriften und Kanji, **Zen Kaku Gothic New**
  für Text. Keine dritte Familie.
- Kanji immer in Gewicht 800. Neue Kanji müssen in die Datei
  `fonts/shippori-mincho-800-kanji.woff2` und in deren `unicode-range`.
- Radien fast eckig (`--radius-s`, `--radius-m`), kein Karten-Baukasten.

## Sprache und Ton

Deutsch, **Du**-Form. Klar, gastfreundlich, keine Ausrufezeichen, keine Emojis.

## Reservierung

Siehe `docs/reservierung-schnittstelle.md`. Felder des Formulars:
`datum`, `uhrzeit`, `personen`, `name`, `telefon`, `email`, `nachricht`,
`einwilligung`, `quelle`. Honigtopf `bot-field`. Änderungen an Feldern auch in
`netlify/functions/submission-created.mjs` und in der Doku nachziehen.

## Arbeitsweise

- Jede Animation respektiert `prefers-reduced-motion`.
- Vor dem Commit im Browser prüfen, auf Desktop und bei 390 px Breite.
- Impressum und Datenschutz nur nach Vorlage des Restaurants.
- Vor Livegang `X-Robots-Tag: noindex` aus `netlify.toml` entfernen.
