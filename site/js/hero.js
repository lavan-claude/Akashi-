// Hero: Scrollen durch die hohe Hero-Sektion spult das Samurai-Video vor und
// zurück, zoomt die Bilder leicht und blendet am Ende zur Tusche ab. Dazu steigen
// rote Glutpunkte langsam auf. Keine Effekte, die dem Mauszeiger folgen.
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
  const abblende = buehne.querySelector(".hero__abblende");
  const runter = buehne.querySelector(".hero__runter");
  const leinwand = buehne.querySelector(".hero__funken");

  const ruhig = matchMedia("(prefers-reduced-motion: reduce)");
  const breitBild = matchMedia("(min-width: 60.01rem)");
  const VIDEO_ENDE = 0.85;

  let p = 0; // Scrollfortschritt 0..1
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

  // ── Glutpunkte, die langsam aufsteigen ────────────────────────────────────
  const funken = [];
  let ctx = null, breite = 0, hoehe = 0;
  const FARBE = getComputedStyle(document.documentElement).getPropertyValue("--glut").trim() || "#ff8a4c";

  function leinwandAnpassen() {
    if (!leinwand) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
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

  function funkenZeichnen(t) {
    if (!ctx) return;
    ctx.clearRect(0, 0, breite, hoehe);
    ctx.fillStyle = FARBE;
    for (const f of funken) {
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

    if (!still) {
      // Am Computer etwas stärker vergrößert, damit das Kling-Wasserzeichen unten rechts
      // außerhalb des Bildes liegt (siehe .hero__video in site.css).
      const basis = breitBild.matches ? 1.12 : 1.04;
      const mediaT = `translate3d(${(-2 * p).toFixed(3)}%, ${(-3 * p).toFixed(3)}%, 0) scale(${(basis + p * 0.12).toFixed(4)})`;
      for (const m of medien) m.style.transform = mediaT;
      if (nebelHinten) nebelHinten.style.transform = `translate3d(${(-8 * p).toFixed(3)}%, 0, 0)`;
      if (nebelVorne) nebelVorne.style.transform = `translate3d(${(-22 * p).toFixed(3)}%, ${(-6 * p).toFixed(3)}%, 0)`;
      if (text) {
        text.style.opacity = String(Math.max(0, 1 - Math.max(0, p - 0.55) * 2.5));
        text.style.transform = `translate3d(0, ${(p * -32).toFixed(2)}px, 0)`;
      }
      if (abblende) abblende.style.opacity = String(Math.max(0, (p - 0.85) / 0.15) * 0.9);
      if (runter) runter.style.opacity = String(Math.max(0, 1 - p * 4));
      if (sichtbar) funkenZeichnen(t);
      videoSpulen();
    }

    kopfSetzen();

    // Weiterlaufen, solange der Hero im Bild ist; die Glutpunkte brauchen jedes Bild.
    if (sichtbar && !still && !document.hidden) planen();
  }

  function videoSpulen() {
    if (!video || !video.duration) return;
    const ziel = Math.min(1, p / VIDEO_ENDE) * (video.duration - 0.05);
    videoZeit += (ziel - videoZeit) * 0.12;
    if (Math.abs(ziel - videoZeit) < 0.005) videoZeit = ziel;
    if (Math.abs(video.currentTime - videoZeit) > 1 / 60) video.currentTime = videoZeit;
  }

  function planen() {
    if (!laeuft) {
      laeuft = true;
      requestAnimationFrame(bild);
    }
  }

  new IntersectionObserver(([e]) => {
    sichtbar = e.isIntersecting;
    if (sichtbar) planen();
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
    for (const el of [...medien, nebelHinten, nebelVorne, text]) el?.style.removeProperty("transform");
    video?.toggleAttribute("data-bereit", !ruhig.matches && video.readyState >= 2);
    ctx?.clearRect(0, 0, breite, hoehe);
    planen();
  });

  leinwandAnpassen();
  kopfSetzen();
  planen();
})();
