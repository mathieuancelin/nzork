# Guide de traduction de Zork I

Ce guide s'applique à tous les textes du jeu. Il garantit une traduction cohérente même si
plusieurs personnes (ou agents) traduisent des parties différentes.

## Ton

- On **vouvoie** le joueur (« Vous êtes dans la cuisine. »), comme dans toute la fiction
  interactive francophone.
- On garde l'**humour pince-sans-rire** d'Infocom : ironie, understatement, petites piques au
  joueur. Un jeu de mots intraduisible s'**adapte** (on en invente un équivalent) plutôt que de
  se traduire mot à mot.
- Style littéraire mais simple, phrases courtes. Passé composé / présent comme l'anglais.
- Pas d'anglicismes inutiles. Les noms propres inventés restent tels quels (Flathead,
  Frobozz, zorkmid, Zork, GUE Tech…).

## Typographie

- Espace normale avant `?`, `!`, `:` et `;` (« Que voulez-vous ouvrir ? »).
- Guillemets français avec espaces : `« Bonjour ! »`. Les guillemets anglais `"..."` deviennent
  `« ... »`, y compris pour les inscriptions et les citations.
- Apostrophe droite `'` (pas de typographique, le jeu affiche du texte brut).
- Majuscules accentuées quand il le faut (« À l'ouest de la maison », « Écho »).
- Les nombres restent en chiffres si l'anglais les met en chiffres.

## Format des textes à traduire

Chaque entrée a une clé (`g5955`, `s1a2b`, `m6f10`…) et un texte anglais (`en`). On produit
le texte français pour la même clé.

### Retours à la ligne

Les `\n` font partie de la mise en page du jeu. **Conserver le même nombre de `\n` au début et à
la fin** du texte. À l'intérieur, on garde les `\n` qui séparent des lignes (listes, poèmes,
inscriptions) ; les longues phrases anglaises n'ont pas de retour à la ligne interne.

### Fragments

Beaucoup de textes sont des **fragments** qui seront collés à d'autres morceaux au moment de
l'affichage. Par exemple `"You can't see any "` puis le mot tapé par le joueur puis `" here!"`.
Il faut traduire le fragment pour qu'il se recolle correctement :
`"Vous ne voyez pas de "` … `" ici !"`. Respecter les espaces de début et de fin.
Le contexte ZIL (`zil`) montre le `TELL` complet d'où vient le fragment : s'en servir.

### Paramètres (objets, nombres)

Dans les textes, `{0}`, `{1}`… désignent des valeurs insérées à l'affichage. La liste `args`
donne leur nature : `o` = un objet (son nom), `n` = un nombre, `s` = un autre texte, `c` = un
caractère, `w` = un mot du dictionnaire.

Pour un **objet**, le nom est inséré **sans article**, et on choisit la forme grammaticale avec
une fonction :

| Gabarit | Résultat (épée, f) | Résultat (coffre, m) | (feuilles, f pl) |
|---|---|---|---|
| `{0}` | épée | coffre | feuilles |
| `{le:0}` | l'épée | le coffre | les feuilles |
| `{un:0}` | une épée | un coffre | des feuilles |
| `{du:0}` | de l'épée | du coffre | des feuilles |
| `{au:0}` | à l'épée | au coffre | aux feuilles |
| `{de:0}` | d'épée | de coffre | de feuilles |
| `{ce:0}` | cette épée | ce coffre | ces feuilles |
| `{il:0}` | elle | il | elles |
| `{lui:0}` | la (l' devant voyelle) | le (l' devant voyelle) | les |
| `{e:0}` | e | (rien) | es |
| `{g:0\|ouvert\|ouverte}` | ouverte | ouvert | ouvertes |

`{lui:0}` s'élide automatiquement devant le mot suivant (« {lui:0} avale » → « l'avale »).
Une majuscule sur la fonction met une majuscule au résultat : `{Le:0}` → « L'épée ».
L'accord se fait avec l'objet : `"{Le:0} est fermé{e:0}."` → « La boîte est fermée. » /
« Le coffre est fermé. ». Pour un verbe : `"{Le:0} {g:0|est|est|sont|sont} là."`.

Pour un **nombre** : `{0}` affiche le nombre, `{s:0}` ajoute « s » s'il vaut 2 ou plus :
`"{0} point{s:0}"`.

Références spéciales :
- `{le:+}` (ou `{un:+}`, `{Le:+}`…) : l'article de **l'objet qui sera affiché juste après** ce
  fragment (quand l'anglais écrit `"the "` à la fin d'un fragment et que le nom de l'objet vient
  dans un autre morceau). Le nom lui-même n'est pas répété.
- `{e:-}`, `{il:-}`, `{g:-|…}` : accord avec **le dernier objet affiché** (quand l'objet a été
  affiché dans un fragment précédent).

