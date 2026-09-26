// Google Maps erst nach Klick einbetten. Vorher gehen keine Daten an Google.
(function () {
  const karte = document.querySelector("[data-karte]");
  const knopf = karte && karte.querySelector("[data-karte-laden]");
  if (!knopf) return;

  knopf.addEventListener("click", function () {
    const rahmen = document.createElement("iframe");
    rahmen.src = karte.dataset.karte;
    rahmen.title = "Karte: Akashi, Ludwig-Franzius-Platz 13, 28217 Bremen";
    rahmen.loading = "lazy";
    rahmen.referrerPolicy = "no-referrer-when-downgrade";
    rahmen.allowFullscreen = true;
    karte.replaceChildren(rahmen);
    karte.dataset.geladen = "";
  });
})();
