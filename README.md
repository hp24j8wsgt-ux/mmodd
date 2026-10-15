# MMODD

MMO 2D en pixel art, jouable dans le navigateur (mobile et ordinateur). Un seul serveur Node.js, **aucune dépendance à installer**.

## Lancer en local

```
node server.js
```

Puis ouvre http://localhost:3000 (plusieurs onglets = plusieurs joueurs).

## Mettre en ligne gratuitement (Render + Upstash)

1. **GitHub** : crée un dépôt (par exemple `mmodd`) et envoies-y le contenu de ce dossier (`server.js`, `package.json`, `render.yaml`, `public/`…).
2. **Upstash** (sauvegardes, gratuit) : sur https://upstash.com, crée une base **Redis** gratuite. Dans l'onglet « REST API », copie `UPSTASH_REDIS_REST_URL` et `UPSTASH_REDIS_REST_TOKEN`.
3. **Render** (serveur, gratuit) : sur https://render.com, connecte-toi avec GitHub, puis **New → Web Service** et choisis le dépôt.
   - Language : **Node** · Build command : `echo ok` · Start command : `node server.js` · Instance : **Free**
   - Dans **Environment**, ajoute les deux variables d'Upstash.
4. Render donne une adresse `https://mmodd.onrender.com` : c'est ton site, partage-la.

Sans Upstash, le jeu marche aussi, mais l'offre gratuite de Render efface le disque à chaque redémarrage : les personnages seraient perdus. Avec Upstash, les sauvegardes sont copiées toutes les 30 secondes et à l'arrêt du serveur, puis rechargées au démarrage.

Sur l'offre gratuite, le serveur s'endort après environ 15 minutes sans visite : la première connexion suivante prend une petite minute.

Ça marche aussi sur un VPS ou tout hébergeur Node. Le port est lu dans la variable `PORT`.

## Contenu

- **6 classes, 3 compétences chacune** (niveaux 1, 5 et 10) : Guerrier, Archère, Mage, Paladin, Assassin, Druide
- **Équipement** : 9 emplacements (arme propre à chaque classe, casque, armure, gants, bottes, cape, ceinture, anneau, amulette), 8 paliers de niveau, 7 raretés (Commun, Peu commun, Rare, Épique, Légendaire, Prismatique, Héroïque). Un objet suit ton niveau jusqu'à 3 niveaux au-dessus du sien. Panoplies : les objets du même nom (ex. « du Faucon ») donnent un bonus à 2, 4, 6 et 8 pièces. Catalogue complet, sac de 30 places
- **Quêtes** du Capitaine Aldric, puis primes répétables
- **Cycle jour/nuit** : la nuit, spectres et loups-garous sortent, avec plus d'XP et de butin
- **Le Gouffre** : donjon instancié pour ton groupe (3 vagues puis le Gardien)
- **Groupes** (XP partagée), **échanges**, **classement**, **émotes**
- **Pierres de passage** : bouton Voyage pour se téléporter vers une pierre activée depuis n'importe où, et choisir son point de réapparition
- Musique et bruitages 8 bits générés, bouton Son
- **Monde** : Village d'Ambre, Prairies, Lac Miroir, Plaines du Sud, Forêt des Murmures, Crypte du nord, Marais Brumeux, Mine Profonde
- **Monstres** : Loup gris (1), Sanglier (3), Loup noir (5), Ours brun (7), Squelette (10), Araignée des brumes (12), Golem de pierre (16), boss **Roi des Cendres** (15) et **Golem Ancien** (20)
- XP partagée entre tous ceux qui ont tapé un monstre, niveaux, or, potions
- **Brann le forgeron** améliore chaque pièce d'équipement de +1 à +9 (+10 % de stats par niveau, risque d'échec à partir de +4)
- **Elya l'herboriste** vend des potions
- Chat global, bulles au-dessus des joueurs, mini-carte
- Sauvegarde par pseudo côté serveur

## Nouveautés

