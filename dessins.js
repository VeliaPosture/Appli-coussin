// =====================================================================
// dessins.js — Les PETITS DESSINS des postures
// ---------------------------------------------------------------------
// Une personne vue de dos, assise sur une chaise, inclinée selon la
// posture. Pour utiliser de vraies images à la place, ajoute
// « image: "images/nom.png" » à la posture dans config.js : ce fichier
// n'a alors rien à changer.
// =====================================================================

// posture = un élément de POSTURES, ou null pour le coussin vide
function dessinPosture(posture) {
  if (posture && posture.image) {
    return `<img src="${posture.image}" alt="${posture.nom}">`;
  }
  const couleur = posture ? posture.couleur : "#C8B6A2";
  const angle = posture ? posture.inclinaison : 0;
  const personne = posture ? `
    <g transform="rotate(${angle} 60 80)">
      <line x1="48" y1="50" x2="40" y2="74" stroke="${couleur}" stroke-width="6" stroke-linecap="round"/>
      <line x1="72" y1="50" x2="80" y2="74" stroke="${couleur}" stroke-width="6" stroke-linecap="round"/>
      <rect x="46" y="44" width="28" height="38" rx="11" fill="${couleur}"/>
      <circle cx="60" cy="32" r="9" fill="${couleur}"/>
    </g>` : "";
  return `
  <svg viewBox="0 0 120 120" role="img" aria-label="${posture ? posture.nom : "Coussin vide"}">
    <rect x="26" y="80" width="68" height="8" rx="3" fill="#E5D8C9"/>
    <line x1="32" y1="88" x2="32" y2="112" stroke="#C8B6A2" stroke-width="4" stroke-linecap="round"/>
    <line x1="88" y1="88" x2="88" y2="112" stroke="#C8B6A2" stroke-width="4" stroke-linecap="round"/>
    ${personne}
    <rect x="34" y="36" width="52" height="44" rx="6" fill="none" stroke="#C8B6A2" stroke-width="2" stroke-dasharray="4 3"/>
  </svg>`;
}
