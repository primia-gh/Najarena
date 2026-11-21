-- Comptes Riot : re-liaison d'un compte vérifié et liaisons en attente
-- (contrôle de sécurité complet du 21/11/2026, C1 et E1).
\set ON_ERROR_STOP 0

-- 0 organise ; 1 (Rose) a un compte principal vérifié P99Q-1 et joue un
-- tournoi ouvert ; 2 (Squat) et 3 (Vrai) se disputent le Riot ID P99Q-X.
insert into auth.users (id, email, raw_user_meta_data)
select ('ac0c0000-0000-0000-0000-00000000000' || n)::uuid, 'p99q' || n || '@test',
       json_build_object('pseudo', 'Lien99q' || n, 'slug', 'lien99q' || n)::jsonb
from generate_series(0, 3) n;
insert into game_accounts (profile_id, game_id, puuid, riot_game_name, riot_tag_line, region, est_principal, verifie_le, methode_verification)
values ('ac0c0000-0000-0000-0000-000000000001', 1, 'P99Q-1', 'Rose', 'EUW', 'EUW', true, now(), 'icone_profil');
select id as saison from seasons where est_courante \gset
insert into tournaments (id, game_id, season_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, compte_pour_classement) values
  ('ac0c0000-0000-0000-0000-0000000000a1', 1, :'saison', 'ac0c0000-0000-0000-0000-000000000000', 'lien-99q-a1', 'Coupe 99q', '1v1', 8, 'EUW', now() + interval '2 days', now() + interval '2 days', 'ouvert', true);
insert into registrations (tournament_id, profile_id, statut)
values ('ac0c0000-0000-0000-0000-0000000000a1', 'ac0c0000-0000-0000-0000-000000000001', 'inscrit');

set role service_role;

-- C1 : re-lier son propre compte vérifié ne le « dé-vérifie » plus.
select essai('Rose re-lie son compte principal vérifié (comme secondaire)',
  $q$select public.lier_compte_riot('ac0c0000-0000-0000-0000-000000000001'::uuid, 1::smallint, 'P99Q-1', 'RoseNouveau', 'EUW', 'EUW', 7::smallint, false)$q$, 'passe');
reset role;
select verifie('Son compte reste vérifié, principal, sans défi d''icône, avec son nouveau Riot ID',
  (select verifie_le is not null and est_principal and defi_icone_id is null and defi_cree_le is null and riot_game_name = 'RoseNouveau'
   from game_accounts where puuid = 'P99Q-1'));

set role service_role;
select essai('Rose re-lie son compte principal vérifié (comme principal)',
  $q$select public.lier_compte_riot('ac0c0000-0000-0000-0000-000000000001'::uuid, 1::smallint, 'P99Q-1', 'Rose', 'EUW', 'EUW', 9::smallint, true)$q$, 'passe');
select refus('Rose ne change pas la région de son compte principal pendant son tournoi',
  $q$select public.lier_compte_riot('ac0c0000-0000-0000-0000-000000000001'::uuid, 1::smallint, 'P99Q-1', 'Rose', 'EUW', 'NA', 9::smallint, true)$q$, 'INSCRIT_A_UN_TOURNOI');
reset role;
select verifie('Toujours vérifié, toujours sur EUW',
  (select verifie_le is not null and region = 'EUW' from game_accounts where puuid = 'P99Q-1'));

-- E1 : une liaison jamais vérifiée ne réserve rien.
set role service_role;
select essai('Squat lie le Riot ID de Vrai sans jamais le vérifier',
  $q$select public.lier_compte_riot('ac0c0000-0000-0000-0000-000000000002'::uuid, 1::smallint, 'P99Q-X', 'Vrai', 'EUW', 'EUW', 3::smallint, true)$q$, 'passe');
reset role;
select verifie('La liaison en attente porte l''heure de son défi d''icône',
  (select defi_cree_le is not null and verifie_le is null and profile_id = 'ac0c0000-0000-0000-0000-000000000002'
   from game_accounts where puuid = 'P99Q-X'));

