// Samurai vor der Reservierung: Das Kling-Video wird nicht abgespielt, sondern
// beim Scrollen durch den Abschnitt vor- und zurückgespult. Kommt der Abschnitt
// ins Bild, steht der Samurai still; bis er wieder verschwindet, hat er das
// Schwert gezogen. Geladen wird das Video erst kurz bevor der Abschnitt kommt.
// Bei reduzierter Bewegung bleibt das Standbild stehen.

(function () {
  "use strict";

  const rahmen = document.querySelector("[data-samurai]");
  const video = rahmen?.querySelector(".samurai__video");
  if (!rahmen || !video) return;

  const ruhig = matchMedia("(prefers-reduced-motion: reduce)");
  let zeit = 0;
  let laeuft = false;
  let sichtbar = false;

  // Die Bühne steht, solange man durch die hohe Sektion scrollt; das Video ist
  // bei 85 % des Wegs zu Ende, der Rest gehört dem Übergang zur Reservierung.
  function fortschritt() {
    const r = rahmen.getBoundingClientRect();
    const weg = r.height - innerHeight;
    const p = weg > 80 ? -r.top / weg / 0.85 : (innerHeight - r.top) / (innerHeight + r.height);
    return Math.min(1, Math.max(0, p));
  }

  // Das Video folgt dem Scrollen weich nach, statt bei jedem Schritt zu springen.
  function bild() {
    laeuft = false;
    if (ruhig.matches || !video.duration) return;
    const ziel = fortschritt() * (video.duration - 0.05);
    zeit += (ziel - zeit) * 0.12;
    if (Math.abs(ziel - zeit) < 0.005) zeit = ziel;
    if (Math.abs(video.currentTime - zeit) > 1 / 60) video.currentTime = zeit;
    if (zeit !== ziel && sichtbar) planen();
  }

  function planen() {
    if (!laeuft) {
      laeuft = true;
      requestAnimationFrame(bild);
    }
  }

  video.pause();
  video.addEventListener("loadeddata", () => {
    if (ruhig.matches) return;
    video.toggleAttribute("data-bereit", true);
    planen();
  });
  video.addEventListener("error", () => video.remove());

  new IntersectionObserver(([e]) => {
    sichtbar = e.isIntersecting;
    if (sichtbar && video.preload !== "auto" && !ruhig.matches) {
      video.preload = "auto";
      video.load();
    }
    if (sichtbar) planen();
  }, { rootMargin: "600px 0px" }).observe(rahmen);

  addEventListener("scroll", () => { if (sichtbar) planen(); }, { passive: true });
  ruhig.addEventListener("change", () => {
    video.toggleAttribute("data-bereit", !ruhig.matches && video.readyState >= 2);
    planen();
  });
})();
