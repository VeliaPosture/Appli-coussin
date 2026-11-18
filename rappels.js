// =====================================================================
// rappels.js — Les RAPPELS quand un objectif est dépassé
// ---------------------------------------------------------------------
// verifierRappels(m, info) est appelée par journee.js à chaque mesure.
//  - Se lever : rappel quand on est assis depuis OBJECTIF_LEVER_MIN,
//    puis de nouveau toutes les RAPPEL_LEVER_REPETER_MIN si on reste assis.
//  - Changer de position : un rappel quand on n'a pas bougé depuis
//    OBJECTIF_POSITION_MIN (une seule fois, jusqu'au prochain mouvement).
// Chaque rappel affiche une bannière, une notification de l'ordinateur
// (si activée et si l'onglet est caché) et fait vibrer le coussin
// (si activé et connecté par Bluetooth).
// =====================================================================

const etatRappels = {
  reel: { prochainLever: null, positionFaite: false, dernierRappel: 0 },
  demo: { prochainLever: null, positionFaite: false, dernierRappel: 0 },
};

function verifierRappels(m, info) {
  const r = etatRappels[m];
  const p = periodes[m];

  // ---------- Se lever ----------
  if (!p.active) r.prochainLever = null;                  // une vraie pause remet le compteur à zéro
  if (info.assis && p.active) {
    if (r.prochainLever === null) r.prochainLever = OBJECTIF_LEVER_MIN * 60;
    if (p.duree >= r.prochainLever) {
      const premier = r.prochainLever === OBJECTIF_LEVER_MIN * 60;
      rappeler("lever", premier ? TEXTES.rappelLever : TEXTES.rappelLeverEncore.replace("{duree}", duree(p.duree)), info.temps);
      r.prochainLever += RAPPEL_LEVER_REPETER_MIN * 60;
      return;
    }
  }

  // ---------- Changer de position ----------
  if (info.assis && info.immobileMs >= OBJECTIF_POSITION_MIN * 60000) {
    // pas deux rappels collés : on attend 1 min après un rappel « se lever »
    if (!r.positionFaite && info.temps - r.dernierRappel > 60000) {
      rappeler("position", TEXTES.rappelPosition.replace("{min}", OBJECTIF_POSITION_MIN), info.temps);
      r.positionFaite = true;
    }
  } else if (info.immobileMs < 5000) {
    r.positionFaite = false;                              // on a bougé : prochain rappel possible
  }
}

function rappeler(type, texte, temps) {
  const m = magasinCourant();
  etatRappels[m].dernierRappel = temps;
  const message = personnaliser(texte);

  afficherBanniere(message, type);

  // Notification de l'ordinateur, seulement si l'onglet n'est pas visible
  if (reglages.notifications && document.hidden && "Notification" in window && Notification.permission === "granted") {
    try { new Notification("Vélia", { body: message, icon: "images/favicon.png" }); } catch (e) {}
  }

  // Vibration du coussin : 3 vibrations pour se lever, 1 pour changer de position
  if (reglages.vibration && typeof envoyerCommande === "function") {
    envoyerCommande(type === "lever" ? "V=3" : "V=1");
  }
}

// ---------- Bannière en haut de l'écran ----------
let minuterieBanniere = null;
function afficherBanniere(message, type) {
  $("banniereTexte").textContent = message;
  $("banniere").className = "banniere visible " + type;
  clearTimeout(minuterieBanniere);
  minuterieBanniere = setTimeout(fermerBanniere, 12000);
}
function fermerBanniere() { $("banniere").className = "banniere"; }
$("banniereFermer").onclick = fermerBanniere;
