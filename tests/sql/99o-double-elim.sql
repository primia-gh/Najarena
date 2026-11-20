-- Tournois en double élimination (20/11/2026).
\set ON_ERROR_STOP 0

-- Org organise ; J1 à J6, ratings à l'inscription de 1700 (J1) à 1200 (J6).
insert into auth.users (id, email, raw_user_meta_data)
select ('9f0f0000-0000-0000-0000-00000000000' || n)::uuid, 'p99o' || n || '@test',
       json_build_object('pseudo', 'Double99o' || n, 'slug', 'double99o' || n)::jsonb
from generate_series(0, 6) n;

set role authenticated;
select en_tant_que('9f0f0000-0000-0000-0000-000000000000');
select essai('Org crée un tournoi 1v1 en double élimination (8 places)',
  $q$insert into tournaments (id, game_id, organisateur_id, slug, nom, format, type_bracket, capacite, region, debute_le, checkin_ouvre_le, statut)
     values ('9f0f0000-0000-0000-0000-0000000000a1', 1, '9f0f0000-0000-0000-0000-000000000000', 'coupe-double-99o', 'Coupe double', '1v1', 'double_elim', 8, 'EUW',
             now() + interval '1 hour', now() - interval '1 hour', 'ouvert')$q$,
  'passe');
select refus('Pas de double élimination en 5v5',
  $q$insert into tournaments (game_id, organisateur_id, slug, nom, format, type_bracket, capacite, region, debute_le, checkin_ouvre_le, statut, compte_pour_classement)
     values (1, '9f0f0000-0000-0000-0000-000000000000', 'coupe-double-5v5', 'Coupe double cinq', '5v5', 'double_elim', 8, 'EUW', now() + interval '1 hour', now(), 'ouvert', false)$q$,
  'DOUBLE_1V1_SEULEMENT');
select refus('Pas de match écrit à la main dans une double élimination',
  $q$insert into matches (tournament_id, tour, position, match_suivant_id) values ('9f0f0000-0000-0000-0000-0000000000a1', 3, 1, null)$q$,
  'BRACKET_DOUBLE_RESERVE');
select refus('Pas de lancement sans la base',
  $q$update tournaments set statut = 'en_cours' where id = '9f0f0000-0000-0000-0000-0000000000a1'$q$,
  'LANCEMENT_DOUBLE_RESERVE');
reset role;

insert into registrations (tournament_id, profile_id, statut, rating_a_inscription)
select '9f0f0000-0000-0000-0000-0000000000a1', ('9f0f0000-0000-0000-0000-00000000000' || n)::uuid, 'confirme', 1800 - n * 100
from generate_series(1, 3) n;
set role authenticated;
select en_tant_que('9f0f0000-0000-0000-0000-000000000000');
select refus('Trois joueurs confirmés : pas assez',
  $q$select public.demarrer_double_elim('9f0f0000-0000-0000-0000-0000000000a1')$q$,
  'PAS_ASSEZ_DE_JOUEURS');
reset role;
insert into registrations (tournament_id, profile_id, statut, rating_a_inscription)
select '9f0f0000-0000-0000-0000-0000000000a1', ('9f0f0000-0000-0000-0000-00000000000' || n)::uuid, 'confirme', 1800 - n * 100
from generate_series(4, 6) n;
set role authenticated;
select en_tant_que('9f0f0000-0000-0000-0000-000000000001');
select refus('Seul l''organisateur lance',
  $q$select public.demarrer_double_elim('9f0f0000-0000-0000-0000-0000000000a1')$q$,
  'TOURNOI_INTROUVABLE');
select en_tant_que('9f0f0000-0000-0000-0000-000000000000');
select verifie('Six joueurs : tableau de 8, 3 tours chez les gagnants',
  (select public.demarrer_double_elim('9f0f0000-0000-0000-0000-0000000000a1') = 3));
select refus('Pas de second lancement',
  $q$select public.demarrer_double_elim('9f0f0000-0000-0000-0000-0000000000a1')$q$,
  'TOURNOI_DEJA_LANCE');
