# Najarena — Design System (MASTER)

Source de vérité visuelle du site. Toute page doit respecter ce fichier.
Si `pages/<page>.md` existe, ses règles priment sur celles-ci pour cette page.
Ne jamais régénérer ce fichier avec `--force` sans accord explicite du propriétaire.

## 1. Identité

- Nom : NAJARENA (« Naja » = cobra). Plateforme de compétition e-sport : tournois, classement vérifié, CV e-sport.
- Ton : nerveux, compétitif, premium. Référence : marques de sport haut de gamme, pas « gamer grand public ».
- Logo : cobra blanc en traits de lame (`/brand/najarena-logo-blanc.svg`, `/brand/najarena-logo-noir.svg`).
  Version provisoire vectorisée ; sera remplacée par le fichier source de l'artiste (même nom de fichier).
  Le logo reste toujours blanc (ou noir sur fond clair), jamais recoloré en vert.

## 2. Couleurs (tokens)

| Token | Valeur | Usage |
|---|---|---|
| `--color-bg` | `#080908` | Fond de page |
| `--color-bg-alt` | `#0C0D0C` | Sections alternées |
| `--color-surface` | `#131513` → `#0D0F0D` | Panneaux (dégradé 160°) |
| `--color-text` | `#F5F5F4` | Texte principal |
| `--color-text-2` | `#B9BEB9` | Paragraphes |
| `--color-muted` | `#9CA39C` | Libellés, infos secondaires |
| `--color-faint` | `#6F766F` | En-têtes de tableaux, légendes |
| `--color-accent` | `#B6FF3B` | Vert « Venin » : accent de marque |
| `--color-on-accent` | `#080908` | Texte posé sur le vert (toujours noir) |
| `--color-danger` | `#FF4D4F` | Défaites, erreurs |
| `--color-line` | `rgba(245,245,244,.08)` | Filets de séparation |
| `--color-line-strong` | `rgba(245,245,244,.12)` | Filets de tableaux |

Règles :
- Le vert est RARE : bouton principal, chiffres clés, numéros de section, victoires, état « en direct ». Jamais en aplat de grande surface.
- Victoire / défaite : toujours couleur + lettre (V / D) ou icône. Jamais la couleur seule (daltonisme).
- Contrastes vérifiés (≥ 4.5:1) pour tous les textes ci-dessus sur `--color-bg` et `--color-surface`.

## 3. Typographie

Google Fonts : `Big Shoulders Display` (700, 800, 900) et `Chakra Petch` (400, 500, 600, 700).

| Rôle | Police | Style |
|---|---|---|
| Titres, chiffres clés | Big Shoulders Display 900 | MAJUSCULES, interlignage 0.85–0.9 |
| Titre d'ouverture | 150–168 px | |
| Titres de section | 88 px | |
| Sous-titres de cartes | 30–52 px, 800 | |
| Texte courant | Chakra Petch 400, 17–20 px | interlignage 1.6 |
| Libellés (eyebrows) | Chakra Petch 500, 11–13 px | MAJUSCULES, letter-spacing 3–4 px |
| Liens / boutons | Chakra Petch 600–700, 14–15 px | MAJUSCULES, letter-spacing 2 px |

Chiffres dans les tableaux : `font-variant-numeric: tabular-nums`.
Libellé de section type : `01 — COMMENT ÇA MARCHE` (numéro en vert, reste en `--color-muted`).

## 4. Espacements et mise en page

- Maquettes conçues en 1440 px de large, marges latérales 96 px, contenu max 1248 px.
- Sections : padding vertical 150 px (accueil), 48–72 px (pages outils).
- Grilles : 3 colonnes gap 40 px (accueil) ; profil en 2 colonnes 904 px + 312 px, gap 32 px.
- Beaucoup d'air : le vide fait partie du style premium.
- Responsive obligatoire : 375, 768, 1024, 1440 px. Aucun défilement horizontal de la page.

## 5. Formes et matières

- Rayons : boutons 2 px ; cartes/panneaux 4–6 px ; avatars 6–12 px.
- Bordures : filets fins `--color-line`, pas de cadres épais. Préférer les séparateurs aux boîtes.
- Panneaux : dégradé `#131513 → #0D0F0D`, bordure `rgba(245,245,244,.07)`,
  reflet `box-shadow: inset 0 1px 0 rgba(255,255,255,.05)`.
- Visuels : repères de visée aux 4 coins (équerres 14 px, 1 px, blanc 35 %).
- Grands numéros de section en filigrane (texte évidé, contour 1 px à 7 % d'opacité, 320 px).
- Motif d'écailles très discret en fond des zones d'ouverture.

## 6. Composants

- Bouton principal : fond vert, texte noir, 2 px de rayon, MAJUSCULES ; reflet lumineux qui balaie le bouton toutes les 7 s.
- Bouton secondaire : lien souligné (filet 1 px blanc 30 %), MAJUSCULES, flèche « → ».
- Badge « VÉRIFIÉ » : coche + texte vert, 11 px, letter-spacing 3 px.
- Badge « EN DIRECT » : fond vert, point noir qui pulse.
- Badge « CHERCHE UNE ÉQUIPE » : fond vert, texte noir.
- Pastilles V / D : fond vert 14 % / rouge 12 %, lettre en couleur pleine.
- Tableaux : pas de fond, filets entre lignes, en-têtes 11 px MAJUSCULES `--color-faint`.
- Rating : très grand chiffre en dégradé blanc → vert (texte détouré).
- Icônes : SVG au trait (1.5–2 px). Jamais d'emoji.

## 7. Animation

- Ouverture : le contour du logo se dessine en vert (~4 s), éclair, remplissage discret, halo qui respire, braises vertes qui montent (voir `maquettes/Ouverture-Anim.dc.html`).
- Boucles « comment ça marche » : animations d'interface codées, pas de vidéo (voir `maquettes/Boucle-*.dc.html`).
- Durées : survols 150–250 ms ; apparitions 300–450 ms.
- `prefers-reduced-motion` : toutes les animations coupées, état final affiché directement.
- Pages outils (profil, tournoi, classement) : animations minimales, sauf l'état « en direct ».

## 8. Avatars

- Système d'avatars vectoriels maison (`/avatars/`). Gratuits : 01 à 05. Premium : p1 (visière venin), p2 (teinture venin), p3 (édition Or).
- Premium = cosmétique uniquement. Aucun avantage de jeu (principe « pas de pay-to-win »).
- V1 : choix parmi les avatars gratuits. Éditeur et boutique premium : palier suivant.

## 9. Règles de contenu

- Aucun KDA brut affiché.
- Aucun visuel, logo ou nom de marque de Riot Games (propriété intellectuelle). Mention légale exigée par Riot pour l'API dans le pied de page.
- Pas de statistiques inventées en production ; afficher un état vide soigné si pas de données.
- Aucune vidéo ou image contenant un écran de jeu identifiable.

## 10. Accessibilité (checklist avant livraison)

- Contrastes ≥ 4.5:1, focus clavier visible, vrais `<button>` / `<a>`, `alt` sur les images.
- Zones cliquables ≥ 44 × 44 px.
- Information jamais portée par la couleur seule.
- Respect de `prefers-reduced-motion`.
