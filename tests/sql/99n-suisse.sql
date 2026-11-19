-- Tournois au format suisse (19/11/2026).
\set ON_ERROR_STOP 0

-- Org organise ; sept joueurs confirmés (nombre impair : une exemption par
-- ronde), ratings à l'inscription de 1700 (J1) à 1100 (J7).
insert into auth.users (id, email, raw_user_meta_data)
select ('9e0e0000-0000-0000-0000-00000000000' || n)::uuid, 'p99n' || n || '@test',
       json_build_object('pseudo', 'Suisse99n' || n, 'slug', 'suisse99n' || n)::jsonb
from generate_series(0, 7) n;

set role authenticated;
select en_tant_que('9e0e0000-0000-0000-0000-000000000000');
select essai('Org crée un tournoi 1v1 au format suisse',
  $q$insert into tournaments (id, game_id, organisateur_id, slug, nom, format, type_bracket, capacite, region, debute_le, checkin_ouvre_le, statut)
     values ('9e0e0000-0000-0000-0000-0000000000a1', 1, '9e0e0000-0000-0000-0000-000000000000', 'coupe-suisse-99n', 'Coupe suisse', '1v1', 'suisse', 8, 'EUW',
             now() + interval '1 hour', now() - interval '1 hour', 'ouvert')$q$,
  'passe');
select refus('Pas de format suisse en 5v5',
  $q$insert into tournaments (game_id, organisateur_id, slug, nom, format, type_bracket, capacite, region, debute_le, checkin_ouvre_le, statut, compte_pour_classement)
     values (1, '9e0e0000-0000-0000-0000-000000000000', 'coupe-suisse-5v5', 'Coupe suisse 5v5', '5v5', 'suisse', 8, 'EUW', now() + interval '1 hour', now(), 'ouvert', false)$q$,
  'SUISSE_1V1_SEULEMENT');
select refus('Le nombre de rondes ne se fixe pas soi-même',
  $q$insert into tournaments (game_id, organisateur_id, slug, nom, format, type_bracket, rondes, capacite, region, debute_le, checkin_ouvre_le, statut)
     values (1, '9e0e0000-0000-0000-0000-000000000000', 'coupe-suisse-rondes', 'Coupe suisse rondes', '1v1', 'suisse', 5, 8, 'EUW', now() + interval '1 hour', now(), 'ouvert')$q$,
  'CHAMP_RESERVE');
select refus('Lancement sans joueurs confirmés',
  $q$select public.demarrer_suisse('9e0e0000-0000-0000-0000-0000000000a1')$q$,
  'PAS_ASSEZ_DE_JOUEURS');
reset role;

insert into registrations (tournament_id, profile_id, statut, rating_a_inscription)
select '9e0e0000-0000-0000-0000-0000000000a1', ('9e0e0000-0000-0000-0000-00000000000' || n)::uuid, 'confirme', 1800 - n * 100
from generate_series(1, 7) n;

set role authenticated;
select en_tant_que('9e0e0000-0000-0000-0000-000000000001');
select refus('Seul l''organisateur lance le tournoi',
  $q$select public.demarrer_suisse('9e0e0000-0000-0000-0000-0000000000a1')$q$,
  'TOURNOI_INTROUVABLE');
select en_tant_que('9e0e0000-0000-0000-0000-000000000000');
select verifie('Org lance : 3 rondes pour 7 joueurs',
  (select public.demarrer_suisse('9e0e0000-0000-0000-0000-0000000000a1') = 3));
select refus('Pas de second lancement',
  $q$select public.demarrer_suisse('9e0e0000-0000-0000-0000-0000000000a1')$q$,
  'TOURNOI_DEJA_LANCE');
reset role;

