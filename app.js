// =====================================================================
// app.js — La LOGIQUE : calibration, calculs et mise à jour de l'affichage
// ---------------------------------------------------------------------
// Point d'entrée : traiter(valeurs, tempsMs), appelé par sources.js
// chaque fois qu'une mesure arrive (Bluetooth, démo ou relecture).
// =====================================================================

const $ = id => document.getElementById(id);
const zones = Object.keys(INDEX);
const zonesBranchees = zones.filter(z => INDEX[z] !== null);

// ---------- État ----------
let calibration = chargerCalibration();   // { zone: [vide, assis] }
let derniere = null;                       // dernières valeurs brutes { zone: valeur }
let precedente = null;                     // dernières valeurs normalisées
let tempsActuel = 0;                       // temps de la dernière mesure (ms)
let dernierMouvement = 0;                  // temps du dernier mouvement détecté (ms)
let estAssis = false;
let echantillonsCalibration = null;        // collecte pendant une étape de calibration
let consigneCalibration = null;            // "vide" ou "assis" (utilisé par le mode démo)

// ---------- Stockage de la calibration dans le navigateur ----------
function chargerCalibration() {
  try { return JSON.parse(localStorage.getItem(CLE_STOCKAGE)) || null; }
  catch (e) { return null; }
}
function sauverCalibration(c) {
  try { localStorage.setItem(CLE_STOCKAGE, JSON.stringify(c)); } catch (e) {}
}

function etat(texte) { $("etat").textContent = texte; }

// =====================================================================
// RÉCEPTION D'UNE MESURE
// =====================================================================
function traiter(valeurs, tempsMs) {
  tempsActuel = tempsMs;
  derniere = {};
  for (const z of zones) {
    const i = INDEX[z];
    derniere[z] = (i === null || isNaN(valeurs[i])) ? null : valeurs[i];
  }
  if (echantillonsCalibration) echantillonsCalibration.push({ ...derniere });
  afficher();
}

// =====================================================================
// CALIBRATION
// =====================================================================
$("btnCalibrer").onclick = async () => {
  $("btnCalibrer").disabled = true;
  $("btnFermerCalib").hidden = true;
  $("calibResultat").innerHTML = "";
  $("calib").style.display = "block";
  try {
    const vide = await mesurer("Étape 1 sur 2", TEXTES.etapeVide, "vide", 3, 5, 0);
    const assis = await mesurer("Étape 2 sur 2", TEXTES.etapeAssis, "assis", 5, 10, 2);
    const nouvelle = {};
    const problemes = [];
    let lignes = "";
    for (const z of zonesBranchees) {
      nouvelle[z] = [vide[z], assis[z]];
      const ok = assis[z] - vide[z] >= ECART_MIN_CALIBRATION;
      if (!ok) problemes.push(NOMS[z]);
      lignes += `<tr><td>${NOMS[z]}</td><td>${Math.round(vide[z])}</td><td>${Math.round(assis[z])}</td>` +
                `<td>${ok ? "✅" : "⚠️ aucun contact"}</td></tr>`;
    }
    calibration = nouvelle;
    sauverCalibration(calibration);
    bip(1200, 0.15); setTimeout(() => bip(1500, 0.25), 200);
    $("calibEtape").textContent = "Terminé";
    $("calibConsigne").textContent = problemes.length
      ? "Calibré, mais vérifie : " + problemes.join(", ")
      : "Calibration réussie";
    $("calibResultat").innerHTML =
      "<table><tr><th>Capteur</th><th>Vide</th><th>Assis</th><th></th></tr>" + lignes + "</table>";
  } catch (e) {
    echantillonsCalibration = null;
    bip(300, 0.5);
    $("calibEtape").textContent = "Échec";
    $("calibConsigne").textContent = "Calibration interrompue : " + e.message;
  }
  consigneCalibration = null;
  $("calibCompte").textContent = "";
  $("calibRecus").textContent = "";
  $("btnFermerCalib").hidden = false;
  $("btnCalibrer").disabled = !sourceActive();
  afficher();
};

