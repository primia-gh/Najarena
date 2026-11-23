-- Face-à-face entre deux joueurs (19/11/2026).
\set ON_ERROR_STOP 0

-- Ana et Bob se sont affrontés : une victoire d'Ana lue chez Riot, une de
-- Bob tranchée à la main, un forfait ; et dans un brouillon (invisible).
-- Ana a aussi joué Cid. Un match 5v5 entre leurs équipes ne compte pas.
insert into auth.users (id, email, raw_user_meta_data)
select ('9c0c0000-0000-0000-0000-00000000000' || n)::uuid, 'p99l' || n || '@test',
       json_build_object('pseudo', 'Face99l' || n, 'slug', 'face99l' || n)::jsonb
from generate_series(1, 4) n;
insert into tournaments (id, game_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, compte_pour_classement) values
  ('9c0c0000-0000-0000-0000-0000000000a1', 1, '9c0c0000-0000-0000-0000-000000000004', 'face-99l-a', 'Coupe face A', '1v1', 4, 'EUW', now() - interval '3 days', now() - interval '3 days', 'termine', true),
  ('9c0c0000-0000-0000-0000-0000000000a2', 1, '9c0c0000-0000-0000-0000-000000000004', 'face-99l-b', 'Coupe face B', '1v1', 4, 'EUW', now() + interval '3 days', now() + interval '3 days', 'brouillon', true),
  ('9c0c0000-0000-0000-0000-0000000000a3', 1, '9c0c0000-0000-0000-0000-000000000004', 'face-99l-c', 'Coupe face C', '5v5', 4, 'EUW', now() - interval '2 days', now() - interval '2 days', 'termine', false);
insert into matches (id, tournament_id, tour, position, statut, demarre_le) values
  ('9c0c0000-0000-0000-0000-0000000000b1', '9c0c0000-0000-0000-0000-0000000000a1', 1, 1, 'termine', now() - interval '3 days'),
  ('9c0c0000-0000-0000-0000-0000000000b2', '9c0c0000-0000-0000-0000-0000000000a1', 1, 2, 'termine', now() - interval '2 days'),
  ('9c0c0000-0000-0000-0000-0000000000b3', '9c0c0000-0000-0000-0000-0000000000a1', 2, 1, 'forfait', now() - interval '1 day'),
  ('9c0c0000-0000-0000-0000-0000000000b4', '9c0c0000-0000-0000-0000-0000000000a1', 3, 1, 'termine', now() - interval '12 hours'),
  ('9c0c0000-0000-0000-0000-0000000000b5', '9c0c0000-0000-0000-0000-0000000000a2', 1, 1, 'termine', now()),
  ('9c0c0000-0000-0000-0000-0000000000b6', '9c0c0000-0000-0000-0000-0000000000a3', 1, 1, 'termine', now() - interval '2 days');
insert into match_participants (match_id, profile_id, slot) values
  ('9c0c0000-0000-0000-0000-0000000000b1', '9c0c0000-0000-0000-0000-000000000001', 1),
  ('9c0c0000-0000-0000-0000-0000000000b1', '9c0c0000-0000-0000-0000-000000000002', 2),
  ('9c0c0000-0000-0000-0000-0000000000b2', '9c0c0000-0000-0000-0000-000000000002', 1),
  ('9c0c0000-0000-0000-0000-0000000000b2', '9c0c0000-0000-0000-0000-000000000001', 2),
  ('9c0c0000-0000-0000-0000-0000000000b3', '9c0c0000-0000-0000-0000-000000000001', 1),
  ('9c0c0000-0000-0000-0000-0000000000b3', '9c0c0000-0000-0000-0000-000000000002', 2),
  ('9c0c0000-0000-0000-0000-0000000000b4', '9c0c0000-0000-0000-0000-000000000001', 1),
  ('9c0c0000-0000-0000-0000-0000000000b4', '9c0c0000-0000-0000-0000-000000000003', 2),
  ('9c0c0000-0000-0000-0000-0000000000b5', '9c0c0000-0000-0000-0000-000000000001', 1),
  ('9c0c0000-0000-0000-0000-0000000000b5', '9c0c0000-0000-0000-0000-000000000002', 2),
  ('9c0c0000-0000-0000-0000-0000000000b6', '9c0c0000-0000-0000-0000-000000000001', 1),
  ('9c0c0000-0000-0000-0000-0000000000b6', '9c0c0000-0000-0000-0000-000000000002', 2);
insert into match_verdicts (match_id, niveau, gagnant_id, motif, est_definitif, niveau_compte_min) values
  ('9c0c0000-0000-0000-0000-0000000000b1', 'historique', '9c0c0000-0000-0000-0000-000000000001', null, true, 120),
  ('9c0c0000-0000-0000-0000-0000000000b2', 'manuel', '9c0c0000-0000-0000-0000-000000000002', 'Capture d''écran', true, null),
  ('9c0c0000-0000-0000-0000-0000000000b3', 'manuel', '9c0c0000-0000-0000-0000-000000000001', 'Forfait', true, null),
  ('9c0c0000-0000-0000-0000-0000000000b4', 'historique', '9c0c0000-0000-0000-0000-000000000003', null, true, 120),
  ('9c0c0000-0000-0000-0000-0000000000b5', 'historique', '9c0c0000-0000-0000-0000-000000000002', null, true, 120),
  ('9c0c0000-0000-0000-0000-0000000000b6', 'historique', '9c0c0000-0000-0000-0000-000000000002', null, true, 120);

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select verifie('Ana contre Bob, vu par un visiteur : 3 matchs 1v1 (ni le brouillon, ni le 5v5), du plus récent au plus ancien',
  (select count(*) = 3 from public.face_a_face('9c0c0000-0000-0000-0000-000000000001', '9c0c0000-0000-0000-0000-000000000002'))
  and (select array_agg(match_id order by joue_le desc) = array['9c0c0000-0000-0000-0000-0000000000b3', '9c0c0000-0000-0000-0000-0000000000b2', '9c0c0000-0000-0000-0000-0000000000b1']::uuid[]
       from public.face_a_face('9c0c0000-0000-0000-0000-000000000001', '9c0c0000-0000-0000-0000-000000000002')));
select verifie('Le forfait et la décision manuelle sont signalés comme tels',
  (select bool_and(case match_id
                     when '9c0c0000-0000-0000-0000-0000000000b3' then forfait
                     when '9c0c0000-0000-0000-0000-0000000000b2' then niveau = 'manuel' and not forfait
                     else niveau = 'historique' and not forfait end)
   from public.face_a_face('9c0c0000-0000-0000-0000-000000000001', '9c0c0000-0000-0000-0000-000000000002')));
select verifie('Dans l''autre sens, les mêmes matchs ; Ana contre Cid : 1 ; Ana contre elle-même : rien',
  (select count(*) = 3 from public.face_a_face('9c0c0000-0000-0000-0000-000000000002', '9c0c0000-0000-0000-0000-000000000001'))
  and (select count(*) = 1 from public.face_a_face('9c0c0000-0000-0000-0000-000000000001', '9c0c0000-0000-0000-0000-000000000003'))
  and (select count(*) = 0 from public.face_a_face('9c0c0000-0000-0000-0000-000000000001', '9c0c0000-0000-0000-0000-000000000001')));
reset role;
