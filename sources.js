// =====================================================================
// sources.js — D'OÙ VIENNENT LES DONNÉES
// ---------------------------------------------------------------------
// Trois sources possibles, une seule active à la fois :
//   1. "bluetooth" : le vrai coussin
//   2. "demo"      : une personne simulée (aucun matériel nécessaire)
//   3. "relecture" : un fichier .csv enregistré auparavant
// Chaque source appelle recevoir(valeurs, tempsMs), qui transmet à app.js.
// =====================================================================

let source = null;            // source active
let arreterSource = null;     // fonction qui arrête la source active
let enregistrement = null;    // lignes enregistrées, ou null si on n'enregistre pas

function sourceActive() { return source !== null; }

function changerSource(nouvelle, arret, message) {
  if (arreterSource) arreterSource();
  source = nouvelle;
  arreterSource = arret;
  etat(message);
  $("btnCalibrer").disabled = !nouvelle;
  $("btnEnregistrer").disabled = !nouvelle;
  $("btnDemo").classList.toggle("actif", nouvelle === "demo");
  $("btnDemo").textContent = nouvelle === "demo" ? "Arrêter la démo" : "Mode démo";
  if (!nouvelle && enregistrement) arreterEnregistrement();
}

// Toutes les sources passent par ici
function recevoir(valeurs, tempsMs) {
  if (enregistrement) {
    if (enregistrement.debut === null) enregistrement.debut = tempsMs;   // première mesure = temps 0
    enregistrement.push([Math.round(tempsMs - enregistrement.debut), ...valeurs]);
  }
  traiter(valeurs, tempsMs);
}

// =====================================================================
// 1. BLUETOOTH (le vrai coussin)
// =====================================================================
$("btnConnecter").onclick = async () => {
  if (!navigator.bluetooth) { etat("Ouvre cette page avec Chrome ou Edge (le Bluetooth Web n'est pas disponible ici)."); return; }
  try {
    etat("Recherche...");
    const appareil = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: PREFIXE_NOM }], optionalServices: [UART_SERVICE] });
    etat("Connexion...");
    const serveur = await appareil.gatt.connect();
    const service = await serveur.getPrimaryService(UART_SERVICE);
    const tx = await service.getCharacteristic(UART_TX);
    await tx.startNotifications();

    let tampon = "";
    const surMessage = ev => {
      tampon += new TextDecoder().decode(ev.target.value);
      let fin;
      while ((fin = tampon.indexOf("\n")) >= 0) {       // les messages peuvent arriver en morceaux
        const ligne = tampon.slice(0, fin).trim();
        tampon = tampon.slice(fin + 1);
        if (ligne) recevoir(ligne.split(",").map(Number), Date.now());
      }
    };
    tx.addEventListener("characteristicvaluechanged", surMessage);

    changerSource("bluetooth", () => {
      tx.removeEventListener("characteristicvaluechanged", surMessage);
      if (appareil.gatt.connected) appareil.gatt.disconnect();
    }, "Connecté à " + appareil.name);

    appareil.addEventListener("gattserverdisconnected", () => {
      if (source === "bluetooth") { arreterSource = null; changerSource(null, null, "Coussin déconnecté"); }
    });
  } catch (e) {
    etat("Erreur : " + e.message);
  }
};

// =====================================================================
// 2. MODE DÉMO (personne simulée)
// =====================================================================
// Scénario en boucle : [durée en secondes, description, valeurs brutes FG, FD, DOS_G]
const SCENARIO_DEMO = [
  [6,  "absent",              [0, 0, 0]],
  [20, "assis, adossé",       [2600, 2500, 2400]],
  [12, "penché à gauche",     [3300, 1500, 2600]],
  [12, "assis, adossé",       [2600, 2500, 2400]],
  [12, "penché à droite",     [1600, 3200, 1200]],
  [15, "penché vers l'avant", [2300, 2200, 0]],
  [25, "immobile, adossé",    [2600, 2500, 2400]],
  [8,  "se tortille",         null],               // null = mouvements au hasard
  [6,  "absent (pause)",      [0, 0, 0]],
];

