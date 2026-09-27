// Stimmen: die Bewertungen blenden nacheinander ein, alle sieben Sekunden die
// nächste. Pfeile, Punkte und Wischen schalten von Hand weiter. Die Automatik
// pausiert bei Maus, Fokus, unsichtbarem Tab und reduzierter Bewegung.
// Ohne JavaScript stehen alle Bewertungen untereinander.

(function () {
  "use strict";

  const schau = document.querySelector("[data-schau]");
  if (!schau) return;
  const folien = [...schau.querySelectorAll(".bewertung")];
  const punkte = schau.querySelector(".stimmen__punkte");
  if (folien.length < 2 || !punkte) return;

  const ruhig = matchMedia("(prefers-reduced-motion: reduce)");
  const TAKT = 7000;
  let aktiv = 0;
  let uhr = null;
  let angehalten = false;

  const knoepfe = folien.map((f, i) => {
    const k = document.createElement("button");
    k.type = "button";
    k.className = "stimmen__punkt";
    k.setAttribute("role", "tab");
    k.setAttribute("aria-controls", f.id);
    k.setAttribute("aria-label", `Bewertung ${i + 1} von ${folien.length}`);
    k.addEventListener("click", () => { zeigen(i); neuStarten(); });
    punkte.append(k);
    return k;
  });

  function zeigen(i) {
    aktiv = (i + folien.length) % folien.length;
    folien.forEach((f, j) => {
      const an = j === aktiv;
      f.toggleAttribute("data-aktiv", an);
      f.setAttribute("aria-hidden", String(!an));
      f.inert = !an;
    });
    knoepfe.forEach((k, j) => k.setAttribute("aria-selected", String(j === aktiv)));
  }

  function neuStarten() {
    clearInterval(uhr);
    uhr = null;
    if (angehalten || ruhig.matches || document.hidden) return;
    uhr = setInterval(() => zeigen(aktiv + 1), TAKT);
  }

  schau.querySelector("[data-weiter]").addEventListener("click", () => { zeigen(aktiv + 1); neuStarten(); });
  schau.querySelector("[data-zurueck]").addEventListener("click", () => { zeigen(aktiv - 1); neuStarten(); });

  // Anhalten, solange jemand liest oder mit der Tastatur darin ist
  const halt = (an) => { angehalten = an; neuStarten(); };
  schau.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") halt(true); });
  schau.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") halt(false); });
  schau.addEventListener("focusin", () => halt(true));
  schau.addEventListener("focusout", (e) => { if (!schau.contains(e.relatedTarget)) halt(false); });
  document.addEventListener("visibilitychange", neuStarten);
  ruhig.addEventListener("change", neuStarten);

  // Wischen auf dem Handy
  let startX = null;
  schau.addEventListener("touchstart", (e) => { startX = e.touches[0].clientX; }, { passive: true });
  schau.addEventListener("touchend", (e) => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    startX = null;
    if (Math.abs(dx) < 40) return;
    zeigen(aktiv + (dx < 0 ? 1 : -1));
    neuStarten();
  }, { passive: true });

  // Pfeiltasten, wenn die Punkte den Fokus haben
  punkte.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    zeigen(aktiv + (e.key === "ArrowRight" ? 1 : -1));
    knoepfe[aktiv].focus();
  });

  schau.setAttribute("data-bereit", "");
  zeigen(0);

  // Erst loslaufen, wenn der Abschnitt im Bild ist
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting) neuStarten();
    else { clearInterval(uhr); uhr = null; }
  }).observe(schau);
})();
