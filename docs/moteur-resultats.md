# Najarena — Moteur de résultats et de classement

Spécification fonctionnelle serveur. Périmètre V1 : LoL 1v1, verdicts de niveau 1 à 3, classement Glicko-2 par tournoi.

---

## 1. Principes directeurs

1. **Le client ne calcule rien.** Toute écriture sur `ratings` et `rating_events` passe par une fonction serveur (`service_role`). La clé Riot ne quitte jamais le serveur.
2. **Un match a un seul verdict définitif.** Toute la logique d'attribution de points en dépend.
3. **Toute opération est idempotente.** Une relance ne doit jamais produire un second gain de points.
4. **On n'invente jamais un résultat.** En cas de doute, on escalade vers l'organisateur — un verdict manuel assumé vaut mieux qu'une déduction fausse.

---

## 2. Niveaux de verdict

| Niveau | Source | Compte pour le classement |
|---|---|---|
| 3 — `code_tournoi` | Partie créée via un code de tournoi Riot | Oui |
| 2 — `historique` | Partie retrouvée dans l'historique des joueurs | Oui |
| 1 — `manuel` | Décision de l'organisateur | **Non** |

Le niveau est affiché publiquement sur la page du match. Un verdict manuel affiche aussi son motif.

---

## 3. Cycle de vie d'un match

```
en_attente ──[les 2 joueurs présents]──> en_cours
                                            │
              ┌─────────────────────────────┼──────────────────────┐
              ▼                             ▼                      ▼
      partie trouvée          aucune partie (T+60 min en Bo1)   abandon déclaré
              │                             │                      │
              ▼                             ▼                      ▼
      verdict niveau 2/3              statut: litige          statut: forfait
              │                             │                      │
              └──────────> terminé <────────┴──────────────────────┘
```

### Déclenchement de la recherche

La tâche de recherche passe toutes les 5 minutes (pg_cron). Pas de recherche avant T+8 : l'historique Riot n'est pas immédiat, et interroger trop tôt consomme du quota pour rien. Seules les parties personnalisées sont demandées à Riot (filtre `queue=0`), et une partie déjà lue pendant un passage n'est pas redemandée.

Sans résultat, le match passe en `litige` après **30 + 30 × Best-of minutes** : 60 min en Bo1, 120 en Bo3, 180 en Bo5 (il faut créer la partie, la jouer jusqu'au Nexus, puis attendre que Riot publie l'historique). L'organisateur est prévenu, les joueurs aussi. **La recherche continue ensuite pendant 24 h**, environ toutes les 30 minutes : une partie retrouvée plus tard (historique lent, clé Riot renouvelée) résout le litige et compte au classement. *(Jusqu'au 28/09/2026 : litige à T+25 min, puis plus aucune recherche.)*

Logique pure (séries, calendrier) : `src/lib/serie.ts` ; orchestration : `src/lib/rapprochement.ts`.

### Défaite reconnue

Un joueur peut reconnaître sa défaite depuis le bracket (`reconnaitre_defaite`). Match en cours : la recherche Riot a encore 20 minutes ; si la partie est retrouvée, le verdict est de niveau 2 et compte ; sinon la tâche tranche au niveau 1 (manuel, hors classement) avec le motif public « Défaite reconnue par … ». Match déjà en litige : tranché tout de suite, au niveau 1. La parole du perdant ne compte jamais au classement ; elle évite seulement qu'un tournoi reste bloqué en attendant un organisateur.

### Forfait automatique

Chaque joueur se déclare prêt dans la salle de match (`declarer_pret`, colonne `match_participants.pret_le`) ; l'adversaire est prévenu (push et message privé Discord). Dès que l'un des deux l'est, l'autre a **15 minutes** pour faire de même, sinon la tâche de recherche le déclare forfait (`appliquer_forfait_absence`) : verdict de niveau 1 (manuel, hors classement), motif public, match au statut `forfait`, aucun point pour personne. Garde-fous : la partie Riot est cherchée d'abord (si elle est retrouvée, elle décide) ; jamais de forfait si l'un des deux joueurs est en partie chez Riot à cet instant (spectator-v5), ni si on ne peut pas le vérifier ; seulement pour un match en cours, sans défaite reconnue. Logique pure : `src/lib/forfait.ts`.

