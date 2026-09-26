# Akashi Bremen – Projektregeln

Website für **Akashi – Japanese Restaurant & Izakaya**, Ludwig-Franzius-Platz 13,
28217 Bremen, Telefon 0421 43093028. Sushi, Ramen, Izakaya-Küche. Vor Ort,
zum Mitnehmen, Lieferung. 20–40 € pro Person. Ziel der Seite: Tischreservierungen.

## Stack

Reines HTML, CSS und JavaScript ohne Build-Schritt, gehostet auf Netlify –
wie `mi-elevate`.

```
site/                 wird veröffentlicht (netlify.toml: publish = "site")
  index.html          Startseite: Hero, Über uns, Speisekarte, Reservierung
  danke.html          Bestätigung ohne JavaScript
  css/tokens.css      Designsystem: Farben, Schrift, Abstände, Radien
  css/site.css        Gestaltung
  js/reservierung.js  Prüfung und Versand des Formulars
  js/hero.js          Scroll-Effekt im Hero (setzt --fortschritt)
  js/karte.js         markiert die sichtbare Kategorie der Speisekarte
  assets/hero/        Samurai aus Kling: samurai.jpg (Standbild), samurai.mp4 + samurai.webm (Video)
  fonts/              selbst gehostete Schriften, keine Google-Fonts-Einbindung
netlify/functions/    reservierung.mjs: Serverfunktion unter /api/reservierung
docs/                 Schnittstelle der Reservierung
daten/                speisekarte.json
tools/                speisekarte.py erzeugt die Karte in index.html
```

Lokal ansehen: `npx netlify dev` (mit Serverfunktion) oder
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
- Hero und Reservierung dunkel (Tusche), Über uns und Speisekarte auf hellem
  Washi-Papier (`.papier`).
- Japanische Abschnittszeichen in Pinselschrift **Yuji Boku** (`.pinsel`, senkrecht
  mit Tuschestrich). Texte bleiben Deutsch. Nur echtes Japanisch, kein
  vereinfachtes Chinesisch. Die Schriftdatei enthält nur die verwendeten
  Zeichen; neue Zeichen erst in `fonts/yuji-boku-pinsel.woff2` aufnehmen.

## Sprache und Ton

Deutsch, **Du**-Form. Klar, gastfreundlich, keine Ausrufezeichen, keine Emojis.

## Reservierung

Aufgebaut wie das Kontaktformular von Leadflow, Details in
`docs/reservierung-schnittstelle.md`. Das Formular ruft `/api/reservierung`
auf (`netlify/functions/reservierung.mjs`), die Funktion reicht die Anfrage an
den n8n-Workflow weiter. Die Webhook-Adresse landet dadurch nie im Browser.

- Adresse nur über die Umgebungsvariable `RESERVIERUNG_WEBHOOK_URL` in Netlify,
  nie im Code, das Repo ist öffentlich. Fehlt sie, zeigt das Formular die
  Telefonnummer.
- Prüfung von Hand in `validate()`, auch der Öffnungszeiten.
- Honigtopf-Feld `website`: ausgefüllt heißt stillschweigend verwerfen, der
  Absender sieht trotzdem die Bestätigung.
- Ratenbegrenzung: höchstens fünf Anfragen je IP und Minute, im Arbeitsspeicher.
- Fehlermeldungen der Funktion werden im Formular angezeigt.
- Öffnungszeiten stehen in `site/js/reservierung.js` und in der Funktion und
  müssen übereinstimmen.

Felder an n8n: `name`, `email`, `telefon`, `datum`, `uhrzeit`, `beginn`,
`personen`, `grosse_gruppe`, `nachricht`, `quelle`, `einwilligung`. Änderungen
müssen zum n8n-Workflow passen.

## Hero-Video

Das Video wird nicht abgespielt, sondern beim Scrollen vor- und zurückgespult
(`js/hero.js`). Damit das flüssig läuft, braucht es in kurzen Abständen
Schlüsselbilder und keinen Ton:

```sh
ffmpeg -i kling.mp4 -an -vf "scale=1600:-2" -c:v libx264 -crf 23 -g 6 \
  -pix_fmt yuv420p -movflags +faststart site/assets/hero/samurai.mp4
```

Dazu eine WebM-Fassung für Chrome und Firefox:

```sh
ffmpeg -i kling.mp4 -an -c:v libvpx-vp9 -b:v 0 -crf 36 -g 6 -row-mt 1 \
  site/assets/hero/samurai.webm
```

Ziel: höchstens 4 MB. Das Standbild `samurai.jpg` ist das erste Bild des Videos
und zugleich die Ansicht bei reduzierter Bewegung. Das Video ist bei 85 %
Scrollweg zu Ende, danach blendet die Bühne ab.

Das aktuelle Video trägt das Kling-Wasserzeichen (kostenloses Konto). Vor
Livegang durch die Fassung ohne Wasserzeichen ersetzen und die
Nutzungsbedingungen von Kling für gewerbliche Nutzung prüfen.

## Inhalte

- Nur belegte Angaben über das Restaurant. Keine erfundenen Details wie Tresen,
  Herkunft des Kochs oder Auszeichnungen.
- Speisekarte: vollständig auf der Seite, Quelle ist die Karte des Restaurants
  (Stand September 2026). Daten in `daten/speisekarte.json`, das HTML erzeugt
  `python3 tools/speisekarte.py` zwischen den Markierungen `KARTE:START` und
  `KARTE:ENDE` in `index.html`. Nie das erzeugte HTML von Hand ändern.

## Arbeitsweise

- Jede Animation respektiert `prefers-reduced-motion`.
- Vor dem Commit im Browser prüfen, auf Desktop und bei 390 px Breite.
- Impressum und Datenschutz nur nach Vorlage des Restaurants.
- Vor Livegang `X-Robots-Tag: noindex` aus `netlify.toml` entfernen.
