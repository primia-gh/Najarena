-- Une partie Riot ne compte qu'une fois (contrôle de sécurité du 17/10/2026).
\set ON_ERROR_STOP 0

-- Deux joueurs, deux matchs ouverts l'un contre l'autre en même temps
-- (un match de tournoi et un défi).
insert into auth.users (id, email, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000009c' || n)::uuid, 'p99c' || n || '@test',
       json_build_object('pseudo', 'Unique99c' || n, 'slug', 'unique99c' || n)::jsonb
from generate_series(0, 1) n;
insert into tournaments (id, game_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, nature)
values
  ('10000000-0000-0000-0000-0000000009c0', 1, '00000000-0000-0000-0000-00000000000d', 'tournoi-99c', 'Tournoi 99c', '1v1', 4, 'EUW', now(), now(), 'en_cours', 'tournoi'),
  ('10000000-0000-0000-0000-0000000009c1', 1, '00000000-0000-0000-0000-00000000000d', 'defi-99c', 'Défi 99c', '1v1', 2, 'EUW', now(), now(), 'en_cours', 'defi');
insert into matches (id, tournament_id, tour, position, statut, demarre_le) values
  ('50000000-0000-0000-0000-0000000009c0', '10000000-0000-0000-0000-0000000009c0', 1, 1, 'en_cours', now() - interval '10 minutes'),
  ('50000000-0000-0000-0000-0000000009c1', '10000000-0000-0000-0000-0000000009c1', 1, 1, 'en_cours', now() - interval '10 minutes');
insert into match_participants (match_id, profile_id, slot) values
  ('50000000-0000-0000-0000-0000000009c0', '00000000-0000-0000-0000-0000000009c0', 1),
  ('50000000-0000-0000-0000-0000000009c0', '00000000-0000-0000-0000-0000000009c1', 2),
  ('50000000-0000-0000-0000-0000000009c1', '00000000-0000-0000-0000-0000000009c0', 1),
  ('50000000-0000-0000-0000-0000000009c1', '00000000-0000-0000-0000-0000000009c1', 2);

set role service_role;
select verifie('La partie EUW1_99C_A tranche le match de tournoi',
  public.enregistrer_verdict_historique('50000000-0000-0000-0000-0000000009c0', '00000000-0000-0000-0000-0000000009c0', 'EUW1_99C_A'));
select refus('La même partie pour le défi entre les mêmes joueurs',
  $q$select public.enregistrer_verdict_historique('50000000-0000-0000-0000-0000000009c1', '00000000-0000-0000-0000-0000000009c0', 'EUW1_99C_A')$q$,
  'PARTIE_DEJA_UTILISEE');
select refus('Une série dont une manche est déjà prise',
  $q$select public.enregistrer_verdict_historique('50000000-0000-0000-0000-0000000009c1', '00000000-0000-0000-0000-0000000009c1', 'EUW1_99C_B, EUW1_99C_A')$q$,
  'PARTIE_DEJA_UTILISEE');
select verifie('Le refus n''a rien laissé : ni verdict pour le défi, ni manche réservée',
  not exists (select 1 from match_verdicts where match_id = '50000000-0000-0000-0000-0000000009c1')
  and not exists (select 1 from parties_utilisees where riot_match_id = 'EUW1_99C_B'));
select verifie('Une autre partie tranche le défi',
  public.enregistrer_verdict_historique('50000000-0000-0000-0000-0000000009c1', '00000000-0000-0000-0000-0000000009c1', 'EUW1_99C_B'));
select verifie('Relance pour le match de tournoi : rien d''écrit deux fois',
  not public.enregistrer_verdict_historique('50000000-0000-0000-0000-0000000009c0', '00000000-0000-0000-0000-0000000009c0', 'EUW1_99C_A'));
reset role;
select verifie('Chaque partie est réservée à un seul match',
  (select count(*) = 2 from parties_utilisees where riot_match_id like 'EUW1_99C_%')
  and (select match_id = '50000000-0000-0000-0000-0000000009c0' from parties_utilisees where riot_match_id = 'EUW1_99C_A'));

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000009c0');
select essai('Un joueur lit la table des parties utilisées', $q$select * from parties_utilisees$q$, 'bloque');
select essai('Un joueur réserve une partie', $q$insert into parties_utilisees (riot_match_id, match_id) values ('EUW1_99C_Z', '50000000-0000-0000-0000-0000000009c1')$q$, 'bloque');
reset role;
