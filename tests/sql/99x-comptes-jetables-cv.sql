-- Comptes jetables sur le CV (23/11/2026, suite du contrôle M4) : une
-- partie jouée avec un compte Riot sous le niveau 30, ou avec un compte
-- Riot qui n'est plus lié au même profil, ne compte pas pour une
-- recommandation, et le face-à-face rend le niveau des comptes.
\set ON_ERROR_STOP 0

insert into auth.users (id, email, raw_user_meta_data)
select ('b33b000' || n || '-0000-0000-0000-000000000000')::uuid, 'p99x' || n || '@test',
       json_build_object('pseudo', 'Jetable99x' || n, 'slug', 'jetable99x' || n)::jsonb
from generate_series(1, 6) n;
insert into game_accounts (profile_id, game_id, puuid, riot_game_name, riot_tag_line, region, est_principal, verifie_le, methode_verification)
select ('b33b000' || n || '-0000-0000-0000-000000000000')::uuid, 1, 'P99X-' || n, 'Jetable' || n, 'EUW', 'EUW', true, now(), 'icone_profil'
from generate_series(1, 6) n;
insert into admins (profile_id) values ('00000000-0000-0000-0000-00000000000d') on conflict do nothing;

-- Un duel joué et lu chez Riot entre deux joueurs, avec le niveau de chacun
-- (et le compte Riot qui a joué). Le niveau gardé avec le verdict est le
-- plus bas des deux.
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
  insert into stats_match_joueur (match_id, profile_id, puuid, champion, kills, deaths, assists, cs, or_gagne, duree_secondes, gagne, niveau_compte) values
    (v_match, v_a, 'P99X-' || p_a, 'Ahri', 3, 1, 2, 150, 9000, 1500, true, p_niveau_a),
    (v_match, v_b, 'P99X-' || p_b, 'Zed', 1, 3, 0, 120, 7000, 1500, false, p_niveau_b);
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

-- Fiche écrite sans niveau (pendant la mise en ligne) : le niveau gardé avec
-- le verdict 1v1 suffit à l'écarter.
update stats_match_joueur set niveau_compte = null
where profile_id = 'b33b0003-0000-0000-0000-000000000000';
select verifie('Fiche sans niveau, mais verdict 1v1 sous le niveau 30 : ne compte toujours pas',
  (select contre = 0
   from public.matchs_communs('b33b0001-0000-0000-0000-000000000000', 'b33b0003-0000-0000-0000-000000000000')));

