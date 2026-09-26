#!/usr/bin/env python3
"""Erzeugt die Speisekarte aus daten/speisekarte.json.

Aufruf nach jeder Änderung an der Karte:  python3 tools/speisekarte.py
- site/speisekarte.html: die ganze Karte zwischen <!-- KARTE:START --> und <!-- KARTE:ENDE -->
- site/index.html: die Kacheln zwischen <!-- KACHELN:START --> und <!-- KACHELN:ENDE -->
"""
import html
import json
from pathlib import Path

WURZEL = Path(__file__).resolve().parent.parent
DATEN = WURZEL / "daten" / "speisekarte.json"
SEITE = WURZEL / "site" / "speisekarte.html"
START, ENDE = "<!-- KARTE:START -->", "<!-- KARTE:ENDE -->"
STARTSEITE = WURZEL / "site" / "index.html"
K_START, K_ENDE = "<!-- KACHELN:START -->", "<!-- KACHELN:ENDE -->"


def e(text):
    return html.escape(text, quote=True)


def preis(wert):
    """"15,5" -> "15,50", "62" -> "62,00"."""
    euro, _, cent = wert.partition(",")
    return f"{euro},{(cent + '00')[:2]}"


def merkmale(g):
    teile = []
    if g.get("veggie"):
        teile.append('<span class="merkmal merkmal--veggie">vegetarisch</span>')
    elif g.get("veggie_option"):
        teile.append('<span class="merkmal merkmal--veggie">auch vegetarisch</span>')
    if g.get("scharf"):
        teile.append('<span class="merkmal merkmal--scharf">scharf</span>')
    if g.get("beliebt"):
        teile.append('<span class="merkmal merkmal--beliebt">sehr beliebt</span>')
    return f'<p class="gericht__merkmale">{"".join(teile)}</p>' if teile else ""


def gericht(g):
    nr = f'<span class="gericht__nr">{e(g["nr"])}</span>' if g.get("nr") else ""
    zeilen = [
        '<li class="gericht">',
        '  <div class="gericht__kopf">',
        f'    <h4 class="gericht__name">{nr}{e(g["name"])}</h4>',
        f'    <p class="gericht__preis"><data value="{g["preis"].replace(",", ".")}">{preis(g["preis"])}</data></p>',
        "  </div>",
    ]
    if g.get("text"):
        zeilen.append(f'  <p class="gericht__text">{e(g["text"])}</p>')
    if g.get("liste"):
        punkte = "".join(f"<li>{e(p)}</li>" for p in g["liste"])
        zeilen.append(f'  <ul class="gericht__liste">{punkte}</ul>')
    if g.get("optionen"):
        zeilen.append(f'  <p class="gericht__optionen">{e(", ".join(g["optionen"]))}</p>')
    m = merkmale(g)
    if m:
        zeilen.append("  " + m)
    zeilen.append("</li>")
    return "\n".join(zeilen)


def kategorie(k):
    teile = [
        f'<section class="kategorie" id="karte-{k["id"]}" aria-labelledby="karte-{k["id"]}-titel">',
        f'  <h3 class="kategorie__titel" id="karte-{k["id"]}-titel">{e(k["kategorie"])}</h3>',
    ]
    if k.get("kanji"):
        teile.insert(1, f'  <span class="kategorie__kanji" aria-hidden="true">{e(k["kanji"])}</span>')
    if k.get("intro"):
        teile.append(f'  <p class="kategorie__intro">{e(k["intro"])}</p>')
    teile.append(f'  <ul class="kategorie__liste{" kategorie__liste--sets" if k["id"] == "sets" else ""}">')
    teile.extend("    " + z for g in k["gerichte"] for z in gericht(g).splitlines())
    teile.append("  </ul>")
    if k.get("hinweis"):
        teile.append(f'  <p class="kategorie__hinweis">{e(k["hinweis"])}</p>')
    teile.append("</section>")
    return "\n".join(teile)


def kacheln(karte):
    """Kacheln der Startseite, jede führt zur Kategorie auf der Kartenseite."""
    zeilen = [K_START, '<ol class="kacheln">']
    for i, k in enumerate(karte["kategorien"]):
        zeilen.append(
            f'  <li class="aufdeck" style="--i: {i}"><a class="kachel" href="speisekarte.html#karte-{k["id"]}">'
            f'<span class="kachel__nr">{i + 1:02d}</span>'
            f'<span class="kachel__kanji" aria-hidden="true">{e(k["kanji"])}</span>'
            f'<span class="kachel__name">{e(k["kategorie"])}</span>'
            f'<span class="kachel__zahl">{len(k["gerichte"])} Gerichte</span></a></li>'
        )
    zeilen += ["</ol>", K_ENDE]
    return "\n".join(zeilen)


def ersetzen(datei, start, ende, block):
    seite = datei.read_text(encoding="utf-8")
    a, b = seite.index(start), seite.index(ende) + len(ende)
    datei.write_text(seite[:a] + block + seite[b:], encoding="utf-8")


def main():
    karte = json.loads(DATEN.read_text(encoding="utf-8"))
    nav = "".join(
        f'<li><a href="#karte-{k["id"]}">{e(k["kategorie"])}</a></li>' for k in karte["kategorien"]
    )
    block = "\n".join(
        [
            START,
            '<nav class="karte__nav" aria-label="Kategorien der Speisekarte">',
            f'  <ul class="karte__nav-liste">{nav}</ul>',
            "</nav>",
            *[kategorie(k) for k in karte["kategorien"]],
            f'<p class="karte__fuss">{e(karte["hinweis"])} Stand: {e(karte["stand"])}.</p>',
            ENDE,
        ]
    )
    ersetzen(SEITE, START, ENDE, block)
    ersetzen(STARTSEITE, K_START, K_ENDE, kacheln(karte))
    anzahl = sum(len(k["gerichte"]) for k in karte["kategorien"])
    print(f"Speisekarte geschrieben: {len(karte['kategorien'])} Kategorien, {anzahl} Positionen")


if __name__ == "__main__":
    main()
