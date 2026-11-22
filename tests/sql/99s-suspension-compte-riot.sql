-- Suspension et niveau qui suivent le compte Riot (contrôle de sécurité
-- complet du 21/11/2026, M3).
\set ON_ERROR_STOP 0

-- 0 organise ; 1 triche et sera suspendu ; 2 est son complice ;
-- 3 est Diamant et supprime son compte ; 4 recrée un compte avec le même
-- compte Riot ; 5 est un vrai débutant ; 6 est Platine et délie son compte
-- Riot ; 7 le relie ailleurs.
insert into auth.users (id, email, raw_user_meta_data)
select ('ae0e000' || n || '-0000-0000-0000-000000000000')::uuid, 'p99s' || n || '@test',
       json_build_object('pseudo', 'Susp99s' || n, 'slug', 'susp99s' || n)::jsonb
from generate_series(0, 7) n;
insert into game_accounts (profile_id, game_id, puuid, riot_game_name, riot_tag_line, region, est_principal, verifie_le, methode_verification) values
  ('ae0e0001-0000-0000-0000-000000000000', 1, 'P99S-T', 'Triche', 'EUW', 'EUW', true, now(), 'icone_profil'),
  ('ae0e0003-0000-0000-0000-000000000000', 1, 'P99S-D', 'Diam', 'EUW', 'EUW', true, now(), 'icone_profil'),
  ('ae0e0005-0000-0000-0000-000000000000', 1, 'P99S-N', 'Neuf', 'EUW', 'EUW', true, now(), 'icone_profil'),
  ('ae0e0006-0000-0000-0000-000000000000', 1, 'P99S-P', 'Plat', 'EUW', 'EUW', true, now(), 'icone_profil');
-- Une liaison de 1 encore en attente (commencée avant la suspension).
insert into game_accounts (profile_id, game_id, puuid, riot_game_name, riot_tag_line, region, est_principal, defi_icone_id, defi_cree_le, methode_verification) values
  ('ae0e0001-0000-0000-0000-000000000000', 1, 'P99S-T2', 'Triche2', 'EUW', 'EUW', false, 4, now(), 'icone_profil');
select id as saison from seasons where est_courante \gset
insert into ratings (profile_id, game_id, season_id, rating, rd, volatilite, matchs_joues) values
  ('ae0e0003-0000-0000-0000-000000000000', 1, :'saison', 1800, 100, 0.06, 20),
  ('ae0e0006-0000-0000-0000-000000000000', 1, :'saison', 1650, 200, 0.06, 6);
insert into rating_events (profile_id, game_id, season_id, motif, rating_avant, rd_avant, rating_apres, rd_apres) values
  ('ae0e0003-0000-0000-0000-000000000000', 1, :'saison', 'tournoi', 1790, 110, 1820, 105),
  ('ae0e0003-0000-0000-0000-000000000000', 1, :'saison', 'tournoi', 1820, 105, 1800, 100);

-- ---- Suspension ----
insert into suspensions (id, profile_id, motif) values
  ('ae0e0000-0000-0000-0000-0000000000f1', 'ae0e0001-0000-0000-0000-000000000000', 'Triche avérée.');
select verifie('Son compte Riot vérifié est noté (empreinte seulement), pas la liaison en attente',
  (select count(*) = 1 from comptes_riot_suspendus where profile_id = 'ae0e0001-0000-0000-0000-000000000000')
  and exists (select 1 from comptes_riot_suspendus where empreinte = encode(sha256(convert_to('P99S-T', 'UTF8')), 'hex'))
  and not exists (select 1 from comptes_riot_suspendus where empreinte = 'P99S-T'));

set role authenticated;
select en_tant_que('ae0e0001-0000-0000-0000-000000000000');
select refus('Le suspendu ne délie pas son compte Riot',
  $q$select public.delier_compte_riot(1::smallint)$q$, 'COMPTE_SUSPENDU');
select refus('Ni un compte secondaire',
  $q$select public.delier_compte_secondaire(1::smallint, 'P99S-T2')$q$, 'COMPTE_SUSPENDU');
select refus('Il ne lit pas la liste des comptes suspendus',
  $q$select count(*) from comptes_riot_suspendus$q$, 'permission denied for table comptes_riot_suspendus');
reset role;

set role service_role;
select refus('Le suspendu ne lie pas de nouveau compte',
  $q$select public.lier_compte_riot('ae0e0001-0000-0000-0000-000000000000'::uuid, 1::smallint, 'P99S-T3', 'Triche3', 'EUW', 'EUW', 5::smallint, false)$q$,
  'COMPTE_SUSPENDU');
