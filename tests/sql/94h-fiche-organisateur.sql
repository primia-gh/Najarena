-- Fiche publique de l'organisateur (audit N13).
\set ON_ERROR_STOP 0

-- Oscar organise : un tournoi terminé (un match lu chez Riot, un tranché à
-- la main, une exemption, un litige résolu en 3 h, un autre ouvert), un
-- tournoi annulé, un brouillon (ignoré).
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c0', 'orga948@test', '{"pseudo":"Orga948","slug":"orga948"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'joueur948a@test', '{"pseudo":"Joueur948a","slug":"joueur948a"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'joueur948b@test', '{"pseudo":"Joueur948b","slug":"joueur948b"}');
insert into tournaments (id, game_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut) values
  ('94800000-0000-0000-0000-000000000001', 1, '00000000-0000-0000-0000-0000000000c0', 'oscar-1', 'Oscar 1', '1v1', 4, 'EUW', now() - interval '3 days', now() - interval '3 days', 'termine'),
  ('94800000-0000-0000-0000-000000000002', 1, '00000000-0000-0000-0000-0000000000c0', 'oscar-2', 'Oscar 2', '1v1', 4, 'EUW', now() - interval '2 days', now() - interval '2 days', 'annule'),
  ('94800000-0000-0000-0000-000000000003', 1, '00000000-0000-0000-0000-0000000000c0', 'oscar-3', 'Oscar 3', '1v1', 4, 'EUW', now() + interval '2 days', now() + interval '2 days', 'brouillon');
insert into matches (id, tournament_id, tour, position, statut) values
  ('94800000-0000-0000-0000-0000000000a1', '94800000-0000-0000-0000-000000000001', 1, 1, 'termine'),
  ('94800000-0000-0000-0000-0000000000a2', '94800000-0000-0000-0000-000000000001', 1, 2, 'termine'),
  ('94800000-0000-0000-0000-0000000000a3', '94800000-0000-0000-0000-000000000001', 2, 1, 'termine');
insert into match_participants (match_id, profile_id, slot) values
  ('94800000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', 1),
  ('94800000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c2', 2),
  ('94800000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000c1', 1),
  ('94800000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000c2', 2),
  ('94800000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000c1', 1);
insert into match_verdicts (match_id, niveau, gagnant_id, est_definitif) values
  ('94800000-0000-0000-0000-0000000000a1', 'historique', '00000000-0000-0000-0000-0000000000c1', true),
  ('94800000-0000-0000-0000-0000000000a2', 'manuel', '00000000-0000-0000-0000-0000000000c2', true),
  ('94800000-0000-0000-0000-0000000000a3', 'manuel', '00000000-0000-0000-0000-0000000000c1', true);
insert into disputes (match_id, ouvert_par, motif, cree_le, resolution, resolu_le) values
  ('94800000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000c1', 'Contestation', now() - interval '10 hours', 'Rejoué', now() - interval '7 hours'),
  ('94800000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c2', 'Autre', now() - interval '1 hour', null, null);

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select verifie('Fiche d''Oscar lisible par un visiteur : 2 tournois publiés (1 terminé, 1 annulé), 1 match lu chez Riot sur 2, 2 litiges dont 1 tranché en 3 h',
  (select tournois_publies = 2 and tournois_termines = 1 and tournois_annules = 1
      and matchs_decides = 2 and matchs_verifies = 1
      and litiges = 2 and litiges_resolus = 1 and resolution_mediane_heures = 3.0
   from public.fiche_organisateur('00000000-0000-0000-0000-0000000000c0')));
reset role;
