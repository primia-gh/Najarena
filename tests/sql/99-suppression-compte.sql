-- Suppression de compte en libre-service (audit M17).
\set ON_ERROR_STOP 0

-- Ivan : compte Riot, rating et journal, équipe à lui seul, annonce,
-- visite, inscription à un tournoi à venir.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000020', 'ivan@test', '{"pseudo":"Ivan","slug":"ivan"}');
insert into game_accounts (profile_id, game_id, puuid, riot_game_name, riot_tag_line, region, est_principal, verifie_le, methode_verification)
values ('00000000-0000-0000-0000-000000000020', 1, 'P-IVAN', 'Ivan', 'EUW', 'EUW', true, now(), 'icone_profil');
insert into ratings (profile_id, game_id, season_id, rating, rd, volatilite, matchs_joues, est_classe)
values ('00000000-0000-0000-0000-000000000020', 1, (select id from seasons where est_courante), 1620, 120, 0.06, 12, true);
insert into rating_events (profile_id, game_id, season_id, tournament_id, rating_avant, rating_apres, rd_avant, rd_apres, motif)
values ('00000000-0000-0000-0000-000000000020', 1, (select id from seasons where est_courante), '10000000-0000-0000-0000-000000000003', 1600, 1620, 130, 120, 'tournoi');
insert into teams (id, game_id, slug, nom, tag, capitaine_id)
values ('20000000-0000-0000-0000-000000000020', 1, 'equipe-ivan', 'Equipe Ivan', 'IVN', '00000000-0000-0000-0000-000000000020');
insert into team_members (team_id, profile_id, role, accepte_le)
values ('20000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000020', 'Capitaine', now());
insert into vues_profil (profile_id, vu_par) values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000020');
insert into registrations (tournament_id, profile_id, statut)
values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000020', 'inscrit');
insert into login_attempts (email) values ('ivan@test');

-- Jade : seulement un abonnement payant en cours.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000021', 'jade@test', '{"pseudo":"Jade","slug":"jade"}');
insert into abonnements_stripe (profile_id, client_stripe_id, abonnement_stripe_id, statut)
values ('00000000-0000-0000-0000-000000000021', 'cus_jade', 'sub_jade', 'active');

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-00000000000a');
select refus('Alice organise un tournoi ouvert : suppression refusée',
  $q$select public.supprimer_mon_compte()$q$, 'TOURNOI_ORGANISE_ACTIF');
-- Gina joue dans le tournoi en cours (points calculés à sa clôture).
reset role;
insert into registrations (tournament_id, profile_id, statut)
values ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000010', 'confirme');
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000010');
select refus('Gina joue un tournoi en cours : suppression refusée',
  $q$select public.supprimer_mon_compte()$q$, 'TOURNOI_EN_COURS');
select en_tant_que('00000000-0000-0000-0000-000000000021');
select refus('Jade a un abonnement payant actif : suppression refusée',
  $q$select public.supprimer_mon_compte()$q$, 'ABONNEMENT_ACTIF');
select en_tant_que('00000000-0000-0000-0000-000000000020');
select essai('Ivan supprime son compte',
  $q$select public.supprimer_mon_compte()$q$, 'passe');
select essai('Ivan relance la suppression (sans effet)',
  $q$select public.supprimer_mon_compte()$q$, 'passe');
reset role;

select verifie('Ivan : pseudo et adresse anonymes, pays et Discord effacés',
  (select pseudo = 'Supprime-00000000000' and slug = 'supprime-00000000000' and pays is null and discord_id is null and supprime_le is not null
     from profiles where id = '00000000-0000-0000-0000-000000000020'));
select verifie('Ivan : compte Riot, rating, équipe, visite et tentatives de connexion effacés',
  not exists (select 1 from game_accounts where profile_id = '00000000-0000-0000-0000-000000000020')
  and not exists (select 1 from ratings where profile_id = '00000000-0000-0000-0000-000000000020')
  and not exists (select 1 from teams where id = '20000000-0000-0000-0000-000000000020')
  and not exists (select 1 from vues_profil where vu_par = '00000000-0000-0000-0000-000000000020')
  and not exists (select 1 from login_attempts where email = 'ivan@test'));
select verifie('Ivan : journal public des points conservé',
  exists (select 1 from rating_events where profile_id = '00000000-0000-0000-0000-000000000020'));
select verifie('Ivan : retiré du tournoi à venir',
  (select statut = 'retire' from registrations
     where tournament_id = '10000000-0000-0000-0000-000000000001' and profile_id = '00000000-0000-0000-0000-000000000020'));

insert into admins (profile_id) values ('00000000-0000-0000-0000-00000000000f');
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-00000000000f');
select refus('Frank (administrateur) : suppression refusée',
  $q$select public.supprimer_mon_compte()$q$, 'COMPTE_ADMINISTRATEUR');
reset role;
delete from admins where profile_id = '00000000-0000-0000-0000-00000000000f';
