# Najarena — brief projet

Contexte permanent. À lire avant toute intervention sur le code.

---

## 1. Le produit

Plateforme de tournois **League of Legends** en français. Les joueurs disputent des tournois quotidiens ; les résultats sont **lus dans la donnée officielle Riot**, pas déclarés par les joueurs. Il en résulte un classement incontestable et un **profil public de type CV e-sport**.

**Promesse :** ton niveau, vérifié.
Le produit ne vend pas du spectacle, il vend une **preuve**. Toute décision de conception se tranche par : est-ce que ça renforce ou affaiblit la crédibilité du classement ?

**Périmètre V1 :** LoL, formats 1v1 et 5v5. La structure est multi-jeux dès le départ, mais un seul jeu est actif.

*Mise à jour du 12/09/2026 : les équipes/5v5 étaient prévues en Phase 3 (§9) ; leur construction a été avancée en V1 sur décision du porteur du projet, en parallèle du reste plutôt qu'après l'obtention de la clé Riot production.*

**Concurrent direct :** olymps.gg. Même thèse, plus avancé. On ne les copie pas ligne à ligne ; notre différenciation porte sur le CV e-sport multi-jeux, le matching entre joueurs, et une identité visuelle opposée à la leur.

**Le porteur du projet ne code pas.** Explique tes choix en langage simple. Quand tu introduis une notion technique nouvelle, définis-la en une phrase. Ne propose jamais de solution sans dire pourquoi tu l'as retenue.

---

## 2. Contrainte structurante : l'accès à l'API Riot

Ordre imposé, non négociable :

1. **Aujourd'hui** — clé de développement uniquement (expire toutes les 24 h). Pas de connexion via Riot, pas de codes de tournoi.
2. **Prototype** — on livre d'abord un site fonctionnel avec inscription, connexion, création de tournoi et inscription à un tournoi. C'est la condition posée par Riot pour accorder une clé production.
3. **Clé production obtenue** — la connexion Riot (RSO) devient possible, ainsi que la lecture de l'historique de matchs.
4. **API Tournament** — demandée après, elle seule donne les codes de lobby.

Conséquence sur l'architecture : **la couche d'identité doit être interchangeable.** En V1, le joueur saisit son Riot ID et prouve qu'il le possède en changeant son icône de profil. RSO se branchera ensuite derrière la même interface, sans réécriture.

---

## 3. Le système de verdict

Un match ne connaît pas son résultat, il consomme un **verdict** qui porte un niveau de fiabilité :

| Niveau | Source | Compte pour le classement |
|---|---|---|
| 3 | Code de tournoi Riot | oui |
| 2 | Partie retrouvée dans l'historique | oui |
| 1 | Décision manuelle de l'organisateur | **non** |

Le niveau est affiché publiquement sur chaque match. Un verdict manuel affiche son motif.

**On n'invente jamais un résultat.** En cas de doute, on escalade vers l'organisateur.

Détail complet : `docs/moteur-resultats.md`.

---

## 4. Le classement

**Glicko-2**, tau = 0.5, rating initial 1500, RD initial 350.

Règles calibrées par simulation (`docs/sim.py`) :

- **Période de notation = le tournoi**, jamais le match. Le calcul se fait à la clôture. Pendant le tournoi, on peut afficher une estimation, clairement étiquetée comme provisoire.
- **Entrée au classement : RD ≤ 150** (une dizaine de matchs). En dessous, le joueur est visible mais non classé.
- **Soft reset de saison : 15 %** vers 1500, RD multiplié par 1.8. Jamais de remise à zéro.
- **Inactivité :** le RD remonte, le rating ne bouge pas.
- **Paliers, seuils fixes :** Bronze < 1300 · Argent 1300 · Or 1450 · Platine 1600 · Diamant 1750 · Champion 1900+.

Anti-abus : 3 victoires max contre le même adversaire par 24 h, forfait = zéro point des deux côtés, verdict manuel ignoré dans le calcul.

**Chaque variation de points est journalisée** dans `rating_events`, avec le rating avant et après. Ce journal est public et ne se modifie jamais.

---

## 5. Stack

- **Next.js** (App Router) — le rendu serveur est indispensable : les profils joueurs et les pages de tournoi doivent être indexables par Google, c'est le canal d'acquisition principal.
- **Supabase** — Postgres, authentification, fonctions serveur, tâches planifiées.
- **Vercel** — hébergement.
- **Tailwind** — les jetons de la direction artistique y sont traduits.
- **Discord** — canal de notification principal. Pas d'e-mail pour les rappels de check-in.

