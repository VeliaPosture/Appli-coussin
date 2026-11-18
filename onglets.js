// =====================================================================
// onglets.js — La NAVIGATION entre les onglets et l'état de l'en-tête
// ---------------------------------------------------------------------
// Chaque bouton d'onglet a un data-onglet="nom", qui affiche la section
// id="onglet-nom". Le dernier onglet ouvert est retenu par le navigateur.
// =====================================================================

const CLE_ONGLET = "velia_onglet";
const ONGLETS = ["direct", "posture", "lever", "reglages"];

function ouvrirOnglet(nom) {
  if (!ONGLETS.includes(nom)) nom = "direct";
  for (const n of ONGLETS) $("onglet-" + n).hidden = n !== nom;
  document.querySelectorAll(".onglet-bouton").forEach(b => {
    const actif = b.dataset.onglet === nom;
    b.classList.toggle("actif", actif);
    b.setAttribute("aria-selected", actif);
  });
  try { localStorage.setItem(CLE_ONGLET, nom); } catch (e) {}
  if (nom === "posture" && typeof afficherJournee === "function") afficherJournee();
  window.scrollTo({ top: 0 });
}

// Boutons d'onglet, et tout bouton avec data-aller="nom" (ex. « Commencer »)
document.querySelectorAll("[data-onglet], [data-aller]").forEach(b => {
  b.addEventListener("click", () => ouvrirOnglet(b.dataset.onglet || b.dataset.aller));
});

// Pastille de l'en-tête et invitation de l'onglet « En direct »
function majPastille() {
  const s = typeof source !== "undefined" ? source : null;
  const textes = { bluetooth: "Connecté", demo: "Mode démo", relecture: "Relecture" };
  $("pastilleEtat").textContent = textes[s] || "Non connecté";
  $("pastilleEtat").className = "pastille" + (s ? " active" : "");
  $("invitation").hidden = !!s;
}

let ongletDepart = "direct";
try { ongletDepart = localStorage.getItem(CLE_ONGLET) || "direct"; } catch (e) {}
ouvrirOnglet(ongletDepart);
majPastille();
