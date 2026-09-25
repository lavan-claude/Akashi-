# Reservierung: Anbindung an n8n und das Restaurant-System

Aufgebaut wie das Kontaktformular von Leadflow.

## Ablauf

```
Gast füllt Formular aus (site/index.html)
        │  Prüfung im Browser (site/js/reservierung.js)
        ▼
POST /api/reservierung    netlify/functions/reservierung.mjs
        │                 prüft alle Angaben erneut, auch die Öffnungszeiten,
        │                 Honigtopf, höchstens fünf Anfragen je IP und Minute
        ▼
n8n-Workflow              RESERVIERUNG_WEBHOOK_URL
        │                 ohne Variable: https://lavan-claude.app.n8n.cloud/webhook/reservierung
        ▼
E-Mail ans Restaurant, eatbu, FoodAmigos, Google Sheet – was der Workflow vorsieht
```

- Die Webhook-Adresse steht nur im Server-Code und landet nie im Browser.
- Honigtopf-Feld `website`: für Besucher unsichtbar. Ist es ausgefüllt, wird
  die Anfrage stillschweigend verworfen, der Absender sieht trotzdem die
  Bestätigung.
- Die Ratenbegrenzung liegt im Arbeitsspeicher der Funktion. Sie bremst nur
  ab und ersetzt keinen echten Spamschutz.
- Fehlermeldungen der Funktion werden im Formular angezeigt. Nichts
  hineinschreiben, was Gäste nicht sehen sollen.
- Ohne JavaScript schickt der Browser das Formular klassisch ab. Die Funktion
  leitet dann auf `/danke.html` weiter.
- Antwortet n8n nicht oder mit Fehler, sieht der Gast eine Meldung mit der
  Telefonnummer. **Die Anfrage wird dann nirgends gespeichert.** Der Workflow
  muss also zuverlässig laufen.

## n8n-Workflow einrichten

1. In n8n einen Workflow mit Webhook-Knoten anlegen: Methode `POST`,
   Pfad `reservierung`. Das ergibt die Adresse oben.
2. Den Workflow aktivieren. Nur aktive Workflows nehmen Produktions-Aufrufe an.
3. Dahinter zum Beispiel eine E-Mail an `info@akashi-bremen.de` mit allen
   Angaben und eine Bestätigungsmail an den Gast („Wir haben deine Anfrage
   erhalten und melden uns“).
4. Soll eine andere Adresse gelten: in Netlify unter Site configuration →
   Environment variables `RESERVIERUNG_WEBHOOK_URL` setzen und neu deployen.

## Datensatz an n8n (POST, `application/json`)

```json
{
  "name": "Mia Tanaka",
  "email": "mia@example.org",
  "telefon": "0421 123456",
  "datum": "2026-10-02",
  "uhrzeit": "19:30",
  "beginn": "2026-10-02T19:30:00+02:00",
  "personen": 4,
  "grosse_gruppe": false,
  "nachricht": "Erdnussallergie",
  "quelle": "Website-Reservierung",
  "einwilligung": true
}
```

- `beginn` ist ISO 8601 mit Versatz, Sommer- und Winterzeit sind berücksichtigt.
  Damit lässt sich direkt ein Kalendereintrag anlegen.
- `personen` ist bei der Auswahl „9+“ gleich 9, dazu `grosse_gruppe: true`.
- Änderungen an den Feldern müssen zum n8n-Workflow passen.

## Öffnungszeiten

Stehen zweimal und müssen übereinstimmen: `OEFFNUNGSZEITEN` in
`site/js/reservierung.js` (Auswahl im Browser) und in
`netlify/functions/reservierung.mjs` (Prüfung auf dem Server). Letzte
Reservierung 60 Minuten vor Schluss.

## Anbindung an eatbu oder FoodAmigos

Im Umfeld des Akashi tauchen zwei Systeme auf. Unter `akashi.eatbu.com` gibt
es eine Buchungsseite von eatbu. Die bisherige Website nennt in ihrer
Datenschutzerklärung FoodAmigos (Foodamigos GmbH, Bonn) als Partner für
Online-Bestellungen. Hat eines davon eine API, ruft der n8n-Workflow sie mit
den Daten oben auf. Die Website selbst muss dafür nicht geändert werden.

Fragen an das Restaurant bzw. an den Support des Systems:
1. Werden Reservierungen über eatbu, FoodAmigos oder etwas anderes verwaltet?
2. Gibt es eine API, um Reservierungen von außen anzulegen?
3. Sollen Anfragen an info@akashi-bremen.de gehen oder an eine andere Adresse?
4. Bis wann vor Schluss nehmt ihr Reservierungen an? Voreingestellt sind 60 Minuten.
