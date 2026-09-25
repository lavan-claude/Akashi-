// Hero: überträgt den Scrollfortschritt durch die hohe Hero-Sektion als
// --fortschritt (0 bis 1) auf die Bühne und spult das Samurai-Video passend
// vor und zurück. Alles Weitere regelt das CSS.
// Bei reduzierter Bewegung bleibt der Hero still auf dem Standbild.

(function () {
  "use strict";

  const kopf = document.querySelector(".kopf--schwebend");
  const hero = document.querySelector(".hero");
  const buehne = hero?.querySelector(".hero__buehne");
  const video = hero?.querySelector(".hero__video");
  const ruhig = window.matchMedia("(prefers-reduced-motion: reduce)");

  let fortschritt = 0;
  let videoZeit = 0;
  let geplant = false;
  let spultGerade = false;

  function lesen() {
    if (!hero) return 0;
    const r = hero.getBoundingClientRect();
    const weg = r.height - window.innerHeight;
    return weg > 0 ? Math.min(1, Math.max(0, -r.top / weg)) : 0;
  }

  // Das Video folgt dem Scrollen weich nach, statt bei jedem Scrollschritt zu springen.
  function spulen() {
    spultGerade = false;
    if (!video || !video.duration || ruhig.matches) return;
    const ziel = fortschritt * (video.duration - 0.05);
    videoZeit += (ziel - videoZeit) * 0.18;
    if (Math.abs(ziel - videoZeit) < 0.005) videoZeit = ziel;
    if (Math.abs(video.currentTime - videoZeit) > 1 / 60) video.currentTime = videoZeit;
    if (videoZeit !== ziel) {
      spultGerade = true;
      requestAnimationFrame(spulen);
    }
  }

  function aktualisieren() {
    geplant = false;

    if (kopf) {
      const ueberHero = hero && hero.getBoundingClientRect().bottom > kopf.offsetHeight;
      kopf.toggleAttribute("data-gescrollt", window.scrollY > 24 && !ueberHero);
    }

    if (!buehne || ruhig.matches) return;
    fortschritt = lesen();
    buehne.style.setProperty("--fortschritt", fortschritt.toFixed(4));
    if (!spultGerade) spulen();
  }

  function planen() {
    if (!geplant) {
      geplant = true;
      requestAnimationFrame(aktualisieren);
    }
  }

  if (video) {
    video.pause();
    video.addEventListener("loadeddata", () => {
      if (ruhig.matches) return;
      video.toggleAttribute("data-bereit", true);
      planen();
    });
    video.addEventListener("error", () => video.remove());
  }

  window.addEventListener("scroll", planen, { passive: true });
  window.addEventListener("resize", planen);
  ruhig.addEventListener("change", () => {
    buehne?.style.removeProperty("--fortschritt");
    video?.toggleAttribute("data-bereit", !ruhig.matches && video.readyState >= 2);
    planen();
  });
  aktualisieren();
})();
