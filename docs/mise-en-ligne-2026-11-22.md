# Mise en ligne du 22/11/2026 — contrôle de sécurité, suite (M1, M2, M3, M6, M7)

Le code de cette mise en ligne lit de nouvelles colonnes, tables et fonctions :
**la base se met à jour d'abord, le code ensuite.**

## Ce que contient la migration

Cinq sections datées du 22/11/2026 à la fin de `docs/schema.sql`, à partir de la ligne
`-- ---------- Lancement anticipé d'un tournoi classé (2026-11-22) ----------`
jusqu'à la fin du fichier :

1. **Lancement anticipé** : colonne `tournaments.lance_le` et déclencheur `tournaments_lancement`
   (posée par la base au passage « en cours ») ; `criteres_tournoi_classe` redéfinie (la règle des
   24 h compte jusqu'au lancement réel s'il est plus tôt) ; déclencheur
   `registrations_absent_apres_checkin` (« absent » seulement une fois le check-in ouvert).
2. **Suspension et niveau qui suivent le compte Riot** : `empreinte_puuid`, tables
   `comptes_riot_suspendus` et `niveaux_comptes_riot` (aucune policy : lues par la base seule),
   déclencheurs `suspensions_comptes_riot`, `game_accounts_verification_suspendu`,
   `game_accounts_garder_niveau`, `seasons_purger_niveaux` ; `lier_compte_riot`,
   `delier_compte_riot`, `delier_compte_secondaire`, `rating_niveau`, `rating_niveau_meilleur`,
   `est_non_classe`, `mon_niveau_tournoi` redéfinies ; nouvelles `saisons_niveau`, `niveau_herite`,
   `mon_statut_non_classe`. Les suspensions déjà en cours sont reprises (comptes Riot vérifiés notés).
3. **Saison close** : `cloturer_rating_joueur` refuse une saison qui n'est pas la saison en cours
   (`SAISON_CLOSE`).
4. **Défis : 20 par jour** : `consommer_limite` (action `defi`) et `controler_lanceur_defi` redéfinies.
5. **Registre** : table `verification_registre` (lisible par tous), fonction
   `garder_verification_registre` (serveur seul) ; `verifier_registre` n'est plus appelable par les
   visiteurs.

Aucune donnée existante n'est modifiée. Les tournois déjà lancés ont `lance_le` vide : la règle
reste celle de la date annoncée pour eux.

**Entre la migration et la fusion du code**, la page `/registre` affiche « Vérification
indisponible pour l'instant » (l'ancien code appelle `verifier_registre`, désormais réservée au
serveur). Fusionner le code juste après la migration ; la tâche des tournois automatiques
remplit la vérification gardée dans les 5 minutes qui suivent.

## 1. Avant (lecture seule)

```sql
select count(*) from public.suspensions where levee_le is null;             -- suspensions en cours
select column_name from information_schema.columns
 where table_name = 'tournaments' and column_name = 'lance_le';              -- vide avant
```

## 2. Migration

Appliquer les cinq sections, d'un seul tenant. Elles sont rejouables (`if not exists`,
`create or replace`, `drop … if exists`) : rejouées deux fois sur le schéma de `master`, sans
erreur.

## 3. Après (lecture seule)

```sql
select column_name from information_schema.columns
 where table_name = 'tournaments' and column_name = 'lance_le';              -- 1 ligne
select string_agg(tgname, ', ' order by tgname) from pg_trigger
 where tgname in ('tournaments_lancement', 'registrations_absent_apres_checkin',
                  'suspensions_comptes_riot', 'game_accounts_verification_suspendu',
                  'game_accounts_garder_niveau', 'seasons_purger_niveaux');   -- les 6
select has_function_privilege('anon', 'public.verifier_registre()', 'execute');            -- false
select has_function_privilege('authenticated', 'public.mon_statut_non_classe()', 'execute'); -- true
select count(*) from public.comptes_riot_suspendus;                          -- comptes des suspendus en cours
```

## 4. Fusion du code, puis contrôles sur le site

- `/registre` : « Intacte — N lignes vérifiées le JJ/MM HH:MM (heure de Paris) » dans les
  5 minutes après la fusion, au lieu d'un calcul à chaque visite. Il faut que la tâche planifiée
  de la base (pg_cron) tourne ; contrôle : `select verifie_le, verification_complete_le from
  public.verification_registre;` doit montrer une heure de moins de 5 minutes. Si la tâche
  s'arrête, la page passe d'elle-même à « En attente » au bout de 15 minutes.
- Cockpit d'un tournoi d'organisateur publié depuis moins de 24 h et annoncé plus tard : la
  phrase « Lancé maintenant, ce tournoi ne sera pas classé… » apparaît au-dessus du bouton.
- Cockpit d'un tournoi dont le check-in n'est pas ouvert : plus de bouton « Absent ».
- `/cgu` : version du 22 novembre 2026 ; `/confidentialite` : deux lignes de plus dans « Durée de
  conservation ».
- Erreurs d'exécution Vercel sur 24 h : aucune nouvelle.