select refus('L''organisateur ne déplace pas la route d''un perdant',
  $q$update matches set match_perdant_suivant_id = null where tournament_id = '9f0f0000-0000-0000-0000-0000000000a1' and tableau = 'gagnants' and tour = 1 and position = 2$q$,
  'CHAMP_RESERVE');
reset role;

select verifie('Structure : 7 matchs chez les gagnants, 6 chez les perdants, 1 grande finale',
  (select count(*) filter (where tableau = 'gagnants') = 7
      and count(*) filter (where tableau = 'perdants') = 6
      and count(*) filter (where tableau = 'finale') = 1
   from matches where tournament_id = '9f0f0000-0000-0000-0000-0000000000a1'));
select verifie('Seule la grande finale n''a pas de match suivant ; chaque match des gagnants envoie son perdant chez les perdants',
  (select array_agg(tableau) = array['finale'] from matches
   where tournament_id = '9f0f0000-0000-0000-0000-0000000000a1' and match_suivant_id is null)
  and not exists (select 1 from matches where tournament_id = '9f0f0000-0000-0000-0000-0000000000a1'
                  and tableau = 'gagnants' and match_perdant_suivant_id is null));
select verifie('Têtes de série 1 et 2 (J1, J2) exemptées du premier tour ; J4-J5 et J3-J6 en cours',
  (select count(*) = 2 from matches m join match_verdicts v on v.match_id = m.id
   where m.tournament_id = '9f0f0000-0000-0000-0000-0000000000a1' and m.tableau = 'gagnants' and m.tour = 1
     and v.niveau = 'manuel' and v.gagnant_id in ('9f0f0000-0000-0000-0000-000000000001', '9f0f0000-0000-0000-0000-000000000002'))
  and (select array_agg(p order by p) = array['3-6', '4-5'] from (
         select string_agg(right(mp.profile_id::text, 1), '-' order by mp.profile_id) as p
         from matches m join match_participants mp on mp.match_id = m.id
         where m.tournament_id = '9f0f0000-0000-0000-0000-0000000000a1' and m.tableau = 'gagnants' and m.tour = 1 and m.statut = 'en_cours'
         group by m.id) x));

select refus('Pas de pronostic en double élimination',
  $q$insert into pronostics (match_id, profile_id, gagnant_prevu)
     select m.id, '9f0f0000-0000-0000-0000-000000000000', mp.profile_id
     from matches m join match_participants mp on mp.match_id = m.id and mp.slot = 1
     where m.tournament_id = '9f0f0000-0000-0000-0000-0000000000a1' and m.statut = 'en_cours' limit 1$q$,
  'PRONOSTIC_HORS_PHASE');
select refus('Pas de dotation en double élimination',
  $q$insert into dotations (tournament_id, sponsor_nom, repartition, cree_par)
     values ('9f0f0000-0000-0000-0000-0000000000a1', 'Sponsor', array[1000], '9f0f0000-0000-0000-0000-000000000000')$q$,
  'DOTATION_DOUBLE_INDISPONIBLE');

-- Joue tout le tournoi : à chaque match ouvert, le joueur du premier
-- emplacement gagne, lu chez Riot.
create or replace function pg_temp.jouer_double(p_t uuid) returns integer language plpgsql as $$
declare v_m uuid; v_g uuid; i integer := 0;
begin
  loop
    v_m := null;
    select m.id into v_m from matches m where m.tournament_id = p_t and m.statut = 'en_cours' order by m.tour, m.position limit 1;
    exit when v_m is null or i > 60;
    select profile_id into v_g from match_participants where match_id = v_m and slot = 1;
    perform public.enregistrer_verdict_historique(v_m, v_g, 'EUW_99O_' || replace(v_m::text, '-', ''));
    i := i + 1;
  end loop;
  return i;
end $$;

