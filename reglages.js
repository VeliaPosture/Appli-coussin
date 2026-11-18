// =====================================================================
// reglages.js — Les RÉGLAGES de la personne (onglet Réglages)
// ---------------------------------------------------------------------
// Objectifs (se lever, changer de position), prénom, notifications et
// vibration. Les choix sont gardés dans le navigateur. Les valeurs par
// défaut et les choix proposés sont dans config.js.
// =====================================================================

const CLE_REGLAGES = "velia_reglages";

let reglages = {
  lever: OBJECTIF_LEVER_MIN,
  position: OBJECTIF_POSITION_MIN,
  prenom: "",
  notifications: false,
  vibration: true,
};

try { Object.assign(reglages, JSON.parse(localStorage.getItem(CLE_REGLAGES)) || {}); } catch (e) {}

function sauverReglages() {
  try { localStorage.setItem(CLE_REGLAGES, JSON.stringify(reglages)); } catch (e) {}
}

// Les objectifs choisis remplacent les valeurs par défaut de config.js
function appliquerReglages() {
  OBJECTIF_LEVER_MIN = reglages.lever;
  OBJECTIF_POSITION_MIN = reglages.position;
}

// Remplace {prenom, } et {, prenom} par le prénom (ou par rien), puis met une majuscule au début
function personnaliser(texte) {
  const p = (reglages.prenom || "").trim();
  const t = texte.replace("{prenom, }", p ? p + ", " : "").replace("{, prenom}", p ? ", " + p : "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// ---------- Interface ----------
function boutonsChoix(idConteneur, choix, cle) {
  const conteneur = document.getElementById(idConteneur);
  conteneur.innerHTML = choix.map(v =>
    `<button type="button" data-valeur="${v}" class="${v === reglages[cle] ? "choisi" : ""}">${v} min</button>`).join("");
  conteneur.querySelectorAll("button").forEach(b => b.onclick = () => {
    reglages[cle] = Number(b.dataset.valeur);
    sauverReglages();
    appliquerReglages();
    boutonsChoix(idConteneur, choix, cle);
    if (typeof afficherJournee === "function") afficherJournee();
  });
}

function majInvitation() {
  const titre = document.getElementById("invitationTitre");
  if (titre) titre.textContent = personnaliser(TEXTES.invitationTitre);
}

function initialiserReglages() {
  boutonsChoix("choixLever", CHOIX_LEVER, "lever");
  boutonsChoix("choixPosition", CHOIX_POSITION, "position");
  document.getElementById("texteHistorique").textContent = TEXTES.reglagesHistorique;

  const champPrenom = document.getElementById("champPrenom");
  champPrenom.value = reglages.prenom;
  champPrenom.oninput = () => {
    reglages.prenom = champPrenom.value.slice(0, 30);
    sauverReglages();
    majInvitation();
    if (typeof afficherJournee === "function") afficherJournee();
  };

  const caseVibration = document.getElementById("caseVibration");
  caseVibration.checked = reglages.vibration;
  caseVibration.onchange = () => { reglages.vibration = caseVibration.checked; sauverReglages(); };

  const caseNotif = document.getElementById("caseNotifications");
  caseNotif.checked = reglages.notifications && "Notification" in window && Notification.permission === "granted";
  caseNotif.onchange = async () => {
    $("messageNotifications").textContent = "";
    if (!caseNotif.checked) { reglages.notifications = false; sauverReglages(); return; }
    if (!("Notification" in window)) { caseNotif.checked = false; return; }
    const reponse = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    reglages.notifications = reponse === "granted";
    caseNotif.checked = reglages.notifications;
    if (!reglages.notifications) $("messageNotifications").textContent = TEXTES.notificationsRefusees;
    sauverReglages();
  };

  majInvitation();
}

appliquerReglages();
initialiserReglages();
