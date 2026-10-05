-- Bilan du joueur, étape 1 : parties vérifiées complètes, indicateurs et
-- repères (05/10/2026).
\set ON_ERROR_STOP 0

-- Mia, Noe et Oli jouent un tournoi 1v1 ; Pat joue un match tranché à la
-- main ; puis un match 5v5.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000160', 'mia957@test', '{"pseudo":"Mia957","slug":"mia957"}'),
  ('00000000-0000-0000-0000-000000000161', 'noe957@test', '{"pseudo":"Noe957","slug":"noe957"}'),
  ('00000000-0000-0000-0000-000000000162', 'oli957@test', '{"pseudo":"Oli957","slug":"oli957"}'),
  ('00000000-0000-0000-0000-000000000163', 'pat957@test', '{"pseudo":"Pat957","slug":"pat957"}');
insert into tournaments (id, game_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, compte_pour_classement) values
  ('a1000000-0000-0000-0000-000000000001', 1, '00000000-0000-0000-0000-000000000163', 'bilan-1v1', 'Bilan 1v1', '1v1', 8, 'EUW', now() - interval '2 days', now() - interval '2 days', 'termine', true),
  ('a1000000-0000-0000-0000-000000000002', 1, '00000000-0000-0000-0000-000000000163', 'bilan-5v5', 'Bilan 5v5', '5v5', 4, 'EUW', now() - interval '1 day', now() - interval '1 day', 'termine', false);
insert into matches (id, tournament_id, tour, position, statut) values
  ('a1000000-0000-0000-0000-0000000000a1', 'a1000000-0000-0000-0000-000000000001', 1, 1, 'termine'),
  ('a1000000-0000-0000-0000-0000000000a2', 'a1000000-0000-0000-0000-000000000001', 1, 2, 'termine'),
  ('a1000000-0000-0000-0000-0000000000a3', 'a1000000-0000-0000-0000-000000000001', 1, 3, 'termine'),
  ('a1000000-0000-0000-0000-0000000000a4', 'a1000000-0000-0000-0000-000000000001', 1, 4, 'termine'),
  ('a1000000-0000-0000-0000-0000000000b1', 'a1000000-0000-0000-0000-000000000002', 1, 1, 'termine');
insert into match_verdicts (match_id, niveau, gagnant_id, est_definitif) values
  ('a1000000-0000-0000-0000-0000000000a1', 'historique', '00000000-0000-0000-0000-000000000160', true),
  ('a1000000-0000-0000-0000-0000000000a2', 'historique', '00000000-0000-0000-0000-000000000160', true),
  ('a1000000-0000-0000-0000-0000000000a3', 'historique', '00000000-0000-0000-0000-000000000161', true),
  ('a1000000-0000-0000-0000-0000000000a4', 'manuel', '00000000-0000-0000-0000-000000000163', true),
  ('a1000000-0000-0000-0000-0000000000b1', 'historique', '00000000-0000-0000-0000-000000000160', true);

insert into stats_match_joueur (match_id, profile_id, champion, kills, deaths, assists, cs, or_gagne, duree_secondes, gagne,
                                degats_champions, premier_sang, premiere_tour, objets, rune_principale, style_secondaire, sorts, poste, patch, joue_le) values
  ('a1000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000160', 'Ahri', 3, 1, 2, 150, 6000, 900, true, 9000, true, true, array[6655, 3020, 1056], 8112, 8200, array[14, 4], null, '15.19', now() - interval '2 days'),
  ('a1000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000161', 'Zed', 1, 3, 0, 120, 4800, 900, false, 6000, false, false, array[3142, 1055], 8010, null, array[4, 14], null, '15.19', now() - interval '2 days'),
  ('a1000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000160', 'Ahri', 4, 2, 0, 120, 4000, 600, true, 6000, true, false, array[6655, 1056], 8112, null, array[4, 14], null, '15.19', now() - interval '47 hours'),
  ('a1000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000162', 'Yasuo', 2, 4, 1, 90, 3000, 600, false, 4800, false, false, array[3031], 8008, null, array[4, 14], null, '15.19', now() - interval '47 hours'),
  ('a1000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000161', 'Zed', 2, 0, 1, 140, 5600, 840, true, 8400, true, true, array[3142], 8010, null, array[4, 14], null, '15.19', now() - interval '46 hours'),
  ('a1000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000160', 'Ahri', 0, 2, 0, 112, 4200, 840, false, 5040, false, false, array[3020, 1056], 8229, null, array[4, 21], null, '15.19', now() - interval '46 hours'),
  ('a1000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-000000000163', 'Ahri', 10, 0, 0, 200, 9000, 900, true, 12000, true, true, array[3089], 8112, null, array[4, 14], null, '15.19', now() - interval '45 hours'),
  ('a1000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000160', 'Ahri', 5, 2, 7, 210, 11000, 1500, true, 21000, false, false, array[6655, 3020, 4645], 8112, 8300, array[4, 12], 'MIDDLE', '15.19', now() - interval '1 day'),
  ('a1000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000162', 'Yasuo', 3, 6, 2, 190, 9500, 1500, false, 15000, false, false, array[3031, 3006], 8008, 8400, array[4, 12], 'MIDDLE', '15.19', now() - interval '1 day'),
  ('a1000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000161', 'Garen', 1, 5, 3, 180, 8000, 1500, false, 12000, false, true, array[3078], 8010, 8400, array[4, 12], 'TOP', '15.19', now() - interval '1 day');

