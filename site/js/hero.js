// Hero: Das Samurai-Video läuft genau wie geliefert einmal ab und bleibt auf dem
// letzten Bild stehen (Wunsch von Lavan): kein Zoom, kein Abdunkeln, kein Spulen.
// Darüber steigen rote Glutpunkte langsam auf.
// Bei reduzierter Bewegung bleibt das Standbild stehen, ohne Glutpunkte.

(function () {
  "use strict";

  const kopf = document.querySelector(".kopf--schwebend");
  const hero = document.querySelector(".hero");
  const buehne = hero?.querySelector(".hero__buehne");
  if (!hero || !buehne) return;

  const video = buehne.querySelector(".hero__video");
  const leinwand = buehne.querySelector(".hero__funken");
  const ruhig = matchMedia("(prefers-reduced-motion: reduce)");

  let laeuft = false;
  let sichtbar = true;

  function kopfSetzen() {
    if (!kopf) return;
    const ueberHero = hero.getBoundingClientRect().bottom > kopf.offsetHeight;
    kopf.toggleAttribute("data-gescrollt", scrollY > 24 && !ueberHero);
  }

  // ── Video ─────────────────────────────────────────────────────────────────
  function videoStarten() {
    if (!video || ruhig.matches) return;
    video.play().catch(() => {});
  }

  if (video) {
    video.addEventListener("loadeddata", () => {
      if (ruhig.matches) { video.pause(); return; }
      video.toggleAttribute("data-bereit", true);
      videoStarten();
    });
    video.addEventListener("error", () => video.remove());
    // iPhone im Stromsparmodus startet stumme Videos erst nach einer Berührung.
    addEventListener("touchstart", videoStarten, { once: true, passive: true });
    if (ruhig.matches) video.pause();
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

  function bild(t) {
    laeuft = false;
    if (!ctx || ruhig.matches) return;
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
    if (sichtbar && !document.hidden) planen();
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

  addEventListener("scroll", kopfSetzen, { passive: true });
  addEventListener("resize", () => { leinwandAnpassen(); planen(); });
  document.addEventListener("visibilitychange", planen);
  ruhig.addEventListener("change", () => {
    if (ruhig.matches) { video?.pause(); ctx?.clearRect(0, 0, breite, hoehe); }
    else { video?.toggleAttribute("data-bereit", video.readyState >= 2); videoStarten(); planen(); }
  });

  leinwandAnpassen();
  kopfSetzen();
  planen();
})();
