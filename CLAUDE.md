# Akashi Bremen – Projektregeln

Website für **Akashi – Japanese Restaurant & Izakaya**, Ludwig-Franzius-Platz 13,
28217 Bremen, Telefon 0421 43093028. Sushi, Ramen, Izakaya-Küche. Vor Ort,
zum Mitnehmen, Lieferung. 20–40 € pro Person. Ziel der Seite: Tischreservierungen.

## Stack

Reines HTML, CSS und JavaScript ohne Build-Schritt, gehostet auf Netlify –
wie `mi-elevate`.

```
site/                 wird veröffentlicht (netlify.toml: publish = "site")
  index.html          Startseite: Hero, Über uns, Izakaya, Standort, Karten-Kacheln, Bilderleiste, Reservierung
  speisekarte.html    die ganze Speisekarte, die Kacheln springen zur Kategorie;
                      Kategorien mit eigenem Foto ("foto" in speisekarte.json)
                      zeigen es rechts neben der Liste, es bleibt beim Scrollen stehen
  favicon.ico         Browser-Symbol: roter Hanko-Stempel 明石
  assets/icon/        icon-192.png, icon-512.png, apple-touch-icon.png
  assets/og-akashi.jpg  Vorschaubild für WhatsApp und Co. (1200 × 630)
  danke.html          Bestätigung ohne JavaScript
  css/tokens.css      Designsystem: Farben, Schrift, Abstände, Radien
  css/site.css        Gestaltung
  js/reservierung.js  Prüfung und Versand des Formulars
  js/hero.js          Hero: Scroll spult das Video, sonst nichts
  js/karte.js         markiert die sichtbare Kategorie der Speisekarte
  js/aufdecken.js     blendet .aufdeck-Elemente beim Scrollen ein
  js/anfahrt.js       markiert den heutigen Tag, lädt Google Maps erst nach Klick (Datenschutz)
  assets/logo/        freigestellter Akashi-Schriftzug für die Kopfzeile
  assets/raeume/      eigene Fotos des Restaurants, bearbeitet, als WebP
  assets/hero/        Samurai aus Kling: samurai.jpg (Standbild), samurai.mp4 + samurai.webm (Video)
  fonts/              selbst gehostete Schriften, keine Google-Fonts-Einbindung
netlify/functions/    reservierung.mjs: Serverfunktion unter /api/reservierung
docs/                 Schnittstelle der Reservierung
daten/                speisekarte.json
tools/                speisekarte.py erzeugt Karte und Kacheln
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
  Ausnahme: Knöpfe haben runde Enden (`--radius-round`). Beim Überfahren wischt
  eine Füllfarbe herein (`--fuellung`, je nach Untergrund).
- Im Hero gibt es genau einen Effekt: Scrollen spult das Video. Keine
  Maus-Effekte, kein Licht, keine Funken, keine Blüten.
- Hero und Reservierung dunkel (Tusche), Über uns und Speisekarte auf hellem
  Washi-Papier (`.papier`).
- Japanische Abschnittszeichen in Pinselschrift **Yuji Boku** (`.pinsel`, senkrecht
  mit Tuschestrich). Texte bleiben Deutsch. Nur echtes Japanisch, kein
  vereinfachtes Chinesisch. Die Schriftdatei enthält nur die verwendeten
  Zeichen; neue Zeichen erst in `fonts/yuji-boku-pinsel.woff2` aufnehmen.

- Navigation liegt auf einer Katana-Scheide (`.saya`): Griff, Stichblatt,
  Kordel, Endkappe sind reine CSS-Zierde, Farben dafür in `tokens.css`
  (`--urushi`, `--kin`, `--hagane`). Beim Überfahren wird das Schwert gezogen.
- Kapitel wechseln zwischen `.kapitel--papier` und `.kapitel--tusche`. Aufbau
  angelehnt an antica-weyhe.vercel.app.
- Bewegung: Tokens `--ease-out` und `--ease-in-out`, Hover-Bewegung nur bei
  `(hover: hover) and (pointer: fine)`, Einblenden 600 ms. Der Hero setzt
  Transformationen direkt an den Ebenen, nicht über Variablen am Elternelement.
- Hero-Name: 明石 als Pinselzug, „Akashi“ in Mincho, roter Hanko-Stempel.

## Nicht nach Vorlage aussehen

Die Seite soll nach einem echten Restaurant aussehen, nicht nach einem
KI-Baukasten. Deshalb:

- Keine Kapitelzeilen in gesperrten Großbuchstaben über Überschriften (`.kicker`).
- Keine Pfeile in Knöpfen, keine Mittelpunkte als Trenner.
- Keine Zahlenreihen und „Vertrauensbausteine“ (72 Gerichte, 4,7 Sterne …).
  Eine Bewertung höchstens als echtes Zitat eines Gastes.
  Ausnahme auf Wunsch von Lavan: Die Karten-Kästen auf der Startseite behalten
  ihre roten Nummern 01–08 und die Zahl der Gerichte.
- Abschnitte bewusst unterschiedlich bauen, nicht jeder braucht Wort, Titel,
  Text und Liste.
- Texte in der Stimme des Restaurants, kurz. Nichts erklären, was Gäste wissen.
- Echte Fotos vor Effekten. KI-Bilder nur, wo es kein eigenes Foto gibt.

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

Ziel: höchstens 4 MB.

Das Original aus Kling liegt nicht im Repo. Die aktuelle Fassung (1920 × 1080,
Stand 26.09.2026) ist aus der alten 1276er-Datei hochgerechnet, entrauscht
(`hqdn3d`, `gradfun`) und nachgeschärft (`cas`). Mit dem Original als Quelle
wird sie noch einmal deutlich besser. Das Standbild `samurai.jpg` ist das erste Bild des Videos
und zugleich die Ansicht bei reduzierter Bewegung. Das Video ist bei 85 %
Scrollweg zu Ende, danach blendet die Bühne ab.

Das aktuelle Video trägt das Kling-Wasserzeichen (kostenloses Konto). Vor
Livegang durch die Fassung ohne Wasserzeichen ersetzen und die
Nutzungsbedingungen von Kling für gewerbliche Nutzung prüfen.

## Inhalte

- Nur belegte Angaben über das Restaurant. Keine erfundenen Details wie Tresen,
  Herkunft des Kochs oder Auszeichnungen.
- Speisekarte: vollständig auf `speisekarte.html`, Quelle ist die Karte des Restaurants
  (Stand September 2026). Daten in `daten/speisekarte.json`. `python3 tools/speisekarte.py` erzeugt
  die ganze Karte in `speisekarte.html` (`KARTE:START`/`KARTE:ENDE`) und die
  Kacheln in `index.html` (`KACHELN:START`/`KACHELN:ENDE`). Nie das erzeugte HTML von Hand ändern.
- Vorschaubild und og:url stehen mit voller Adresse akashibremen.netlify.app im
  Kopf von index.html und speisekarte.html. Beim Umzug auf akashi-bremen.de
  anpassen. Solange Netlify einen Login verlangt, sieht WhatsApp kein Vorschaubild.
- Fotos: nur eigene Fotos des Restaurants, als WebP in `site/assets/raeume/`.
  Das Teamfoto liegt nur in 399 px vor, deshalb klein unter Über uns.

## Branches

- `main` ist die Seite, die live auf akashibremen.netlify.app steht
  (Samurai-Hero mit Funken, Kacheln, Zahlenreihe). **Nicht ändern**, solange
  die neue Version nicht ausdrücklich freigegeben ist.
- `neue-version` ist die Überarbeitung mit echten Fotos und ohne
  Vorlagen-Muster. Hier wird weitergebaut. Vorschau unter
  neue-version--akashibremen.netlify.app (Branch-Deploys in Netlify nötig).
- `alte-version` und `vor-fotos` sind nur Sicherungen.

## Arbeitsweise

- Jede Animation respektiert `prefers-reduced-motion`.
- Vor dem Commit im Browser prüfen, auf Desktop und bei 390 px Breite.
- Impressum und Datenschutz nur nach Vorlage des Restaurants.
- Vor Livegang `X-Robots-Tag: noindex` aus `netlify.toml` entfernen.
