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
                      ohne Fotos (Wunsch von Lavan). Das Skript kann sie noch:
                      "foto" in speisekarte.json zeigt es rechts neben der Liste
  favicon.ico         Browser-Symbol: roter Hanko-Stempel 明石
  assets/icon/        icon-192.png, icon-512.png, apple-touch-icon.png
  assets/og-akashi.jpg  Vorschaubild für WhatsApp und Co. (1200 × 630)
  danke.html          Bestätigung ohne JavaScript
  css/tokens.css      Designsystem: Farben, Schrift, Abstände, Radien
  css/site.css        Gestaltung
  js/reservierung.js  Prüfung und Versand des Formulars
  js/hero.js          Hero: Scroll spult das Video, rote Glutpunkte steigen auf
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
  Knöpfe (28.09.2026, Wunsch von Lavan): Hauptknopf asymmetrisch gerundet
  (`border-radius: 4px 16px 4px 16px`). Im Hero ist „Speisekarte“ ein Textlink
  mit Pfeil. Andere Nebenknöpfe bleiben eckige Rahmen. Beim Überfahren wischt
  eine Füllfarbe herein (`--fuellung`).
- Hero-Animation (Wunsch von Lavan, 27.09.2026): Die einzige Animation sind
  rote Glutpunkte, die langsam aufsteigen, dazu spult Scrollen das Video.
  Nichts folgt dem Mauszeiger: keine Blüten, kein Laternenlicht, keine
  Parallaxe. Auf dem Handy bleibt die Bühne beim Scrollen stehen.
  Alles in `js/hero.js`, bei reduzierter Bewegung aus. Keine Karten und kein
  Schild rechts im Hero.
- Hero und Reservierung dunkel (Tusche), Über uns und Speisekarte auf hellem
  Washi-Papier (`.papier`).
- Japanische Abschnittszeichen in Pinselschrift **Yuji Boku** (`.pinsel`, senkrecht
  mit Tuschestrich). Texte bleiben Deutsch. Nur echtes Japanisch, kein
  vereinfachtes Chinesisch. Die Schriftdatei enthält nur die verwendeten
  Zeichen; neue Zeichen erst in `fonts/yuji-boku-pinsel.woff2` aufnehmen.
  Neu zuschneiden: volle YujiBoku-Regular.ttf aus google/fonts, mit npm `subset-font`
  auf die Zeichen der `unicode-range` in tokens.css plus die neuen, dann Liste dort ergänzen.
- Handy-Menü (unter 52rem): Katana-Knopf `.schwertknopf` neben „Tisch reservieren“,
  Klick zieht die Klinge und öffnet `.schwertmenue` (js/menue.js). Einträge müssen zur
  Scheide `.saya` passen, auf index.html und speisekarte.html.

- Navigation liegt auf einer Katana-Scheide (`.saya`): Griff, Stichblatt,
  Kordel, Endkappe sind reine CSS-Zierde, Farben dafür in `tokens.css`
  (`--urushi`, `--kin`, `--hagane`). Beim Überfahren wird das Schwert gezogen.
- Kapitel wechseln zwischen `.kapitel--papier` und `.kapitel--tusche`. Aufbau
  angelehnt an antica-weyhe.vercel.app.
- Bewegung: Tokens `--ease-out` und `--ease-in-out`, Hover-Bewegung nur bei
  `(hover: hover) and (pointer: fine)`, Einblenden 600 ms. Der Hero setzt
  Transformationen direkt an den Ebenen, nicht über Variablen am Elternelement.
- Tusche-Design (28.09.2026, Wunsch von Lavan): nur bei „Über Akashi“ ein roter
  Pinselstrich unter der Überschrift (`assets/tusche/strich.svg`) und ein zarter
  Tuschefleck (`fleck.svg`). Nicht auf andere Überschriften übertragen.
- Hero-Name: 明石 als Pinselzug, „Akashi“ in Mincho, roter Hanko-Stempel.

## Nicht nach Vorlage aussehen

Die Seite soll nach einem echten Restaurant aussehen, nicht nach einem
KI-Baukasten. Deshalb:

- Keine Kapitelzeilen in gesperrten Großbuchstaben über Überschriften (`.kicker`).
- Keine Standard-Tabellenlinien: Öffnungszeiten mit gepunkteter Führungslinie
  wie auf einer gedruckten Karte, „heute“ als kleiner roter Stempel.