### Ouverture du match suivant

Un match passe `en_cours` dès que ses deux joueurs sont connus (`avancer_vainqueur`). Le verdict qui qualifie le second joueur — partie retrouvée, défaite reconnue ou verdict de l'organisateur — envoie aux deux un rappel push et un message privé Discord avec le lien de la salle de match (`prevenirMatchOuvert`, `src/lib/apres-verdict.ts`). Le délai avant litige court à partir de cette ouverture (`demarre_le`).

### Critères de rapprochement (niveau 2)

Une partie de l'historique est retenue si **toutes** ces conditions sont vraies :

1. les `puuid` des deux joueurs y figurent, dans des camps opposés ;
2. son horodatage de début est postérieur à l'ouverture du match ;
3. c'est une partie personnalisée (`queueId` 0), à deux joueurs exactement pour un tournoi 1v1 ;
4. sa durée dépasse le seuil de remake (5 minutes).

**1v1 classique** (`tournaments.condition_victoire = 'classique'`, audit N5, 28/09/2026) : les critères 1 à 3 s'appliquent, mais le vainqueur n'est pas celui de la partie — c'est le premier qui obtient le premier sang, détruit la première tour ou atteint 100 sbires, lu dans la chronologie de la partie (match-v5 timeline, `src/lib/conditions-1v1.ts`). La durée minimale ne s'applique pas (un premier sang à 2 minutes est une vraie victoire). Les sbires ne figurent dans la chronologie qu'une fois par minute : si deux conditions remplies par des joueurs différents tombent dans la même minute, l'ordre est impossible à établir et la partie n'est pas retenue — l'organisateur tranche. Aucune condition remplie : partie non retenue.

Les parties retenues sont rejouées dans l'ordre chronologique : en Bo1 la première décide, en Bo3 / Bo5 la série s'arrête dès qu'un joueur atteint 2 / 3 victoires. Une série inachevée (1-1) n'est jamais tranchée par déduction. Le verdict garde les identifiants Riot de toutes les manches (`riot_match_id`, séparés par des virgules) ; les statistiques enregistrées sont celles de la manche décisive.

---

## 4. Calcul du classement

### Déclenchement
À la clôture du tournoi uniquement (`statut` → `termine`). Jamais match par match.

### Séquence

1. Charger l'état de départ (`rating`, `rd`, `volatilite`) de chaque participant — **l'état d'avant le tournoi**, pas l'état courant.
2. Constituer, pour chaque joueur, la liste de ses adversaires et de ses résultats, en ne retenant que les matchs dont le verdict est de niveau 2 ou 3.
3. Appliquer les plafonds anti-abus (section 5).
4. Exécuter la mise à jour Glicko-2 (tau = 0.5).
5. Écrire en une transaction : mise à jour de `ratings` + insertion dans `rating_events`.

### Garde d'idempotence
Avant l'étape 5, vérifier qu'aucune ligne `rating_events` n'existe déjà pour ce couple (tournoi, joueur). Si oui, abandonner sans erreur. Depuis le 28/09/2026, une contrainte d'unicité sur (tournoi, joueur) rend le double crédit impossible même en cas d'exécutions simultanées.

### État de départ périmé et reprise
`cloturer_rating_joueur` verrouille la ligne `ratings` du joueur et refuse d'écrire si son rating ou son RD ne correspondent plus à l'état de départ utilisé pour le calcul (un autre tournoi du même joueur clôturé entre-temps) : `ETAT_DE_DEPART_PERIME`. Le tournoi reste alors « en cours » et la tâche des tournois automatiques (toutes les 5 minutes) reprend la clôture de tout tournoi dont la finale est jouée. À la reprise, un joueur déjà crédité sert d'adversaire avec son état d'avant tournoi, lu dans le journal.

### Tournoi classé

Seul un tournoi **classé** écrit des points (audit E12 / N12, 28/09/2026) : un tournoi officiel (quotidien automatique), ou un tournoi d'organisateur qui remplit tous ces critères publics — au moins 8 joueurs au départ du bracket, publié au moins 24 h avant son début (`publie_le`, posée par la base à l'ouverture des inscriptions), sans son organisateur dans le bracket, pas déclaré amical. La clôture demande la décision à la base (`figer_classement_tournoi`) une fois la finale jouée ; elle est alors écrite dans `tournaments.classe` et ne change plus. Un tournoi non classé est clôturé sans aucune écriture dans `ratings` ni `rating_events`, et `cloturer_rating_joueur` refuse tout tournoi non classé (`TOURNOI_NON_CLASSE`). La page du tournoi affiche chaque critère (`src/lib/tournoi-classe.ts`, mêmes seuils).