$("btnFermerCalib").onclick = () => { $("calib").style.display = "none"; };

// Compte à rebours, puis moyenne des valeurs reçues pendant « duree » secondes
// (en ignorant les « ignorer » premières secondes, le temps de s'installer).
async function mesurer(etape, consigne, type, preparation, duree, ignorer) {
  $("calibEtape").textContent = etape;
  $("calibConsigne").textContent = consigne;
  $("calibRecus").textContent = "";
  consigneCalibration = type;
  for (let s = preparation; s > 0; s--) {
    $("calibCompte").textContent = "Départ dans " + s;
    bip(660, 0.08);
    await pause(1000);
  }
  bip(990, 0.3);                                   // bip long : la mesure commence
  echantillonsCalibration = [];
  for (let s = duree; s > 0; s--) {
    $("calibCompte").textContent = "Mesure... " + s;
    if (duree - s === ignorer) echantillonsCalibration = [];
    $("calibRecus").textContent = echantillonsCalibration.length + " mesures reçues";
    await pause(1000);
  }
  const echantillons = echantillonsCalibration;
  echantillonsCalibration = null;
  if (echantillons.length < 2) {
    throw new Error("aucune donnée reçue. Vérifie que le coussin est connecté (ou que le mode démo est actif).");
  }
  const moyennes = {};
  for (const z of zonesBranchees) {
    moyennes[z] = echantillons.reduce((s, e) => s + e[z], 0) / echantillons.length;
  }
  return moyennes;
}
const pause = ms => new Promise(r => setTimeout(r, ms));

// Petit bip (pour suivre la calibration sans regarder l'écran)
let audio = null;
function bip(freq = 880, duree = 0.15) {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audio.createOscillator(), gain = audio.createGain();
    osc.frequency.value = freq;
    gain.gain.value = 0.15;
    osc.connect(gain); gain.connect(audio.destination);
    osc.start(); osc.stop(audio.currentTime + duree);
  } catch (e) {}
}

// =====================================================================
// CALCULS
// =====================================================================
// Normalisation : 0 = aucun contact, 1,0 = comme pendant la calibration « assis ».
function normaliser(brut) {
  const n = {};
  for (const z of zones) {
    if (brut[z] === null) { n[z] = null; continue; }
    if (calibration && calibration[z]) {
      const [vide, assis] = calibration[z];
      const etendue = assis - vide;
      n[z] = etendue > 0 ? Math.max(0, (brut[z] - vide) / etendue) : 0;
    } else {
      n[z] = brut[z] / 4095 * 1.5;              // sans calibration : estimation grossière
    }
  }
  return n;
}

// Couleur selon le niveau de pression (dégradé défini dans config.js)
function couleur(v) {
  const arrets = COULEURS_PRESSION.map(([niveau, hex]) => [niveau, hexVersRgb(hex)]);
  v = Math.max(arrets[0][0], Math.min(arrets[arrets.length - 1][0], v));
  for (let k = 1; k < arrets.length; k++) {
    if (v <= arrets[k][0]) {
      const [a, ca] = arrets[k - 1], [b, cb] = arrets[k];
      const t = (v - a) / (b - a);
      return "rgb(" + ca.map((c, i) => Math.round(c + (cb[i] - c) * t)).join(",") + ")";
    }
  }
  return COULEURS_PRESSION[COULEURS_PRESSION.length - 1][1];
}
function hexVersRgb(hex) {
  const h = hex.replace("#", "");
  return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16));
}