Si l'anglais contient « the » devant `{0}`, on utilise `{le:0}` ; « a/an » → `{un:0}`, etc.
On ne laisse jamais « le », « la » ou « un » en dur devant un paramètre objet.

### Messages de combat (clés `m…`)

Ils contiennent `{wep}` (l'arme) et `{def}` (le défenseur : troll, voleur, cyclope, ou vous).
Mêmes fonctions : `{le:def}`, `{Le:def}`, `{wep}`… Exemple :
`"Your {wep} misses the {def} by an inch."` → `"Votre {wep} manque {le:def} d'un cheveu."`.

## Commandes citées dans les textes

Quand un texte cite une commande du jeu, utiliser la commande française :

| Anglais | Français |
|---|---|
| VERBOSE / BRIEF / SUPERBRIEF | DÉTAILLÉ / BREF / SUPERBREF |
| INVENTORY, I | INVENTAIRE, I |
| LOOK, L | REGARDER, R |
| EXAMINE | EXAMINER, X |
| SCORE | SCORE |
| DIAGNOSE | DIAGNOSTIC |
| SAVE / RESTORE / RESTART / QUIT | SAUVEGARDER / CHARGER / RECOMMENCER / QUITTER |
| AGAIN, G | ENCORE, G |
| OOPS | OUPS |
| WAIT, Z | ATTENDRE, Z |
| YES / NO (Y / N) | OUI / NON (O / N) |
| SCRIPT / UNSCRIPT | TRANSCRIPTION / FIN TRANSCRIPTION |
| directions N, S, E, W, NE… | N, S, E, O, NE, NO, SE, SO, HAUT, BAS |

Les mots magiques restent ou s'adaptent : « echo » → « écho », « Odysseus / Ulysses » → « Ulysse »,
« XYZZY » et « PLUGH » restent tels quels, « Hello, sailor! » → « Salut, marin ! ».

## Glossaire

### Lieux

| Anglais | Français |
|---|---|
| West of House | À l'ouest de la maison |
| North of House | Au nord de la maison |
| South of House | Au sud de la maison |
| Behind House | Derrière la maison |
| Kitchen | Cuisine |
| Living Room | Salon |
| Attic | Grenier |
| Cellar | Cave |
| Forest | Forêt |
| Forest Path | Sentier forestier |
| Up a Tree | Dans un arbre |
| Clearing | Clairière |
| Canyon View | Vue sur le canyon |
| Rocky Ledge | Corniche rocheuse |
| Canyon Bottom | Fond du canyon |
| End of Rainbow | Pied de l'arc-en-ciel |
| On the Rainbow | Sur l'arc-en-ciel |
| Aragain Falls | Chutes d'Aragain |
| Stone Barrow | Tumulus de pierre |
| The Troll Room | Salle du troll |
| East of Chasm | À l'est du gouffre |
| Gallery | Galerie |
| Studio | Atelier |
| Maze | Labyrinthe |
| Dead End | Cul-de-sac |
| Grating Room | Salle de la grille |
| Cyclops Room | Salle du cyclope |
| Strange Passage | Passage étrange |
| Treasure Room | Salle du trésor |
| East-West Passage | Passage est-ouest |
| North-South Passage | Passage nord-sud |
| Round Room | Salle ronde |
| Loud Room | Salle bruyante |
| Deep Canyon | Canyon profond |
| Damp Cave | Grotte humide |
| Chasm | Gouffre |
| Reservoir / Reservoir North / Reservoir South | Réservoir / Réservoir nord / Réservoir sud |
| Stream View / Stream | Vue sur le ruisseau / Ruisseau |
| Dam / Dam Lobby / Dam Base | Barrage / Hall du barrage / Pied du barrage |
| Maintenance Room | Salle de maintenance |
| Frigid River | Rivière glaciale |
| White Cliffs Beach | Plage des falaises blanches |
| Sandy Beach / Sandy Cave | Plage de sable / Grotte sablonneuse |
| Shore | Rivage |
| Mirror Room | Salle du miroir |
| Cave | Grotte |
| Small Cave / Tiny Cave | Petite grotte / Minuscule grotte |
| Cold Passage / Narrow Passage / Winding Passage / Twisting Passage | Passage froid / Passage étroit / Passage sinueux / Passage tortueux |
| Atlantis Room | Salle de l'Atlantide |
| Engravings Cave | Grotte aux gravures |
| Dome Room / Torch Room | Salle du dôme / Salle de la torche |
| Temple / Altar | Temple / Autel |
| Egyptian Room | Salle égyptienne |
| Entrance to Hades / Land of the Dead | Entrée des Enfers / Pays des morts |
| Mine Entrance / Coal Mine | Entrée de la mine / Mine de charbon |
| Squeaky Room / Bat Room / Shaft Room / Smelly Room / Gas Room | Salle grinçante / Salle des chauves-souris / Salle du puits / Salle nauséabonde / Salle du gaz |
| Ladder Top / Ladder Bottom | Haut de l'échelle / Bas de l'échelle |
| Timber Room / Drafty Room / Machine Room / Slide Room | Salle des poutres / Salle des courants d'air / Salle de la machine / Salle du toboggan |

### Personnages et créatures

| Anglais | Français |
|---|---|
| grue | **un grue** (masculin ! « dévoré par un grue ») |
| troll | troll |
| thief | voleur |
| cyclops | cyclope |
| songbird | oiseau chanteur |
| bat | chauve-souris |
| spirits / ghosts | esprits / fantômes |
| adventurer | aventurier |

### Objets principaux

| Anglais | Français |
|---|---|
| white house | maison blanche |
| small mailbox | petite boîte aux lettres |
| leaflet | prospectus |
| brass lantern / lamp | lanterne en laiton |
| elvish sword | épée elfique |
| trophy case | vitrine à trophées |
| rug, carpet | tapis |
| trap door | trappe |
| glass bottle | bouteille en verre |
| brown sack | sac brun |
| lunch | casse-croûte |
| clove of garlic | gousse d'ail |
| rope | corde |
| nasty knife / rusty knife | vilain couteau / couteau rouillé |
| stiletto | stylet |
| bloody axe | hache ensanglantée |
| jewel-encrusted egg | œuf incrusté de joyaux |
| golden clockwork canary | canari mécanique en or |
| brass bauble | babiole en laiton |
| painting | tableau |
| jade figurine | figurine de jade |
| crystal trident / crystal skull | trident de cristal / crâne de cristal |
| platinum bar | lingot de platine |
| ivory torch | torche d'ivoire |
| pair of candles | paire de bougies |
| matchbook, match | pochette d'allumettes, allumette |
| brass bell | cloche en laiton |
| black book | livre noir |
| gold coffin | cercueil en or |
| sceptre | sceptre |
| skeleton key | passe-partout |
| leather bag of coins | bourse de cuir pleine de pièces |
| large emerald / huge diamond | grosse émeraude / énorme diamant |
| jeweled scarab | scarabée orné de joyaux |
| sapphire-encrusted bracelet | bracelet incrusté de saphirs |
| trunk of jewels | malle de bijoux |
| pot of gold | pot d'or |
| chalice | calice |
| shovel / screwdriver / wrench | pelle / tournevis / clé à molette |
| hand-held air pump | pompe à air manuelle |
| magic boat / punctured boat | bateau magique / bateau crevé |
| red buoy | bouée rouge |
| tube / viscous material (putty) | tube / substance visqueuse |
| tour guidebook | guide touristique |
| ancient map | carte ancienne |
| grating | grille |
| control panel, bolt, bubble, button | panneau de commande, boulon, bulle, bouton |
| machine, switch, coal, slag | machine, interrupteur, charbon, scorie |
| basket | panier |
| wooden ladder / railing | échelle en bois / rampe en bois |
| altar / pedestal / mirror | autel / piédestal / miroir |
| rainbow | arc-en-ciel |
| pile of leaves | tas de feuilles |
| treasure | trésor |

### Noms propres et institutions

| Anglais | Français |
|---|---|
| Great Underground Empire | Grand Empire Souterrain |
| Flood Control Dam #3 (FCD#3) | Barrage n° 3 de régulation des crues (BRC n° 3) |
| Frobozz Magic … Company | Compagnie Frobozz de … magiques (ex. Compagnie Frobozz des bateaux magiques) |
| Lord Dimwit Flathead | Lord Dimwit Flathead |
| zorkmid | zorkmid |
| Zork, ZORK | Zork, ZORK |
| Infocom | Infocom |

### Rangs du score

Beginner → Débutant · Amateur Adventurer → Aventurier amateur · Novice Adventurer → Aventurier
novice · Junior Adventurer → Aventurier en herbe · Adventurer → Aventurier · Master → Maître ·
Wizard → Magicien · Master Adventurer → Maître aventurier.

### Phrases célèbres

- « It is pitch black. You are likely to be eaten by a grue. » → « Il fait noir comme dans un
  four. Vous risquez fort d'être dévoré par un grue. »
- « You are in a maze of twisty little passages, all alike. » → « Vous êtes dans un dédale de
  petits passages tortueux, tous semblables. »
- « Oh, no! You have walked into the slavering fangs of a lurking grue! » → « Oh non ! Vous êtes
  tombé tout droit dans les crocs baveux d'un grue aux aguets ! »
