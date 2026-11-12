// =====================================================================
// journee.js — Le RÉSUMÉ DE LA JOURNÉE (section « Ma journée »)
// ---------------------------------------------------------------------
// 1. compterJournee(info) est appelée par app.js à chaque mesure :
//    elle ajoute le temps écoulé aux bons compteurs de la journée.
// 2. afficherJournee() dessine la section : phrase, bandes, chiffres.
//
// Les vraies données (coussin) et les données d'essai (démo, relecture)
// sont gardées SÉPARÉMENT, pour ne jamais les mélanger.
// =====================================================================

let journal = chargerJournal();            // { reel: { "2026-11-11": stats }, demo: {...} }
let jourAffiche = null;                    // jour affiché, ou null = le plus récent
let derniersTemps = { reel: null, demo: null };
let derniersMouvementsComptes = { reel: 0, demo: 0 };
let derniereSauvegarde = 0;
let affichagePrevu = false;

function chargerJournal() {
  try {
    const j = JSON.parse(localStorage.getItem(CLE_JOURNAL));
    if (j && j.reel && j.demo) return j;
  } catch (e) {}
  return { reel: {}, demo: {} };
}
function sauverJournal() {
  try { localStorage.setItem(CLE_JOURNAL, JSON.stringify(journal)); } catch (e) {}
  derniereSauvegarde = Date.now();
}
window.addEventListener("beforeunload", sauverJournal);

// Quel magasin utiliser : "reel" pour le coussin, "demo" pour la démo et la relecture
function magasinCourant() {
  return (typeof source !== "undefined" && (source === "demo" || source === "relecture")) ? "demo" : "reel";
}