select verifie('Le tournoi se joue jusqu''au bout : 10 matchs disputés', pg_temp.jouer_double('9f0f0000-0000-0000-0000-0000000000a1') = 10);
select verifie('Tous les matchs sont clos, grande finale comprise',
  not exists (select 1 from matches where tournament_id = '9f0f0000-0000-0000-0000-0000000000a1' and statut not in ('termine', 'forfait'))
  and (select count(*) = 1 from matches m join match_verdicts v on v.match_id = m.id
       where m.tournament_id = '9f0f0000-0000-0000-0000-0000000000a1' and m.tableau = 'finale'));
select verifie('Chaque joueur battu l''a été deux fois, sauf le vainqueur : 10 défaites pour 5 éliminés',
  (select count(*) = 5 and bool_and(d = 2) from (
     select mp.profile_id, count(*) filter (where mp.est_gagnant is false) as d
     from matches m join match_participants mp on mp.match_id = m.id
     where m.tournament_id = '9f0f0000-0000-0000-0000-0000000000a1'
     group by mp.profile_id having count(*) filter (where mp.est_gagnant is false) > 0) x)
  and (select count(*) = 1 from (
     select mp.profile_id
     from matches m join match_participants mp on mp.match_id = m.id
     where m.tournament_id = '9f0f0000-0000-0000-0000-0000000000a1'
     group by mp.profile_id having count(*) filter (where mp.est_gagnant is false) = 0) y));
select verifie('Clôture possible : la grande finale est jouée',
  public.figer_classement_tournoi('9f0f0000-0000-0000-0000-0000000000a1') is not null);

-- Cinq joueurs dans un tableau de 8 : trois exemptions au premier tour, un
-- match du tableau des perdants sans aucun joueur (clos vide).
insert into tournaments (id, game_id, organisateur_id, slug, nom, format, type_bracket, capacite, region, debute_le, checkin_ouvre_le, statut)
values ('9f0f0000-0000-0000-0000-0000000000a2', 1, '9f0f0000-0000-0000-0000-000000000000', 'coupe-double-99o-b', 'Coupe double bis', '1v1', 'double_elim', 8, 'EUW',
        now() + interval '1 hour', now() - interval '1 hour', 'ouvert');
insert into registrations (tournament_id, profile_id, statut, rating_a_inscription)
select '9f0f0000-0000-0000-0000-0000000000a2', ('9f0f0000-0000-0000-0000-00000000000' || n)::uuid, 'confirme', 1800 - n * 100
from generate_series(1, 5) n;
set role authenticated;
select en_tant_que('9f0f0000-0000-0000-0000-000000000000');
select verifie('Cinq joueurs : lancé', (select public.demarrer_double_elim('9f0f0000-0000-0000-0000-0000000000a2') = 3));
reset role;
select verifie('Un match du tableau des perdants sans aucun joueur est clos vide d''emblée',
  (select count(*) >= 1 from matches m
   where m.tournament_id = '9f0f0000-0000-0000-0000-0000000000a2' and m.tableau = 'perdants' and m.statut = 'termine'
     and not exists (select 1 from match_participants x where x.match_id = m.id)));
select verifie('Le tournoi à cinq se joue jusqu''au bout : 8 matchs disputés', pg_temp.jouer_double('9f0f0000-0000-0000-0000-0000000000a2') = 8);
select verifie('Grande finale jouée, quatre éliminés battus deux fois',
  (select count(*) = 1 from matches m join match_verdicts v on v.match_id = m.id
   where m.tournament_id = '9f0f0000-0000-0000-0000-0000000000a2' and m.tableau = 'finale')
  and (select count(*) = 4 and bool_and(d = 2) from (
     select mp.profile_id, count(*) filter (where mp.est_gagnant is false) as d
     from matches m join match_participants mp on mp.match_id = m.id
     where m.tournament_id = '9f0f0000-0000-0000-0000-0000000000a2'
     group by mp.profile_id having count(*) filter (where mp.est_gagnant is false) > 0) x));

select verifie('L''élimination directe ne change pas : aucun match d''un tournoi ordinaire n''a de tableau',
  not exists (select 1 from matches m join tournaments t on t.id = m.tournament_id
              where t.type_bracket = 'elim_simple' and (m.tableau is not null or m.match_perdant_suivant_id is not null)));
