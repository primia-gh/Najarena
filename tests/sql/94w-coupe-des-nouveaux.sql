-- Coupe des nouveaux (idée en réserve n°12) : tournoi réservé aux joueurs
-- pas encore classés, réservation posée par le serveur seul.
\set ON_ERROR_STOP 0

-- Théo (…3a0) n'est pas classé, Ugo (…3a1) l'est ; tous deux EUW vérifiés.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000003a0', 'theo@test', '{"pseudo":"Theo","slug":"theo"}'),
  ('00000000-0000-0000-0000-0000000003a1', 'ugo@test', '{"pseudo":"Ugo","slug":"ugo"}');
insert into game_accounts (profile_id, game_id, puuid, riot_game_name, riot_tag_line, region, est_principal, verifie_le, methode_verification) values
  ('00000000-0000-0000-0000-0000000003a0', 1, 'P-THEO', 'Theo', 'EUW', 'EUW', true, now(), 'icone_profil'),
  ('00000000-0000-0000-0000-0000000003a1', 1, 'P-UGO', 'Ugo', 'EUW', 'EUW', true, now(), 'icone_profil');
-- « Classé » se déduit du RD (≤ 150), calculé par la base.
insert into ratings (profile_id, game_id, season_id, rating, rd, volatilite, matchs_joues) values
  ('00000000-0000-0000-0000-0000000003a0', 1, (select id from seasons where est_courante), 1500, 280, 0.06, 3),
  ('00000000-0000-0000-0000-0000000003a1', 1, (select id from seasons where est_courante), 1620, 120, 0.06, 14);

-- La Coupe, créée par le serveur.
set role service_role;
insert into tournaments (id, game_id, season_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, creneau_auto, reserve_non_classes)
values ('94b70000-0000-0000-0000-000000000001', 1, (select id from seasons where est_courante), '00000000-0000-0000-0000-00000000000a',
        'essai-coupe-nouveaux', 'Coupe des nouveaux · essai', '1v1', 16, 'EUW', now() + interval '1 day', now() + interval '23 hours', 'ouvert',
        'coupe-des-nouveaux-20h', true);
reset role;

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000003a0');
select essai('Théo, pas encore classé, s''inscrit à la Coupe des nouveaux',
  $q$select public.s_inscrire_tournoi('94b70000-0000-0000-0000-000000000001')$q$, 'passe');
select en_tant_que('00000000-0000-0000-0000-0000000003a1');
select refus('Ugo, classé, s''inscrit à la Coupe des nouveaux',
  $q$select public.s_inscrire_tournoi('94b70000-0000-0000-0000-000000000001')$q$, 'RESERVE_NON_CLASSES');
select en_tant_que('00000000-0000-0000-0000-00000000000a');
select refus('Un organisateur crée lui-même un tournoi réservé aux non-classés',
  $q$insert into tournaments (game_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, reserve_non_classes) values (1, '00000000-0000-0000-0000-00000000000a', 'faux-nouveaux', 'Faux nouveaux', '1v1', 8, 'EUW', now() + interval '2 days', now() + interval '2 days', 'ouvert', true)$q$,
  'CHAMP_RESERVE');
reset role;

set role anon;
select essai('Visiteur : voit qu''un tournoi est réservé aux non-classés',
  $q$select 1 from tournaments where slug = 'essai-coupe-nouveaux' and reserve_non_classes$q$, 'passe');
reset role;
select verifie('Un tournoi ordinaire n''est pas réservé', not (select reserve_non_classes from tournaments where slug = 'essai-forfait'));
