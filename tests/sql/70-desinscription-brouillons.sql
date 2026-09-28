-- Désinscription et brouillons privés (audit M7, F2).
\set ON_ERROR_STOP 0

insert into tournaments (id, game_id, season_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut)
select '10000000-0000-0000-0000-000000000009', 1, id, '00000000-0000-0000-0000-00000000000a', 'brouillon-alice', 'Brouillon', '1v1', 8, 'EUW',
       now() + interval '3 days', now() + interval '3 days', 'brouillon'
from seasons where est_courante;

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-00000000000e');
select essai('Eve se désinscrit d''un tournoi ouvert',
  $q$select 1 where public.se_desinscrire('10000000-0000-0000-0000-000000000001')$q$, 'passe');
select essai('Eve se réinscrit ensuite au même tournoi',
  $q$select public.s_inscrire_tournoi('10000000-0000-0000-0000-000000000001')$q$, 'passe');
select en_tant_que('00000000-0000-0000-0000-00000000000b');
select essai('Bob se désinscrit d''un tournoi déjà commencé',
  $q$select public.se_desinscrire('10000000-0000-0000-0000-000000000003')$q$, 'bloque');
select en_tant_que('00000000-0000-0000-0000-00000000000e');
select essai('Eve lit le brouillon d''Alice',
  $q$select * from tournaments where id = '10000000-0000-0000-0000-000000000009'$q$, 'bloque');
select en_tant_que('00000000-0000-0000-0000-00000000000a');
select essai('Alice lit son propre brouillon',
  $q$select * from tournaments where id = '10000000-0000-0000-0000-000000000009'$q$, 'passe');
select essai('Alice publie son brouillon',
  $q$update tournaments set statut = 'ouvert' where id = '10000000-0000-0000-0000-000000000009'$q$, 'passe');
select essai('Alice annule son tournoi ouvert',
  $q$update tournaments set statut = 'annule' where id = '10000000-0000-0000-0000-000000000009'$q$, 'passe');
reset role;
set role anon;
select essai('Visiteur anonyme : liste des tournois publiés',
  $q$select * from tournaments where statut <> 'brouillon'$q$, 'passe');
reset role;

select verifie('Eve est de nouveau inscrite (statut « inscrit »), une seule ligne',
  (select count(*) = 1 and bool_and(statut = 'inscrit') from registrations
     where tournament_id = '10000000-0000-0000-0000-000000000001' and profile_id = '00000000-0000-0000-0000-00000000000e'));
