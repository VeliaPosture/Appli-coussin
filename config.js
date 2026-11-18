// =====================================================================
// config.js — Les RÉGLAGES de l'application
// ---------------------------------------------------------------------
// Les textes et les couleurs de pression se changent ici sans risque.
// Les sections marquées ⚠️ doivent correspondre au programme de l'ESP32 :
// demande à Vincent avant de les modifier.
// =====================================================================

// ⚠️ Position de chaque zone dans la ligne envoyée par l'ESP32 (« FG,FD,DOS_G »).
//    null = capteur pas encore branché (zone grise en pointillés).
const INDEX = { FG: 0, FD: 1, DOS_G: 2, DOS_D: null, CG: null, CD: null };

// Noms affichés à l'écran (modifiables)
const NOMS = {
  FG: "Fesse gauche", FD: "Fesse droite",
  CG: "Cuisse gauche", CD: "Cuisse droite",
  DOS_G: "Dos gauche", DOS_D: "Dos droit",
};

// Regroupements de zones (ne pas modifier)
const ASSISE = ["FG", "FD", "CG", "CD"];
const GAUCHE = ["FG", "CG"];
const DROITE = ["FD", "CD"];
const DOS = ["DOS_G", "DOS_D"];

// Seuils de détection (1,0 = comme pendant la calibration « assis comme d'habitude »)
const SEUIL_PRESENCE = 0.3;     // charge moyenne de l'assise pour être « Assis »
const SEUIL_DOS = 0.4;          // une zone du dos est « appuyée » au-dessus de ce seuil
const SEUIL_MOUVEMENT = 0.25;   // variation totale entre deux mesures qui compte comme un mouvement
const ECART_MIN_CALIBRATION = 150;  // écart minimal vide/assis pour dire qu'un capteur a été touché
const SEUIL_COTE = 0.55;        // part du poids d'un côté (55 %) pour dire « appuyé à gauche / à droite »
const DELAI_ENTRE_MOUVEMENTS = 3000;  // ms : un mouvement continu ne compte qu'une fois par 3 s

// =====================================================================
// POSTURES apprises pendant la calibration
// ---------------------------------------------------------------------
// Pendant la calibration, la personne prend chaque posture de cette liste.
// L'application garde la « signature » de chacune, puis reconnaît en direct
// la posture la plus ressemblante.
//   ⚠️ La PREMIÈRE posture sert de référence (1,0 = cette posture) :
//      garde « Bonne posture » en premier.
//   - inclinaison : angle du dessin, en degrés (négatif = vers la gauche)
//   - image : optionnel, chemin d'une image (ex. "images/droit.png") qui
//             remplace le dessin automatique
//   - demo : valeurs brutes FG, FD, DOS_G que la personne simulée envoie
//            dans cette posture (mode démo seulement)
// Pour ajouter une posture, copie une ligne et change son id et ses textes.
// =====================================================================
const POSTURES = [
  { id: "droit",  nom: "Bonne posture",   consigne: "Assieds-toi droit, bien adossé",
    bonne: true,  couleur: "#6F9E85", inclinaison: 0,   demo: [2600, 2500, 2400] },
  { id: "gauche", nom: "Penché à gauche", consigne: "Penche-toi vers la gauche et reste ainsi",
    bonne: false, couleur: "#5E87A0", inclinaison: -18, demo: [3300, 1500, 2600] },
  { id: "droite", nom: "Penché à droite", consigne: "Penche-toi vers la droite et reste ainsi",
    bonne: false, couleur: "#C9848B", inclinaison: 18,  demo: [1600, 3200, 1200] },
];
const DUREE_MESURE_POSTURE = 8;         // secondes de mesure par posture
const DUREE_CONFIRMATION_POSTURE = 3000; // ms : une posture doit durer 3 s avant d'être affichée
const DISTANCE_MIN_POSTURES = 0.2;      // deux postures plus proches que ça « se ressemblent »

// Résumé de la journée
const JOURS_CONSERVES = 60;     // nombre de jours gardés dans le navigateur
const COULEURS_JOURNEE = {
  gauche: "#5E87A0",
  centre: "#D9C9B6",
  droite: "#C9848B",
  dosAppuye: "#6F9E85",
  dosDecolle: "#D9C9B6",
  absent: "#F3E6D8",
};

// Couleurs de la pression sur la silhouette : [niveau, couleur]
// 0 = aucun contact, 1,0 = comme pendant la calibration, 1,5 = beaucoup plus.
// La légende sous la silhouette utilise automatiquement ces couleurs.
const COULEURS_PRESSION = [
  [0.0, "#FDF0E3"],
  [0.5, "#F9B26B"],
  [1.0, "#E07B1B"],
  [1.5, "#8E450A"],
];
const COULEUR_NON_BRANCHE = "#F3ECE4";

// Textes affichés (modifiables)
const TEXTES = {
  assis: "Assis",
  absent: "Absent",
  dosAppuye: "Appuyé",
  dosDecolle: "Décollé",
  calibre: "Calibré",
  pasCalibre: "Pas encore calibré : clique sur Calibrer",
  calibrationAncienne: "Refais la calibration pour que l'application reconnaisse tes postures",
  etapeVide: "Lève-toi, ne touche pas au coussin",
  resumePosture: "Tu étais en bonne posture {pct} % de ton temps assis.",
  resumeHabitude: " Ta principale habitude : {nom} ({pct} %).",
  resumeParfait: " Aucune mauvaise habitude détectée, bravo !",
  aucuneDonnee: "Aucune donnée pour cette journée.",
  resumeGauche: "Tu as passé {pct} % de ton temps assis appuyé sur la fesse gauche.",
  resumeDroite: "Tu as passé {pct} % de ton temps assis appuyé sur la fesse droite.",
  resumeCentre: "Tu as passé {pct} % de ton temps assis bien centré.",
  titreJournee: "Ma journée",
  badgeDemo: "Données de démo",
};

// ⚠️ Bluetooth : identifiants du service UART (doivent correspondre à l'ESP32)
const UART_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const UART_TX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";   // coussin -> application
const UART_RX = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";   // application -> coussin
const PREFIXE_NOM = "Coussin";

const CLE_STOCKAGE = "coussin_calibration";   // où la calibration est gardée dans le navigateur
const CLE_JOURNAL = "coussin_journal";         // où les résumés de journée sont gardés
