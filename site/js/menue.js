// Handy-Menü: Tippen auf das Katana zieht das Schwert und klappt die Navigation auf.
// Schließt bei Klick auf einen Eintrag, außerhalb, mit Escape oder beim Wechsel
// auf die breite Ansicht (dort gibt es die Scheide als Navigation).

(function () {
  "use strict";

  const kopf = document.querySelector(".kopf");
  const knopf = kopf?.querySelector(".schwertknopf");
  const menue = kopf?.querySelector(".schwertmenue");
  if (!knopf || !menue) return;

  const breit = matchMedia("(min-width: 52.01rem)");

  function setzen(offen) {
    knopf.setAttribute("aria-expanded", String(offen));
    knopf.setAttribute("aria-label", offen ? "Menü schließen" : "Menü öffnen");
    menue.toggleAttribute("data-offen", offen);
    kopf.toggleAttribute("data-menue-offen", offen);
    // Geschlossen soll das Menü für Tastatur und Vorleser nicht erreichbar sein.
    menue.inert = !offen;
  }

  const offen = () => knopf.getAttribute("aria-expanded") === "true";

  knopf.addEventListener("click", () => {
    setzen(!offen());
    if (offen()) menue.querySelector("a")?.focus({ preventScroll: true });
  });

  menue.addEventListener("click", (e) => {
    if (e.target.closest("a")) setzen(false);
  });

  document.addEventListener("click", (e) => {
    if (offen() && !kopf.contains(e.target)) setzen(false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && offen()) {
      setzen(false);
      knopf.focus();
    }
  });

  breit.addEventListener("change", (e) => {
    if (e.matches) setzen(false);
  });

  setzen(false);
})();