Schéma de base de données : `docs/schema.sql`.

---

## 6. Règles de sécurité — non négociables

1. **Le client n'écrit jamais sur `ratings` ni `rating_events`.** Aucune policy d'insertion ou de mise à jour sur ces tables. Écriture réservée aux fonctions serveur.
2. **La clé Riot ne quitte jamais le serveur.** Aucun appel à l'API Riot depuis le navigateur.
3. **Aucun secret dans le dépôt Git.** Variables d'environnement uniquement.
4. **Toute opération d'attribution de points est idempotente.** Une relance ne doit jamais créditer deux fois.
5. RLS activé sur toutes les tables contenant des données utilisateur.

---

## 7. Direction artistique

**Source de vérité : `design-system/najarena/MASTER.md`**, complété par `design-system/najarena/pages/` (accueil, profil, tournoi — leurs règles priment sur MASTER pour leur page). Maquettes de référence (mise en page, textes, tailles) : `najarena-design/maquettes/` — format de maquette, pas du code à copier (voir `najarena-design/LISEZ-MOI.md`). Ne jamais régénérer MASTER.md sans accord du porteur du projet.

**Principe :** nerveux, compétitif, premium — marque de sport haut de gamme, pas « gamer grand public ». Le vert Venin est **rare**. La crédibilité du classement passe avant l'effet : pages outils (profil, tournoi, classement) denses et peu animées, accueil spectaculaire.