select verifie('Ronde 1 : J1-J4, J2-J5, J3-J6 en cours ; J7 (le plus bas) exempté, victoire manuelle',
  (select count(*) = 4 from matches where tournament_id = '9e0e0000-0000-0000-0000-0000000000a1' and tour = 1)
  and (select array_agg(p order by p) from (
         select string_agg(right(mp.profile_id::text, 1), '-' order by mp.slot) as p
         from matches m join match_participants mp on mp.match_id = m.id
         where m.tournament_id = '9e0e0000-0000-0000-0000-0000000000a1' and m.tour = 1
         group by m.id) x) = array['1-4', '2-5', '3-6', '7']
  and (select v.niveau = 'manuel' and m.statut = 'termine'
       from matches m join match_verdicts v on v.match_id = m.id
       join match_participants mp on mp.match_id = m.id
       where m.tournament_id = '9e0e0000-0000-0000-0000-0000000000a1' and m.tour = 1
         and mp.profile_id = '9e0e0000-0000-0000-0000-000000000007'));

-- Joue une ronde : le joueur du premier emplacement gagne, lu chez Riot.
create or replace function pg_temp.jouer_ronde(p_tour smallint) returns void language plpgsql as $$
declare r record;
begin
  for r in
    select m.id, (select mp.profile_id from match_participants mp where mp.match_id = m.id and mp.slot = 1) as gagnant
    from matches m
    where m.tournament_id = '9e0e0000-0000-0000-0000-0000000000a1' and m.tour = p_tour and m.statut = 'en_cours'
    order by m.position
  loop
    perform public.enregistrer_verdict_historique(r.id, r.gagnant, 'EUW_99N_' || p_tour || '_' || left(r.id::text, 8));
  end loop;
end $$;

select pg_temp.jouer_ronde(1::smallint);
select verifie('Ronde 1 jouée : la ronde 2 est créée d''elle-même (3 matchs et une exemption)',
  (select count(*) = 4 from matches where tournament_id = '9e0e0000-0000-0000-0000-0000000000a1' and tour = 2));
select verifie('Ronde 2 : aucune revanche de la ronde 1',
  not exists (
    select 1 from matches m2
    join match_participants a2 on a2.match_id = m2.id
    join match_participants b2 on b2.match_id = m2.id and b2.profile_id > a2.profile_id
    join match_participants a1 on a1.profile_id = a2.profile_id
    join match_participants b1 on b1.match_id = a1.match_id and b1.profile_id = b2.profile_id
    join matches m1 on m1.id = a1.match_id and m1.tour = 1 and m1.tournament_id = m2.tournament_id
    where m2.tournament_id = '9e0e0000-0000-0000-0000-0000000000a1' and m2.tour = 2));
select verifie('Ronde 2 : J7, déjà exempté, ne l''est pas une seconde fois',
  not exists (
    select 1 from matches m join match_participants mp on mp.match_id = m.id
    where m.tournament_id = '9e0e0000-0000-0000-0000-0000000000a1' and m.tour = 2
      and mp.profile_id = '9e0e0000-0000-0000-0000-000000000007'
      and (select count(*) from match_participants x where x.match_id = m.id) = 1));
select verifie('Les vainqueurs de la ronde 1 se rencontrent : J1 joue un autre gagnant',
  (select bool_and(gagnants.v = 1) from (
     select (select victoires from public.classement_suisse('9e0e0000-0000-0000-0000-0000000000a1') c where c.profile_id = adv.profile_id) as v
     from matches m
     join match_participants moi on moi.match_id = m.id and moi.profile_id = '9e0e0000-0000-0000-0000-000000000001'
     join match_participants adv on adv.match_id = m.id and adv.profile_id <> moi.profile_id
     where m.tournament_id = '9e0e0000-0000-0000-0000-0000000000a1' and m.tour = 2) gagnants));
select verifie('Pas encore terminé', not public.suisse_terminee('9e0e0000-0000-0000-0000-0000000000a1'));

select pg_temp.jouer_ronde(2::smallint);
select pg_temp.jouer_ronde(3::smallint);
select verifie('Trois rondes jouées : tournoi terminé, pas de quatrième ronde',
  public.suisse_terminee('9e0e0000-0000-0000-0000-0000000000a1')
  and not exists (select 1 from matches where tournament_id = '9e0e0000-0000-0000-0000-0000000000a1' and tour = 4));
