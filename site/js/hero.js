// Hero: überträgt den Scrollfortschritt durch die hohe Hero-Sektion als
// --fortschritt (0 bis 1) auf die Bühne. Alles Weitere regelt das CSS.
// Bei reduzierter Bewegung bleibt der Hero still.

(function () {
  "use strict";

  const kopf = document.querySelector(".kopf--schwebend");
  const hero = document.querySelector(".hero");
  const buehne = hero?.querySelector(".hero__buehne");
  const ruhig = window.matchMedia("(prefers-reduced-motion: reduce)");

  let geplant = false;

  function aktualisieren() {
    geplant = false;

    if (kopf) kopf.toggleAttribute("data-gescrollt", window.scrollY > 24 && (!hero || hero.getBoundingClientRect().bottom < kopf.offsetHeight + 1));

    if (!buehne || ruhig.matches) return;
    const r = hero.getBoundingClientRect();
    const weg = r.height - window.innerHeight;
    const p = weg > 0 ? Math.min(1, Math.max(0, -r.top / weg)) : 0;
    buehne.style.setProperty("--fortschritt", p.toFixed(4));
  }

  function planen() {
    if (!geplant) {
      geplant = true;
      requestAnimationFrame(aktualisieren);
    }
  }

  window.addEventListener("scroll", planen, { passive: true });
  window.addEventListener("resize", planen);
  ruhig.addEventListener("change", () => {
    buehne?.style.removeProperty("--fortschritt");
    planen();
  });
  aktualisieren();
})();