// =====================================================================
// AFFICHAGE
// =====================================================================
function afficher() {
  if (!derniere) return;
  const n = normaliser(derniere);

  // --- Mouvement : variation totale par rapport à la mesure précédente ---
  if (precedente) {
    let variation = 0;
    for (const z of zonesBranchees) variation += Math.abs(n[z] - precedente[z]);
    if (variation > SEUIL_MOUVEMENT) dernierMouvement = tempsActuel;
  }
  precedente = n;

  // --- Présence ---
  const assise = ASSISE.filter(z => n[z] !== null);
  const charge = assise.reduce((s, z) => s + n[z], 0) / Math.max(1, assise.length);
  const etaitAssis = estAssis;
  estAssis = charge > SEUIL_PRESENCE;
  if (estAssis && !etaitAssis) dernierMouvement = tempsActuel;   // on vient de s'asseoir
  $("presence").textContent = estAssis ? TEXTES.assis : TEXTES.absent;
  $("presence").style.color = estAssis ? "var(--ok)" : "var(--doux)";

  // --- Immobilité ---
  if (estAssis) {
    const s = Math.max(0, Math.floor((tempsActuel - dernierMouvement) / 1000));
    $("immobile").textContent = Math.floor(s / 60) + " min " + String(s % 60).padStart(2, "0") + " s";
  } else {
    $("immobile").textContent = "--";
  }

  // --- Silhouette : couleur et pourcentage de chaque zone ---
  const totalAssise = assise.reduce((s, z) => s + n[z], 0);
  for (const z of zones) {
    const forme = $("z_" + z), texte = $("t_" + z);
    if (!forme) continue;
    if (n[z] === null) {
      forme.style.fill = COULEUR_NON_BRANCHE;
      forme.style.stroke = "#bbb";
      forme.style.strokeDasharray = "4 3";
      texte.textContent = "";
      continue;
    }
    forme.style.fill = couleur(n[z]);
    forme.style.stroke = "none";
    forme.style.strokeDasharray = "";
    texte.style.fill = n[z] > 0.8 ? "#fff" : "#4a1b0c";
    if (ASSISE.includes(z)) {
      texte.textContent = totalAssise > 0.05 ? Math.round(n[z] / totalAssise * 100) + "%" : "";
    } else {
      texte.textContent = n[z] > 0.05 ? Math.round(Math.min(n[z], 1.5) * 100) + "%" : "";
    }
  }

  // --- Équilibre gauche / droite ---
  const g = GAUCHE.filter(z => n[z] !== null).reduce((s, z) => s + n[z], 0);
  const d = DROITE.filter(z => n[z] !== null).reduce((s, z) => s + n[z], 0);
  if (g + d > 0.05) {
    const pg = g / (g + d);
    $("curseur").style.left = ((1 - pg) * 100) + "%";   // va à gauche quand on penche à gauche
    $("pctG").textContent = "G " + Math.round(pg * 100) + " %";
    $("pctD").textContent = "D " + Math.round((1 - pg) * 100) + " %";
  } else {
    $("curseur").style.left = "50%";
    $("pctG").textContent = "G --";
    $("pctD").textContent = "D --";
  }

  // --- Dos ---
  const appuye = DOS.filter(z => n[z] !== null).some(z => n[z] > SEUIL_DOS);
  $("dos").textContent = !estAssis ? "--" : (appuye ? TEXTES.dosAppuye : TEXTES.dosDecolle);

  $("infoCalib").textContent = calibration ? TEXTES.calibre : TEXTES.pasCalibre;
}

// ---------- État initial : silhouette « vide » et légende ----------
(function initialiser() {
  const legende = document.querySelectorAll(".legende .l1, .legende .l2, .legende .l3, .legende .l4");
  legende.forEach((el, i) => {
    const arret = COULEURS_PRESSION[Math.min(i, COULEURS_PRESSION.length - 1)];
    el.style.background = arret[1];
  });
  document.querySelector(".legende .l0").style.background = COULEUR_NON_BRANCHE;

  derniere = Object.fromEntries(zones.map(z => [z, INDEX[z] === null ? null : 0]));
  afficher();
  precedente = null;
  $("presence").textContent = "--";
  $("presence").style.color = "";
  $("infoCalib").textContent = calibration ? TEXTES.calibre : TEXTES.pasCalibre;
})();
