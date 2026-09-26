// Einblenden beim Scrollen: Elemente mit .aufdeck bekommen data-da, sobald sie
// ins Bild kommen. Das CSS lässt sie dann hochgleiten. Ohne JavaScript oder bei
// reduzierter Bewegung ist alles sofort sichtbar.

(function () {
  "use strict";

  const elemente = document.querySelectorAll(".aufdeck");
  if (!elemente.length) return;

  if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    elemente.forEach((el) => el.setAttribute("data-da", ""));
    return;
  }

  const beobachter = new IntersectionObserver(
    (eintraege) => {
      for (const e of eintraege) {
        if (!e.isIntersecting) continue;
        e.target.setAttribute("data-da", "");
        beobachter.unobserve(e.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px" },
  );
  elemente.forEach((el) => beobachter.observe(el));
})();
