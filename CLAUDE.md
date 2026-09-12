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

Référence complète et jouable : `docs/direction-artistique.html`.

**Principe :** registre officiel, pas arène à néons. Le site est **clair** ; seule la page d'accueil est sombre et atmosphérique. Le contraste est volontaire — on entre par l'arène, on arrive dans le registre.

**Couleurs**

```
--encre    #12161D    texte, fond nuit
--papier   #E7E6E1    fond jour
--sceau    #7E2233    validation, accent principal
--laiton   #B08334    paliers, palmarès
--atteste  #1F6F4A    verdict niveau 3
--ardoise  #5B6672    libellés, données secondaires
```

**Typographie — règle centrale**

- Bricolage Grotesque 800 — titrage, tracking serré
- Inter Tight — texte courant
- **JetBrains Mono — tout ce qui constitue la preuve** : rating, RD, identifiants de match, horodatages

Si un chiffre fait partie du dossier, il est en caractères machine. Si c'est du commentaire humain, il est en texte.

**Élément signature :** le **sceau de fiabilité** sur la fiche joueur. Une couronne de crans dont le remplissage traduit le calibrage (RD). Un joueur non calibré a un sceau pâle et incomplet ; le tampon se referme à mesure que le classement devient fiable. Remplace toute barre de progression.

**Mouvement :** fond animé sur la page d'accueil, dessiné directement sur canvas, sans bibliothèque externe. Effet retenu : *Bracket* — des nœuds se cherchent et se relient. Référence jouable : `docs/fonds-animes.html`. Aucune animation décorative permanente ailleurs sur le site. `prefers-reduced-motion` respecté partout.

---

## 8. Arborescence

```
/                          accueil (sombre, fond animé)
/lol                       hub du jeu
/lol/tournois              liste + filtres
/lol/tournois/[slug]       page tournoi
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
```

Le segment de jeu (`/lol/...`) est obligatoire dès maintenant : sans lui, l'ajout d'un second jeu imposerait une migration d'URL et une perte de référencement.

Le profil joueur reste **hors** du segment de jeu, avec des onglets par jeu — c'est un CV unique qui accumule les jeux.

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