- Im Hero steht alles linksbündig, auch der Hinweis „Weiter“.
- Fotos stehen nie nackt: `.rahmen` (Passepartout wie ein Abzug, versetzte rote
  Linie dahinter) auf Papier, `.rahmen--lack` (Lack mit Messinglinie) auf
  Tusche. Das Bild sitzt in `.rahmen__fenster`. Ausnahme (Wunsch von Lavan):
  Die Bilderleiste bleibt randlos ohne Rahmen. Teamfoto liegt schräg über der
  Ecke des Gastraum-Fotos, darauf ein kleiner 明石-Stempel.
- Keine Pfeile in Knöpfen, keine Mittelpunkte als Trenner.
- Keine Zahlenreihen und „Vertrauensbausteine“ (72 Gerichte, 4,7 Sterne …).
  Eine Bewertung höchstens als echtes Zitat eines Gastes.
  Ausnahme auf Wunsch von Lavan: Die Karten-Kästen auf der Startseite behalten
  ihre roten Nummern 01–08 und die Zahl der Gerichte.
- Hero-Text (27.09.2026, abends): nur 明石 Akashi mit Stempel, ein Satz, zwei
  Knöpfe ohne Pfeile. Keine Kapitelzeile, keine Merkmal-Zeile, keine Sterne.
- Izakaya (Wunsch von Lavan, 27.09.2026): Überschrift, Liste Vor Ort / Abholen / Lieferung und rechts die rote Sonne
  mit 居酒屋 statt Foto. Kein erklärender Text.
- Stimmen (`#stimmen`, vor der Reservierung): Laufband wie bei MI Elevate mit echten
  Google-Bewertungen (reines CSS, `.band`), wörtlich, Namen gekürzt, Quelle und
  Stand im Kommentar. Nie Zitate erfinden oder umformulieren, Kürzungen mit […].
  Gesamtwert 4,7 und 367 Bewertungen von Hand aktualisieren. Achtung: Die
  Tripadvisor-Einträge „Akashi Restaurant Bremen“ gehören zu einem anderen Lokal.
- Einblenden von Bildern (`.aufdeck--bild`): zugeschnitten wird nur das `img`,
  nie das beobachtete Element selbst, sonst meldet Chrome es nicht als sichtbar.
- Abschnitte bewusst unterschiedlich bauen, nicht jeder braucht Wort, Titel,
  Text und Liste.
- Texte in der Stimme des Restaurants, kurz. Nichts erklären, was Gäste wissen.
- Über uns: Text von Lavan (Herkunft aus dem Streetfood-Restaurant Doki Doki,
  Rosu Katsukaré, Softshell-Crab Roll). Auf der Karte heißt die Roll
  „Softshell-Crab Roll“, nicht „Softshell-Caviar Roll“.
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

Seit 28.09.2026: neues Kling-Video (Samurai im Gras vor der roten Sonne,
zieht nach der Hälfte das Schwert), 1920 × 1080, 8 s. Quelle
`Downloads/kling_20260928_VIDEO_Create_an__422_0.mp4`, nicht im Repo. Farben
bewusst unverändert wie im Original (Wunsch von Lavan), nur der Ton ist
entfernt. Nicht nachfärben.

Das Video trägt unten rechts das Wasserzeichen „KlingAI 3.0 Omni“. Vor
Livegang durch die Fassung ohne Wasserzeichen ersetzen und die
Nutzungsbedingungen von Kling für gewerbliche Nutzung prüfen.

Das Standbild `samurai.jpg` ist das erste Bild des Videos und zugleich die
Ansicht bei reduzierter Bewegung.

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

- `main` ist die Seite, die live auf akashibremen.netlify.app steht. Seit dem
  27.09.2026 ist das die überarbeitete Fassung (vorher auf `neue-version`).
  Hier wird weitergebaut.
- `neue-version` ist in `main` aufgegangen und wird nicht mehr gebraucht.
- `live-bis-27-09` ist die alte Live-Fassung (Blüten, Laternenlicht, Karten im
  Hero). `alte-version` und `vor-fotos` sind ältere Sicherungen.

## Arbeitsweise

- Jede Animation respektiert `prefers-reduced-motion`.
- Vor dem Commit im Browser prüfen, auf Desktop und bei 390 px Breite.
- Impressum und Datenschutz nur nach Vorlage des Restaurants.
- Vor Livegang `X-Robots-Tag: noindex` aus `netlify.toml` entfernen.
- Google-Angaben (JSON-LD `Restaurant`) im Kopf von index.html: beim Umzug
  alle `akashibremen.netlify.app`-Adressen auf akashi-bremen.de umstellen.
  Öffnungszeiten dort bei jeder Änderung mitpflegen. Keine `aggregateRating`.
