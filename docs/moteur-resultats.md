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
      partie trouvée              aucune partie (T+25min)     abandon déclaré
              │                             │                      │
              ▼                             ▼                      ▼
      verdict niveau 2/3              statut: litige          statut: forfait
              │                             │                      │
              └──────────> terminé <────────┴──────────────────────┘
```

### Déclenchement de la recherche

Le worker interroge les deux joueurs à T+8, T+12, T+18 et T+25 minutes après l'ouverture du match. Pas de recherche avant T+8 : l'historique Riot n'est pas immédiat, et interroger trop tôt consomme du quota pour rien.

### Critères de rapprochement (niveau 2)

Une partie de l'historique est retenue si **les quatre** conditions sont vraies :

1. les `puuid` des deux joueurs y figurent ;
2. son horodatage de début est postérieur à l'ouverture du match ;
3. le mode de jeu correspond au format annoncé ;
4. sa durée dépasse le seuil de remake.

Si plusieurs parties correspondent, on retient la plus ancienne postérieure à l'ouverture.
Si aucune ne correspond à T+25, le match passe en `litige`.

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
Avant l'étape 5, vérifier qu'aucune ligne `rating_events` n'existe déjà pour ce couple (tournoi, joueur). Si oui, abandonner sans erreur.

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
| Recherche de résultats | 1 min | Traite la file des matchs en cours |
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
