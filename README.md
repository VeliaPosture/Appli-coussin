# Vélia : l'application du coussin intelligent

Application web qui se connecte au coussin par Bluetooth, le calibre et affiche en direct comment la personne est assise : silhouette colorée selon la pression, présence, temps d'immobilité, équilibre gauche/droite et contact du dos.

**Pas besoin du coussin pour travailler sur l'application** : le mode démo et la relecture de sessions enregistrées permettent de tout développer sur son propre ordinateur.

---

## 1. Démarrer en 2 minutes (sans coussin)

1. Télécharge le projet (voir la section 5 pour GitHub).
2. Ouvre `index.html` dans **Chrome**.
3. Va dans l'onglet **Réglages** (ou clique sur **Commencer**) et clique sur **Mode démo** : une personne simulée s'assoit, se penche, bouge et se lève, en boucle.
4. Ou clique sur **Rejouer un fichier** et choisis `exemple_session.csv` : 9 minutes de données réalistes.
5. Le menu **Vitesse** (×1, ×5, ×20) accélère la démo et la relecture.

Tu peux aussi tester la **calibration** en mode démo : la personne simulée suit les consignes.

La **calibration** se fait en plusieurs positions, chacune illustrée par un petit dessin : coussin vide, puis chaque posture de la liste `POSTURES` (bonne posture, penché à gauche, penché à droite). L'application garde la « signature » de chaque posture et reconnaît ensuite en direct **la plus ressemblante** (carte « Posture », en vert pour la bonne posture). Une posture qui n'a pas été apprise (ex. penché vers l'avant) est classée dans la plus proche : ajoute-la à `POSTURES` pour qu'elle soit reconnue.

Plus bas, la section **Ma journée** résume chaque journée : côté où on appuie, dos, heure par heure, mouvements et plus longue période immobile. Les données de la démo et de la relecture sont gardées **séparément** des vraies journées (badge « Données de démo »), et un bouton permet de les effacer. La démo peut tourner des heures sans surveillance, même si l'onglet est en arrière-plan ; l'ordinateur ne doit simplement pas se mettre en veille.

---

## 2. Les fichiers : qui touche à quoi

| Fichier | Contenu | Qui le modifie |
|---|---|---|
| `index.html` | La structure : boutons, silhouette, cartes, textes fixes | Équipe design |
| `style.css` | L'apparence : couleurs, polices, tailles, espacements | Équipe design |
| `config.js` | Les réglages : textes affichés, couleurs de pression, seuils, branchement des capteurs | Équipe (textes et couleurs) ; Vincent (sections ⚠️) |
| `app.js` | La logique : calibration, calculs, mise à jour de l'affichage | Programmeurs |
| `journee.js` | Le résumé « Ma journée » : comptage par jour, bandes, phrase résumé | Programmeurs |
| `dessins.js` | Les petits dessins des postures (personne vue de dos sur une chaise) | Équipe design |
| `onglets.js` | La navigation entre les onglets (En direct, Posture, Se lever, Réglages) et la pastille de l'en-tête | Programmeurs |
| `images/` | Le logo Vélia : `logo-velia.png` (complet), `symbole-velia.png` (en-tête), `favicon.png` (icône d'onglet) | Équipe design |
| `sources.js` | D'où viennent les données : Bluetooth, démo, enregistrement, relecture | Vincent |
| `exemple_session.csv` | Une session enregistrée pour les tests | — |

**Modifier `style.css` ne peut pas casser le Bluetooth ni les calculs.** C'est le meilleur endroit pour commencer.

---

## 3. Où changer quoi

| Je veux changer… | Fichier | Où |
|---|---|---|
| Les couleurs générales (marque Vélia, sauge, ardoise, crème…) | `style.css` | Le bloc `:root` tout en haut, chaque couleur y est commentée |
| Le logo de l'en-tête | `images/` | Remplace `symbole-velia.png` par une nouvelle image du même nom (fond transparent) |
| Les polices (Outfit pour les titres, Nunito Sans pour le texte) | `index.html` et `style.css` | Le lien Google Fonts dans `index.html`, puis `--police` et `--police-titres` |
| La police de caractères | `style.css` | `--police` dans `:root` |
| Les couleurs de pression de la silhouette | `config.js` | `COULEURS_PRESSION` (la légende suit automatiquement) |
| Un texte affiché (« Assis », « Décollé », consignes de calibration…) | `config.js` | `TEXTES` |
| Le nom d'une zone (« Fesse gauche »…) | `config.js` | `NOMS` |
| Le titre, l'ordre ou le libellé des boutons et des cartes | `index.html` | — |
| La forme de la silhouette | `index.html` | Dans le `<svg id="silhouette">` |
| Ajouter une image (logo, etc.) | `index.html` | Place l'image dans le dossier, puis `<img src="logo.png" alt="Logo">` |
| La mise en page sur téléphone | `style.css` | Les règles `@media (max-width: 640px)` |
| Le scénario du mode démo | `sources.js` | `SCENARIO_DEMO` |
| Les couleurs des bandes de « Ma journée » | `config.js` | `COULEURS_JOURNEE` |
| La phrase résumé de la journée | `config.js` | `TEXTES` (`resumeGauche`, `resumeDroite`, `resumeCentre`) |
| Le seuil « appuyé d'un côté » (55 %) | `config.js` | `SEUIL_COTE` |
| Les postures de la calibration (nom, consigne, couleur) | `config.js` | `POSTURES` |
| Ajouter une posture (ex. « Penché vers l'avant ») | `config.js` | Copier une ligne de `POSTURES`, changer `id`, `nom`, `consigne`, `couleur` et `inclinaison` |
| Remplacer un dessin par une vraie image | `config.js` | Ajouter `image: "images/nom.png"` à la posture, et mettre l'image dans un dossier `images` |
| La forme des dessins automatiques | `dessins.js` | La fonction `dessinPosture` |

---

## 4. ⚠️ Les règles pour ne rien casser

Le JavaScript retrouve les éléments de la page par leur **`id`**. Tu peux déplacer, restyler ou réorganiser les éléments librement, mais :

1. **Ne renomme pas et ne supprime pas les `id`** comme `btnConnecter`, `btnDemo`, `btnCalibrer`, `presence`, `immobile`, `curseur`, `dos`, etc.
2. **Sur la silhouette**, chaque zone de capteur doit garder son `id` : `z_FG`, `z_FD`, `z_CG`, `z_CD`, `z_DOS_G`, `z_DOS_D` (la forme), et `t_FG`, `t_FD`, etc. (le pourcentage). Tu peux changer leur forme, leur taille et leur position.
3. **Garde l'ordre des scripts** à la fin de `index.html` : `config.js`, `dessins.js`, `app.js`, `journee.js`, `onglets.js`, puis `sources.js`. Après une mise à jour, **augmente le numéro `?v=`** de chaque fichier pour que Chrome recharge les nouvelles versions.
4. **Dans `POSTURES`, garde « Bonne posture » en premier** : elle sert de référence (1,0) à tous les calculs.
5. **Ne modifie pas les sections ⚠️ de `config.js`** sans en parler à Vincent : elles doivent correspondre au programme de l'ESP32.
6. **Après chaque modification, teste en mode démo** : si quelque chose ne bouge plus, appuie sur **F12** dans Chrome et regarde l'onglet **Console** pour voir l'erreur en rouge.

---

## 5. Travailler en équipe avec GitHub

### Mise en place (Vincent, une seule fois)

1. Crée un compte sur **github.com**.
2. Clique sur **New repository**. Nomme-le (par exemple `coussin-app`), choisis **Public** (nécessaire pour GitHub Pages gratuit), puis **Create repository**.
3. Clique sur **uploading an existing file** et glisse tous les fichiers du projet. Clique sur **Commit changes**.
4. Active la mise en ligne : **Settings → Pages → Branch : main → Save**. Après environ une minute, l'application est en ligne à une adresse du type `https://ton-nom.github.io/coussin-app/`.
5. Invite l'équipe : **Settings → Collaborators → Add people** (chacun doit avoir un compte GitHub).

> **Confidentialité :** un dépôt public est visible par tous. Ne mets jamais de mot de passe (comme celui du WiFi) ni de données de participants dans le dépôt.

### Les outils de chaque membre

- **GitHub Desktop** (gratuit) : pour récupérer et envoyer les modifications, sans ligne de commande.
- **Visual Studio Code** (gratuit) : pour modifier les fichiers.
- L'extension **Live Server** dans VS Code : clic droit sur `index.html` → **Open with Live Server**. La page se met à jour **toute seule** à chaque enregistrement.

### Le cycle de travail

1. **Avant de commencer** : dans GitHub Desktop, clique sur **Fetch origin** puis **Pull** pour récupérer le travail des autres.
2. **Modifie**, enregistre, vérifie le résultat dans Chrome (en mode démo).
3. **Quand ça fonctionne** : dans GitHub Desktop, écris un court résumé (par exemple « Nouvelle couleur des boutons »), clique sur **Commit to main**, puis sur **Push origin**.
4. Environ une minute plus tard, la version en ligne est à jour pour tout le monde.

**Pour éviter les conflits :** annoncez à l'équipe quel fichier vous modifiez. Deux personnes qui changent les mêmes lignes en même temps créent un conflit que GitHub demandera de régler à la main.

---

## 6. Avec le vrai coussin (Vincent)

1. Lance `coussin_ble_3zones.py` sur l'ESP32.
2. Ouvre l'application **en ligne** (adresse GitHub Pages) dans **Chrome** sur ordinateur, ou dans **Bluefy** sur iPhone. La version en ligne est en HTTPS, ce qu'exige le Bluetooth.
3. Clique sur **Connecter le coussin**, puis **Calibrer**.

### Partager des données réelles avec l'équipe

1. Pendant que le coussin est connecté, clique sur **● Enregistrer**.
2. Utilise le coussin normalement (par exemple, 30 minutes de travail).
3. Clique sur **■ Arrêter et télécharger** : un fichier `session_AAAA-MM-JJ_HHhMM.csv` est téléchargé.
4. Partage-le avec l'équipe, qui peut le rejouer avec **Rejouer un fichier**.

Format du fichier : une ligne par mesure, `temps_ms,FG,FD,DOS_G` (valeurs brutes de 0 à 4095).

---

## 7. Les capteurs actuels

| Zone | Capteur | Broche ESP32 | État |
|---|---|---|---|
| Fesse gauche (`FG`) | Bande FSR408 | D34 | Branché |
| Fesse droite (`FD`) | Bande FSR408 | D35 | Branché |
| Dos gauche (`DOS_G`) | Pastille FSR402B | VP (36) | Branché |
| Dos droit, cuisses | — | — | À venir (zones grises sur la silhouette) |
