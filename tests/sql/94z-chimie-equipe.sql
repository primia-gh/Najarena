-- Chimie d'équipe (idée en réserve n°16) : matchs 5v5 d'une équipe lus chez
-- Riot, avec ses joueurs alignés présents dans la partie.
\set ON_ERROR_STOP 0

-- Équipe Z : Zia (capitaine), Zac, Zed, Zoe, Zou, Zen (remplaçant).
-- Xan joue en face.
insert into auth.users (id, email, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000003c' || n)::uuid, 'z94' || n || '@test',
       json_build_object('pseudo', 'Z94z' || n, 'slug', 'z94z' || n)::jsonb
from generate_series(0, 6) n;
insert into teams (id, game_id, slug, nom, tag, capitaine_id) values
  ('a7f00000-0000-0000-0000-00000000000a', 1, 'equipe-z-94z', 'Equipe Z', 'ZZZ', '00000000-0000-0000-0000-0000000003c0');

-- Tournoi A : Zia, Zac, Zed, Zoe, Zou. Tournoi B : Zen remplace Zou.
insert into tournaments (id, game_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, compte_pour_classement) values
  ('a7f00000-0000-0000-0000-000000000001', 1, '00000000-0000-0000-0000-0000000003c6', 'chimie-a-94z', 'Chimie A', '5v5', 4, 'EUW', now() - interval '3 days', now() - interval '3 days', 'termine', false),
  ('a7f00000-0000-0000-0000-000000000002', 1, '00000000-0000-0000-0000-0000000003c6', 'chimie-b-94z', 'Chimie B', '5v5', 4, 'EUW', now() - interval '2 days', now() - interval '2 days', 'termine', false);
insert into registrations (id, tournament_id, profile_id, team_id, statut) values
  ('a7f00000-0000-0000-0000-0000000000a1', 'a7f00000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000003c0', 'a7f00000-0000-0000-0000-00000000000a', 'confirme'),
  ('a7f00000-0000-0000-0000-0000000000b1', 'a7f00000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000003c0', 'a7f00000-0000-0000-0000-00000000000a', 'confirme');
insert into alignements (tournament_id, profile_id, registration_id)
select 'a7f00000-0000-0000-0000-000000000001', ('00000000-0000-0000-0000-0000000003c' || n)::uuid, 'a7f00000-0000-0000-0000-0000000000a1'
from generate_series(0, 4) n;
insert into alignements (tournament_id, profile_id, registration_id)
select 'a7f00000-0000-0000-0000-000000000002', ('00000000-0000-0000-0000-0000000003c' || n)::uuid, 'a7f00000-0000-0000-0000-0000000000b1'
from unnest(array[0, 1, 2, 3, 5]) n;

-- m1 (A) gagné, m2 (A) perdu, m3 (B) gagné : lus chez Riot. m4 (B) : verdict manuel.
insert into matches (id, tournament_id, tour, position, statut) values
  ('a7f00000-0000-0000-0000-000000000011', 'a7f00000-0000-0000-0000-000000000001', 1, 1, 'termine'),
  ('a7f00000-0000-0000-0000-000000000012', 'a7f00000-0000-0000-0000-000000000001', 2, 1, 'termine'),
  ('a7f00000-0000-0000-0000-000000000013', 'a7f00000-0000-0000-0000-000000000002', 1, 1, 'termine'),
  ('a7f00000-0000-0000-0000-000000000014', 'a7f00000-0000-0000-0000-000000000002', 2, 1, 'termine');
insert into match_verdicts (match_id, niveau, gagnant_id, est_definitif, cree_le) values
  ('a7f00000-0000-0000-0000-000000000011', 'historique', '00000000-0000-0000-0000-0000000003c0', true, now() - interval '3 days'),
  ('a7f00000-0000-0000-0000-000000000012', 'historique', '00000000-0000-0000-0000-0000000003c6', true, now() - interval '3 days' + interval '1 hour'),
  ('a7f00000-0000-0000-0000-000000000013', 'historique', '00000000-0000-0000-0000-0000000003c0', true, now() - interval '2 days'),
  ('a7f00000-0000-0000-0000-000000000014', 'manuel', '00000000-0000-0000-0000-0000000003c0', true, now() - interval '2 days' + interval '1 hour');
insert into stats_match_joueur (match_id, profile_id, champion, kills, deaths, assists, cs, or_gagne, duree_secondes, gagne)
select m::uuid, ('00000000-0000-0000-0000-0000000003c' || n)::uuid, 'Ahri', 3, 3, 3, 150, 8000, 1800, g
from (values
  ('a7f00000-0000-0000-0000-000000000011', true), ('a7f00000-0000-0000-0000-000000000012', false)
) as x(m, g)
cross join generate_series(0, 4) n;
insert into stats_match_joueur (match_id, profile_id, champion, kills, deaths, assists, cs, or_gagne, duree_secondes, gagne)
select m::uuid, ('00000000-0000-0000-0000-0000000003c' || n)::uuid, 'Lux', 3, 3, 3, 150, 8000, 1800, true
from (values ('a7f00000-0000-0000-0000-000000000013'), ('a7f00000-0000-0000-0000-000000000014')) as x(m)
cross join unnest(array[0, 1, 2, 3, 5]) n;
-- Xan, en face dans m1 : jamais compté pour Z.
insert into stats_match_joueur (match_id, profile_id, champion, kills, deaths, assists, cs, or_gagne, duree_secondes, gagne) values
  ('a7f00000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-0000000003c6', 'Zed', 3, 3, 3, 150, 8000, 1800, false);

set role anon;
select verifie('Visiteur : trois matchs de l''équipe Z lus chez Riot, le verdict manuel exclu',
  (select count(*) = 3 from public.chimie_equipe('a7f00000-0000-0000-0000-00000000000a')));
select verifie('Les joueurs alignés de chaque match, sans l''adversaire',
  (select bool_and(cardinality(joueurs) = 5 and not '00000000-0000-0000-0000-0000000003c6' = any(joueurs))
     from public.chimie_equipe('a7f00000-0000-0000-0000-00000000000a')));
select verifie('Match du tournoi B : Zen aligné à la place de Zou, gagné',
  (select gagne and '00000000-0000-0000-0000-0000000003c5' = any(joueurs) and not '00000000-0000-0000-0000-0000000003c4' = any(joueurs)
     from public.chimie_equipe('a7f00000-0000-0000-0000-00000000000a') where match_id = 'a7f00000-0000-0000-0000-000000000013'));
select verifie('Bilan : 2 victoires, 1 défaite',
  (select count(*) filter (where gagne) = 2 and count(*) filter (where not gagne) = 1
     from public.chimie_equipe('a7f00000-0000-0000-0000-00000000000a')));
reset role;
