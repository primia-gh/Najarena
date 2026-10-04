-- Suspension de compte (audit M14).
\set ON_ERROR_STOP 0

-- Hugo : compte Riot vérifié sur EUW, deux tournois ouverts.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000013', 'hugo@test', '{"pseudo":"Hugo","slug":"hugo"}');
insert into game_accounts (profile_id, game_id, puuid, riot_game_name, riot_tag_line, region, est_principal, verifie_le, methode_verification)
values ('00000000-0000-0000-0000-000000000013', 1, 'P-HUGO', 'Hugo', 'EUW', 'EUW', true, now(), 'icone_profil');
insert into tournaments (id, game_id, season_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut)
select v.id::uuid, 1, (select id from seasons where est_courante), '00000000-0000-0000-0000-00000000000a', v.slug, v.slug, '1v1', 8, 'EUW',
       now() + interval '1 day', now() + interval '20 hours', 'ouvert'
from (values
  ('10000000-0000-0000-0000-000000000091', 't-susp-1'),
  ('10000000-0000-0000-0000-000000000092', 't-susp-2')
) as v(id, slug);

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000013');
select essai('Hugo s''inscrit au premier tournoi',
  $q$select public.s_inscrire_tournoi('10000000-0000-0000-0000-000000000091')$q$, 'passe');
select essai('Hugo se suspend lui-même… ou lève sa suspension',
  $q$insert into suspensions (profile_id, motif) values ('00000000-0000-0000-0000-00000000000a', 'essai')$q$, 'bloque');
select essai('Hugo lit les suspensions (réservé aux administrateurs)',
  $q$select 1 from suspensions$q$, 'bloque');
reset role;

-- Le serveur suspend Hugo (action /admin).
insert into suspensions (profile_id, motif) values ('00000000-0000-0000-0000-000000000013', 'Triche avérée');

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000013');
select refus('Hugo (suspendu) s''inscrit au second tournoi',
  $q$select public.s_inscrire_tournoi('10000000-0000-0000-0000-000000000092')$q$, 'COMPTE_SUSPENDU');
select essai('Hugo (suspendu) se désinscrit du premier tournoi',
  $q$select public.se_desinscrire('10000000-0000-0000-0000-000000000091')$q$, 'passe');
select refus('Hugo (suspendu) se réinscrit au premier tournoi',
  $q$select public.s_inscrire_tournoi('10000000-0000-0000-0000-000000000091')$q$, 'COMPTE_SUSPENDU');
reset role;

update suspensions set levee_le = now() where profile_id = '00000000-0000-0000-0000-000000000013';

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000013');
select essai('Hugo (suspension levée) s''inscrit au second tournoi',
  $q$select public.s_inscrire_tournoi('10000000-0000-0000-0000-000000000092')$q$, 'passe');
select en_tant_que('00000000-0000-0000-0000-00000000000a');
reset role;
