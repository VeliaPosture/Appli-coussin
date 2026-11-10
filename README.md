# Coussin intelligent : l'application

Application web qui se connecte au coussin par Bluetooth, le calibre et affiche en direct comment la personne est assise : silhouette colorée selon la pression, présence, temps d'immobilité, équilibre gauche/droite et contact du dos.

**Pas besoin du coussin pour travailler sur l'application** : le mode démo et la relecture de sessions enregistrées permettent de tout développer sur son propre ordinateur.

---

## 1. Démarrer en 2 minutes (sans coussin)

1. Télécharge le projet (voir la section 5 pour GitHub).
2. Ouvre `index.html` dans **Chrome**.
3. Clique sur **Mode démo** : une personne simulée s'assoit, se penche, bouge et se lève, en boucle.
4. Ou clique sur **Rejouer un fichier** et choisis `exemple_session.csv` : 9 minutes de données réalistes.
5. Le menu **Vitesse** (×1, ×5, ×20) accélère la démo et la relecture.

Tu peux aussi tester la **calibration** en mode démo : la personne simulée suit les consignes.

---

## 2. Les fichiers : qui touche à quoi

| Fichier | Contenu | Qui le modifie |
|---|---|---|
| `index.html` | La structure : boutons, silhouette, cartes, textes fixes | Équipe design |
| `style.css` | L'apparence : couleurs, polices, tailles, espacements | Équipe design |
| `config.js` | Les réglages : textes affichés, couleurs de pression, seuils, branchement des capteurs | Équipe (textes et couleurs) ; Vincent (sections ⚠️) |
| `app.js` | La logique : calibration, calculs, mise à jour de l'affichage | Programmeurs |
| `sources.js` | D'où viennent les données : Bluetooth, démo, enregistrement, relecture | Vincent |
| `exemple_session.csv` | Une session enregistrée pour les tests | — |

**Modifier `style.css` ne peut pas casser le Bluetooth ni les calculs.** C'est le meilleur endroit pour commencer.

---

## 3. Où changer quoi

| Je veux changer… | Fichier | Où |
|---|---|---|
| Les couleurs générales (fond, boutons, texte) | `style.css` | Le bloc `:root` tout en haut |
| La police de caractères | `style.css` | `--police` dans `:root` |
| Les couleurs de pression de la silhouette | `config.js` | `COULEURS_PRESSION` (la légende suit automatiquement) |
| Un texte affiché (« Assis », « Décollé », consignes de calibration…) | `config.js` | `TEXTES` |
| Le nom d'une zone (« Fesse gauche »…) | `config.js` | `NOMS` |
| Le titre, l'ordre ou le libellé des boutons et des cartes | `index.html` | — |
| La forme de la silhouette | `index.html` | Dans le `<svg id="silhouette">` |
| Ajouter une image (logo, etc.) | `index.html` | Place l'image dans le dossier, puis `<img src="logo.png" alt="Logo">` |
| La mise en page sur téléphone | `style.css` | Les règles `@media (max-width: 640px)` |
| Le scénario du mode démo | `sources.js` | `SCENARIO_DEMO` |

---

## 4. ⚠️ Les règles pour ne rien casser

Le JavaScript retrouve les éléments de la page par leur **`id`**. Tu peux déplacer, restyler ou réorganiser les éléments librement, mais :

1. **Ne renomme pas et ne supprime pas les `id`** comme `btnConnecter`, `btnDemo`, `btnCalibrer`, `presence`, `immobile`, `curseur`, `dos`, etc.
2. **Sur la silhouette**, chaque zone de capteur doit garder son `id` : `z_FG`, `z_FD`, `z_CG`, `z_CD`, `z_DOS_G`, `z_DOS_D` (la forme), et `t_FG`, `t_FD`, etc. (le pourcentage). Tu peux changer leur forme, leur taille et leur position.
3. **Garde l'ordre des scripts** à la fin de `index.html` : `config.js`, puis `app.js`, puis `sources.js`.
4. **Ne modifie pas les sections ⚠️ de `config.js`** sans en parler à Vincent : elles doivent correspondre au programme de l'ESP32.
5. **Après chaque modification, teste en mode démo** : si quelque chose ne bouge plus, appuie sur **F12** dans Chrome et regarde l'onglet **Console** pour voir l'erreur en rouge.

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