select refus('Plus de six objets dans une partie',
  $q$update stats_match_joueur set objets = array[1, 2, 3, 4, 5, 6, 7] where match_id = 'a1000000-0000-0000-0000-0000000000a1' and profile_id = '00000000-0000-0000-0000-000000000160'$q$,
  'new row for relation "stats_match_joueur" violates check constraint "stats_match_joueur_objets_check"');
select refus('Patch mal formé',
  $q$update stats_match_joueur set patch = '15.19.715' where match_id = 'a1000000-0000-0000-0000-0000000000a1' and profile_id = '00000000-0000-0000-0000-000000000160'$q$,
  'new row for relation "stats_match_joueur" violates check constraint "stats_match_joueur_patch_check"');

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select verifie('Visiteur : indicateurs de la première partie de Mia (KDA 5, 10 sbires/min, 400 or/min, 600 dégâts/min, 0,67 mort par 10 min, premier sang)',
  (select kda = 5.00 and sbires_min = 10.00 and or_min = 400.0 and degats_min = 600.0 and morts_10min = 0.67 and premier_sang = 1 and premiere_tour = 1
   from indicateurs_partie where match_id = 'a1000000-0000-0000-0000-0000000000a1' and profile_id = '00000000-0000-0000-0000-000000000160'));
select verifie('Un match tranché à la main n''entre pas dans les indicateurs',
  (select count(*) = 0 from indicateurs_partie where match_id = 'a1000000-0000-0000-0000-0000000000a4'));
select verifie('Repères 1v1 : moyennes des vainqueurs et des perdants calculées sur toutes les parties vérifiées (celles de Mia comprises)',
  (select r.parties = c.parties and r.moyenne_gagnants = c.gagnants and r.moyenne_perdants = c.perdants and c.parties >= 6
   from public.reperes_bilan('1v1') r,
        (select count(*)::integer as parties, round(avg(kda) filter (where gagne), 3) as gagnants,
                round(avg(kda) filter (where not gagne), 3) as perdants
         from indicateurs_partie where format = '1v1') c
   where r.indicateur = 'kda'));
select verifie('Repères 1v1 : les vainqueurs ont tous fait le premier sang, les perdants jamais',
  (select moyenne_gagnants = 1.000 and moyenne_perdants = 0.000 from public.reperes_bilan('1v1') where indicateur = 'premier_sang'));
select verifie('Repères 1v1 : pas de vision mesurée en 1v1', (select count(*) = 0 from public.reperes_bilan('1v1') where indicateur = 'vision_min'));
select verifie('Repères 5v5 au poste mid : les deux joueurs du milieu seulement',
  (select parties = 2 from public.reperes_bilan('5v5', 'MIDDLE') where indicateur = 'kda'));
select verifie('Build de référence d''Ahri en 1v1 : 3 parties, 2 victoires (le match manuel ne compte pas)',
  (select parties = 3 and victoires = 2 from public.reperes_build('1v1', 'Ahri') where genre = 'total'));
select verifie('Build d''Ahri : objets comptés une fois par partie, avec leurs victoires',
  (select array_agg(valeur || ':' || parties || '/' || victoires order by valeur) = array['1056:3/2', '3020:2/1', '6655:2/2']
   from public.reperes_build('1v1', 'Ahri') where genre = 'objet'));
select verifie('Build d''Ahri : runes principales et sorts (paire rangée)',
  (select array_agg(genre || '=' || valeur || ':' || parties || '/' || victoires order by genre, valeur)
          = array['rune=8112:2/2', 'rune=8229:1/0', 'sorts=4,14:2/2', 'sorts=4,21:1/0', 'style=8200:1/1']
   from public.reperes_build('1v1', 'Ahri') where genre in ('rune', 'sorts', 'style')));
select essai('Visiteur : écrire des statistiques', $q$insert into stats_match_joueur (match_id, profile_id, champion, kills, deaths, assists, cs, or_gagne, duree_secondes, gagne) values ('a1000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-000000000160', 'Ahri', 1, 1, 1, 1, 1, 60, true)$q$, 'bloque');
reset role;

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000160');
select verifie('Mia retrouve ses 4 parties vérifiées (3 en 1v1, 1 en 5v5)',
  (select count(*) = 4 from indicateurs_partie where profile_id = '00000000-0000-0000-0000-000000000160'));
select essai('Mia écrit dans les indicateurs', $q$delete from indicateurs_partie where profile_id = '00000000-0000-0000-0000-000000000160'$q$, 'bloque');
reset role;