select refus('Il ne termine pas la vérification commencée avant sa suspension',
  $q$update game_accounts set verifie_le = now() where puuid = 'P99S-T2'$q$, 'COMPTE_SUSPENDU');
reset role;

-- Il supprime son compte : le compte Riot reste bloqué.
set role authenticated;
select en_tant_que('ae0e0001-0000-0000-0000-000000000000');
select essai('Le suspendu supprime son compte Najarena',
  $q$select public.supprimer_mon_compte()$q$, 'passe');
reset role;
set role service_role;
select refus('Son complice ne relie pas le compte Riot suspendu, même après la suppression',
  $q$select public.lier_compte_riot('ae0e0002-0000-0000-0000-000000000000'::uuid, 1::smallint, 'P99S-T', 'Triche', 'EUW', 'EUW', 5::smallint, true)$q$,
  'COMPTE_RIOT_SUSPENDU');
reset role;

-- Levée de la suspension : le compte Riot redevient libre.
update suspensions set levee_le = now() where id = 'ae0e0000-0000-0000-0000-0000000000f1';
select verifie('La levée efface la note', not exists (select 1 from comptes_riot_suspendus where suspension_id = 'ae0e0000-0000-0000-0000-0000000000f1'));
set role service_role;
select essai('Après la levée, le compte Riot se lie de nouveau',
  $q$select public.lier_compte_riot('ae0e0002-0000-0000-0000-000000000000'::uuid, 1::smallint, 'P99S-T', 'Triche', 'EUW', 'EUW', 5::smallint, true)$q$,
  'passe');
reset role;

-- ---- Le niveau suit le compte Riot ----
set role authenticated;
select en_tant_que('ae0e0003-0000-0000-0000-000000000000');
select essai('Le joueur Diamant supprime son compte',
  $q$select public.supprimer_mon_compte()$q$, 'passe');
reset role;
select verifie('Son niveau est gardé sous l''empreinte de son compte Riot (meilleur 1820, dernier 1800, classé)',
  (select meilleur_rating = 1820 and dernier_rating = 1800 and est_classe
   from niveaux_comptes_riot
   where empreinte = encode(sha256(convert_to('P99S-D', 'UTF8')), 'hex') and season_id = :'saison'));

-- Il revient avec un nouveau compte et le même compte Riot.
set role service_role;
select essai('Nouveau compte, même compte Riot',
  $q$select public.lier_compte_riot('ae0e0004-0000-0000-0000-000000000000'::uuid, 1::smallint, 'P99S-D', 'Diam', 'EUW', 'EUW', 6::smallint, true)$q$,
  'passe');
reset role;
select verifie('Tant que le compte Riot n''est pas vérifié, rien n''est hérité',
  public.est_non_classe('ae0e0004-0000-0000-0000-000000000000') and public.rating_niveau('ae0e0004-0000-0000-0000-000000000000') = 1500);
update game_accounts set verifie_le = now(), defi_icone_id = null, defi_cree_le = null where puuid = 'P99S-D';
select verifie('Vérifié : il n''est plus « non classé »', not public.est_non_classe('ae0e0004-0000-0000-0000-000000000000'));
select verifie('Plancher : son dernier rating (1800)', public.rating_niveau('ae0e0004-0000-0000-0000-000000000000') = 1800);
select verifie('Plafond : son meilleur rating (1820)', public.rating_niveau_meilleur('ae0e0004-0000-0000-0000-000000000000') = 1820);
select verifie('Son classement officiel n''est pas touché (aucun rating recopié)',
  not exists (select 1 from ratings where profile_id = 'ae0e0004-0000-0000-0000-000000000000'));
select verifie('Un vrai débutant reste « non classé » à 1500',
  public.est_non_classe('ae0e0005-0000-0000-0000-000000000000') and public.rating_niveau_meilleur('ae0e0005-0000-0000-0000-000000000000') = 1500);

set role authenticated;
select en_tant_que('ae0e0004-0000-0000-0000-000000000000');
select verifie('La page du tournoi lit « déjà classé »', (select public.mon_statut_non_classe()) = false);
select verifie('Et son niveau hérité', (select actuel = 1800 and meilleur = 1820 and a_joue from public.mon_niveau_tournoi()));
select refus('Il ne lit pas la table des niveaux gardés',
  $q$select count(*) from niveaux_comptes_riot$q$, 'permission denied for table niveaux_comptes_riot');
select refus('Ni le calcul d''empreinte',
  $q$select public.empreinte_puuid('P99S-D')$q$, 'permission denied for function empreinte_puuid');
select en_tant_que('ae0e0005-0000-0000-0000-000000000000');
select verifie('Le vrai débutant lit « non classé »', (select public.mon_statut_non_classe()) = true);
reset role;