function cleJour(temps) {
  const d = new Date(temps);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function statsVides() {
  return { assis: 0, gauche: 0, centre: 0, droite: 0, dosAppuye: 0, dosDecolle: 0,
           mouvements: 0, immobileMax: 0, heures: {} };
}

// =====================================================================
// 1. COMPTAGE
// =====================================================================
function compterJournee(info) {
  const m = magasinCourant();

  // Temps écoulé depuis la mesure précédente (plafonné à 5 s pour ignorer les coupures)
  const precedent = derniersTemps[m];
  derniersTemps[m] = info.temps;
  const dt = precedent === null ? 1 : Math.min(Math.max(info.temps - precedent, 0), 5000) / 1000;
  if (!info.assis || dt === 0) { prevoirAffichage(); return; }

  const jour = cleJour(info.temps);
  const heure = new Date(info.temps).getHours();
  const s = journal[m][jour] || (journal[m][jour] = statsVides());
  const h = s.heures[heure] || (s.heures[heure] = { assis: 0, gauche: 0, centre: 0, droite: 0 });

  s.assis += dt;
  h.assis += dt;

  // Côté où la personne appuie
  if (info.partGauche !== null) {
    const cote = info.partGauche >= SEUIL_COTE ? "gauche"
               : info.partGauche <= 1 - SEUIL_COTE ? "droite" : "centre";
    s[cote] += dt;
    h[cote] += dt;
  }

  // Dos
  if (info.dosAppuye !== null) s[info.dosAppuye ? "dosAppuye" : "dosDecolle"] += dt;

  // Mouvements (un mouvement continu ne compte qu'une fois par DELAI_ENTRE_MOUVEMENTS)
  if (info.mouvement && info.temps - derniersMouvementsComptes[m] >= DELAI_ENTRE_MOUVEMENTS) {
    s.mouvements++;
    derniersMouvementsComptes[m] = info.temps;
  }
  s.immobileMax = Math.max(s.immobileMax, info.immobileMs / 1000);

  nettoyerVieuxJours(m);
  if (Date.now() - derniereSauvegarde > 10000) sauverJournal();   // sauvegarde aux 10 s
  prevoirAffichage();
}

function nettoyerVieuxJours(m) {
  const jours = Object.keys(journal[m]).sort();
  while (jours.length > JOURS_CONSERVES) delete journal[m][jours.shift()];
}

// Redessine au plus 2 fois par seconde (la démo accélérée envoie beaucoup de mesures)
function prevoirAffichage() {
  if (affichagePrevu) return;
  affichagePrevu = true;
  setTimeout(() => { affichagePrevu = false; afficherJournee(); }, 500);
}

// =====================================================================
// 2. AFFICHAGE
// =====================================================================
function duree(secondes) {
  if (secondes < 60) return Math.round(secondes) + " s";
  const min = Math.round(secondes / 60);
  if (min < 60) return min + " min";
  return Math.floor(min / 60) + " h " + String(min % 60).padStart(2, "0");
}

function pourcent(partie, total) { return total > 0 ? Math.round(partie / total * 100) : 0; }

function segment(largeur, couleur, texte, texteFonce) {
  const etiquette = largeur >= 12 && texte ? texte : "";
  return `<div style="width:${largeur}%;background:${couleur};${texteFonce ? "color:#2c2c2a" : ""}">${etiquette}</div>`;
}

function afficherJournee() {
  const m = magasinCourant();
  const jours = Object.keys(journal[m]).sort();
  const jour = (jourAffiche && journal[m][jourAffiche]) ? jourAffiche : jours[jours.length - 1];
  const s = jour ? journal[m][jour] : null;
  const index = jours.indexOf(jour);

  // En-tête
  $("badgeDemo").hidden = m !== "demo";
  $("btnEffacerDemo").hidden = m !== "demo";
  $("jourPrecedent").disabled = index <= 0;
  $("jourSuivant").disabled = index < 0 || index >= jours.length - 1;
  $("titreJournee").textContent = TEXTES.titreJournee + (jour ? " · " +
    new Date(jour + "T12:00:00").toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" }) : "");

  if (!s || s.assis < 1) {
    $("sousTitreJournee").textContent = "";
    $("phraseJournee").textContent = TEXTES.aucuneDonnee;
    $("contenuJournee").hidden = true;
    return;
  }
  $("contenuJournee").hidden = false;
  $("sousTitreJournee").textContent = duree(s.assis) + " assis · " + s.mouvements + " mouvements";

  // Phrase résumé : le côté dominant
  const totalCote = s.gauche + s.centre + s.droite;
  const parts = { gauche: pourcent(s.gauche, totalCote), centre: pourcent(s.centre, totalCote), droite: pourcent(s.droite, totalCote) };
  const dominant = Object.keys(parts).reduce((a, b) => parts[a] >= parts[b] ? a : b);
  const modele = { gauche: TEXTES.resumeGauche, centre: TEXTES.resumeCentre, droite: TEXTES.resumeDroite }[dominant];
  $("phraseJournee").textContent = modele.replace("{pct}", parts[dominant]);

  // Bande : côté
  const C = COULEURS_JOURNEE;
  $("bandeCote").innerHTML =
    segment(parts.gauche, C.gauche, parts.gauche + " %") +
    segment(parts.centre, C.centre, parts.centre + " %", true) +
    segment(parts.droite, C.droite, parts.droite + " %");
  $("legendeCote").innerHTML =
    `<span><i style="background:${C.gauche}"></i>Gauche ${parts.gauche} %</span>` +
    `<span><i style="background:${C.centre}"></i>Centré ${parts.centre} %</span>` +
    `<span><i style="background:${C.droite}"></i>Droite ${parts.droite} %</span>`;

  // Bande : dos
  const totalDos = s.dosAppuye + s.dosDecolle;
  $("blocDos").hidden = totalDos === 0;
  const pA = pourcent(s.dosAppuye, totalDos);
  $("bandeDos").innerHTML =
    segment(pA, C.dosAppuye, "Appuyé " + pA + " %") +
    segment(100 - pA, C.dosDecolle, "Décollé " + (100 - pA) + " %", true);

  // Bande : heure par heure (couleur = côté dominant pendant l'heure)
  const heures = Object.keys(s.heures).map(Number);
  const debut = Math.min(8, ...heures), fin = Math.max(17, ...heures);
  let html = "";
  for (let h = debut; h <= fin; h++) {
    const hh = s.heures[h];
    let couleur = C.absent;
    if (hh && hh.assis >= 180) {                      // au moins 3 min assis dans l'heure
      const cote = ["gauche", "centre", "droite"].reduce((a, b) => hh[a] >= hh[b] ? a : b);
      couleur = C[cote];
    }
    html += `<div style="flex:1;background:${couleur}" title="${h} h"></div>`;
  }
  $("bandeHeures").innerHTML = html;
  const milieu = Math.round((debut + fin) / 2);
  $("heuresEtiquettes").innerHTML = `<span>${debut} h</span><span>${milieu} h</span><span>${fin + 1} h</span>`;

  // Chiffres clés
  $("statAssis").textContent = duree(s.assis);
  $("statMouvements").textContent = s.mouvements;
  $("statImmobile").textContent = duree(s.immobileMax);
}

// ---------- Navigation et bouton ----------
$("jourPrecedent").onclick = () => naviguer(-1);
$("jourSuivant").onclick = () => naviguer(+1);
function naviguer(sens) {
  const jours = Object.keys(journal[magasinCourant()]).sort();
  const actuel = (jourAffiche && jours.includes(jourAffiche)) ? jourAffiche : jours[jours.length - 1];
  const i = Math.min(Math.max(jours.indexOf(actuel) + sens, 0), jours.length - 1);
  jourAffiche = i === jours.length - 1 ? null : jours[i];   // null = suit le jour le plus récent
  afficherJournee();
}

$("btnEffacerDemo").onclick = () => {
  journal.demo = {};
  derniersTemps.demo = null;
  jourAffiche = null;
  sauverJournal();
  afficherJournee();
};

afficherJournee();
