# Najarena — brief projet

Contexte permanent. À lire avant toute intervention sur le code.

---

## 1. Le produit

Plateforme de tournois **League of Legends** en français. Les joueurs disputent des tournois quotidiens ; les résultats sont **lus dans la donnée officielle Riot**, pas déclarés par les joueurs. Il en résulte un classement incontestable et un **profil public de type CV e-sport**.

**Promesse :** ton niveau, vérifié.
Le produit ne vend pas du spectacle, il vend une **preuve**. Toute décision de conception se tranche par : est-ce que ça renforce ou affaiblit la crédibilité du classement ?

**Périmètre V1 :** LoL, formats 1v1 et 5v5. La structure est multi-jeux dès le départ, mais un seul jeu est actif.

**Fonctionnalités déjà construites** (règles précises, fonctions de base et fichiers : **`docs/brief/fonctionnalites.md`**, à lire avant d'en modifier une) : tournois 1v1 et 5v5 (capitaine, alignements, agents libres, bourse aux remplaçants), scrims vérifiés, défis et arène 1v1 (en pause), divisions mensuelles, tournois à la demande, coupe des nouveaux, échéances (Clash, Nexus Tour), textes rédigés par l'IA (`src/lib/claude.ts`), analyse de progression IA, bilan du joueur et parties classées sur accord, fiche publique de l'organisateur, comptes Riot secondaires, pronostics gratuits, communautés et bot Discord, écoles et tournois réservés aux membres, widgets, API publique et overlay de stream, cash prizes sponsorisés (désactivés), offres « Plus » et « Pro », CGV et CAPTCHA, équipes qui recrutent, matching duo, recherche recruteurs, alertes « tournoi pour toi », fiche de preuve, certificats signés, registre ancré sur GitHub, chances de titre, recalcul public, météo du classement, fiche de l'adversaire, recommandations vérifiées, coach vérifié, chimie d'équipe.

**Concurrent direct :** olymps.gg. Même thèse, plus avancé. On ne les copie pas ligne à ligne ; notre différenciation porte sur le CV e-sport multi-jeux, le matching entre joueurs, et une identité visuelle opposée à la leur.

**Le porteur du projet ne code pas.** Explique tes choix en langage simple. Quand tu introduis une notion technique nouvelle, définis-la en une phrase. Ne propose jamais de solution sans dire pourquoi tu l'as retenue.

---

## Où trouver le détail

Ce fichier ne garde que l'essentiel. Le détail est dans `docs/brief/`, **à lire avant de toucher au sujet concerné** :

| Avant de modifier… | Lire |
|---|---|
| une fonctionnalité listée au §1 | `docs/brief/fonctionnalites.md` |
| le classement, les verdicts, un format de tournoi (suisse, double élimination, défis, niveaux), le registre | `docs/brief/classement-regles.md` |
| la base, une action serveur, une route API, les comptes Riot, un champ de texte libre, les saisons | `docs/brief/securite-regles.md` |
| une page, un composant, une animation, un texte affiché | `docs/brief/direction-artistique.md` |
| la structure des pages, une adresse (URL) | `docs/brief/arborescence.md` |

Ancienne version complète de ce fichier : `docs/archive/CLAUDE-complet-2026-11-25.md` (référence, ne plus la mettre à jour). **Les nouvelles « mises à jour » datées s'ajoutent dans le fichier `docs/brief/` concerné, pas ici** ; ici, seulement une ligne si une règle devient non négociable.

---

## 2. Contrainte structurante : l'accès à l'API Riot

Ordre imposé, non négociable :

1. **Aujourd'hui** — clé de développement uniquement (expire toutes les 24 h). Pas de connexion via Riot, pas de codes de tournoi.
2. **Prototype** — on livre d'abord un site fonctionnel avec inscription, connexion, création de tournoi et inscription à un tournoi. C'est la condition posée par Riot pour accorder une clé production.
3. **Clé production obtenue** — la connexion Riot (RSO) devient possible, ainsi que la lecture de l'historique de matchs.
4. **API Tournament** — demandée après, elle seule donne les codes de lobby.

Conséquence sur l'architecture : **la couche d'identité doit être interchangeable.** En V1, le joueur saisit son Riot ID et prouve qu'il le possède en changeant son icône de profil. RSO se branchera ensuite derrière la même interface, sans réécriture.

*À ne pas oublier au passage à la clé production (contrôle de sécurité du 23/11/2026)* : les identifiants de compte chiffrés (PUUID) changent d'une clé de projet à l'autre. Les traduire **partout où ils sont gardés, dans la même opération** : `game_accounts.puuid`, `stats_match_joueur.puuid` (sinon les recommandations fondées sur les parties d'après le 03/10/2026 disparaissent du CV, `matchs_communs`), `parties_classees`, et les empreintes `comptes_riot_suspendus` / `niveaux_comptes_riot` (`empreinte_puuid`). Ne jamais toucher au registre scellé.

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
- **Paliers, seuils fixes :** Mue < 1300 · Écaille 1300 · Crochet 1450 · Venin 1600 · Cobra 1750 · Basilic 1900+.
- Le rating se présente comme « rating Najarena », **jamais « officiel »** (règles Riot). Arène 1v1 en pause (`ARENE_OUVERTE`).

Anti-abus : 3 victoires max contre le même adversaire par 24 h, forfait = zéro point des deux côtés, verdict manuel ignoré dans le calcul.

**Chaque variation de points est journalisée** dans `rating_events`, avec le rating avant et après. Ce journal est public et ne se modifie jamais. Le journal est **scellé** (empreinte SHA-256 chaînée, page `/registre`) : **ne jamais changer la formule du contenu scellé**.

Règles détaillées (niveau Riot 30, duels classés, tournoi classé, formats suisse et double élimination, tournois par niveau…) : `docs/brief/classement-regles.md`.

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

Règles métier appliquées **par la base**, pas seulement par les pages : toute nouvelle règle s'écrit aussi en base, avec un scénario dans `tests/sql/` (`npm run test:base`). Tout nouveau champ de texte libre = un nouveau déclencheur de modération (`analyser_texte`). Une partie Riot ne compte qu'une fois (`parties_utilisees`). Détail : `docs/brief/securite-regles.md`.

### Pièges : valeurs à changer ensemble

Ces règles existent à deux endroits ; en changer une sans l'autre casse le site :
- Tournoi classé : `src/lib/tournoi-classe.ts` + `criteres_tournoi_classe` ; officiel : `estOfficiel()` (`src/lib/a-la-demande.ts`) + `criteres_tournoi_classe`.
- Paliers : table `tiers` + `src/lib/niveau-tournoi.ts` + `src/lib/paliers.ts`.
- Niveau Riot minimum : `NIVEAU_COMPTE_RIOT_MIN` + seuil 30 de `matchs_communs`.
- Duels classés par jour : `DUELS_CLASSES_PAR_JOUR_MAX` (`src/lib/defis.ts`) + `duel_classe_possible`.
- Toute modification de `cloturerTournoi` se reporte dans `src/lib/recalcul.ts`.
- Certificats : `contenu_certificat` v1 **ne change jamais** (créer un v2).
- CGU / CGV modifiées : changer `VERSION_CGU` / `VERSION_CGV`.
- Créneaux automatiques : ne jamais renommer la `cle` d'un créneau existant.
- CAPTCHA du site et CAPTCHA de Supabase Auth : allumés ensemble, jamais l'un sans l'autre.

---

## 7. Direction artistique

**Source de vérité : `design-system/najarena/MASTER.md`**, complété par `design-system/najarena/pages/` (accueil, profil, tournoi — leurs règles priment sur MASTER pour leur page). Maquettes de référence (mise en page, textes, tailles) : `najarena-design/maquettes/` — format de maquette, pas du code à copier (voir `najarena-design/LISEZ-MOI.md`). Ne jamais régénérer MASTER.md sans accord du porteur du projet.

**Principe :** nerveux, compétitif, premium — marque de sport haut de gamme, pas « gamer grand public ». Le vert Venin est **rare**. La crédibilité du classement passe avant l'effet : pages outils (profil, tournoi, classement) denses et peu animées, accueil spectaculaire.

Non négociable :
- Jetons dans `src/app/globals.css` (`@theme`), composants dans `src/components/design/` — les consulter avant d'écrire un bouton, un badge, une carte ou un formulaire.
- « Vérifié » et le vert sont **réservés à la preuve** (verdict lu chez Riot, compte vérifié). Verdict manuel = « MANUEL » gris, jamais vert. Badges d'offre payante en gris.
- **Aucune fonctionnalité annoncée qui n'existe pas**, aucun bloc avec des valeurs fictives. Le KDA n'est jamais affiché.
- Aucun visuel Riot, sauf les icônes Data Dragon de l'analyse du joueur.
- Ne jamais rendre un élément différent selon `useReducedMotion` pendant le rendu (échec d'hydratation). Tout ce qui bouge plus de 5 s se fige avec le bouton « Pause ».
- Typographie : Big Shoulders (titres, chiffres clés) + Chakra Petch (texte). Chiffres de preuve en `tabular-nums`.

Détail (alignement, composants, adaptations, migration) : `docs/brief/direction-artistique.md`.

---

## 8. Arborescence

Liste complète des pages : `docs/brief/arborescence.md`.

Le segment de jeu (`/lol/...`) est obligatoire dès maintenant : sans lui, l'ajout d'un second jeu imposerait une migration d'URL et une perte de référencement.

Le profil joueur reste **hors** du segment de jeu, avec des onglets par jeu — c'est un CV unique qui accumule les jeux.

---

## 9. Roadmap

**Phase 0 — dossier Riot.** Inscription, profil, saisie du Riot ID, création de tournoi, inscription, check-in, bracket 1v1, résultats manuels, profil public. Aucun classement. → dépôt de la demande de clé production.

**Phase 1 — pendant l'attente.** Moteur Glicko-2 et journal des points, cockpit organisateur (check-in, byes, litiges), paliers et leaderboard, CV e-sport partageable, pages légales, direction artistique, pages SEO.

**Phase 2 — clé obtenue.** RSO, rapprochement par historique (niveau 2), synchronisation des Riot ID, demande d'API Tournament, lancement public, saison 1.

**Phase 3.** Codes de tournoi (niveau 3), analyse IA du profil (version progression), matching duo *(analyse de progression et matching duo construits le 18/11/2026, voir §1)*. *(Équipes et 5v5, recherche de coéquipiers, temps réel, Discord et assistant IA organisateur avancés en V1 le 12/09/2026 — voir §1.)*

**Phase 4.** Analyse orientée recruteur, scouting *(recherche recruteurs construite le 18/11/2026, voir §1)*, overlay stream *(construit le 21/11/2026, voir §1)*, cash prizes sponsorisés.

---

## 10. Contrainte d'exploitation à ne pas oublier

La précision du classement dépend du **nombre de matchs par joueur**, pas du nombre de joueurs. Compter environ **15 joueurs actifs par place de tournoi et par jour**. Ouvrir de nouveaux créneaux au fur et à mesure de la croissance, plutôt que d'entasser tout le monde sur un seul tournoi quotidien — un classement bruité détruit la valeur du CV e-sport, qui est le produit.

Tournois automatiques : créneaux dans `src/lib/tournois-auto/creneaux.ts`, tâche `/api/cron/tournois-auto` appelée toutes les 5 minutes par la base (pg_cron), pas par Vercel. Rappels par push et Discord, jamais d'e-mail.

---

## 11. Conventions de code

- TypeScript partout, `any` proscrit.
- Nommage de la base de données en français (le schéma existant fait foi), code en anglais.
- Les montants de rating sont des `numeric`, jamais des flottants côté application.
- Toute écriture liée au classement passe par une transaction unique.
- Un commit par unité fonctionnelle, message en français.
- Évolution de la base : ajoutée à la fin de `docs/schema.sql`, en section datée « À appliquer sur la base AVANT la mise en ligne du code du même commit ». La base se met à jour avant le code (exemple : `docs/mise-en-ligne-2026-09-28.md`).
- Règlement du 1v1 (carte, mode, étapes d'un match) : `src/lib/reglement.ts`, lu par tous les écrans. Règles de pseudo : `src/lib/pseudo.ts` (mêmes règles en base). CGU modifiées : changer `VERSION_CGU` (`src/lib/cgu.ts`), enregistrée avec le consentement de chaque compte.

---

## 12. Contrôle qualité — obligatoire

Trois agents de vérification sont définis dans `.claude/agents/`. Ils lisent et rapportent, ils ne modifient jamais le code : c'est toi qui corriges.

Une tâche n'est terminée qu'après ces vérifications :

| Si la tâche touche… | Appeler |
|---|---|
| la base (`docs/schema.sql`), une action serveur, une route API, l'authentification, les comptes Riot, les verdicts, le classement, le registre, Stripe, les dotations, ou un nouveau champ de texte libre | `securite` |
| toute fonctionnalité ou correction | `testeur` |
| une page, un composant, une animation ou un texte affiché | `design` |

Les agents nécessaires se lancent **en parallèle**, une fois le code écrit. Corriger tous les problèmes **Critiques, Élevés et Bloquants** et les « À corriger » du design, puis relancer l'agent concerné pour confirmer. Ne pas boucler plus de deux fois sur un même problème : au-delà, le présenter au porteur du projet comme une décision à prendre.

Ensuite, résumer au porteur du projet, en langage simple : ce qui a été vérifié, ce qui a été corrigé, ce qui reste ouvert (problèmes Moyens, « À améliorer », points non vérifiables depuis le code) et ce qu'il doit décider.

**Économie de limites :** pour toute recherche dans le code (où se trouve quelque chose, quels fichiers sont concernés, lecture de journaux, résumé d'un fichier long), délègue à l'agent `explorateur` (Haiku) au lieu de le faire toi-même. Garde ta propre réflexion pour la conception et les modifications.

Exception : une modification minime sans effet sur le comportement (faute de frappe dans un commentaire, documentation interne) ne demande aucun agent.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