-- Coupe des nouveaux et tournoi « Bronze à Argent » : refusés.
insert into tournaments (id, game_id, season_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, reserve_non_classes) values
  ('ae0e0000-0000-0000-0000-0000000000a1', 1, :'saison', 'ae0e0000-0000-0000-0000-000000000000', 'susp-99s-nouveaux', 'Coupe 99s nouveaux', '1v1', 8, 'EUW', now() + interval '2 days', now() + interval '2 days', 'ouvert', true);
insert into tournaments (id, game_id, season_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, rating_max) values
  ('ae0e0000-0000-0000-0000-0000000000a2', 1, :'saison', 'ae0e0000-0000-0000-0000-000000000000', 'susp-99s-bronze', 'Coupe 99s Bronze à Argent', '1v1', 8, 'EUW', now() + interval '2 days', now() + interval '2 days', 'ouvert', 1450);
select refus('Coupe des nouveaux : refusé avec le compte Riot d''un joueur classé',
  $q$insert into registrations (tournament_id, profile_id, statut) values ('ae0e0000-0000-0000-0000-0000000000a1', 'ae0e0004-0000-0000-0000-000000000000', 'inscrit')$q$,
  'RESERVE_NON_CLASSES');
select refus('« Bronze à Argent » : refusé',
  $q$insert into registrations (tournament_id, profile_id, statut) values ('ae0e0000-0000-0000-0000-0000000000a2', 'ae0e0004-0000-0000-0000-000000000000', 'inscrit')$q$,
  'NIVEAU_HORS_TOURNOI');
select essai('Le vrai débutant entre dans la Coupe des nouveaux',
  $q$insert into registrations (tournament_id, profile_id, statut) values ('ae0e0000-0000-0000-0000-0000000000a1', 'ae0e0005-0000-0000-0000-000000000000', 'inscrit')$q$,
  'passe');

-- Délier son compte Riot pour le relier ailleurs : même effet.
set role authenticated;
select en_tant_que('ae0e0006-0000-0000-0000-000000000000');
select essai('Le joueur Platine délie son compte Riot', $q$select public.delier_compte_riot(1::smallint)$q$, 'passe');
reset role;
set role service_role;
select essai('Un autre profil le relie',
  $q$select public.lier_compte_riot('ae0e0007-0000-0000-0000-000000000000'::uuid, 1::smallint, 'P99S-P', 'Plat', 'EUW', 'EUW', 7::smallint, true)$q$,
  'passe');
reset role;
update game_accounts set verifie_le = now(), defi_icone_id = null, defi_cree_le = null where puuid = 'P99S-P';
select verifie('Le niveau Platine le suit (1650), pas classé (RD 200)',
  public.rating_niveau_meilleur('ae0e0007-0000-0000-0000-000000000000') = 1650
  and public.est_non_classe('ae0e0007-0000-0000-0000-000000000000'));

-- Ménage au changement de saison : gardé pendant sa saison et la suivante.
insert into seasons (id, game_id, numero, nom, debut_le, fin_le) values
  ('ae0e0000-0000-0000-0000-0000000000c1', 1, 2, 'Saison 99s A', now(), now() + interval '90 days'),
  ('ae0e0000-0000-0000-0000-0000000000c2', 1, 3, 'Saison 99s B', now() + interval '90 days', now() + interval '180 days');
select id as ancienne_courante from seasons where est_courante \gset
update seasons set est_courante = false where id = :'ancienne_courante';
update seasons set est_courante = true where id = 'ae0e0000-0000-0000-0000-0000000000c1';
select verifie('Saison suivante : le niveau gardé de la saison d''avant reste',
  exists (select 1 from niveaux_comptes_riot where empreinte = encode(sha256(convert_to('P99S-P', 'UTF8')), 'hex') and season_id = :'ancienne_courante'));
update seasons set est_courante = false where id = 'ae0e0000-0000-0000-0000-0000000000c1';
update seasons set est_courante = true where id = 'ae0e0000-0000-0000-0000-0000000000c2';
select verifie('Deux saisons plus tard, il est effacé',
  not exists (select 1 from niveaux_comptes_riot where season_id = :'ancienne_courante'));
-- Retour à la saison d'origine pour les scénarios suivants.
update seasons set est_courante = false where id = 'ae0e0000-0000-0000-0000-0000000000c2';
update seasons set est_courante = true where id = :'ancienne_courante';
delete from seasons where id in ('ae0e0000-0000-0000-0000-0000000000c1', 'ae0e0000-0000-0000-0000-0000000000c2');