select verifie('Classement : J1 premier avec 3 victoires ; 7 joueurs, 21 matchs-joueurs (exemptions comprises)',
  (select profile_id = '9e0e0000-0000-0000-0000-000000000001' and victoires = 3 and defaites = 0
   from public.classement_suisse('9e0e0000-0000-0000-0000-0000000000a1') where rang = 1)
  and (select count(*) = 7 and sum(victoires + defaites) = 21 from public.classement_suisse('9e0e0000-0000-0000-0000-0000000000a1')));

select refus('Pas de pronostic sur un match suisse',
  $q$insert into pronostics (match_id, profile_id, gagnant_prevu)
     select m.id, '9e0e0000-0000-0000-0000-000000000000', mp.profile_id
     from matches m join match_participants mp on mp.match_id = m.id and mp.slot = 1
     where m.tournament_id = '9e0e0000-0000-0000-0000-0000000000a1' and m.tour = 3 limit 1$q$,
  'PRONOSTIC_HORS_PHASE');

-- L'élimination directe n'a pas changé : avancer_vainqueur pour un
-- tournoi ordinaire ne crée aucune ronde.
select verifie('Un tournoi en élimination directe n''est pas touché',
  (select public.ronde_suisse_suivante(t.id) is null from tournaments t where t.type_bracket = 'elim_simple' limit 1));

select refus('Pas de dotation sur un tournoi suisse',
  $q$insert into dotations (tournament_id, sponsor_nom, repartition, cree_par)
     values ('9e0e0000-0000-0000-0000-0000000000a1', 'Sponsor', array[1000], '9e0e0000-0000-0000-0000-000000000000')$q$,
  'DOTATION_SUISSE_INDISPONIBLE');

-- ---------- Contrôle de sécurité du 19/11/2026 ----------

-- Inscriptions figées une fois le tournoi lancé : l'organisateur ne retire
-- pas le premier du classement en le déclarant absent.
set role authenticated;
select en_tant_que('9e0e0000-0000-0000-0000-000000000000');
select refus('L''organisateur ne passe pas J1 « absent » une fois le tournoi lancé',
  $q$update registrations set statut = 'absent'
     where tournament_id = '9e0e0000-0000-0000-0000-0000000000a1' and profile_id = '9e0e0000-0000-0000-0000-000000000001'$q$,
  'INSCRIPTIONS_FIGEES');
reset role;
-- Même forcé par le serveur, le classement suit les matchs, pas les inscriptions.
update registrations set statut = 'absent'
where tournament_id = '9e0e0000-0000-0000-0000-0000000000a1' and profile_id = '9e0e0000-0000-0000-0000-000000000001';
select verifie('Le classement ne bouge pas : J1 reste premier, 7 joueurs',
  (select profile_id = '9e0e0000-0000-0000-0000-000000000001' from public.classement_suisse('9e0e0000-0000-0000-0000-0000000000a1') where rang = 1)
  and (select count(*) = 7 from public.classement_suisse('9e0e0000-0000-0000-0000-0000000000a1')));
select verifie('J1, placé dans les matchs d''un tournoi en cours, reste engagé (pas de changement de compte Riot principal)',
  public.engage_en_tournoi('9e0e0000-0000-0000-0000-000000000001', 1::smallint));
select verifie('Toutes les rondes jouées : la clôture fige le classement du tournoi',
  public.figer_classement_tournoi('9e0e0000-0000-0000-0000-0000000000a1') is not null);
select essai('Toutes les rondes jouées : le tournoi passe « terminé »',
  $q$update tournaments set statut = 'termine' where id = '9e0e0000-0000-0000-0000-0000000000a1'$q$,
  'passe');
set role authenticated;
select en_tant_que('9e0e0000-0000-0000-0000-000000000000');
select refus('Tournoi terminé : inscriptions toujours figées',
  $q$update registrations set statut = 'confirme'
     where tournament_id = '9e0e0000-0000-0000-0000-0000000000a1' and profile_id = '9e0e0000-0000-0000-0000-000000000001'$q$,
  'INSCRIPTIONS_FIGEES');

