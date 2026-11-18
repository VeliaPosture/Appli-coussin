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
let calibration = chargerCalibration();   // { zones: { zone: [vide, bonne posture] }, signatures: { posture: {...} } }
let derniere = null;                       // dernières valeurs brutes { zone: valeur }
let precedente = null;                     // dernières valeurs normalisées
let tempsActuel = 0;                       // temps de la dernière mesure (ms)
let dernierMouvement = 0;                  // temps du dernier mouvement détecté (ms)
let estAssis = false;
let echantillonsCalibration = null;        // collecte pendant une étape de calibration
let consigneCalibration = null;            // "vide" ou l'id d'une posture (utilisé par le mode démo)
let postureAffichee = null;                // posture confirmée, affichée à l'écran
let postureCandidate = null, debutCandidate = 0;

// ---------- Stockage de la calibration dans le navigateur ----------
function chargerCalibration() {
  try {
    const c = JSON.parse(localStorage.getItem(CLE_STOCKAGE));
    if (!c) return null;
    return c.zones ? c : { zones: c, signatures: null };   // ancienne calibration (avant les postures)
  } catch (e) { return null; }
}
function sauverCalibration(c) {
  try { localStorage.setItem(CLE_STOCKAGE, JSON.stringify(c)); } catch (e) {}
}

