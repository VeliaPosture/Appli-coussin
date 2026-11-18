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
// Tranche de temps assis en cours : réussie si on a bougé ou changé de posture pendant la tranche
let tranches = { reel: { temps: 0, bouge: false }, demo: { temps: 0, bouge: false } };
let dernieresPostures = { reel: null, demo: null };
// Période assise en cours (d'une pause à la suivante) : durée assise, et depuis quand on est debout
let periodes = { reel: { duree: 0, debout: null, active: false }, demo: { duree: 0, debout: null, active: false } };
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
// Compteurs du jour (s) et de l'heure (h) qui correspondent à un instant
function compteurs(m, temps) {
  const jour = cleJour(temps);
  const heure = new Date(temps).getHours();
  const s = journal[m][jour] || (journal[m][jour] = statsVides());
  const h = s.heures[heure] || (s.heures[heure] = { assis: 0, gauche: 0, centre: 0, droite: 0 });
  return [s, h];
}

// Pauses : une pause compte quand on reste debout au moins DUREE_MIN_PAUSE_S
function compterPause(m, info, dt) {
  const p = periodes[m];
  if (info.assis) {
    p.debout = null;
    p.active = true;
    p.duree += dt;
    const [s] = compteurs(m, info.temps);
    s.periodeMax = Math.max(s.periodeMax || 0, p.duree);
  } else if (p.active) {
    if (p.debout === null) p.debout = info.temps;
    else if (info.temps - p.debout >= DUREE_MIN_PAUSE_S * 1000) {
      const [s, h] = compteurs(m, p.debout);        // la pause compte à l'heure où on s'est levé
      s.pauses = (s.pauses || 0) + 1;
      h.pauses = (h.pauses || 0) + 1;
      s.periodesTotal = (s.periodesTotal || 0) + p.duree;
      s.periodesNombre = (s.periodesNombre || 0) + 1;
      periodes[m] = { duree: 0, debout: null, active: false };
    }
  }
}
function compterJournee(info) {
  const m = magasinCourant();

  // Temps écoulé depuis la mesure précédente (plafonné à 5 s pour ignorer les coupures)
  const precedent = derniersTemps[m];
  derniersTemps[m] = info.temps;
  const dt = precedent === null ? 1 : Math.min(Math.max(info.temps - precedent, 0), 5000) / 1000;
  compterPause(m, info, dt);
  if (typeof verifierRappels === "function") verifierRappels(m, info);
  if (!info.assis) {                         // debout : la tranche en cours repart à zéro
    tranches[m] = { temps: 0, bouge: false };
    dernieresPostures[m] = null;
  }
  if (!info.assis || dt === 0) { prevoirAffichage(); return; }

  const [s, h] = compteurs(m, info.temps);

  s.assis += dt;
  h.assis += dt;

  // Côté où la personne appuie
  if (info.partGauche !== null) {
    const cote = info.partGauche >= SEUIL_COTE ? "gauche"
               : info.partGauche <= 1 - SEUIL_COTE ? "droite" : "centre";
    s[cote] += dt;
    h[cote] += dt;
  }

  // Posture reconnue (bonne posture, penché à gauche, etc.)
  if (info.posture) {
    s.postures = s.postures || {};
    h.postures = h.postures || {};
    s.postures[info.posture] = (s.postures[info.posture] || 0) + dt;
    h.postures[info.posture] = (h.postures[info.posture] || 0) + dt;
  }

  // Dos
  if (info.dosAppuye !== null) s[info.dosAppuye ? "dosAppuye" : "dosDecolle"] += dt;

  // Mouvements (un mouvement continu ne compte qu'une fois par DELAI_ENTRE_MOUVEMENTS)
  if (info.mouvement && info.temps - derniersMouvementsComptes[m] >= DELAI_ENTRE_MOUVEMENTS) {
    s.mouvements++;
    derniersMouvementsComptes[m] = info.temps;
  }
  s.immobileMax = Math.max(s.immobileMax, info.immobileMs / 1000);

  // Changement de posture (ex. bonne posture → penché à droite)
  const changementPosture = info.posture && dernieresPostures[m] && info.posture !== dernieresPostures[m];
  if (changementPosture) s.changementsPosture = (s.changementsPosture || 0) + 1;
  if (info.posture) dernieresPostures[m] = info.posture;

  // Tranches de OBJECTIF_POSITION_MIN minutes : réussie si on a bougé pendant la tranche
  const t = tranches[m];
  t.temps += dt;
  if (info.mouvement || changementPosture) t.bouge = true;
  if (t.temps >= OBJECTIF_POSITION_MIN * 60) {
    s.tranches = (s.tranches || 0) + 1;
    if (t.bouge) s.tranchesReussies = (s.tranchesReussies || 0) + 1;
    tranches[m] = { temps: 0, bouge: false };
  }

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

// Anneau de progression (SVG) : pct de 0 à 100
function anneau(pct, couleur, texte) {
  const r = 38, c = 2 * Math.PI * r;
  const plein = Math.max(0, Math.min(100, pct)) / 100 * c;
  return `<svg viewBox="0 0 96 96" role="img" aria-label="${texte}">
    <circle cx="48" cy="48" r="${r}" fill="none" stroke="#F3E6D8" stroke-width="10"/>
    ${plein > 0 ? `<circle cx="48" cy="48" r="${r}" fill="none" stroke="${couleur}" stroke-width="10" stroke-linecap="round"
            stroke-dasharray="${plein} ${c}" transform="rotate(-90 48 48)"/>` : ""}
    <text x="48" y="54" text-anchor="middle">${texte}</text>
  </svg>`;
}

// Pourcentage du temps en bonne posture pour une journée (null si aucune posture)
function pctBonnePosture(s) {
  if (!s || !s.postures) return null;
  const total = Object.values(s.postures).reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  return pourcent(POSTURES.filter(p => p.bonne).reduce((t, p) => t + (s.postures[p.id] || 0), 0), total);
}

function afficherJournee() {
  afficherPosture();
  afficherLever();
}

function afficherPosture() {
  const m = magasinCourant();
  const jours = Object.keys(journal[m]).sort();
  const jour = (jourAffiche && journal[m][jourAffiche]) ? jourAffiche : jours[jours.length - 1];
  const s = jour ? journal[m][jour] : null;
  const index = jours.indexOf(jour);

  // ---------- En-tête ----------
  $("badgeDemo").hidden = m !== "demo";
  $("btnEffacerDemo").hidden = m !== "demo";
  $("jourPrecedent").disabled = index <= 0;
  $("jourSuivant").disabled = index < 0 || index >= jours.length - 1;
  $("titreJournee").textContent = TEXTES.titreJournee + (jour ? " · " +
    new Date(jour + "T12:00:00").toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" }) : "");

  if (!s || s.assis < 1) {
    $("sousTitreJournee").textContent = "";
    $("phraseJournee").textContent = TEXTES.aucuneDonnee;
    $("phraseJournee").hidden = false;
    $("contenuJournee").hidden = true;
    return;
  }
  $("contenuJournee").hidden = false;
  $("sousTitreJournee").textContent = duree(s.assis) + " assis";

  const C = COULEURS_JOURNEE;
  const totalCote = s.gauche + s.centre + s.droite;
  const parts = { gauche: pourcent(s.gauche, totalCote), centre: pourcent(s.centre, totalCote), droite: pourcent(s.droite, totalCote) };
  const totalPostures = s.postures ? Object.values(s.postures).reduce((a, b) => a + b, 0) : 0;
  const avecPostures = totalPostures > 0;
  const pct = id => pourcent((s.postures || {})[id] || 0, totalPostures);
  const mauvaises = POSTURES.filter(p => !p.bonne && pct(p.id) > 0).sort((a, b) => pct(b.id) - pct(a.id));

  // ---------- Objectif 1 : bonne posture ----------
  const pctBonne = pctBonnePosture(s);
  if (pctBonne !== null) {
    $("anneauPosture").innerHTML = anneau(pctBonne, POSTURES[0].couleur, pctBonne + " %");
    // Comparaison avec la journée précédente qui a des postures
    let precedente = null;
    for (let i = index - 1; i >= 0 && precedente === null; i--) precedente = pctBonnePosture(journal[m][jours[i]]);
    const comp = $("comparaisonPosture");
    if (precedente === null) { comp.textContent = TEXTES.comparaisonPremiere; comp.className = "petit-texte"; }
    else {
      const d = pctBonne - precedente;
      comp.textContent = d > 0 ? TEXTES.comparaisonPlus.replace("{n}", d)
                       : d < 0 ? TEXTES.comparaisonMoins.replace("{n}", -d) : TEXTES.comparaisonEgal;
      comp.className = "petit-texte " + (d > 0 ? "hausse" : d < 0 ? "baisse" : "");
    }
  } else {
    $("anneauPosture").innerHTML = anneau(0, POSTURES[0].couleur, "--");
    $("comparaisonPosture").textContent = TEXTES.calibrationAncienne;
  }

  // ---------- Objectif 2 : changer de position ----------
  const tr = s.tranches || 0, ok = s.tranchesReussies || 0;
  const taux = tr > 0 ? pourcent(ok, tr) : null;
  $("anneauPosition").innerHTML = anneau(taux || 0, "#F28C2E", taux === null ? "--" : taux + " %");
  $("sousTitrePosition").textContent = taux === null
    ? TEXTES.tranchesPasEncore.replace("{min}", OBJECTIF_POSITION_MIN)
    : TEXTES.sousTitreChangerPosition.replace("{min}", OBJECTIF_POSITION_MIN);

  // ---------- Phrase résumé ----------
  if (avecPostures) {
    let phrase = TEXTES.resumePosture.replace("{pct}", pctBonne);
    phrase += mauvaises.length
      ? TEXTES.resumeHabitude.replace("{nom}", mauvaises[0].nom.toLowerCase()).replace("{pct}", pct(mauvaises[0].id))
      : TEXTES.resumeParfait;
    $("phraseJournee").textContent = phrase;
  } else {
    const dominant = Object.keys(parts).reduce((a, b) => parts[a] >= parts[b] ? a : b);
    const modele = { gauche: TEXTES.resumeGauche, centre: TEXTES.resumeCentre, droite: TEXTES.resumeDroite }[dominant];
    $("phraseJournee").textContent = modele.replace("{pct}", parts[dominant]);
  }
  $("phraseJournee").hidden = false;

  // ---------- Conseil du jour ----------
  $("conseilJournee").textContent = personnaliser(choisirConseil(s, taux, pctBonne, mauvaises));

  // ---------- Bandes ----------
  $("blocPosture").hidden = !avecPostures;
  $("blocCote").hidden = avecPostures;
  if (avecPostures) {
    $("bandePosture").innerHTML = POSTURES.map(p => segment(pct(p.id), p.couleur, pct(p.id) + " %")).join("");
    $("legendePosture").innerHTML = POSTURES.map(p =>
      `<span><i style="background:${p.couleur}"></i>${p.nom} ${pct(p.id)} %</span>`).join("");
  }
  $("bandeCote").innerHTML =
    segment(parts.gauche, C.gauche, parts.gauche + " %") +
    segment(parts.centre, C.centre, parts.centre + " %", true) +
    segment(parts.droite, C.droite, parts.droite + " %");
  $("legendeCote").innerHTML =
    `<span><i style="background:${C.gauche}"></i>Gauche ${parts.gauche} %</span>` +
    `<span><i style="background:${C.centre}"></i>Centré ${parts.centre} %</span>` +
    `<span><i style="background:${C.droite}"></i>Droite ${parts.droite} %</span>`;

  const totalDos = s.dosAppuye + s.dosDecolle;
  $("blocDos").hidden = totalDos === 0;
  const pA = pourcent(s.dosAppuye, totalDos);
  $("bandeDos").innerHTML =
    segment(pA, C.dosAppuye, "Appuyé " + pA + " %") +
    segment(100 - pA, C.dosDecolle, "Décollé " + (100 - pA) + " %", true);

  // Heure par heure (couleur = posture, ou côté, dominant pendant l'heure)
  const heures = Object.keys(s.heures).map(Number);
  const debut = Math.min(8, ...heures), fin = Math.max(17, ...heures);
  let html = "";
  for (let h = debut; h <= fin; h++) {
    const hh = s.heures[h];
    let couleur = C.absent, nom = "absent";
    if (hh && hh.assis >= 180) {                      // au moins 3 min assis dans l'heure
      if (avecPostures && hh.postures) {
        const p = POSTURES.reduce((a, b) => (hh.postures[a.id] || 0) >= (hh.postures[b.id] || 0) ? a : b);
        couleur = p.couleur; nom = p.nom;
      } else {
        const cote = ["gauche", "centre", "droite"].reduce((a, b) => hh[a] >= hh[b] ? a : b);
        couleur = C[cote]; nom = cote;
      }
    }
    html += `<div style="flex:1;background:${couleur}" title="${h} h : ${nom}"></div>`;
  }
  $("bandeHeures").innerHTML = html;
  const milieu = Math.round((debut + fin) / 2);
  $("heuresEtiquettes").innerHTML = `<span>${debut} h</span><span>${milieu} h</span><span>${fin + 1} h</span>`;

  // ---------- Chiffres clés ----------
  $("statAssis").textContent = duree(s.assis);
  $("statChangements").textContent = s.changementsPosture || 0;
  $("statImmobile").textContent = duree(s.immobileMax);
}

// Un seul conseil, le plus utile : bouger, puis l'heure difficile, puis l'habitude, sinon bravo
function choisirConseil(s, taux, pctBonne, mauvaises) {
  if (taux !== null && taux < 60) return TEXTES.conseilBouger.replace("{min}", OBJECTIF_POSITION_MIN);
  if (mauvaises.length && pctBonne !== null && pctBonne < 80) {
    // Heure où la principale mauvaise habitude est la plus présente (au moins 10 min assis)
    const habitude = mauvaises[0];
    let meilleure = null, part = 0;
    for (const [h, hh] of Object.entries(s.heures)) {
      if (!hh.postures || hh.assis < 600) continue;
      const p = (hh.postures[habitude.id] || 0) / hh.assis;
      if (p > part) { part = p; meilleure = h; }
    }
    if (meilleure !== null && part >= 0.3) {
      return TEXTES.conseilHeure.replace("{nom}", habitude.nom.toLowerCase()).replace("{h}", meilleure);
    }
    return TEXTES.conseilHabitude.replace("{nom}", habitude.nom.toLowerCase());
  }
  return TEXTES.conseilBravo;
}


// =====================================================================
// 3. ONGLET « SE LEVER »
// =====================================================================
function afficherLever() {
  const m = magasinCourant();
  const jours = Object.keys(journal[m]).sort();
  const jour = (jourAffiche && journal[m][jourAffiche]) ? jourAffiche : jours[jours.length - 1];
  const s = jour ? journal[m][jour] : null;
  const index = jours.indexOf(jour);
  const objectifS = OBJECTIF_LEVER_MIN * 60;

  // ---------- En ce moment ----------
  const p = periodes[m];
  const actif = typeof sourceActive === "function" && sourceActive();
  const assis = actif && p.active && p.debout === null;
  $("carteMaintenant").hidden = jourAffiche !== null;          // seulement pour la journée en cours
  $("assisDepuis").textContent = assis ? duree(p.duree) : "--";
  $("assisDepuisLegende").textContent = assis ? "assis sans pause" : "";
  const ratio = assis ? p.duree / objectifS : 0;
  $("progressionLever").style.width = Math.min(100, ratio * 100) + "%";
  $("progressionLever").className = ratio >= 1 ? "depasse" : "";
  let message;
  if (!actif) message = TEXTES.leverPasAssis;
  else if (!assis) message = TEXTES.leverDebout;
  else if (ratio < 1) message = TEXTES.leverBientot.replace("{min}", Math.max(1, Math.ceil((objectifS - p.duree) / 60)));
  else if (ratio < 1.25) message = TEXTES.leverMaintenant;
  else message = TEXTES.leverDepasse.replace("{min}", OBJECTIF_LEVER_MIN);
  $("messageLever").textContent = message;
  $("messageLever").className = "maintenant-message" + (ratio >= 1 ? " alerte" : "");

  // ---------- En-tête du jour (même navigation que l'onglet Posture) ----------
  document.querySelectorAll(".badge-demo").forEach(b => b.hidden = m !== "demo");
  document.querySelectorAll(".nav-precedent").forEach(b => b.disabled = index <= 0);
  document.querySelectorAll(".nav-suivant").forEach(b => b.disabled = index < 0 || index >= jours.length - 1);
  $("titreLever").textContent = $("titreJournee").textContent;

  if (!s || s.assis < 1) {
    $("sousTitreLever").textContent = "";
    $("contenuLever").hidden = true;
    $("aucuneDonneeLever").hidden = false;
    return;
  }
  $("contenuLever").hidden = false;
  $("aucuneDonneeLever").hidden = true;

  // ---------- Objectif : pauses par heure assise ----------
  const pauses = s.pauses || 0;
  const objectif = Math.max(1, Math.round(s.assis / objectifS));
  $("sousTitreLever").textContent = duree(s.assis) + " assis · " + pauses + (pauses > 1 ? " pauses" : " pause");
  $("anneauLever").innerHTML = anneau(pourcent(pauses, objectif),
    pauses >= objectif ? POSTURES[0].couleur : "#F28C2E", pauses + " / " + objectif);
  $("objectifLeverTexte").textContent = TEXTES.objectifLever.replace("{min}", OBJECTIF_LEVER_MIN);

  // ---------- Chiffres ----------
  $("statEntrePauses").textContent = s.periodesNombre ? duree(s.periodesTotal / s.periodesNombre) : "--";
  $("statPlusLongAssis").textContent = duree(s.periodeMax || 0);
  $("statPlusLongAssis").className = "chiffre" + ((s.periodeMax || 0) > objectifS ? " baisse" : "");

  // ---------- Conseil ----------
  let conseil;
  if (pauses >= objectif) conseil = TEXTES.conseilLeverBravo;
  else if ((s.periodeMax || 0) > objectifS * 1.25) {
    conseil = TEXTES.conseilLeverLong.replace("{duree}", duree(s.periodeMax)).replace("{min}", OBJECTIF_LEVER_MIN);
  } else {
    const reste = objectif - pauses;
    conseil = TEXTES.conseilLeverPresque.replace("{n}", reste + (reste > 1 ? " pauses" : " pause"));
  }
  $("conseilLever").textContent = personnaliser(conseil);

  // ---------- Heure par heure ----------
  const C = COULEURS_JOURNEE;
  const heures = Object.keys(s.heures).map(Number);
  const debut = Math.min(8, ...heures), fin = Math.max(17, ...heures);
  let html = "";
  for (let h = debut; h <= fin; h++) {
    const hh = s.heures[h];
    let couleur = C.absent, nom = "absent";
    if (hh && hh.pauses) { couleur = C.pausePrise; nom = "pause prise"; }
    else if (hh && hh.assis >= 1800) { couleur = C.sansPause; nom = "assis, sans pause"; }
    else if (hh && hh.assis >= 180) { couleur = C.centre; nom = "un peu assis"; }
    html += `<div style="flex:1;background:${couleur}" title="${h} h : ${nom}"></div>`;
  }
  $("bandeLever").innerHTML = html;
  $("leverEtiquettes").innerHTML = `<span>${debut} h</span><span>${Math.round((debut + fin) / 2)} h</span><span>${fin + 1} h</span>`;
  $("legendeLever").innerHTML =
    `<span><i style="background:${C.pausePrise}"></i>Pause prise</span>` +
    `<span><i style="background:${C.sansPause}"></i>30 min ou plus sans pause</span>` +
    `<span><i style="background:${C.absent}"></i>Absent</span>`;
}

// ---------- Navigation et bouton ----------
$("jourPrecedent").onclick = () => naviguer(-1);
$("jourSuivant").onclick = () => naviguer(+1);
document.querySelectorAll(".nav-precedent").forEach(b => b.onclick = () => naviguer(-1));
document.querySelectorAll(".nav-suivant").forEach(b => b.onclick = () => naviguer(+1));
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
  tranches.demo = { temps: 0, bouge: false };
  periodes.demo = { duree: 0, debout: null, active: false };
  dernieresPostures.demo = null;
  jourAffiche = null;
  sauverJournal();
  afficherJournee();
};

afficherJournee();