-- Un second tournoi suisse : lancé seulement par demarrer_suisse, jamais
-- clos avant sa dernière ronde.
select essai('Org crée un second tournoi suisse',
  $q$insert into tournaments (id, game_id, organisateur_id, slug, nom, format, type_bracket, capacite, region, debute_le, checkin_ouvre_le, statut)
     values ('9e0e0000-0000-0000-0000-0000000000a2', 1, '9e0e0000-0000-0000-0000-000000000000', 'coupe-suisse-99n-b', 'Coupe suisse bis', '1v1', 'suisse', 4, 'EUW',
             now() + interval '1 hour', now() - interval '1 hour', 'ouvert')$q$,
  'passe');
reset role;
insert into registrations (tournament_id, profile_id, statut, rating_a_inscription)
select '9e0e0000-0000-0000-0000-0000000000a2', ('9e0e0000-0000-0000-0000-00000000000' || n)::uuid, 'confirme', 1800 - n * 100
from generate_series(1, 4) n;
set role authenticated;
select en_tant_que('9e0e0000-0000-0000-0000-000000000000');
select refus('Pas de match inséré à la main dans un tournoi suisse',
  $q$insert into matches (tournament_id, tour, position, match_suivant_id) values ('9e0e0000-0000-0000-0000-0000000000a2', 2, 1, null)$q$,
  'BRACKET_SUISSE_RESERVE');
select refus('Pas de lancement « à la main » d''un tournoi suisse',
  $q$update tournaments set statut = 'en_cours' where id = '9e0e0000-0000-0000-0000-0000000000a2'$q$,
  'LANCEMENT_SUISSE_RESERVE');
select verifie('demarrer_suisse lance : 2 rondes pour 4 joueurs',
  (select public.demarrer_suisse('9e0e0000-0000-0000-0000-0000000000a2') = 2));
select refus('Tournoi lancé : l''organisateur ne déclare plus un joueur absent',
  $q$update registrations set statut = 'absent'
     where tournament_id = '9e0e0000-0000-0000-0000-0000000000a2' and profile_id = '9e0e0000-0000-0000-0000-000000000004'$q$,
  'INSCRIPTIONS_FIGEES');
reset role;
select refus('Après la ronde 1 seulement : pas de clôture du classement',
  $q$select public.figer_classement_tournoi('9e0e0000-0000-0000-0000-0000000000a2')$q$,
  'SUISSE_NON_TERMINEE');
select refus('Après la ronde 1 seulement : pas de passage à « terminé », même par le serveur',
  $q$update tournaments set statut = 'termine' where id = '9e0e0000-0000-0000-0000-0000000000a2'$q$,
  'SUISSE_NON_TERMINEE');

-- ---------- Abandon officiel (finitions du 19/11/2026) ----------
-- Cinq joueurs, trois rondes : ronde 1 = J1-J3, J2-J4, J5 exempté.
insert into tournaments (id, game_id, organisateur_id, slug, nom, format, type_bracket, capacite, region, debute_le, checkin_ouvre_le, statut)
values ('9e0e0000-0000-0000-0000-0000000000a3', 1, '9e0e0000-0000-0000-0000-000000000000', 'coupe-suisse-99n-c', 'Coupe suisse ter', '1v1', 'suisse', 8, 'EUW',
        now() + interval '1 hour', now() - interval '1 hour', 'ouvert');
insert into registrations (tournament_id, profile_id, statut, rating_a_inscription)
select '9e0e0000-0000-0000-0000-0000000000a3', ('9e0e0000-0000-0000-0000-00000000000' || n)::uuid, 'confirme', 1800 - n * 100
from generate_series(1, 5) n;
set role authenticated;
select en_tant_que('9e0e0000-0000-0000-0000-000000000000');
select verifie('Coupe à cinq lancée : 3 rondes', (select public.demarrer_suisse('9e0e0000-0000-0000-0000-0000000000a3') = 3));
select refus('L''organisateur, qui ne joue pas, n''abandonne pas',
  $q$select public.abandonner_suisse('9e0e0000-0000-0000-0000-0000000000a3')$q$,
  'NON_PARTICIPANT');