function etat(texte) {
  $("etat").textContent = texte;
  if (typeof majPastille === "function") majPastille();   // pastille de l'en-tête (onglets.js)
}

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
  const total = 1 + POSTURES.length;
  try {
    // Étape 1 : coussin vide. Puis une étape par posture de config.js.
    $("calibDessin").innerHTML = dessinPosture(null);
    const vide = await mesurer(`Étape 1 sur ${total}`, TEXTES.etapeVide, "vide", 3, 5, 0);
    const brutes = {};
    for (let i = 0; i < POSTURES.length; i++) {
      const p = POSTURES[i];
      $("calibDessin").innerHTML = dessinPosture(p);
      brutes[p.id] = await mesurer(`Étape ${i + 2} sur ${total} · ${p.nom}`, p.consigne, p.id, 5, DUREE_MESURE_POSTURE, 2);
    }

    // La première posture (la bonne) sert de référence : 1,0 = cette posture
    const reference = brutes[POSTURES[0].id];
    const zonesCal = {};
    const problemes = [];
    for (const z of zonesBranchees) {
      zonesCal[z] = [vide[z], reference[z]];
      if (reference[z] - vide[z] < ECART_MIN_CALIBRATION) problemes.push(NOMS[z] + " : aucun contact");
    }
    // Signature de chaque posture = ses valeurs normalisées
    const signatures = {};
    for (const p of POSTURES) signatures[p.id] = normaliserAvec(brutes[p.id], zonesCal);

    // Deux postures trop semblables seront difficiles à distinguer
    for (let i = 0; i < POSTURES.length; i++) {
      for (let j = i + 1; j < POSTURES.length; j++) {
        const a = POSTURES[i], b = POSTURES[j];
        if (distance(signatures[a.id], signatures[b.id]) < DISTANCE_MIN_POSTURES) {
          problemes.push(`« ${a.nom} » et « ${b.nom} » se ressemblent : exagère davantage`);
        }
      }
    }

    calibration = { zones: zonesCal, signatures };
    sauverCalibration(calibration);
    postureAffichee = postureCandidate = null;
    bip(1200, 0.15); setTimeout(() => bip(1500, 0.25), 200);
    $("calibDessin").innerHTML = "";
    $("calibEtape").textContent = "Terminé";
    $("calibConsigne").textContent = problemes.length ? "Calibré, mais vérifie :" : "Calibration réussie";

    // Tableau : valeur brute de chaque capteur dans chaque position
    let html = "<table><tr><th>Capteur</th><th>Vide</th>" + POSTURES.map(p => `<th>${p.nom}</th>`).join("") + "</tr>";
    for (const z of zonesBranchees) {
      html += `<tr><td>${NOMS[z]}</td><td>${Math.round(vide[z])}</td>` +
              POSTURES.map(p => `<td>${Math.round(brutes[p.id][z])}</td>`).join("") + "</tr>";
    }
    html += "</table>";
    if (problemes.length) html = `<ul class="problemes">${problemes.map(t => `<li>⚠️ ${t}</li>`).join("")}</ul>` + html;
    $("calibResultat").innerHTML = html;
  } catch (e) {
    echantillonsCalibration = null;
    bip(300, 0.5);
    $("calibDessin").innerHTML = "";
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
// Normalisation : 0 = aucun contact, 1,0 = comme dans la bonne posture de la calibration.
function normaliser(brut) {
  return normaliserAvec(brut, calibration ? calibration.zones : null);
}
function normaliserAvec(brut, zonesCal) {
  const n = {};
  for (const z of zones) {
    if (brut[z] === null || brut[z] === undefined) { n[z] = null; continue; }
    if (zonesCal && zonesCal[z]) {
      const [vide, reference] = zonesCal[z];
      const etendue = reference - vide;
      n[z] = etendue > 0 ? Math.max(0, (brut[z] - vide) / etendue) : 0;
    } else {
      n[z] = brut[z] / 4095 * 1.5;              // sans calibration : estimation grossière
    }
  }
  return n;
}

// Écart entre deux ensembles de valeurs normalisées (distance « à vol d'oiseau »)
function distance(a, b) {
  let somme = 0;
  for (const z of zonesBranchees) somme += (a[z] - b[z]) ** 2;
  return Math.sqrt(somme);
}

// Posture la plus ressemblante parmi celles apprises pendant la calibration.
// Sans calibration des postures : on se rabat sur l'équilibre gauche/droite.
function reconnaitrePosture(n, partGauche) {
  if (calibration && calibration.signatures) {
    let meilleure = null, meilleureDistance = Infinity;
    for (const p of POSTURES) {
      const sig = calibration.signatures[p.id];
      if (!sig) continue;
      const d = distance(n, sig);
      if (d < meilleureDistance) { meilleure = p; meilleureDistance = d; }
    }
    return meilleure;
  }
  const parId = id => POSTURES.find(p => p.id === id) || POSTURES[0];
  if (partGauche === null) return POSTURES[0];
  if (partGauche >= SEUIL_COTE) return parId("gauche");
  if (partGauche <= 1 - SEUIL_COTE) return parId("droite");
  return POSTURES[0];
}

// Une posture n'est affichée que si elle dure DUREE_CONFIRMATION_POSTURE
function confirmerPosture(p) {
  if (!p) { postureAffichee = postureCandidate = null; return null; }
  if (!postureAffichee) { postureAffichee = postureCandidate = p; debutCandidate = tempsActuel; return p; }
  if (!postureCandidate || p.id !== postureCandidate.id) { postureCandidate = p; debutCandidate = tempsActuel; }
  if (postureCandidate.id !== postureAffichee.id && tempsActuel - debutCandidate >= DUREE_CONFIRMATION_POSTURE) {
    postureAffichee = postureCandidate;
  }
  return postureAffichee;
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
  let mouvement = false;
  if (precedente) {
    let variation = 0;
    for (const z of zonesBranchees) variation += Math.abs(n[z] - precedente[z]);
    if (variation > SEUIL_MOUVEMENT) { dernierMouvement = tempsActuel; mouvement = true; }
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
  let pg = null;                                   // part du poids à gauche (0 à 1)
  if (g + d > 0.05) {
    pg = g / (g + d);
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

  $("infoCalib").textContent = texteCalibration();

  // --- Posture ---
  const avant = postureAffichee;
  const posture = confirmerPosture(estAssis ? reconnaitrePosture(n, pg) : null);
  if (posture !== avant) {
    $("dessinPosture").innerHTML = dessinPosture(posture);
    $("posture").textContent = posture ? posture.nom : "--";
    $("posture").style.color = !posture ? "var(--doux)" : (posture.bonne ? "var(--ok)" : "var(--alerte)");
  }

  // --- Ajout de cette mesure au résumé de la journée (journee.js) ---
  if (typeof compterJournee === "function" && typeof sourceActive === "function" && sourceActive()) {
    const aDos = DOS.some(z => n[z] !== null);
    compterJournee({
      temps: tempsActuel,
      assis: estAssis,
      partGauche: pg,
      dosAppuye: aDos ? appuye : null,
      mouvement: mouvement,
      immobileMs: estAssis ? tempsActuel - dernierMouvement : 0,
      posture: posture ? posture.id : null,
    });
  }
}

function texteCalibration() {
  if (!calibration) return TEXTES.pasCalibre;
  return calibration.signatures ? TEXTES.calibre : TEXTES.calibrationAncienne;
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
  $("dessinPosture").innerHTML = dessinPosture(null);
  $("infoCalib").textContent = texteCalibration();
})();