-- Partie d'avant la règle : aucun niveau nulle part, elle compte comme avant.
-- (Depuis le 23/11/2026, la base refuse un tel verdict : on l'imite en
-- coupant la règle le temps de l'écrire.)
alter table match_verdicts disable trigger niveau_compte_verdict;
select pg_temp.duel_99x(4, 5, null, null, 'EUW1_99X3');
alter table match_verdicts enable trigger niveau_compte_verdict;
select verifie('Aucun niveau connu (partie d''avant le 22/11/2026) : compte comme avant',
  (select contre = 1
   from public.matchs_communs('b33b0004-0000-0000-0000-000000000000', 'b33b0005-0000-0000-0000-000000000000')));

select refus('Un niveau impossible est refusé',
  $q$update stats_match_joueur set niveau_compte = -1 where profile_id = 'b33b0002-0000-0000-0000-000000000000'$q$,
  'new row for relation "stats_match_joueur" violates check constraint "stats_match_joueur_niveau_compte_check"');

-- ---- Un compte Riot recyclé de profil en profil ----
set role authenticated;
select en_tant_que('b33b0001-0000-0000-0000-000000000000');
select essai('Le joueur 1 recommande le joueur 2 (partie lue chez Riot ensemble)',
  $q$select public.recommander('b33b0002-0000-0000-0000-000000000000', 'Adversaire régulier, à l''heure et fair-play.') where true$q$,
  'passe');
reset role;
select verifie('La recommandation est affichée',
  (select count(*) = 1 from public.recommandations_joueur('b33b0002-0000-0000-0000-000000000000')));

-- Le compte Riot du joueur 1 quitte son profil pour un autre.
delete from game_accounts where profile_id = 'b33b0001-0000-0000-0000-000000000000';
insert into game_accounts (profile_id, game_id, puuid, riot_game_name, riot_tag_line, region, est_principal, verifie_le, methode_verification)
values ('b33b0006-0000-0000-0000-000000000000', 1, 'P99X-1', 'Jetable1', 'EUW', 'EUW', false, now(), 'icone_profil');
select verifie('Compte Riot délié : ses parties ne comptent plus pour le joueur 1',
  (select ensemble + contre = 0
   from public.matchs_communs('b33b0001-0000-0000-0000-000000000000', 'b33b0002-0000-0000-0000-000000000000')));
select verifie('… et sa recommandation n''est plus affichée',
  (select count(*) = 0 from public.recommandations_joueur('b33b0002-0000-0000-0000-000000000000')));
select verifie('Le profil qui a repris le compte n''hérite pas des parties jouées avant',
  (select ensemble + contre = 0
   from public.matchs_communs('b33b0006-0000-0000-0000-000000000000', 'b33b0002-0000-0000-0000-000000000000')));

-- Le compte revient au joueur 1 : la recommandation revient.
delete from game_accounts where puuid = 'P99X-1';
insert into game_accounts (profile_id, game_id, puuid, riot_game_name, riot_tag_line, region, est_principal, verifie_le, methode_verification)
values ('b33b0001-0000-0000-0000-000000000000', 1, 'P99X-1', 'Jetable1', 'EUW', 'EUW', true, now(), 'icone_profil');
select verifie('Compte Riot relié et vérifié : la recommandation revient',
  (select count(*) = 1 from public.recommandations_joueur('b33b0002-0000-0000-0000-000000000000')));
update game_accounts set verifie_le = null where puuid = 'P99X-1';
select verifie('Compte Riot relié mais pas vérifié : ne compte pas',
  (select ensemble + contre = 0
   from public.matchs_communs('b33b0001-0000-0000-0000-000000000000', 'b33b0002-0000-0000-0000-000000000000')));
update game_accounts set verifie_le = now() where puuid = 'P99X-1';

-- ---- Coéquipiers d'une partie 5v5 (niveau lu joueur par joueur) ----
do $$
declare v_match uuid;
begin
  v_match := pg_temp.duel_99x(4, 2, 80, 60, 'EUW1_99X4');
  insert into stats_match_joueur (match_id, profile_id, puuid, champion, kills, deaths, assists, cs, or_gagne, duree_secondes, gagne, niveau_compte) values
    (v_match, 'b33b0003-0000-0000-0000-000000000000', 'P99X-3', 'Lux', 0, 1, 9, 30, 6000, 1500, true, 50),
    (v_match, 'b33b0006-0000-0000-0000-000000000000', 'P99X-6', 'Leona', 0, 2, 7, 20, 5000, 1500, true, 5);
end $$;
select verifie('5v5 : deux coéquipiers de niveau 30 ou plus, la partie compte « ensemble »',
  (select ensemble = 1
   from public.matchs_communs('b33b0004-0000-0000-0000-000000000000', 'b33b0003-0000-0000-0000-000000000000')));
select verifie('5v5 : un coéquipier sous le niveau 30 ne compte pas',
  (select ensemble = 0
   from public.matchs_communs('b33b0004-0000-0000-0000-000000000000', 'b33b0006-0000-0000-0000-000000000000')));

-- ---- Un joueur n'écrit jamais son niveau ----
set role authenticated;
select en_tant_que('b33b0003-0000-0000-0000-000000000000');
select essai('Un joueur ne remonte pas le niveau gardé de sa partie',
  $q$update stats_match_joueur set niveau_compte = 200 where profile_id = 'b33b0003-0000-0000-0000-000000000000'$q$,
  'bloque');
select essai('Un joueur n''écrit pas de fiche de partie',
  $q$insert into stats_match_joueur (match_id, profile_id, champion, kills, deaths, assists, cs, or_gagne, duree_secondes, gagne, niveau_compte)
     select match_id, 'b33b0003-0000-0000-0000-000000000000', 'Ahri', 9, 0, 9, 300, 15000, 1500, true, 300
     from stats_match_joueur where profile_id = 'b33b0001-0000-0000-0000-000000000000' limit 1$q$,
  'bloque');
reset role;
select verifie('Le niveau gardé n''a pas bougé',
  (select bool_and(niveau_compte is distinct from 200) from stats_match_joueur
   where profile_id = 'b33b0003-0000-0000-0000-000000000000'));

set role anon;
select verifie('Le face-à-face rend le niveau des comptes de chaque match',
  (select bool_and(niveau_compte_min is not null) and count(*) = 1 and min(niveau_compte_min) = 45
   from public.face_a_face('b33b0001-0000-0000-0000-000000000000', 'b33b0002-0000-0000-0000-000000000000')));
select verifie('Match contre un compte sous le niveau 30 : niveau rendu pour la page',
  (select min(niveau_compte_min) = 7
   from public.face_a_face('b33b0001-0000-0000-0000-000000000000', 'b33b0003-0000-0000-0000-000000000000')));
reset role;
