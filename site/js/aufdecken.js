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

// Navigation auf der Scheide: markiert den Abschnitt, der gerade im Blick ist.
(function () {
  "use strict";

  const links = [...document.querySelectorAll(".saya a[data-abschnitt]")];
  if (!links.length || !("IntersectionObserver" in window)) return;

  const beobachter = new IntersectionObserver(
    (eintraege) => {
      for (const e of eintraege) {
        if (!e.isIntersecting) continue;
        for (const a of links) a.toggleAttribute("aria-current", a.dataset.abschnitt === e.target.id);
      }
    },
    { rootMargin: "-45% 0px -50% 0px" },
  );
  for (const a of links) {
    const ziel = document.getElementById(a.dataset.abschnitt);
    if (ziel) beobachter.observe(ziel);
  }
})();
