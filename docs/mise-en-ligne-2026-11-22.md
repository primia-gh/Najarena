# Mise en ligne du 22/11/2026 — contrôle de sécurité, suite (M1, M2, M3, M4, M6, M7, F1-F5)

Le code de cette mise en ligne lit de nouvelles colonnes, tables et fonctions :
**la base se met à jour d'abord, le code ensuite.**

## Ce que contient la migration

Sept sections datées du 22/11/2026 à la fin de `docs/schema.sql`, à partir de la ligne
`-- ---------- Lancement anticipé d'un tournoi classé (2026-11-22) ----------`
jusqu'à la fin du fichier :

1. **Lancement anticipé** : colonne `tournaments.lance_le` et déclencheur `tournaments_lancement`
   (posée par la base au passage « en cours ») ; `lancement_reel_tournoi` (le plus tôt du passage
   « en cours », du premier match démarré et du premier verdict) ; `criteres_tournoi_classe`
   redéfinie (la règle des 24 h compte jusqu'à ce lancement réel s'il est plus tôt) ; déclencheur
   `registrations_absent_apres_checkin` (« absent » seulement une fois le check-in ouvert) ;
   `controler_ecriture_match` (un match ne démarre qu'une fois le tournoi « en cours »,
   `TOURNOI_PAS_LANCE`), `figer_inscriptions_lancees` et `engage_en_tournoi` (dès qu'un bracket
   existe) redéfinies.
2. **Suspension et niveau qui suivent le compte Riot** : `empreinte_puuid`, tables
   `comptes_riot_suspendus` et `niveaux_comptes_riot` (aucune policy : lues par la base seule),
   déclencheurs `suspensions_comptes_riot`, `game_accounts_verification_suspendu`,
   `game_accounts_garder_niveau`, `seasons_purger_niveaux` ; `lier_compte_riot`,
   `delier_compte_riot`, `delier_compte_secondaire`, `rating_niveau`, `rating_niveau_meilleur`,
   `est_non_classe`, `mon_niveau_tournoi` redéfinies ; nouvelles `saisons_niveau`, `niveau_herite`,
   `mon_statut_non_classe`. Les suspensions déjà en cours sont reprises (comptes Riot vérifiés notés).
3. **Saison close** : `cloturer_rating_joueur` refuse une saison qui n'est pas la saison en cours
   (`SAISON_CLOSE`) ou pendant la bascule vers la suivante (`SAISON_EN_BASCULE`) ;
   `appliquer_decroissance_rd` ne touche plus une saison archivée.
4. **Défis : 20 par jour** : `consommer_limite` (action `defi`), `lancer_defi` et
   `creer_invitation_defi` redéfinies (l'arène n'est pas comptée).
5. **Registre** : table `verification_registre` (lisible par tous), fonction
   `garder_verification_registre` (serveur seul) ; `verifier_registre` n'est plus appelable par les
   visiteurs.
6. **Petites failles** : déclencheur `push_subscriptions_controle` (adresse de notification push
   seulement chez les services des navigateurs, en https, 10 appareils au plus par joueur, refus
   `ADRESSE_PUSH_INVALIDE`) ; `texte_acceptable` réservée au serveur ; déclencheur
   `recherches_coequipiers_date` (date d'une annonce « cherche une équipe » posée par la base).
7. **Comptes multiples** : colonne `match_verdicts.niveau_compte_min` ;
   `enregistrer_verdict_historique` prend un 4e paramètre facultatif (niveau Riot le plus bas des
   deux comptes) — l'ancienne version à 3 paramètres est remplacée, l'appel de l'ancien code
   passe toujours ; `duels_classes_du_jour` et `duel_classe_possible` (5 duels classés au plus par
   joueur et par 24 h) ; `creer_duel` et `je_suis_la_division` redéfinies pour s'en servir.

Aucune donnée existante n'est modifiée. Les tournois déjà lancés ont `lance_le` vide, mais le
lancement réel compte aussi leur premier match démarré : un tournoi d'organisateur lancé en avance
avant la migration et clos après sera **non classé** (comportement voulu). La requête de l'étape 1
les liste.

**Entre la migration et la fusion du code** (quelques minutes, à réduire au plus court) :
- la page `/registre` affiche « Vérification indisponible pour l'instant » (l'ancien code appelle
  `verifier_registre`, désormais réservée au serveur) ; la tâche des tournois automatiques remplit
  la vérification gardée dans les 5 minutes qui suivent la fusion ;
- un tournoi lancé depuis le cockpit avec l'ancien code garde ses matchs du tour 1 « en attente »
  (l'ancien code démarre le tour 1 avant de passer le tournoi « en cours », la nouvelle base le
  refuse). Contrôle et réparation à l'étape 4 ;