select en_tant_que('9e0e0000-0000-0000-0000-000000000002');
select verifie('J2 abandonne en ronde 1 : son match est tranché',
  public.abandonner_suisse('9e0e0000-0000-0000-0000-0000000000a3') is not null);
select refus('J2 n''abandonne pas deux fois',
  $q$select public.abandonner_suisse('9e0e0000-0000-0000-0000-0000000000a3')$q$,
  'DEJA_ABANDONNE');
reset role;
select verifie('Match J2-J4 : J4 gagne par forfait, décision manuelle motivée « Abandon »',
  (select m.statut = 'forfait' and v.niveau = 'manuel' and v.gagnant_id = '9e0e0000-0000-0000-0000-000000000004'
          and v.motif like 'Abandon : Suisse99n2%'
   from matches m join match_verdicts v on v.match_id = m.id
   join match_participants mp on mp.match_id = m.id and mp.profile_id = '9e0e0000-0000-0000-0000-000000000002'
   where m.tournament_id = '9e0e0000-0000-0000-0000-0000000000a3' and m.tour = 1));
set role authenticated;
select en_tant_que('9e0e0000-0000-0000-0000-000000000003');
select verifie('J3 abandonne aussi : J1 gagne', public.abandonner_suisse('9e0e0000-0000-0000-0000-0000000000a3') is not null);
reset role;
select verifie('Ronde 1 complète : la ronde 2 se crée sans J2 ni J3 — J1 contre J5, J4 exempté (J5 l''a déjà été)',
  (select array_agg(p order by p) = array['1-5', '4'] from (
     select string_agg(right(mp.profile_id::text, 1), '-' order by mp.profile_id) as p
     from matches m join match_participants mp on mp.match_id = m.id
     where m.tournament_id = '9e0e0000-0000-0000-0000-0000000000a3' and m.tour = 2
     group by m.id) x));
set role authenticated;
select en_tant_que('9e0e0000-0000-0000-0000-000000000004');
select verifie('J4, exempté de la ronde 2, abandonne : aucun match à trancher',
  public.abandonner_suisse('9e0e0000-0000-0000-0000-0000000000a3') is null);
reset role;
select verifie('Le classement garde les abandons, marqués comme tels',
  (select count(*) = 5 and count(*) filter (where abandon) = 3 from public.classement_suisse('9e0e0000-0000-0000-0000-0000000000a3')));
set role authenticated;
select en_tant_que('9e0e0000-0000-0000-0000-000000000005');
select verifie('J5 abandonne en ronde 2 : J1 gagne', public.abandonner_suisse('9e0e0000-0000-0000-0000-0000000000a3') is not null);
reset role;
select verifie('Plus qu''un joueur en lice : le tournoi s''arrête après la ronde 2 (terminé, pas de ronde 3)',
  public.suisse_terminee('9e0e0000-0000-0000-0000-0000000000a3')
  and (select rondes = 2 from tournaments where id = '9e0e0000-0000-0000-0000-0000000000a3')
  and not exists (select 1 from matches where tournament_id = '9e0e0000-0000-0000-0000-0000000000a3' and tour = 3));
select verifie('J1 premier', (select profile_id = '9e0e0000-0000-0000-0000-000000000001' from public.classement_suisse('9e0e0000-0000-0000-0000-0000000000a3') where rang = 1));
set role authenticated;
select en_tant_que('9e0e0000-0000-0000-0000-000000000001');
select refus('Pas d''abandon dans un tournoi en élimination directe',
  $q$select public.abandonner_suisse((select id from tournaments where type_bracket = 'elim_simple' limit 1))$q$,
  'PAS_UN_TOURNOI_SUISSE');
reset role;