$("btnDemo").onclick = () => {
  if (source === "demo") { changerSource(null, null, "Démo arrêtée"); return; }

  let etape = 0, tempsEtape = 0;
  let actuelles = [0, 0, 0];
  let tempsSimule = Date.now();          // l'horloge de la personne simulée
  let derniereVerification = Date.now(); // l'horloge réelle
  let reste = 0;                         // fraction de seconde simulée pas encore jouée

  // Chrome ralentit les onglets en arrière-plan (parfois une vérification par minute).
  // On calcule donc combien de secondes simulées auraient dû passer, et on les joue
  // toutes d'un coup : la démo peut tourner des heures sans qu'on la regarde.
  const verifier = () => {
    const maintenant = Date.now();
    reste += (maintenant - derniereVerification) / 1000 * Number($("vitesse").value);
    derniereVerification = maintenant;
    const aJouer = Math.min(Math.floor(reste), 7200);   // au plus 2 h simulées d'un coup
    reste -= Math.floor(reste);
    for (let k = 0; k < aJouer; k++) tic();
  };

  const tic = () => {
    let [duree, description, cible] = SCENARIO_DEMO[etape];

    // Pendant une calibration, la personne simulée suit les consignes
    if (consigneCalibration === "vide") { cible = [0, 0, 0]; description = "calibration : coussin vide"; }
    else if (consigneCalibration === "assis") { cible = [2600, 2500, 2400]; description = "calibration : assis"; }
    else if (cible === null) {
      cible = [1500 + Math.random() * 2000, 1500 + Math.random() * 2000, Math.random() * 3000];
    }

    // Transition douce vers la position visée, plus un peu de bruit
    actuelles = actuelles.map((v, i) => v + (cible[i] - v) * 0.5);
    const valeurs = actuelles.map(v => v < 20 ? 0 : Math.round(Math.min(4095, Math.max(0, v + (Math.random() - 0.5) * 80))));

    tempsSimule += 1000;
    recevoir(valeurs, tempsSimule);
    etat("Mode démo : " + description);

    if (!consigneCalibration && ++tempsEtape >= duree) {
      tempsEtape = 0;
      etape = (etape + 1) % SCENARIO_DEMO.length;
    }
  };

  const minuterie = setInterval(verifier, 250);
  changerSource("demo", () => clearInterval(minuterie), "Mode démo");
  tic();
};

// =====================================================================
// 3. ENREGISTREMENT d'une session (.csv)
// =====================================================================
$("btnEnregistrer").onclick = () => {
  if (enregistrement) { arreterEnregistrement(); return; }
  enregistrement = [];
  enregistrement.debut = null;              // fixé à la première mesure reçue
  $("btnEnregistrer").classList.add("enregistre");
  $("btnEnregistrer").textContent = "■ Arrêter et télécharger";
  majEtatEnregistrement();
};

function majEtatEnregistrement() {
  if (!enregistrement) { $("etatEnregistrement").textContent = ""; return; }
  $("etatEnregistrement").textContent = enregistrement.length + " mesures enregistrées";
  setTimeout(majEtatEnregistrement, 1000);
}

function arreterEnregistrement() {
  const lignes = enregistrement;
  enregistrement = null;
  $("btnEnregistrer").classList.remove("enregistre");
  $("btnEnregistrer").textContent = "● Enregistrer";
  $("etatEnregistrement").textContent = "";
  if (!lignes || !lignes.length) return;

  const entete = "temps_ms," + zones.filter(z => INDEX[z] !== null)
    .sort((a, b) => INDEX[a] - INDEX[b]).join(",");
  const csv = [entete, ...lignes.map(l => l.join(","))].join("\n");
  const maintenant = new Date();
  const nom = "session_" + maintenant.toISOString().slice(0, 10) + "_" +
    String(maintenant.getHours()).padStart(2, "0") + "h" + String(maintenant.getMinutes()).padStart(2, "0") + ".csv";

  const lien = document.createElement("a");
  lien.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  lien.download = nom;
  lien.click();
  $("etatEnregistrement").textContent = "Fichier téléchargé : " + nom;
}

// =====================================================================
// 4. RELECTURE d'un fichier .csv
// =====================================================================
$("fichierSession").onchange = async ev => {
  const fichier = ev.target.files[0];
  ev.target.value = "";                     // permet de rouvrir le même fichier
  if (!fichier) return;

  const lignes = (await fichier.text()).trim().split(/\r?\n/).slice(1)   // on saute l'en-tête
    .map(l => l.split(",").map(Number))
    .filter(l => l.length > 1 && !l.some(isNaN));
  if (!lignes.length) { etat("Fichier vide ou illisible : " + fichier.name); return; }

  let i = 0, minuterie = null;
  const debutReel = Date.now();
  const suivante = () => {
    const [temps, ...valeurs] = lignes[i];
    recevoir(valeurs, debutReel + temps);
    etat("Relecture de " + fichier.name + " : " + (i + 1) + " / " + lignes.length);
    i++;
    if (i >= lignes.length) { changerSource(null, null, "Relecture terminée : " + fichier.name); return; }
    const attente = (lignes[i][0] - temps) / Number($("vitesse").value);
    minuterie = setTimeout(suivante, Math.max(0, attente));
  };

  changerSource("relecture", () => clearTimeout(minuterie), "Relecture de " + fichier.name);
  dernierMouvement = debutReel;
  suivante();
};