### Défis entre joueurs

Un défi accepté (audit N16 / N18, 02/10/2026) devient un mini-tournoi à deux (`tournaments.nature = 'defi'`) : un seul match, ouvert dès l'acceptation, arbitré par le premier administrateur (jamais l'un des deux joueurs). Il suit exactement le cycle d'un match de tournoi (prêt, forfait, recherche Riot, défaite reconnue) et sa clôture est une période de notation Glicko-2 d'un match. Classé sauf s'il est le deuxième défi classé de la même paire en 24 h (joué en amical, décidé à l'acceptation), en plus des plafonds habituels. Sans partie retrouvée, le passage en litige ne prévient pas l'arbitre : les joueurs sont relancés, puis le duel est annulé 25 h après son ouverture, sans verdict ni point.

### Chances estimées et exploits

Avant un match, la page du tournoi affiche les chances de chaque joueur, calculées par Glicko-2 à partir des ratings **au début du tournoi** (journal du tournoi s'il est clôturé, sinon rating actuel de la saison, sinon 1500 / 350) : `probabiliteVictoire` (`src/lib/glicko2.ts`), qui tient compte de l'incertitude des deux joueurs. Une victoire **vérifiée** (niveau 2 ou 3) d'un joueur qui avait moins de 35 % de chances est marquée « Exploit ». Ce sont des estimations affichées comme telles : elles n'entrent jamais dans le calcul du classement.

### Joueur inactif
Tâche mensuelle : pour tout joueur sans match depuis 30 jours, augmenter le RD selon la formule Glicko-2, **sans toucher au rating**. Un joueur absent devient incertain, il ne devient pas mauvais.

### Changement de saison
1. `rating ← rating + 0.15 × (1500 − rating)`
2. `rd ← min(350, rd × 1.8)`
3. Journaliser avec le motif `soft_reset`.
4. La saison précédente reste consultable sur le profil.

---

## 5. Plafonds anti-abus

Appliqués au moment du calcul, avant la mise à jour Glicko-2.

| Règle | Effet |
|---|---|
| 3 victoires max contre le même adversaire sur 24 h | Les suivantes sont ignorées dans le calcul |
| Forfait | Aucun point, des deux côtés |
| Verdict manuel | Le match est ignoré dans le calcul |
| Tournoi marqué non classé | Aucun match du tournoi ne compte |

À journaliser dans `rating_events` avec le motif approprié même quand le résultat est ignoré : la transparence prime.

---

## 6. Tâches planifiées

| Tâche | Fréquence | Rôle |
|---|---|---|
| Recherche de résultats | 5 min (pg_cron) | Traite les matchs en cours, et ceux en litige depuis moins de 24 h |
| Ouverture du check-in | 1 min | Passe les tournois en `checkin` |
| Génération de bracket | 1 min | À la fermeture du check-in, byes inclus |
| Clôture de tournoi | 1 min | Déclenche le calcul du classement |
| Décroissance d'inactivité | mensuelle | Remontée du RD |
| Rotation de saison | mensuelle | Soft reset |
| Synchronisation des comptes | quotidienne | Rafraîchit les Riot ID (ils changent) |

---

## 7. Cas d'erreur à traiter explicitement

| Cas | Traitement |
|---|---|
| Moins d'inscrits que la capacité | Byes au premier tour pour les mieux classés |
| Nombre impair de présents | Idem |
| Joueur absent au check-in | Retiré avant génération du bracket |
| Compte Riot dissocié en cours de tournoi | Le joueur termine le tournoi, ses matchs restants passent en niveau 1 |
| API Riot indisponible | File d'attente conservée, relances espacées, aucun verdict inventé |
| Quota dépassé (429) | Respecter l'en-tête de retente, ne jamais insister |
| Deux verdicts contradictoires | Le niveau le plus élevé l'emporte ; un verdict définitif ne se remplace que par une correction journalisée |
