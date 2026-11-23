-- Comptes jetables sur le CV (23/11/2026, suite du contrôle M4) : une
-- partie jouée avec un compte Riot sous le niveau 30 ne compte pas pour une
-- recommandation, et le face-à-face rend le niveau des comptes.
\set ON_ERROR_STOP 0

insert into auth.users (id, email, raw_user_meta_data)
select ('b33b000' || n || '-0000-0000-0000-000000000000')::uuid, 'p99x' || n || '@test',
       json_build_object('pseudo', 'Jetable99x' || n, 'slug', 'jetable99x' || n)::jsonb
from generate_series(1, 3) n;
insert into game_accounts (profile_id, game_id, puuid, riot_game_name, riot_tag_line, region, est_principal, verifie_le, methode_verification)
select ('b33b000' || n || '-0000-0000-0000-000000000000')::uuid, 1, 'P99X-' || n, 'Jetable' || n, 'EUW', 'EUW', true, now(), 'icone_profil'
from generate_series(1, 3) n;
insert into admins (profile_id) values ('00000000-0000-0000-0000-00000000000d') on conflict do nothing;

-- Un duel joué et lu chez Riot entre deux joueurs, avec le niveau de chacun.
create or replace function pg_temp.duel_99x(p_a int, p_b int, p_niveau_a int, p_niveau_b int, p_partie text)
returns uuid
language plpgsql
as $$
declare
  v_defi uuid;
  v_slug text;
  v_match uuid;
  v_a uuid := ('b33b000' || p_a || '-0000-0000-0000-000000000000')::uuid;
  v_b uuid := ('b33b000' || p_b || '-0000-0000-0000-000000000000')::uuid;
begin
  insert into defis (lanceur_id, adversaire_id, expire_le) values (v_a, v_b, now() + interval '1 day')
  returning id into v_defi;
  v_slug := public.creer_duel(v_defi);
  select m.id into v_match from matches m join tournaments t on t.id = m.tournament_id where t.slug = v_slug;
  insert into stats_match_joueur (match_id, profile_id, champion, kills, deaths, assists, cs, or_gagne, duree_secondes, gagne, niveau_compte) values
    (v_match, v_a, 'Ahri', 3, 1, 2, 150, 9000, 1500, true, p_niveau_a),
    (v_match, v_b, 'Zed', 1, 3, 0, 120, 7000, 1500, false, p_niveau_b);
  perform public.enregistrer_verdict_historique(v_match, v_a, p_partie, least(p_niveau_a, p_niveau_b));
  update tournaments set statut = 'termine' where slug = v_slug;
  return v_match;
end;
$$;

select pg_temp.duel_99x(1, 2, 120, 45, 'EUW1_99X1');
select verifie('Deux comptes de niveau 30 ou plus : la partie compte pour une recommandation',
  (select contre = 1 and ensemble = 0
   from public.matchs_communs('b33b0001-0000-0000-0000-000000000000', 'b33b0002-0000-0000-0000-000000000000')));

select pg_temp.duel_99x(1, 3, 120, 7, 'EUW1_99X2');
select verifie('Contre un compte sous le niveau 30 : la partie ne compte pas',
  (select contre = 0 and ensemble = 0
   from public.matchs_communs('b33b0001-0000-0000-0000-000000000000', 'b33b0003-0000-0000-0000-000000000000')));

-- Ligne d'avant la règle (niveau vide) : compte comme avant.
update stats_match_joueur set niveau_compte = null
where profile_id = 'b33b0003-0000-0000-0000-000000000000';
select verifie('Niveau vide (partie d''avant le 23/11/2026) : la partie compte comme avant',
  (select contre = 1
   from public.matchs_communs('b33b0001-0000-0000-0000-000000000000', 'b33b0003-0000-0000-0000-000000000000')));

select refus('Un niveau impossible est refusé',
  $q$update stats_match_joueur set niveau_compte = -1 where profile_id = 'b33b0002-0000-0000-0000-000000000000'$q$,
  'new row for relation "stats_match_joueur" violates check constraint "stats_match_joueur_niveau_compte_check"');

set role anon;
select verifie('Le face-à-face rend le niveau des comptes de chaque match',
  (select bool_and(niveau_compte_min is not null) and count(*) = 1 and min(niveau_compte_min) = 45
   from public.face_a_face('b33b0001-0000-0000-0000-000000000000', 'b33b0002-0000-0000-0000-000000000000')));
select verifie('Match contre un compte sous le niveau 30 : niveau rendu pour la page',
  (select min(niveau_compte_min) = 7
   from public.face_a_face('b33b0001-0000-0000-0000-000000000000', 'b33b0003-0000-0000-0000-000000000000')));
reset role;
