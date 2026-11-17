-- Bloc « Fiabilité » du CV (idée en réserve n°6) : présence au check-in,
-- délai pour se déclarer prêt, forfaits, défaites reconnues.
\set ON_ERROR_STOP 0

-- Rita (…2e0) joue ; Sven (…2e1) est son adversaire.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000002e0', 'rita@test', '{"pseudo":"Rita","slug":"rita"}'),
  ('00000000-0000-0000-0000-0000000002e1', 'sven@test', '{"pseudo":"Sven","slug":"sven"}');

-- Quatre tournois commencés : Rita confirmée dans deux, absente dans un,
-- jamais confirmée dans un autre ; retirée à temps d'un cinquième ;
-- inscrite à un tournoi pas encore commencé.
insert into tournaments (id, game_id, season_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut)
select ('94910000-0000-0000-0000-00000000000' || n)::uuid, 1, (select id from seasons where est_courante),
       '00000000-0000-0000-0000-00000000000a', 'essai-fiabilite-' || n, 'Essai fiabilité ' || n, '1v1', 4, 'EUW',
       now() - interval '1 day', now() - interval '25 hours', case when n = 6 then 'ouvert' else 'termine' end::tournament_status
from generate_series(1, 6) n;
insert into registrations (tournament_id, profile_id, statut) values
  ('94910000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000002e0', 'confirme'),
  ('94910000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000002e0', 'confirme'),
  ('94910000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000002e0', 'absent'),
  ('94910000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000002e0', 'inscrit'),
  ('94910000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-0000000002e0', 'retire'),
  ('94910000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-0000000002e0', 'inscrit');

-- Trois matchs contre Sven : prête en 2, 4 et — pour le troisième — jamais
-- (forfait) ; une défaite reconnue dans le deuxième.
insert into matches (id, tournament_id, tour, position, statut, demarre_le) values
  ('94910000-0000-0000-0000-000000000011', '94910000-0000-0000-0000-000000000001', 1, 1, 'termine', now() - interval '3 hours'),
  ('94910000-0000-0000-0000-000000000012', '94910000-0000-0000-0000-000000000002', 1, 1, 'termine', now() - interval '2 hours'),
  ('94910000-0000-0000-0000-000000000013', '94910000-0000-0000-0000-000000000002', 2, 1, 'forfait', now() - interval '1 hour');
insert into match_participants (match_id, profile_id, slot, pret_le) values
  ('94910000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-0000000002e0', 1, now() - interval '3 hours' + interval '2 minutes'),
  ('94910000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-0000000002e1', 2, now() - interval '3 hours' + interval '1 minute'),
  ('94910000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-0000000002e0', 1, now() - interval '2 hours' + interval '4 minutes'),
  ('94910000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-0000000002e1', 2, now() - interval '2 hours' + interval '1 minute'),
  ('94910000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-0000000002e0', 1, null),
  ('94910000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-0000000002e1', 2, now() - interval '1 hour' + interval '1 minute');
insert into match_verdicts (match_id, niveau, gagnant_id, motif, est_definitif) values
  ('94910000-0000-0000-0000-000000000013', 'manuel', '00000000-0000-0000-0000-0000000002e1', 'Forfait : Rita ne s''est pas déclarée prête.', true);
update matches set defaite_reconnue_par = '00000000-0000-0000-0000-0000000002e0', defaite_reconnue_le = now() - interval '100 minutes'
where id = '94910000-0000-0000-0000-000000000012';

set role anon;
select essai('Visiteur : lit la fiabilité d''un joueur (bloc public du CV)',
  $q$select 1 from public.fiabilite_joueur('00000000-0000-0000-0000-0000000002e0')$q$, 'passe');
reset role;

select * from public.fiabilite_joueur('00000000-0000-0000-0000-0000000002e0') \gset rita_
select verifie('Rita : 4 tournois commencés, check-in fait dans 2 (retrait et tournoi à venir non comptés)',
  :rita_tournois = 4 and :rita_checkins = 2);
select verifie('Rita : prête dans 2 matchs, délai médian de 3 minutes',
  :rita_matchs_prets = 2 and :rita_delai_pret_median_secondes = 180);
select verifie('Rita : 3 matchs joués, 1 forfait, 1 défaite reconnue',
  :rita_matchs_joues = 3 and :rita_forfaits = 1 and :rita_defaites_reconnues = 1);
select * from public.fiabilite_joueur('00000000-0000-0000-0000-0000000002e1') \gset sven_
select verifie('Sven : gagnant du forfait, aucun forfait à son compte, prêt en 1 minute',
  :sven_forfaits = 0 and :sven_delai_pret_median_secondes = 60 and :sven_tournois = 0);
