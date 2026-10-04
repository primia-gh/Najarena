# Najarena — brief projet

Contexte permanent. À lire avant toute intervention sur le code.

---

## 1. Le produit

Plateforme de tournois **League of Legends** en français. Les joueurs disputent des tournois quotidiens ; les résultats sont **lus dans la donnée officielle Riot**, pas déclarés par les joueurs. Il en résulte un classement incontestable et un **profil public de type CV e-sport**.

**Promesse :** ton niveau, vérifié.
Le produit ne vend pas du spectacle, il vend une **preuve**. Toute décision de conception se tranche par : est-ce que ça renforce ou affaiblit la crédibilité du classement ?

**Périmètre V1 :** LoL, formats 1v1 et 5v5. La structure est multi-jeux dès le départ, mais un seul jeu est actif.

*Mise à jour du 12/09/2026 : les équipes/5v5 étaient prévues en Phase 3 (§9) ; leur construction a été avancée en V1 sur décision du porteur du projet, en parallèle du reste plutôt qu'après l'obtention de la clé Riot production.*

*Mise à jour du 03/10/2026 (audit N21) : **tournois 5v5** — format choisi à la création. Le capitaine inscrit son équipe avec cinq membres aux comptes Riot vérifiés (`s_inscrire_equipe`, table `alignements`, un joueur par équipe et par tournoi), fait le check-in et représente l'équipe dans le bracket (`match_participants.profile_id` = capitaine). Résultat retenu seulement si les dix joueurs alignés sont dans la partie, chaque équipe de son côté. Hors classement individuel ; palmarès sur la page d'équipe, parcours sur le CV.*

*Mise à jour du 03/10/2026 (audit N22) : **scrims vérifiés** — un capitaine propose un match d'entraînement à une autre équipe depuis sa page (date, Bo1/Bo3, cinq joueurs) ; accepté avec les cinq joueurs adverses, il devient un mini-tournoi 5v5 à deux (`tournaments.nature = 'scrim'`, `proposer_scrim` / `repondre_scrim` / `annuler_scrim`), arbitré par le premier administrateur, lu chez Riot comme un match de tournoi, sans forfait automatique, annulé sans partie retrouvée 24 h après l'heure prévue. Jamais classé ; résultat sur la page des deux équipes.*

*Mise à jour du 03/10/2026 (audit N23) : **agents libres** — dans un tournoi 5v5, un joueur sans équipe s'inscrit seul (`s_inscrire_agent_libre`, rôle facultatif) et fait son check-in ; au lancement du bracket, les agents confirmés sont regroupés en équipes de cinq équilibrées par rating et par rôle (`src/lib/agents-libres.ts`), inscrites par la base sous le nom « Agents libres N » (`former_equipes_agents_libres`, pas de page d'équipe). Premiers inscrits servis en premier ; les agents en trop sont prévenus.*

*Mise à jour du 03/10/2026 (audit N24) : **échéances (Nexus Tour, Clash)** — table `echeances` : Clash lu dans l'API Riot (clash-v1) par la tâche des tournois automatiques, quatre fois par jour (`src/lib/echeances-serveur.ts`) ; Nexus Tour et autres saisis dans `/admin#echeances` avec un lien officiel obligatoire. Jamais une date inventée. Une annonce « cherche une équipe » peut viser une échéance à venir (`recherches_coequipiers.objectif_id`), affichée sur `/lol/coequipiers` et sur le CV.*

*Mise à jour du 03/10/2026 (audit N25, N28, N29) : **textes rédigés par l'IA**, tous via `src/lib/claude.ts` (SDK `@anthropic-ai/sdk`, modèle fixé par la constante `MODELE_IA`, effort `low`, réponse JSON contrainte par schéma puis revérifiée, repli `fallbacks: "default"`), à la demande, dans la limite de 10 demandes par 24 h (`reserver_appel_assistant_ia`) : analyse détaillée d'un match (offre Elite, chiffres Riot seuls, table `revues_match_ia` ; **rédigée aussi automatiquement** depuis le 04/10/2026 pour chaque partie vérifiée des 7 derniers jours, 2 par passage de la tâche de recherche des résultats, 10 par joueur et par 24 h, une réponse refusée ou invalide retentée une seule fois : `revues_a_rediger`, `noter_echec_revue`, `src/lib/revue-ia-serveur.ts`), dossier de litige (faits rassemblés par le serveur + synthèse, **ne désigne jamais de vainqueur**, table `dossiers_litige`, lisible par l'organisateur et les admins), recherche de joueurs en langage naturel (offre Organisateur, l'IA ne produit que des filtres). Toute saisie d'un utilisateur est passée à l'IA entre balises, comme une donnée.*

