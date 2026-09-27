// Hero: Scrollen und Maus bewegen die Bühne.
// - Scrollen durch die hohe Hero-Sektion spult das Samurai-Video vor und zurück,
//   zoomt die Bilder leicht und blendet am Ende zur Tusche ab.
// - Die Maus (oder ein Finger) verschiebt die Ebenen gegeneinander, zieht ein warmes
//   Laternenlicht mit und schiebt Glutfunken beiseite.
// Transformationen werden direkt an den Ebenen gesetzt, nicht über eine Variable am
// Elternelement, damit nicht bei jedem Bild alle Kinder neu berechnet werden.
// Bei reduzierter Bewegung bleibt der Hero still auf dem Standbild.

(function () {
  "use strict";

  const kopf = document.querySelector(".kopf--schwebend");
  const hero = document.querySelector(".hero");
  const buehne = hero?.querySelector(".hero__buehne");
  if (!hero || !buehne) return;

  const video = buehne.querySelector(".hero__video");
  const medien = [...buehne.querySelectorAll(".hero__bild, .hero__video, .hero__torii")];
  const nebelHinten = buehne.querySelector(".hero__nebel--hinten");
  const nebelVorne = buehne.querySelector(".hero__nebel--vorne");
  const text = buehne.querySelector(".hero__text");
  const karten = buehne.querySelector(".hero__karten");
  const licht = buehne.querySelector(".hero__licht");
  const abblende = buehne.querySelector(".hero__abblende");
  const runter = buehne.querySelector(".hero__runter");
  const leinwand = buehne.querySelector(".hero__funken");

  const ruhig = matchMedia("(prefers-reduced-motion: reduce)");
  const schmal = matchMedia("(max-width: 60rem)");
  const feineMaus = matchMedia("(hover: hover) and (pointer: fine)");

  const VIDEO_ENDE = 0.85;
  const NACHFUEHRUNG = 0.08; // wie weich die Ebenen der Maus folgen

  let p = 0;               // Scrollfortschritt 0..1
  let zielX = 0, zielY = 0; // Maus, -1..1
  let mx = 0, my = 0;       // nachgeführte Maus
  let lichtX = 0, lichtY = 0, lichtZielX = 0, lichtZielY = 0;
  let videoZeit = 0;
  let laeuft = false;
  let sichtbar = true;

  function scrollLesen() {
    const r = hero.getBoundingClientRect();
    const weg = r.height - innerHeight;
    return weg > 0 ? Math.min(1, Math.max(0, -r.top / weg)) : 0;
  }

  function kopfSetzen() {
    if (!kopf) return;
    const ueberHero = hero.getBoundingClientRect().bottom > kopf.offsetHeight;
    kopf.toggleAttribute("data-gescrollt", scrollY > 24 && !ueberHero);
  }

  // ── Glutfunken ────────────────────────────────────────────────────────────
  const funken = [];
  let ctx = null, breite = 0, hoehe = 0, dpr = 1;
  const FARBE = getComputedStyle(document.documentElement).getPropertyValue("--glut").trim() || "#ff8a4c";

  function leinwandAnpassen() {
    if (!leinwand) return;
    dpr = Math.min(2, devicePixelRatio || 1);
    breite = buehne.clientWidth;
    hoehe = buehne.clientHeight;
    leinwand.width = breite * dpr;
    leinwand.height = hoehe * dpr;
    ctx = leinwand.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const anzahl = Math.round(Math.min(70, breite / 22));
    funken.length = 0;
    for (let i = 0; i < anzahl; i++) funken.push(neuerFunke(true));
  }

  function neuerFunke(irgendwo) {
    return {
      x: Math.random() * breite,
      y: irgendwo ? Math.random() * hoehe : hoehe + 10,
      vx: (Math.random() - 0.5) * 0.25,
      vy: -(0.25 + Math.random() * 0.6),
      r: 0.6 + Math.random() * 1.6,
      a: 0.25 + Math.random() * 0.55,
      phase: Math.random() * Math.PI * 2,
    };
  }

  // ── Rote Blüten, die der Zeiger hinterlässt ──────────────────────────────
  // Vier vorgezeichnete Blüten in Rottönen; gezeichnet wird nur noch gedreht und skaliert.
  const blueten = [];
  const MAX_BLUETEN = 180;
  const wurzel = getComputedStyle(document.documentElement);
  const bluetenFarben = ["--shu", "--shu-on-dark", "--shu-deep", "--bluete-hell"]
    .map((v) => wurzel.getPropertyValue(v).trim())
    .filter(Boolean);
  const kelch = wurzel.getPropertyValue("--kin").trim() || "#b8955a";
  const vorlagen = bluetenFarben.map((farbe) => {
    const g = 64, c = document.createElement("canvas");
    c.width = c.height = g;
    const k = c.getContext("2d");
    k.translate(g / 2, g / 2);
    k.fillStyle = farbe;
    for (let i = 0; i < 5; i++) {
      k.rotate((Math.PI * 2) / 5);
      k.beginPath();
      // Blütenblatt mit kleiner Kerbe an der Spitze, wie bei der Kirschblüte
      k.moveTo(0, 0);
      k.bezierCurveTo(-13, -8, -12, -24, -3, -28);
      k.lineTo(0, -24);
      k.lineTo(3, -28);
      k.bezierCurveTo(12, -24, 13, -8, 0, 0);
      k.fill();
    }
    k.fillStyle = kelch;
    k.beginPath();
    k.arc(0, 0, 4, 0, Math.PI * 2);
    k.fill();
    return c;
  });
  let letzteX = -999, letzteY = -999;

  // fallend: Blüte schwebt als Regen von oben herab statt aus der Zeigerspur aufzuspringen.
  function bluetenStreuen(x, y, anzahl, fallend = false) {
    if (!vorlagen.length) return;
    for (let i = 0; i < anzahl; i++) {
      if (blueten.length >= MAX_BLUETEN) blueten.shift();
      blueten.push({
        x: x + (Math.random() - 0.5) * 14,
        y: y + (Math.random() - 0.5) * 14,
        vx: (Math.random() - 0.5) * (fallend ? 0.5 : 0.9),
        vy: fallend ? 0.5 + Math.random() * 0.5 : -0.2 - Math.random() * 0.5,
        schwere: fallend ? 0.003 : 0.018,
        dreh: Math.random() * Math.PI * 2,
        drall: (Math.random() - 0.5) * 0.05,
        groesse: 9 + Math.random() * 13,
        alter: 0,
        dauer: fallend ? 360 + Math.random() * 200 : 110 + Math.random() * 80, // Bilder bei 60 fps
        bild: vorlagen[(Math.random() * vorlagen.length) | 0],
      });
    }
  }

  function bluetenZeichnen() {
    for (let i = blueten.length - 1; i >= 0; i--) {
      const b = blueten[i];
      b.alter++;
      if (b.alter > b.dauer) { blueten.splice(i, 1); continue; }
      b.vy += b.schwere;         // sinkt langsam
      b.vx *= 0.99;
      b.x += b.vx + Math.sin((b.alter + i) / 18) * 0.25; // schaukelt beim Fallen
      b.y += b.vy;
      b.dreh += b.drall;
      const t = b.alter / b.dauer;
      const auf = Math.min(1, b.alter / 12);                  // springt auf
      const s = b.groesse * (0.4 + 0.6 * (1 - (1 - auf) ** 3));
      ctx.globalAlpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;   // verblasst am Ende
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.dreh);
      ctx.drawImage(b.bild, -s, -s, s * 2, s * 2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function funkenZeichnen(t) {
    if (!ctx) return;
    ctx.clearRect(0, 0, breite, hoehe);
    bluetenZeichnen();
    ctx.fillStyle = FARBE;
    const px = lichtX, py = lichtY;
    for (const f of funken) {
      // Die Maus schiebt Funken sanft beiseite.
      const dx = f.x - px, dy = f.y - py;
      const d2 = dx * dx + dy * dy;
      if (d2 < 22000) {
        const k = (1 - d2 / 22000) * 0.35;
        const d = Math.sqrt(d2) || 1;
        f.vx += (dx / d) * k;
        f.vy += (dy / d) * k;
      }
      f.vx *= 0.97;
      f.vy = f.vy * 0.985 - 0.012;
      f.x += f.vx + Math.sin(t / 900 + f.phase) * 0.15;
      f.y += f.vy;
      if (f.y < -10 || f.x < -20 || f.x > breite + 20) Object.assign(f, neuerFunke(false));
      ctx.globalAlpha = f.a * (0.6 + 0.4 * Math.sin(t / 300 + f.phase));
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ── Ein Bild ──────────────────────────────────────────────────────────────
  function bild(t) {
    laeuft = false;
    const still = ruhig.matches;

    p = scrollLesen();
    mx += (zielX - mx) * NACHFUEHRUNG;
    my += (zielY - my) * NACHFUEHRUNG;
    lichtX += (lichtZielX - lichtX) * 0.14;
    lichtY += (lichtZielY - lichtY) * 0.14;

    if (!still) {
      const zoom = 1.04 + p * 0.14;
      const mediaT = `translate3d(${(-2 * p - 1.2 * mx).toFixed(3)}%, ${(-3 * p - 0.9 * my).toFixed(3)}%, 0) scale(${zoom.toFixed(4)})`;
      for (const m of medien) m.style.transform = mediaT;
      if (nebelHinten) nebelHinten.style.transform = `translate3d(${(-8 * p + 2 * mx).toFixed(3)}%, ${(1.5 * my).toFixed(3)}%, 0)`;
      if (nebelVorne) nebelVorne.style.transform = `translate3d(${(-22 * p + 5 * mx).toFixed(3)}%, ${(-6 * p + 3 * my).toFixed(3)}%, 0)`;

      if (text) {
        text.style.opacity = String(Math.max(0, 1 - Math.max(0, p - 0.55) * 2.5));
        text.style.transform = `translate3d(${(mx * 6).toFixed(2)}px, ${(p * -32 + my * 4).toFixed(2)}px, 0)`;
      }
      if (karten && !schmal.matches) {
        karten.style.transform = `translate3d(${(mx * -12).toFixed(2)}px, ${(p * -48 + my * -8).toFixed(2)}px, 0) rotateY(${(mx * -6).toFixed(2)}deg) rotateX(${(my * 5).toFixed(2)}deg)`;
      }
      if (abblende) abblende.style.opacity = String(Math.max(0, (p - 0.85) / 0.15) * 0.9);
      if (runter) runter.style.opacity = String(Math.max(0, 1 - p * 4));

      // Ohne Maus (Handy, Tablet) fallen die Blüten von selbst, wie ein leichter Regen.
      if (sichtbar && !feineMaus.matches && Math.random() < 0.04) {
        bluetenStreuen(Math.random() * breite, -12, 1, true);
      }

      if (licht) licht.style.transform = `translate3d(${lichtX.toFixed(1)}px, ${lichtY.toFixed(1)}px, 0) translate(-50%, -50%)`;
      if (sichtbar) funkenZeichnen(t);
      videoSpulen();
    }

    kopfSetzen();

    // Weiterlaufen, solange der Hero im Bild ist; die Funken brauchen jedes Bild.
    if (sichtbar && !still && !document.hidden) planen();
  }

  function videoSpulen() {
    if (!video || !video.duration) return;
    const ziel = Math.min(1, p / VIDEO_ENDE) * (video.duration - 0.05);
    videoZeit += (ziel - videoZeit) * 0.18;
    if (Math.abs(ziel - videoZeit) < 0.005) videoZeit = ziel;
    if (Math.abs(video.currentTime - videoZeit) > 1 / 60) video.currentTime = videoZeit;
  }

  function planen() {
    if (!laeuft) {
      laeuft = true;
      requestAnimationFrame(bild);
    }
  }

  // ── Eingaben ──────────────────────────────────────────────────────────────
  function zeigen(e) {
    if (e.pointerType === "touch") return; // Finger laufen über die Touch-Ereignisse unten
    const r = buehne.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    zielX = (x / r.width) * 2 - 1;
    zielY = (y / r.height) * 2 - 1;
    lichtZielX = x;
    lichtZielY = y;
    buehne.setAttribute("data-maus", "");
    // Alle paar Pixel Weg eine neue Blüte, beim Tippen ein kleiner Strauß.
    if (!ruhig.matches) {
      const weg = Math.hypot(x - letzteX, y - letzteY);
      if (e.type === "pointerdown") bluetenStreuen(x, y, 7);
      else if (weg > 16) bluetenStreuen(x, y, weg > 60 ? 2 : 1);
      if (e.type === "pointerdown" || weg > 16) { letzteX = x; letzteY = y; }
    }
    planen();
  }
  buehne.addEventListener("pointermove", zeigen, { passive: true });
  buehne.addEventListener("pointerdown", zeigen, { passive: true });
  buehne.addEventListener("pointerleave", () => {
    zielX = zielY = 0;
    buehne.removeAttribute("data-maus");
    planen();
  });

  // Finger: Touch-Ereignisse laufen auch weiter, während die Seite scrollt,
  // Zeiger-Ereignisse brechen dann ab. So bleibt beim Wischen eine Blütenspur.
  function beruehren(e) {
    const t = e.touches[0];
    if (!t) return;
    zeigen({ clientX: t.clientX, clientY: t.clientY, type: e.type === "touchstart" ? "pointerdown" : "pointermove" });
  }
  buehne.addEventListener("touchstart", beruehren, { passive: true });
  buehne.addEventListener("touchmove", beruehren, { passive: true });
  buehne.addEventListener("touchend", () => { zielX = zielY = 0; planen(); }, { passive: true });

  // Ohne feine Maus (Handy) wandert das Licht langsam von selbst.
  let wandern = 0;
  function lichtWandern() {
    if (feineMaus.matches || ruhig.matches || !sichtbar) return;
    wandern += 0.004;
    lichtZielX = breite * (0.6 + 0.25 * Math.sin(wandern * 1.3));
    lichtZielY = hoehe * (0.45 + 0.2 * Math.cos(wandern));
    buehne.setAttribute("data-maus", "");
    setTimeout(lichtWandern, 50);
  }

  new IntersectionObserver(([e]) => {
    sichtbar = e.isIntersecting;
    if (sichtbar) { planen(); lichtWandern(); }
  }).observe(buehne);

  if (video) {
    video.pause();
    // iPhone: Safari lädt stumme Videos oft erst nach einem ersten Abspielen.
    // Bei der ersten Berührung einmal kurz starten und anhalten, dann lässt es sich spulen.
    const freischalten = () => {
      if (video.readyState < 2) video.load();
      video.play().then(() => video.pause()).catch(() => {});
    };
    addEventListener("touchstart", freischalten, { once: true, passive: true });
    setTimeout(() => { if (video.isConnected && video.readyState < 2) video.load(); }, 1500);
    video.addEventListener("loadeddata", () => {
      if (ruhig.matches) return;
      video.toggleAttribute("data-bereit", true);
      planen();
    });
    video.addEventListener("error", () => video.remove());
  }

  addEventListener("scroll", planen, { passive: true });
  addEventListener("resize", () => { leinwandAnpassen(); planen(); });
  document.addEventListener("visibilitychange", planen);
  ruhig.addEventListener("change", () => {
    for (const el of [...medien, nebelHinten, nebelVorne, text, karten, licht]) el?.style.removeProperty("transform");
    video?.toggleAttribute("data-bereit", !ruhig.matches && video.readyState >= 2);
    ctx?.clearRect(0, 0, breite, hoehe);
    planen();
  });

  leinwandAnpassen();
  lichtX = lichtZielX = breite * 0.62;
  lichtY = lichtZielY = hoehe * 0.45;
  kopfSetzen();
  planen();
  lichtWandern();
})();
