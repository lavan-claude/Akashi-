// Speisekarte: markiert in der Kategorienleiste die Kategorie, die gerade im
// Blick ist, und schiebt sie auf schmalen Bildschirmen in den sichtbaren Bereich.

(function () {
  "use strict";

  const links = [...document.querySelectorAll(".karte__nav-liste a")];
  if (!links.length || !("IntersectionObserver" in window)) return;

  const zuLink = new Map(links.map((a) => [a.hash.slice(1), a]));
  let aktiv = null;

  function markieren(id) {
    const link = zuLink.get(id);
    if (!link || link === aktiv) return;
    aktiv?.removeAttribute("aria-current");
    link.setAttribute("aria-current", "true");
    aktiv = link;
    const liste = link.parentElement.parentElement;
    const l = link.offsetLeft - liste.offsetLeft;
    if (l < liste.scrollLeft || l + link.offsetWidth > liste.scrollLeft + liste.clientWidth) {
      liste.scrollTo({ left: l - 16, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
  }

  // Eine Kategorie gilt als aktiv, sobald ihr Anfang das obere Drittel erreicht.
  const beobachter = new IntersectionObserver(
    (eintraege) => {
      for (const e of eintraege) if (e.isIntersecting) markieren(e.target.id);
    },
    { rootMargin: "-20% 0px -70% 0px" },
  );
  for (const id of zuLink.keys()) {
    const el = document.getElementById(id);
    if (el) beobachter.observe(el);
  }
})();