*Mise à jour du 03/10/2026 (audit N13) : **fiche publique de l'organisateur** — `fiche_organisateur` (base) : tournois publiés, menés à terme, annulés ; part des matchs lus chez Riot ; litiges tranchés et délai médian. Sur ses seuls tournois (hors officiels, défis, scrims, brouillons). Bloc « Organisateur » du CV, résumé sous « Organisé par » d'un tournoi (`src/lib/fiche-organisateur.ts`, pas de pourcentage sous 5 matchs).*

*Mise à jour du 03/10/2026 (audit N15) : **comptes Riot secondaires déclarés** — jusqu'à 3 comptes par joueur (`lier_compte_riot(..., p_principal)`), vérifiés par l'icône, affichés sur le CV (bloc « Comptes Riot »). Seul le principal inscrit aux tournois et sert à lire les résultats ; en changer (`definir_compte_principal`) ou en lier un nouveau comme principal est refusé pendant un tournoi pas encore terminé (`engage_en_tournoi`). Chaque match vérifié garde le compte qui l'a joué (`stats_match_joueur.puuid`).*

*Mise à jour du 03/10/2026 (audit N19) : **arène 1v1** — `/lol/arene` : un joueur entre dans la file de sa région (`rejoindre_arene`, table `file_arene`) ; il est apparié à un joueur de même région et même règle de victoire si l'écart de rating ≤ 100 + moitié du plus grand RD + 20 par minute d'attente, 500 au plus (`ecart_arene`, `src/lib/arene.ts`). Le duel est un défi accepté d'office (`creer_duel`, nommé « Arène A contre B »), mêmes règles de classement. Appariement aussi à chaque passage de la tâche des tournois automatiques (`apparier_arene`) ; place expirée après 30 minutes.*

*Mise à jour du 03/10/2026 (audit N20) : **pronostics gratuits** — vainqueur des demi-finales (1 point) et des finales (2 points) des tournois (`nature = 'tournoi'`), depuis la page du tournoi (`#pronostics`, fonction `pronostiquer`, table `pronostics`). Fermé dès qu'un joueur du match est prêt ou 10 minutes après l'ouverture du match ; les joueurs du tournoi et l'organisateur ne pronostiquent pas. Compté seulement sur un verdict lu chez Riot (forfait, verdict manuel = annulé). Classement par saison sur `/lol/pronostics` (`classement_pronostics`). **Aucune mise, aucun gain** — ne jamais y attacher de récompense (ce serait un jeu d'argent).*

*Mise à jour du 03/10/2026 (audit N30) : **espaces communauté** — `/communautes`, `/communaute/[slug]`, `/communaute/nouvelle` : tables `communautes` et `membres_communaute`, `tournaments.communaute_id`. Créées par l'offre Organisateur (3 au plus, `creer_communaute`), rejointes librement ; fondateur / administrateurs / membres. Classement interne = rating officiel des membres classés, jamais un rating à part. Serveur Discord lié par un code de 30 minutes saisi avec `/lier` par un membre qui peut gérer le serveur (`lier_serveur_discord`, rôle service) ; commandes `/communaute` et `/organiser` (lien pré-rempli vers `/organiser/nouveau`, le bot n'écrit jamais de tournoi). Commandes à réenregistrer : `npm run discord:commandes`.*