- l'inscription ne prévient plus d'un pseudo refusé par la modération (l'ancien code appelle
  `texte_acceptable` avec le compte du visiteur, désormais refusé) : la base le remplace toujours
  par un pseudo automatique à la création du compte. Le nouveau code le signale après la
  création du compte (« Un pseudo provisoire t'a été donné : change-le dans ton profil »).

`vercel.json` : la tâche de changement de saison passe de mensuelle à quotidienne (elle ne fait
rien tant qu'aucune saison n'est due ; un échec n'attend plus un mois). Pris en compte par Vercel
à la fusion.

## 1. Avant (lecture seule)

```sql
select count(*) from public.suspensions where levee_le is null;             -- suspensions en cours
select column_name from information_schema.columns
 where table_name = 'tournaments' and column_name = 'lance_le';              -- vide avant
-- Aucune saison plus récente que la saison en cours ne doit avoir commencé : sinon toutes les
-- clôtures classées seraient refusées (SAISON_EN_BASCULE) jusqu'au changement de saison.
select numero, debut_le, est_courante from public.seasons where game_id = 1 order by numero;
-- Tournois d'organisateur en cours qui deviendront non classés (lancés moins de 24 h après leur
-- publication) : à connaître avant, pour pouvoir le dire aux organisateurs concernés.
select t.slug, t.publie_le, t.debute_le, min(m.demarre_le) as premier_match
from public.tournaments t join public.matches m on m.tournament_id = t.id
where t.statut = 'en_cours' and t.nature = 'tournoi' and t.creneau_auto is null
group by t.id
having t.publie_le > least(t.debute_le, min(m.demarre_le)) - interval '24 hours';
-- Services de push des appareils déjà enregistrés : tous doivent être dans la liste acceptée
-- (fcm.googleapis.com, jmt17.google.com, updates.push.services.mozilla.com, *.push.apple.com,
-- *.notify.windows.com). Sinon, élargir la règle (src/lib/push.ts et controler_abonnement_push)
-- AVANT la migration : le site efface une adresse refusée à son prochain envoi.
select substring(endpoint from '^https://([^/]+)/') as service, count(*)
from public.push_subscriptions group by 1 order by 2 desc;
```

## 2. Migration

Appliquer les sept sections, d'un seul tenant. Elles sont rejouables (`if not exists`,
`create or replace`, `drop … if exists`) : rejouées deux fois sur le schéma de `master`, sans
erreur.

## 3. Après (lecture seule)

```sql
select column_name from information_schema.columns
 where table_name = 'tournaments' and column_name = 'lance_le';              -- 1 ligne
select string_agg(tgname, ', ' order by tgname) from pg_trigger
 where tgname in ('tournaments_lancement', 'registrations_absent_apres_checkin',
                  'suspensions_comptes_riot', 'game_accounts_verification_suspendu',
                  'game_accounts_garder_niveau', 'seasons_purger_niveaux',
                  'push_subscriptions_controle', 'recherches_coequipiers_date'); -- les 8
select has_function_privilege('anon', 'public.verifier_registre()', 'execute');            -- false
select has_function_privilege('authenticated', 'public.mon_statut_non_classe()', 'execute'); -- true
select has_function_privilege('anon', 'public.texte_acceptable(text, text)', 'execute');    -- false
select column_name from information_schema.columns
 where table_name = 'match_verdicts' and column_name = 'niveau_compte_min';  -- 1 ligne
select pg_get_function_identity_arguments('public.enregistrer_verdict_historique'::regproc);
-- p_match_id uuid, p_gagnant_id uuid, p_riot_match_id text, p_niveau_compte_min integer

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
- `/inscription` avec un pseudo grossier : compte créé avec un pseudo « Joueur-… » et message
  « Un pseudo provisoire t'a été donné : change-le dans ton profil ».
- Une page de joueur, de tournoi et d'équipe qui n'existe pas : vraie page « Page introuvable »
  (code 404), plus une page vide en 200.
- Un duel lancé après 5 duels classés dans la journée : « amical » sur sa page.
- `/cgu` : version du 22 novembre 2026 ; `/confidentialite` : deux lignes de plus dans « Durée de
  conservation ».
- Matchs bloqués par un lancement fait pendant la fenêtre (doit être vide) :
  ```sql
  select m.id, t.slug from public.matches m join public.tournaments t on t.id = m.tournament_id
  where t.statut = 'en_cours' and m.tour = 1 and m.statut = 'en_attente' and m.demarre_le is null
    and (select count(*) from public.match_participants p where p.match_id = m.id) = 2
    and t.type_bracket = 'elim_simple';
  ```
  S'il y en a, les démarrer par le serveur :
  `update public.matches set statut = 'en_cours', demarre_le = now() where id in (…);`
- Erreurs d'exécution Vercel sur 24 h : aucune nouvelle.