**Traduction dans le code**
- Jetons (couleurs, polices, tailles, espacements, rayons) : `src/app/globals.css`, bloc `@theme` — `bg-bg`, `text-text`, `text-muted`, `bg-accent`, `text-on-accent`, `border-line`, `font-titre`, `font-texte`, `text-section`, `px-gouttiere`, `max-w-contenu`, `rounded-bouton`, utilitaires `panneau`, `fond-ecailles`, `texte-rating`, `reflet`, classe `.tableau`.
- Composants : `src/components/design/` (BoutonLien, BoutonEnvoi, badges, PastilleResultat, ChiffreRating, IndicateurConfiance, Panneau, ReperesVisee, LibelleSection, NumeroFiligrane, Tableau, Icone, Logo). Les consulter avant d'écrire un bouton, un badge ou une carte.
- Accueil : composants propres dans `src/components/vitrine/` (ouverture, boucles, affiches générées, cartes « EXEMPLE », top 10), animations dans `vitrine.module.css`. Barre de navigation `components/design/Navbar.tsx` et `components/Footer.tsx` partagés par tout le site ; lien « Aller au contenu » dans le layout.
- Profil joueur : affichage refait, chargement d'origine (`chargerJoueur`) inchangé ; données d'affichage ajoutées (rang national, palier, courbe de saison, équipes, annonce, rôle) dans `lib/profil-vitrine.ts`, composants dans `src/components/profil/` (courbe, bouton Partager). « Partager le CV » partage le lien public du profil ; l'export imprimable `/cv` reste réservé à l'offre Elite.
- Page tournoi et tournoi d'exemple : mêmes blocs dans `src/components/tournoi/` (en-tête d'affiche, onglets-ancres avec état actif, bracket à connecteurs, déroulement, essentiel du règlement). `chargerTournoi` et les conditions d'inscription / de litige inchangés ; lecture ajoutée dans `lib/tournoi-vitrine.ts`. Règlement affiché = règles réellement appliquées (CGU, §3-§4), pas celles de la maquette (« retard de 15 min = forfait » n'existe pas). Pas de bloc « Récompenses » (aucune en base).
- Bouton « Pause » (bandeau de l'accueil) : fige toutes les animations du site (`html[data-animations="pause"]`, `lib/pause-animations.ts`) — exigence WCAG 2.2.2 pour tout contenu qui bouge seul plus de 5 s.
- Charte vivante : `/charte` (tous les composants rendus en vrai ; absente du site en ligne, visible en local et en prévisualisation).
- Typographie : Big Shoulders (titres, chiffres clés, MAJUSCULES) + Chakra Petch (texte, libellés, boutons). Tout chiffre de preuve (rating, RD, delta, horodatage) en `tabular-nums`.

**Adaptations propres à Najarena — décidées le 23/09/2026, priment sur la maquette**
- **Niveaux de verdict** (§3) : `BadgeVerdict`. Niveaux 3 et 2 → « ✓ VÉRIFIÉ » vert + source (code tournoi / historique). Niveau 1 → « MANUEL » gris avec plume, **jamais vert, jamais « vérifié »**. La maquette n'a qu'un badge « VÉRIFIÉ » : ne jamais l'appliquer à un verdict manuel.
- **Sceau de fiabilité supprimé**, remplacé par `IndicateurConfiance` (« CONFIRMÉ » / « PROVISOIRE » + « Confiance N % ») — même calcul qu'avant (`ratings.est_classe`, `calibrationPct`).
- **Couleurs de paliers** (Bronze → Champion, `lib/paliers.ts`) : seule exception tolérée au « tout vert ».
- **Contraste** : `faint` vaut `#798079`, pas `#6F766F` (MASTER) — la valeur d'origine ne passe pas 4.5:1 (4.27 sur fond, 3.93 sur panneau), seuil que MASTER exige lui-même.
- **Accueil = vitrine, son premier but est d'attirer** (décision du porteur, 23/09/2026, qui prime pour cette page sur le « pas de spectacle » du §1) : textes, mots du bandeau (« Zéro triche », « Rating officiel », « Repéré par les équipes ») et mise en scène de la maquette conservés ; cartes CV = illustrations du produit avec badge « VÉRIFIÉ » et pseudo « TON_PSEUDO » (jamais un faux joueur). **Jamais de section vide** : affiches de tournois complétées par le tournoi d'exemple, « Organise ton tournoi », « Crée ton équipe » ; top 10 complété par des « places à prendre ». La seule limite : **aucune fonctionnalité annoncée qui n'existe pas** (voir ci-dessous) — remplacée par une formule aussi forte mais vraie.
- **Pas de bloc sans donnée réelle** : Talent Score, analyse IA, classement/rating par rôle, VOD, réglage public/privé par bloc — masqués tant que la fonctionnalité n'existe pas, jamais de valeurs fictives (« disponibilité » et « parcours » du profil existent, construits sur l'annonce « cherche une équipe », les équipes et le premier match réels). Pas de promesse fausse dans les textes : pas d'« anti-smurf » (→ « Comptes vérifiés »), pas de « rang vérifié » (→ « compte vérifié »), pas de rating / classement « par rôle », pas de mise à jour « après chaque match » (→ « recalculé à la fin de chaque tournoi »), pas de « les recruteurs le regardent ».
- **Aucun visuel Riot** (icônes de champions DDragon comprises) ; la mention légale Riot reste dans le pied de page.
- **Navigation** : liens existants conservés (Tournois, Classement, Coéquipiers, Organiser, Tarifs), pas les « Équipes / Recruteurs » de la maquette tant que ces pages n'existent pas.
- **Fond animé** : `BracketBackground` / `FondArene` remplacés par le motif d'écailles discret ; l'animation d'ouverture (logo qui se dessine) est réservée à l'accueil. `prefers-reduced-motion` coupe tout.

**Migration terminée (24/09/2026)** : toutes les pages sont passées à l'identité « Venin ». Les anciens jetons (`encre`, `papier`, `sceau`, `laiton`, `atteste`, `ardoise`, `carte`, `trait`…), les polices Bricolage / Inter Tight / JetBrains Mono et les anciens composants décoratifs (fond animé, sceau de fiabilité, compteur animé) sont **supprimés**. Les pages non refaites une à une ont été converties automatiquement (couleurs, polices, largeurs, champs) ; `lib/ui.ts` et `components/ui/` (Badge, Bouton, SectionTitre, EtatVide, Squelette, CrestPalier, illustrations d'états vides) restent comme **couche de compatibilité redessinée** : mêmes noms qu'avant, nouveau style. Pour du nouveau code, utiliser `lib/design.ts` et `components/design/`. Dans `lib/ui.ts`, les noms d'accent historiques restent (`classeCarte("sceau")` = rouge attention/erreur, `"atteste"`/`"laiton"` = vert). L'ancienne direction artistique est figée au tag git `avant-nouveau-design` ; `docs/direction-artistique.html`, `docs/fonds-animes.html` et `docs/design-system.md` la décrivent et sont **obsolètes**.

---

## 8. Arborescence

