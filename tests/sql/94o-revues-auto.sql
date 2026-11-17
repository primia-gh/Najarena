-- Revue de match rédigée automatiquement pour l'offre Elite (audit N25).
\set ON_ERROR_STOP 0

-- Hana (Elite), Ivo (gratuit), Jade (Organisateur), Kim (Elite, suspendue).
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000140', 'hana955@test', '{"pseudo":"Hana955","slug":"hana955"}'),
  ('00000000-0000-0000-0000-000000000141', 'ivo955@test', '{"pseudo":"Ivo955","slug":"ivo955"}'),
  ('00000000-0000-0000-0000-000000000142', 'jade955@test', '{"pseudo":"Jade955","slug":"jade955"}'),
  ('00000000-0000-0000-0000-000000000143', 'kim955@test', '{"pseudo":"Kim955","slug":"kim955"}');
insert into comptes_offres (profile_id, offre) values
  ('00000000-0000-0000-0000-000000000140', 'elite'),
  ('00000000-0000-0000-0000-000000000142', 'organisateur'),
  ('00000000-0000-0000-0000-000000000143', 'elite');
insert into suspensions (profile_id, motif) values ('00000000-0000-0000-0000-000000000143', 'Test de suspension');

insert into tournaments (id, game_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut) values
  ('9f000000-0000-0000-0000-000000000001', 1, '00000000-0000-0000-0000-000000000141', 'revues-955', 'Revues 955', '1v1', 32, 'EUW',
   now() - interval '10 days', now() - interval '10 days', 'en_cours');
-- Matchs 1 à 20, au premier tour.
insert into matches (id, tournament_id, tour, position, statut)
select ('9f000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, '9f000000-0000-0000-0000-000000000001', 1, n, 'termine'
from generate_series(1, 20) n;

-- m01 : Hana contre Ivo, lu chez Riot il y a une heure.
-- m02 : Hana, verdict manuel. m03 : Hana, lu chez Riot il y a 8 jours.
-- m04 : Jade, lu chez Riot. m05 : Hana, déjà analysé. m06 : Kim, suspendue.
insert into match_verdicts (match_id, niveau, gagnant_id, est_definitif, cree_le) values
  ('9f000000-0000-0000-0000-000000000001', 'historique', '00000000-0000-0000-0000-000000000140', true, now() - interval '1 hour'),
  ('9f000000-0000-0000-0000-000000000002', 'manuel', '00000000-0000-0000-0000-000000000140', true, now() - interval '50 minutes'),
  ('9f000000-0000-0000-0000-000000000003', 'historique', '00000000-0000-0000-0000-000000000140', true, now() - interval '8 days'),
  ('9f000000-0000-0000-0000-000000000004', 'historique', '00000000-0000-0000-0000-000000000142', true, now() - interval '40 minutes'),
  ('9f000000-0000-0000-0000-000000000005', 'historique', '00000000-0000-0000-0000-000000000140', true, now() - interval '30 minutes'),
  ('9f000000-0000-0000-0000-000000000006', 'historique', '00000000-0000-0000-0000-000000000143', true, now() - interval '20 minutes');
insert into stats_match_joueur (match_id, profile_id, champion, kills, deaths, assists, cs, or_gagne, duree_secondes, gagne)
select m::uuid, p::uuid, 'Yasuo', 5, 2, 1, 120, 6000, 900, true
from (values
  ('9f000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000140'),
  ('9f000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000141'),
  ('9f000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000140'),
  ('9f000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000140'),
  ('9f000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000142'),
  ('9f000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000140'),
  ('9f000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000143')
) as x(m, p);
insert into revues_match_ia (match_id, profile_id, points, conseil, modele) values
  ('9f000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000140', array['Déjà fait'], 'Rien', 'test');

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000140');
select refus('Hana demande elle-même la liste des revues à rédiger',
  $q$select * from public.revues_a_rediger(5)$q$, 'permission denied for function revues_a_rediger');
reset role;

set role service_role;
select verifie('Serveur : les parties vérifiées récentes de Hana (Elite) et de Jade (Organisateur), dans l''ordre',
  (select array_agg(right(match_id::text, 2) || ':' || right(profile_id::text, 3) order by ordre)
          = array['01:140', '04:142']
   from (select *, row_number() over () as ordre from public.revues_a_rediger(10)) x));
select verifie('Serveur : la limite par passage est respectée', (select count(*) = 1 from public.revues_a_rediger(1)));
reset role;

-- Plafond de 10 revues par 24 h : Hana en a déjà 9 (m05 compris) ; une
-- seule de ses deux nouvelles parties passe.
insert into revues_match_ia (match_id, profile_id, points, conseil, modele)
select ('9f000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, '00000000-0000-0000-0000-000000000140', array['Point'], 'Conseil', 'test'
from generate_series(7, 14) n;
insert into match_verdicts (match_id, niveau, gagnant_id, est_definitif, cree_le) values
  ('9f000000-0000-0000-0000-000000000015', 'historique', '00000000-0000-0000-0000-000000000140', true, now() - interval '10 minutes');
insert into stats_match_joueur (match_id, profile_id, champion, kills, deaths, assists, cs, or_gagne, duree_secondes, gagne) values
  ('9f000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000140', 'Yasuo', 1, 5, 0, 90, 4000, 800, false);
set role service_role;
select verifie('Serveur : Hana à 9 revues en 24 h, une seule partie de plus à analyser (la plus ancienne)',
  (select array_agg(right(match_id::text, 2)) = array['01']
   from public.revues_a_rediger(10) where profile_id = '00000000-0000-0000-0000-000000000140'));
reset role;

-- Une analyse en échec : retentée une fois, une heure plus tard.
set role service_role;
select essai('Serveur : échec noté pour Jade (m04)',
  $q$select public.noter_echec_revue('9f000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000142')$q$, 'passe');
select verifie('Serveur : Jade n''est pas reprise dans l''heure',
  (select not exists (select 1 from public.revues_a_rediger(10) where profile_id = '00000000-0000-0000-0000-000000000142')));
reset role;
update echecs_revue_ia set dernier_le = now() - interval '2 hours' where profile_id = '00000000-0000-0000-0000-000000000142';
set role service_role;
select verifie('Serveur : Jade reprise une heure plus tard',
  (select exists (select 1 from public.revues_a_rediger(10) where profile_id = '00000000-0000-0000-0000-000000000142')));
select essai('Serveur : second échec pour Jade',
  $q$select public.noter_echec_revue('9f000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000142')$q$, 'passe');
reset role;
update echecs_revue_ia set dernier_le = now() - interval '2 hours' where profile_id = '00000000-0000-0000-0000-000000000142';
set role service_role;
select verifie('Serveur : après deux échecs, plus de nouvel essai',
  (select not exists (select 1 from public.revues_a_rediger(10) where profile_id = '00000000-0000-0000-0000-000000000142')));
reset role;
select verifie('Deux essais comptés', (select essais = 2 from echecs_revue_ia where profile_id = '00000000-0000-0000-0000-000000000142'));
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000142');
select refus('Jade note elle-même un échec', $q$select public.noter_echec_revue('9f000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000142')$q$,
  'permission denied for function noter_echec_revue');
select essai('Jade lit les échecs', $q$select 1 from echecs_revue_ia$q$, 'bloque');
reset role;