set role service_role;
select essai('Vrai lie son propre Riot ID : la liaison en attente de Squat est remplacée',
  $q$select public.lier_compte_riot('ac0c0000-0000-0000-0000-000000000003'::uuid, 1::smallint, 'P99Q-X', 'Vrai', 'EUW', 'EUW', 5::smallint, true)$q$, 'passe');
reset role;
select verifie('Le Riot ID est maintenant en attente chez Vrai, plus chez Squat',
  (select count(*) = 1 from game_accounts where puuid = 'P99Q-X' and profile_id = 'ac0c0000-0000-0000-0000-000000000003')
  and not exists (select 1 from game_accounts where profile_id = 'ac0c0000-0000-0000-0000-000000000002'));

-- Vrai vérifie son compte (écriture du serveur après le contrôle de l'icône chez Riot).
update game_accounts set verifie_le = now(), defi_icone_id = null, defi_cree_le = null where puuid = 'P99Q-X';
set role service_role;
select refus('Une fois vérifié, le Riot ID n''est plus remplaçable',
  $q$select public.lier_compte_riot('ac0c0000-0000-0000-0000-000000000002'::uuid, 1::smallint, 'P99Q-X', 'Vrai', 'EUW', 'EUW', 3::smallint, true)$q$, 'RIOT_ACCOUNT_TAKEN');
reset role;
select verifie('Le compte vérifié de Vrai est intact',
  (select verifie_le is not null and profile_id = 'ac0c0000-0000-0000-0000-000000000003' from game_accounts where puuid = 'P99Q-X'));

-- Une liaison en attente du même joueur se relance normalement (nouveau défi).
set role service_role;
select essai('Squat lie un autre compte, en attente',
  $q$select public.lier_compte_riot('ac0c0000-0000-0000-0000-000000000002'::uuid, 1::smallint, 'P99Q-S', 'Squat', 'EUW', 'EUW', 4::smallint, true)$q$, 'passe');
reset role;
update game_accounts set defi_cree_le = now() - interval '2 hours' where puuid = 'P99Q-S';
set role service_role;
select essai('Squat relance sa liaison en attente',
  $q$select public.lier_compte_riot('ac0c0000-0000-0000-0000-000000000002'::uuid, 1::smallint, 'P99Q-S', 'Squat', 'EUW', 'EUW', 6::smallint, true)$q$, 'passe');
reset role;
select verifie('Nouveau défi d''icône, nouvelle heure',
  (select defi_icone_id = 6 and defi_cree_le > now() - interval '1 minute' and verifie_le is null
   from game_accounts where puuid = 'P99Q-S'));

-- Le client ne peut toujours rien écrire lui-même.
set role authenticated;
select en_tant_que('ac0c0000-0000-0000-0000-000000000002');
select essai('Squat ne repousse pas lui-même l''heure de son défi',
  $q$update game_accounts set defi_cree_le = now() where puuid = 'P99Q-S' returning 1$q$, 'bloque');
select refus('Squat n''appelle pas la liaison lui-même',
  $q$select public.lier_compte_riot('ac0c0000-0000-0000-0000-000000000002'::uuid, 1::smallint, 'P99Q-1', 'Rose', 'EUW', 'EUW', 3::smallint, true)$q$, 'permission denied for function lier_compte_riot');
reset role;

-- M5 : motif d'un verdict manuel et résolution d'un litige, textes publics.
insert into matches (id, tournament_id, tour, position, match_suivant_id) values
  ('ac0c0000-0000-0000-0000-0000000000b1', 'ac0c0000-0000-0000-0000-0000000000a1', 1, 1, null),
  ('ac0c0000-0000-0000-0000-0000000000b2', 'ac0c0000-0000-0000-0000-0000000000a1', 1, 2, null),
  ('ac0c0000-0000-0000-0000-0000000000b3', 'ac0c0000-0000-0000-0000-0000000000a1', 1, 3, null);
select refus('Motif d''organisateur avec un lien : refusé',
  $q$insert into match_verdicts (match_id, niveau, gagnant_id, decide_par, motif, est_definitif)
     values ('ac0c0000-0000-0000-0000-0000000000b1', 'manuel', null, 'ac0c0000-0000-0000-0000-000000000000', 'Voir https://arnaque.example/gain', true)$q$,
  'TEXTE_INTERDIT');
select refus('Motif d''organisateur de plus de 300 caractères : refusé',
  format($q$insert into match_verdicts (match_id, niveau, gagnant_id, decide_par, motif, est_definitif)
     values ('ac0c0000-0000-0000-0000-0000000000b1', 'manuel', null, 'ac0c0000-0000-0000-0000-000000000000', %L, true)$q$, repeat('a', 301)),
  'MOTIF_TROP_LONG');
select essai('Motif d''organisateur ordinaire : accepté',
  $q$insert into match_verdicts (match_id, niveau, gagnant_id, decide_par, motif, est_definitif)
     values ('ac0c0000-0000-0000-0000-0000000000b1', 'manuel', null, 'ac0c0000-0000-0000-0000-000000000000', 'Les deux joueurs absents à l''heure du match.', true)$q$,
  'passe');
select essai('Motif posé par la base elle-même (decide_par nul) : jamais bloqué',
  $q$insert into match_verdicts (match_id, niveau, gagnant_id, decide_par, motif, est_definitif)
     values ('ac0c0000-0000-0000-0000-0000000000b2', 'manuel', null, null, 'Forfait : Lien99q1 ne s''est pas déclaré prêt dans les 15 minutes suivant son adversaire.', true)$q$,
  'passe');

insert into disputes (id, match_id, ouvert_par, motif) values
  ('ac0c0000-0000-0000-0000-0000000000c1', 'ac0c0000-0000-0000-0000-0000000000b3', 'ac0c0000-0000-0000-0000-000000000001', 'Partie introuvable.');
select refus('Résolution de litige avec un lien : refusée',
  $q$update disputes set resolution = 'Réclame ton lot sur https://arnaque.example' where id = 'ac0c0000-0000-0000-0000-0000000000c1'$q$,
  'TEXTE_INTERDIT');
select refus('Résolution de litige de plus de 500 caractères : refusée',
  format($q$update disputes set resolution = %L where id = 'ac0c0000-0000-0000-0000-0000000000c1'$q$, repeat('b', 501)),
  'MOTIF_TROP_LONG');
select essai('Résolution ordinaire : acceptée',
  $q$update disputes set resolution = 'Partie retrouvée : victoire confirmée.' where id = 'ac0c0000-0000-0000-0000-0000000000c1'$q$,
  'passe');

-- Remplacer une demande en cours d'un autre profil : jamais avec la même icône.
set role service_role;
select essai('Squat lance une demande sur P99Q-Y (icône 3)',
  $q$select public.lier_compte_riot('ac0c0000-0000-0000-0000-000000000002'::uuid, 1::smallint, 'P99Q-Y', 'Y', 'EUW', 'EUW', 3::smallint, false)$q$, 'passe');
select refus('Un autre profil ne la remplace pas avec la même icône',
  $q$select public.lier_compte_riot('ac0c0000-0000-0000-0000-000000000000'::uuid, 1::smallint, 'P99Q-Y', 'Y', 'EUW', 'EUW', 3::smallint, true)$q$, 'DEFI_IDENTIQUE');
select essai('Avec une autre icône, la demande est remplacée',
  $q$select public.lier_compte_riot('ac0c0000-0000-0000-0000-000000000000'::uuid, 1::smallint, 'P99Q-Y', 'Y', 'EUW', 'EUW', 8::smallint, true)$q$, 'passe');
reset role;
select verifie('P99Q-Y est maintenant en attente chez le nouveau demandeur, icône 8',
  (select profile_id = 'ac0c0000-0000-0000-0000-000000000000' and defi_icone_id = 8 from game_accounts where puuid = 'P99Q-Y'));
update game_accounts set defi_cree_le = now() - interval '2 hours' where puuid = 'P99Q-Y';
set role service_role;
select essai('Une demande expirée se remplace même avec la même icône',
  $q$select public.lier_compte_riot('ac0c0000-0000-0000-0000-000000000002'::uuid, 1::smallint, 'P99Q-Y', 'Y', 'EUW', 'EUW', 8::smallint, false)$q$, 'passe');
reset role;
