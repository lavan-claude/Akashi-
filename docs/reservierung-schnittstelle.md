# Reservierung: Anbindung an das Restaurant-System

## Ablauf

```
Gast füllt Formular aus (site/index.html)
        │  Prüfung im Browser (site/js/reservierung.js)
        ▼
Netlify Forms            speichert jede Anfrage, sortiert Spam aus (Honigtopf),
        │                schickt auf Wunsch eine E-Mail ans Restaurant
        ▼
submission-created       netlify/functions/submission-created.mjs
        │                wandelt die Anfrage in das JSON unten um
        ▼
RESERVIERUNG_WEBHOOK_URL  n8n, Make, Zapier oder direkt die API des Systems
```

Die Anbindung erfolgt ohne Codeänderung: In Netlify die Umgebungsvariable
`RESERVIERUNG_WEBHOOK_URL` setzen, dann wird jede Anfrage dorthin
weitergereicht. Ohne die Variable bleibt es bei Netlify Forms und E-Mail.
Fällt das Ziel aus, geht nichts verloren. Die Anfrage liegt weiter in
Netlify Forms, der Fehler steht im Funktions-Log.

## Einrichten in Netlify

1. **E-Mail ans Restaurant:** Site configuration → Forms → Form notifications →
   Add notification → Email notification an `info@akashi-bremen.de`, Formular `reservierung`.
2. **Weiterleitung ans System:** Site configuration → Environment variables →
   `RESERVIERUNG_WEBHOOK_URL` setzen, optional `RESERVIERUNG_WEBHOOK_SECRET`.
3. Neu deployen, damit die Variablen greifen.

## Datensatz (POST, `application/json`)

```json
{
  "typ": "reservierungsanfrage",
  "version": 1,
  "id": "netlify-submission-id",
  "eingegangen_am": "2026-09-25T18:00:00.000Z",
  "quelle": "website",
  "datum": "2026-10-03",
  "uhrzeit": "19:30",
  "beginn": "2026-10-03T19:30:00+02:00",
  "zeitzone": "Europe/Berlin",
  "personen": 4,
  "grosse_gruppe": false,
  "gast": { "name": "Mia Tanaka", "telefon": "0421 123456", "email": "mia@example.org" },
  "anmerkungen": "Kinderstuhl",
  "einwilligung": true
}
```

- `beginn` ist ISO 8601 mit Versatz, Sommer- und Winterzeit sind berücksichtigt.
- `personen` ist bei der Auswahl „9+“ gleich 9, dazu `grosse_gruppe: true`.
- Ist `RESERVIERUNG_WEBHOOK_SECRET` gesetzt, steht in der Kopfzeile
  `X-Akashi-Signatur: sha256=<HMAC-SHA256 des Rohinhalts, hex>`. Das Ziel
  kann damit prüfen, dass die Anfrage wirklich von der Website kommt.

## Anbindung an eatbu oder FoodAmigos

Im Umfeld des Akashi tauchen zwei Systeme auf. Unter `akashi.eatbu.com` gibt
es eine Buchungsseite von eatbu. Die bisherige Website nennt in ihrer
Datenschutzerklärung FoodAmigos (Foodamigos GmbH, Bonn) als Partner für
Online-Bestellungen. Welches System die Reservierungen tatsächlich führt und ob
es eine offene Schnittstelle oder einen Webhook-Eingang hat, ist noch offen.
Die Antwort bestimmt den Weg:

| Das System bietet | Umsetzung |
|---|---|
| API zum Anlegen von Reservierungen | n8n-Workflow nimmt das JSON oben an und ruft die API des Systems auf. `RESERVIERUNG_WEBHOOK_URL` zeigt auf den n8n-Webhook. |
| Nur E-Mail-Eingang für Anfragen | E-Mail-Benachrichtigung aus Netlify Forms an diese Adresse schicken. |
| Nichts davon | Anfragen kommen per E-Mail. Zusätzlich kann auf der Seite ein Link zur Online-Buchung stehen. |

Fragen an das Restaurant bzw. an den Support des Systems:
0. Werden Reservierungen über eatbu, FoodAmigos oder etwas anderes verwaltet?
1. Gibt es eine API oder Schnittstelle, um Reservierungen von außen anzulegen?
2. Gibt es ein einbettbares Buchungs-Widget?
3. Sollen Anfragen an info@akashi-bremen.de gehen oder an eine andere Adresse?
4. Öffnungszeiten, Ruhetag, Küchenschluss, ab wann Gruppen anrufen sollen?