*Mise à jour du 03/10/2026 (audit N31) : **widgets et API publique** — widgets HTML autonomes sans script (`/widget/bracket/[slug]`, `/widget/top10`, `/widget/joueur/[pseudo]`, `?fond=transparent` pour OBS, rafraîchis toutes les 60 s), seules pages intégrables dans un autre site (`frame-ancestors *` dans `next.config.ts`) ; API JSON en lecture seule `/api/public/v1/{classement, joueurs/[pseudo], tournois/[slug]}` (CORS ouvert, cache CDN 1 min, client anonyme). Données communes : `src/lib/donnees-publiques.ts` (pas de rating avant l'entrée au classement, `verifie` faux pour un verdict manuel). Mode d'emploi : `/developpeurs`. Exclus du proxy de session.*

*Mise à jour du 03/10/2026 (audit N32) : **cash prizes sponsorisés, désactivés** — tables `dotations` et `versements_dotation`, tout réservé aux administrateurs (`enregistrer_dotation` avant la fin des inscriptions d'un tournoi 1v1, `preparer_versements` lit les gagnants dans le bracket — un rang tranché à la main est « à vérifier » —, `noter_versement`). Aucun argent ne transite par le site. Rien n'est affiché tant que `CASH_PRIZES_ACTIFS` n'est pas à `1` (`src/lib/dotations.ts`) : à n'allumer qu'après le statut juridique (audit E11), des CGU relues et la vérification des règles Riot sur les tournois dotés. Inscription toujours gratuite. **Versement par Stripe Connect (04/10/2026)** : le gagnant ouvre un compte de versement depuis `/moi/gains` (Connect Express, `ouvrir_compte_versement`) ; Stripe vérifie son identité et ses coordonnées bancaires, l'état est relu au retour (`/moi/gains/retour`) et par le webhook `account.updated` (`maj_compte_versement`, `STRIPE_CONNECT_WEBHOOK_SECRET`). L'administrateur clique « Verser par Stripe » : `preparer_virement` (gain à verser, rang manuel vérifié, identité vérifiée), virement retrouvé chez Stripe ou créé avec une clé d'idempotence, puis `noter_virement` ; un gain versé par Stripe ne se modifie plus à la main. Allumer les cash prizes ajoute un paragraphe aux CGU et à la confidentialité : changer alors `VERSION_CGU`. `src/lib/versements-stripe.ts`.*

*Mise à jour du 04/10/2026 (analyse concurrentielle de l'audit : Battlefy, hubs FACEIT) : **écoles et tournois réservés aux membres** — le fondateur d'une communauté en fait une école en indiquant 1 à 5 domaines d'adresses de l'établissement (`definir_ecole`, jamais une messagerie grand public, définitif). Un membre reçoit un code à 6 chiffres sur son adresse d'école : tiré par le serveur (`preparer_verification_ecole`, rôle service, 3 envois par heure par compte comme par adresse, 15 minutes), saisi sur la page (`confirmer_verification_ecole`, 5 essais). La base ne garde que le domaine et une empreinte de l'adresse (une adresse = un compte), jamais l'adresse. Ligue des écoles `/lol/ecoles` (`classement_ecoles`) : moyenne des 5 meilleurs ratings officiels des membres vérifiés et classés, rien de recalculé. Un tournoi d'une communauté peut être réservé à ses membres (`tournaments.reserve_membres`, vérifiés pour une école), figé à la publication, contrôlé par la base à chaque inscription : solo, chacun des cinq joueurs alignés, agent libre (`eligible_tournoi_reserve`). Affichage : `src/lib/ecoles.ts`, actions `src/lib/ecole-actions.ts`.*

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

*Mise à jour du 02/10/2026 (audit N16 / N18) : **défis entre joueurs** — bouton « Défier » du CV, défis dans `/moi`, lien d'invitation `/defi/[code]`. Un défi accepté devient un duel en une partie (`tournaments.nature = 'defi'`, capacité 2), arbitré par le premier administrateur, avec la même salle de match et la même lecture Riot ; classé sauf le deuxième défi d'une même paire en 24 h (joué en amical), annulé sans partie retrouvée en 24 h. Toutes les règles en base (`lancer_defi`, `creer_duel`…). Les listes publiques de tournois, le plan du site et les statistiques excluent les défis (filtre `nature = 'tournoi'`).*

*Mise à jour du 28/09/2026 (audit E12 / N12) : seul un **tournoi classé** écrit des points — tournoi officiel (quotidien automatique), ou tournoi d'organisateur avec au moins 8 joueurs au départ, publié au moins 24 h avant son début, sans son organisateur dans le bracket et pas déclaré amical. La base fige la décision à la clôture (`figer_classement_tournoi`, colonne `tournaments.classe`) et `cloturer_rating_joueur` refuse tout tournoi non classé. Seuils : `src/lib/tournoi-classe.ts` et `criteres_tournoi_classe` (les deux à changer ensemble). Règle proposée par l'audit, à valider par le porteur du projet.*

**Chaque variation de points est journalisée** dans `rating_events`, avec le rating avant et après. Ce journal est public et ne se modifie jamais.

*Mise à jour du 28/09/2026 (audit N8) : le journal est **scellé** — chaque ligne porte l'empreinte SHA-256 de son contenu et de la ligne précédente, la base refuse toute modification ou suppression, l'empreinte du jour part chaque soir sur Discord. Page publique `/registre`, vérification indépendante `scripts/verifier-registre.mjs`. Ne jamais changer la formule du contenu scellé (elle invaliderait toute la chaîne).*

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

*Mise à jour du 28/09/2026 (audit du 27/09) : les règles métier — inscription et check-in, réglages de tournoi figés, équipes, messagerie, profils, pseudos, suspension, stockage des logos, limites d'usage — sont appliquées **par la base** (triggers de contrôle, fonctions `security definer`, droits par colonne), pas seulement par les pages : une action serveur peut être appelée sans la page, et l'API Supabase sans le site. Toute nouvelle règle s'écrit aussi en base, avec un scénario dans `tests/sql/` (`npm run test:base`, rejoué par la CI à chaque envoi). Tout texte saisi par un utilisateur est échappé avant d'entrer dans un e-mail (`echapperHtml`) ou un message Discord (`echapperDiscord`), `src/lib/echappement.ts`.*

*Mise à jour du 02/10/2026 (audit N27) : **modération automatique en base** — tout texte saisi (pseudo, équipe, tag, rôle, nom de tournoi, annonce, bio, message privé, motif de litige) passe par `analyser_texte` (insultes, haine, menaces, arnaques, liens, usurpation « Najarena/admin/modo/Riot »), avec déguisements défaits (accents, chiffres, lettres séparées ou répétées). Noms : refus ; textes publics : refus sauf usurpation ; messages et motifs : haine et arnaques refusées, insultes/menaces/liens relus par un administrateur (`/admin#moderation`, un message relu n'est remis qu'après validation). Liste des termes : table `moderation_termes`, lisible par personne, complétée par SQL. Messages d'erreur : `src/lib/moderation.ts`. Un nouveau champ de texte libre = un nouveau déclencheur de modération.*

---

## 7. Direction artistique

**Source de vérité : `design-system/najarena/MASTER.md`**, complété par `design-system/najarena/pages/` (accueil, profil, tournoi — leurs règles priment sur MASTER pour leur page). Maquettes de référence (mise en page, textes, tailles) : `najarena-design/maquettes/` — format de maquette, pas du code à copier (voir `najarena-design/LISEZ-MOI.md`). Ne jamais régénérer MASTER.md sans accord du porteur du projet.

**Principe :** nerveux, compétitif, premium — marque de sport haut de gamme, pas « gamer grand public ». Le vert Venin est **rare**. La crédibilité du classement passe avant l'effet : pages outils (profil, tournoi, classement) denses et peu animées, accueil spectaculaire.

**Traduction dans le code**
- Jetons (couleurs, polices, tailles, espacements, rayons) : `src/app/globals.css`, bloc `@theme` — `bg-bg`, `text-text`, `text-muted`, `bg-accent`, `text-on-accent`, `border-line`, `font-titre`, `font-texte`, `text-section`, `px-gouttiere`, `max-w-contenu`, `rounded-bouton`, utilitaires `panneau`, `fond-ecailles`, `texte-rating`, `reflet`, classe `.tableau`.
- **Alignement (24/09/2026)** : tout contenu démarre au bord gauche du logo de la barre de navigation. Conteneur de page = `px-grille` (gouttière, ou plus au-delà de 78rem) ; pages outils sur toute la grille, pages de lecture `px-grille *:max-w-3xl`, formulaires `px-grille *:max-w-xl`, calés à gauche. Jamais `mx-auto max-w-… px-gouttiere` sur un même élément (la marge mangeait la largeur : formulaires écrasés). Connexion / inscription restent centrées.
- Composants : `src/components/design/` (BoutonLien, BoutonEnvoi, badges, PastilleResultat, ChiffreRating, IndicateurConfiance, Panneau, ReperesVisee, LibelleSection, NumeroFiligrane, Tableau, Icone, Logo). Les consulter avant d'écrire un bouton, un badge ou une carte.
- Accueil : composants propres dans `src/components/vitrine/` (ouverture, boucles, affiches générées, cartes « EXEMPLE », top 10), animations dans `vitrine.module.css`. Barre de navigation `components/design/Navbar.tsx` et `components/Footer.tsx` partagés par tout le site ; lien « Aller au contenu » dans le layout.
- Profil joueur : affichage refait, chargement d'origine (`chargerJoueur`) inchangé ; données d'affichage ajoutées (rang national, palier, courbe de saison, équipes, annonce, rôle) dans `lib/profil-vitrine.ts`, composants dans `src/components/profil/` (courbe, bouton Partager). « Partager le CV » partage le lien public du profil ; l'export imprimable `/cv` reste réservé à l'offre Elite.
- Page tournoi et tournoi d'exemple : mêmes blocs dans `src/components/tournoi/` (en-tête d'affiche, onglets-ancres avec état actif, bracket à connecteurs, déroulement, essentiel du règlement). `chargerTournoi` et les conditions d'inscription / de litige inchangés ; lecture ajoutée dans `lib/tournoi-vitrine.ts`. Règlement affiché = règles réellement appliquées (CGU, §3-§4), pas celles de la maquette (son « retard de 15 min = forfait » est devenu, le 28/09/2026, « pas prêt 15 min après son adversaire = forfait » : bouton « Je suis prêt » de la salle de match, `src/lib/forfait.ts`, appliqué par la base via `appliquer_forfait_absence`, jamais contre un joueur déjà en partie chez Riot). Pas de bloc « Récompenses » (aucune en base).
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
/lol/tournois/[slug]       page tournoi (salle de match `#ton-match`, fichier agenda `/agenda`)
/lol/tournois/demo         tournoi d'exemple (données statiques, jamais en base)
/lol/classement            leaderboard
/lol/saisons               saisons : dates, jours restants, classements finaux archivés
/lol/semaine/[lundi]       récap de la semaine (publié aussi sur Discord le lundi)
/registre                  registre des points scellé (preuve publique, export, vérification)
/lol/coequipiers           recherche de coéquipiers (5v5)
/lol/arene                 arène 1v1 : file d'attente, duel contre un joueur de son niveau
/lol/pronostics            pronostics gratuits : matchs ouverts, classement des pronostiqueurs
/lol/ecoles                ligue des écoles : écoles classées par la moyenne des 5 meilleurs membres vérifiés
/joueur/[pseudo]           CV e-sport public — transverse, jamais sous /lol
/certificat/[code]         certificat de niveau daté et figé, émis depuis le CV (non indexé)
/defi/[code]               lien « Invite ton rival » : un ami s'inscrit, lie son Riot ID et relève le défi (non indexé)
/equipe/[slug]             page publique d'équipe
/equipe/nouvelle           création d'équipe
/communautes               espaces communauté (serveur Discord, association, école) ; /communaute/[slug], /communaute/nouvelle
/organiser/nouveau         création de tournoi
/moi                       tableau de bord joueur (bandeau « ton match », gérer mon abonnement)
/moi/profil                pseudo, pays, visites anonymes, suppression du compte
/moi/organisation/[id]     cockpit de tournoi
/connexion /inscription /lier-riot /mot-de-passe-oublie /nouveau-mot-de-passe
/admin                     modération, litiges
/comment-ca-marche         guide éditorial (verdict, Glicko-2, indice de confiance)
/faq                       questions de confiance, dépliées par défaut (gratuité, affiliation Riot, délais, IA)
/journal                   journal de bord public (docs/journal réel, voir src/lib/journal.ts)
/note-du-fondateur         positionnement produit, en 1ère personne
/charte                    charte graphique vivante (interne, absente du site en ligne)
/developpeurs              widgets intégrables (/widget/...) et API publique en lecture seule (/api/public/v1/...)
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
- Évolution de la base : ajoutée à la fin de `docs/schema.sql`, en section datée « À appliquer sur la base AVANT la mise en ligne du code du même commit ». La base se met à jour avant le code (exemple : `docs/mise-en-ligne-2026-09-28.md`).
- Règlement du 1v1 (carte, mode, étapes d'un match) : `src/lib/reglement.ts`, lu par tous les écrans. Règles de pseudo : `src/lib/pseudo.ts` (mêmes règles en base). CGU modifiées : changer `VERSION_CGU` (`src/lib/cgu.ts`), enregistrée avec le consentement de chaque compte.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
