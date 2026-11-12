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

// Résumé de la journée
const JOURS_CONSERVES = 60;     // nombre de jours gardés dans le navigateur
const COULEURS_JOURNEE = {
  gauche: "#378add",
  centre: "#b4b2a9",
  droite: "#d85a30",
  dosAppuye: "#1d9e75",
  dosDecolle: "#b4b2a9",
  absent: "#e4e2dc",
};

// Couleurs de la pression sur la silhouette : [niveau, couleur]
// 0 = aucun contact, 1,0 = comme pendant la calibration, 1,5 = beaucoup plus.
// La légende sous la silhouette utilise automatiquement ces couleurs.
const COULEURS_PRESSION = [
  [0.0, "#fbeee8"],
  [0.5, "#f0997b"],
  [1.0, "#d85a30"],
  [1.5, "#8f3415"],
];
const COULEUR_NON_BRANCHE = "#eeeeee";

// Textes affichés (modifiables)
const TEXTES = {
  assis: "Assis",
  absent: "Absent",
  dosAppuye: "Appuyé",
  dosDecolle: "Décollé",
  calibre: "Calibré",
  pasCalibre: "Pas encore calibré : clique sur Calibrer",
  etapeVide: "Lève-toi, coussin vide",
  etapeAssis: "Assieds-toi comme d'habitude, adossé",
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