- **Progression ralentie** : il faut environ 14 + niveau/12 victoires par niveau, le mode auto rapporte 70 % de l'expérience, le jeu actif donne une série de victoires (jusqu'à +25 % d'XP)
- **Mort** : perte d'or plafonnée, un peu d'XP, usure de l'équipement (réparation chez Brann)
- **Équilibrage** : critique à rendement décroissant (plafond 75 %), gemme d'onyx (dégâts critiques), potions au prix de ton niveau, Vyrmax et les boss du royaume suivent ton niveau, 2 points de talent par niveau après la première renaissance
- **Chaînes de quêtes régionales** : un éclaireur par région, 4 quêtes puis des patrouilles répétables
- **Donjons** tous les 100 niveaux : deux salles de gardiens puis un boss à mécaniques (cercles rouges, nova, renforts, furie)
- **Événements mondiaux** : pluie d'étoiles (XP ×2, plus de butin), invasions de champions, boss errant
- **Bestiaire** : 25 victoires = espèce étudiée (or), 100 = maîtrisée (+0,1 % de dégâts), nouveaux titres
- **Forge d'équipement** (Métiers) : fabrique la pièce de panoplie de ton choix ; pêche, minage et cueillette dans toutes les régions
- **Rangs de compétences** (II au niv. 25, III au 50, IV au 100, puis toutes les 2 renaissances) et **compétence ultime** au niveau 50 (touche U)
- **Carte du monde**, **journal de combat**, **réglages** (mode économie, chiffres de dégâts)
- **Niveau 100 et réincarnation** : au niveau 100, renais au niveau 1 avec +5 % de vie et de dégâts permanents et 10 points de talent par renaissance
- **Talents** : un point par niveau, 4 talents communs et 1 talent propre à chaque classe (jusqu'à 20 rangs)
- **Montures** : Cheval brun, Loup des steppes (chez Mira au village) et Destrier spectral (butin du dragon)
- **Gemmes** : rubis, saphir, émeraude, topaze, œil d'ambre (5 niveaux), sertissage, fusion 3 → 1
- **Recyclage** en fragments de forge, et **forge sans risque** avec ces fragments
- **Apparence** : teintures de tenue et lueur d'arme, sans effet sur les statistiques
- **Boss mondial** Vyrmax toutes les heures, butin Héroïque garanti
- **Tour sans fin** (par le portail du Gouffre), avec record
- **Métiers** : pêche, minage, herboristerie, et artisanat (potions, plats, élixirs, fragments)
- Apparences des héros détaillées disponibles dans `public/heroes.js` (désactivées : `USE_HERO_ART = false` dans game.js)
- **Héros redessinés** (sprites détaillés générés, 4 directions, marche, pose de sort) et **animations** pour chaque attaque de base et chacun des 18 sorts
- **Équipement visible** sur le héros : chaque palier a sa forme et sa matière (cuir → Titan), chaque nom de panoplie sa couleur ; adapté à chaque classe (heaumes, chapeaux de mage, capuches, bois de druide…), aperçu dans le sac
- **10 montures** redessinées (sanglier, cheval, cerf, loup, tigre, salamandre, destrier spectral, griffon, licorne, drake)
- **Sac de 100 places** défilant (bouton « Tout afficher »), « Tout vendre » et « Tout recycler » par onglet et par rareté, un onglet par type d'équipement, flèches ▲▼ et comparaison détaillée avec l'objet équipé
- **Auras de prestige** : une aura différente à chaque renaissance (Lueur, Sève, Onde, Runes d'or, Brasier, Givre éternel, Tempête, Néant, Céleste, Prisme, puis Transcendance de plus en plus intense)
- **Monstres redessinés** dans le style des héros (56 gabarits : quadrupèdes, bipèdes, insectes, gelées, volants, serpents, dragons) ; **196 espèces uniques**, une par région et par palier, avec leurs boss
- **Décor unique** par région : éléments propres (ruines, totems, champignons géants, cristaux, obélisques…) et ambiance de couleur
- **49 régions** à l'est du royaume (une par tranche de 20 niveaux, monstres jusqu'au niveau 1000) : Steppes, Dunes, Sylves, Fanges, Toundras, Brasiers, Abysses, chacune avec sa pierre de passage, 3 familles de monstres et un boss
- **Niveau de puissance** = niveau + 100 par renaissance : c'est lui qui fixe tes statistiques et ton équipement
- **Déplacements automatiques** : monture prise automatiquement hors combat, voyage rapide vers la pierre de passage la plus proche de l'objectif de quête
- **Combat automatique** (bouton Auto ou touche B) : chasse autour de toi, lance les sorts, boit les potions, ramasse le butin
- **Talents jusqu'au rang 100** (boutons +1 / +10 / Max)
- **Jusqu'à 5 personnages** par appareil : choix à chaque connexion, « Changer de personnage » dans le Menu
- **Banque de Gaspard** (village) : or, ressources, gemmes et 60 objets partagés entre tous tes personnages
- **Guildes** (tag, banque, quête hebdomadaire), **Hôtel des ventes**, **Arène** classée contre des copies des autres joueurs
- **Succès** avec titres, **quêtes journalières**

Dans la version serveur, la guilde, l'hôtel des ventes et l'arène sont stockés dans `data/shared.json`. Ces échanges font confiance au navigateur du joueur : pour un serveur public, il faudrait les valider côté serveur.

## Commandes

- Mobile : joystick à gauche, boutons à droite (maintenir Attaque = attaque auto)
- Clavier : ZQSD / WASD / flèches, Espace attaque (maintenir), C X F U sorts, V potion, E parler ou récolter, I sac, K catalogue, T voyage, R monture, J journal, N talents, G social, M son, Entrée chat, clic pour cibler
- Toucher un monstre le cible ; toucher un joueur ouvre sa fiche (groupe, échange)

## Fichiers

- `render.yaml` : configuration Render
- `server.js` : serveur HTTP + WebSocket, carte, monstres, combat, sauvegarde
- `public/index.html` : interface (HUD, écran d'accueil)
- `public/game.js` : rendu pixel art, contrôles, effets