```
/                          accueil (animation d'ouverture du logo, boucles « comment ça marche »)
/lol                       hub du jeu
/lol/tournois              liste + filtres
/lol/tournois/[slug]       page tournoi
/lol/tournois/demo         tournoi d'exemple (données statiques, jamais en base)
/lol/classement            leaderboard
/lol/coequipiers           recherche de coéquipiers (5v5)
/joueur/[pseudo]           CV e-sport public — transverse, jamais sous /lol
/equipe/[slug]             page publique d'équipe
/equipe/nouvelle           création d'équipe
/organiser/nouveau         création de tournoi
/moi                       tableau de bord joueur
/moi/organisation/[id]     cockpit de tournoi
/connexion /inscription /lier-riot
/admin                     modération, litiges
/comment-ca-marche         guide éditorial (verdict, Glicko-2, indice de confiance)
/faq                       questions de confiance, dépliées par défaut (gratuité, affiliation Riot, délais, IA)
/journal                   journal de bord public (docs/journal réel, voir src/lib/journal.ts)
/note-du-fondateur         positionnement produit, en 1ère personne
/charte                    charte graphique vivante (interne, absente du site en ligne)
```

Le segment de jeu (`/lol/...`) est obligatoire dès maintenant : sans lui, l'ajout d'un second jeu imposerait une migration d'URL et une perte de référencement.

Le profil joueur reste **hors** du segment de jeu, avec des onglets par jeu — c'est un CV unique qui accumule les jeux.

*Mise à jour du 13/09/2026 : trois pages de contenu ajoutées pour donner de la substance au site indépendamment du trafic réel (`/comment-ca-marche`, `/journal`, `/note-du-fondateur`), plus un tournoi d'exemple aux données statiques, jamais écrites en base (`/lol/tournois/demo`) pour montrer un bracket complet avant le premier vrai tournoi public — ses matchs ne comptent jamais dans les statistiques du site (accueil, admin), contrairement à un vrai tournoi. Décision issue du dossier d'audit du 12/09 (§20) et d'un brainstorm complémentaire non couvert par l'audit.*

---

## 9. Roadmap

**Phase 0 — dossier Riot.** Inscription, profil, saisie du Riot ID, création de tournoi, inscription, check-in, bracket 1v1, résultats manuels, profil public. Aucun classement. → dépôt de la demande de clé production.

**Phase 1 — pendant l'attente.** Moteur Glicko-2 et journal des points, cockpit organisateur (check-in, byes, litiges), paliers et leaderboard, CV e-sport partageable, pages légales, direction artistique, pages SEO.

**Phase 2 — clé obtenue.** RSO, rapprochement par historique (niveau 2), synchronisation des Riot ID, demande d'API Tournament, lancement public, saison 1.

**Phase 3.** Codes de tournoi (niveau 3), analyse IA du profil (version progression), matching duo. *(Équipes et 5v5, recherche de coéquipiers, temps réel, Discord et assistant IA organisateur avancés en V1 le 12/09/2026 — voir §1.)*

**Phase 4.** Analyse orientée recruteur, scouting, overlay stream, cash prizes sponsorisés.

---

## 10. Contrainte d'exploitation à ne pas oublier

La précision du classement dépend du **nombre de matchs par joueur**, pas du nombre de joueurs. Compter environ **15 joueurs actifs par place de tournoi et par jour**. Ouvrir de nouveaux créneaux au fur et à mesure de la croissance, plutôt que d'entasser tout le monde sur un seul tournoi quotidien — un classement bruité détruit la valeur du CV e-sport, qui est le produit.

**Tournois automatiques (24/09/2026)** : les créneaux quotidiens se règlent dans `src/lib/tournois-auto/creneaux.ts` (ajouter un créneau = ajouter une ligne ; ne jamais renommer la `cle` d'un créneau existant). La tâche `/api/cron/tournois-auto` crée les tournois, ouvre le check-in, envoie les rappels (push + message privé Discord, jamais d'e-mail), puis lance le bracket ou annule faute de joueurs. Elle est appelée toutes les 5 minutes par la base (pg_cron, voir `docs/schema.sql`), pas par Vercel (plan gratuit limité à une tâche par jour). Organisateur de ces tournois : `TOURNOIS_AUTO_ORGANISATEUR_ID`, sinon le premier compte de la table `admins`.

---

## 11. Conventions de code

- TypeScript partout, `any` proscrit.
- Nommage de la base de données en français (le schéma existant fait foi), code en anglais.
- Les montants de rating sont des `numeric`, jamais des flottants côté application.
- Toute écriture liée au classement passe par une transaction unique.
- Un commit par unité fonctionnelle, message en français.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
