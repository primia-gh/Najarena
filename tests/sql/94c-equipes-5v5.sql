-- Tournois 5v5 : inscription d'une équipe par son capitaine (audit N21).
\set ON_ERROR_STOP 0

-- Équipe K : Kai (capitaine), Ken, Kim, Kip, Kit acceptés ; Max invité,
-- pas encore accepté. Équipe L : Lou (capitaine), Lea, Lia, Lin acceptés,
-- et Kit, qui joue aussi pour K. Tous vérifiés sur EUW.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000080', 'kai5@test', '{"pseudo":"Kai5v5","slug":"kai5v5"}'),
  ('00000000-0000-0000-0000-000000000081', 'ken5@test', '{"pseudo":"Ken5v5","slug":"ken5v5"}'),
  ('00000000-0000-0000-0000-000000000082', 'kim5@test', '{"pseudo":"Kim5v5","slug":"kim5v5"}'),
  ('00000000-0000-0000-0000-000000000083', 'kip5@test', '{"pseudo":"Kip5v5","slug":"kip5v5"}'),
  ('00000000-0000-0000-0000-000000000084', 'kit5@test', '{"pseudo":"Kit5v5","slug":"kit5v5"}'),
  ('00000000-0000-0000-0000-000000000085', 'lou5@test', '{"pseudo":"Lou5v5","slug":"lou5v5"}'),
  ('00000000-0000-0000-0000-000000000086', 'lea5@test', '{"pseudo":"Lea5v5","slug":"lea5v5"}'),
  ('00000000-0000-0000-0000-000000000087', 'lia5@test', '{"pseudo":"Lia5v5","slug":"lia5v5"}'),
  ('00000000-0000-0000-0000-000000000088', 'lin5@test', '{"pseudo":"Lin5v5","slug":"lin5v5"}'),
  ('00000000-0000-0000-0000-00000000008a', 'max5@test', '{"pseudo":"Max5v5","slug":"max5v5"}');
insert into game_accounts (profile_id, game_id, puuid, riot_game_name, riot_tag_line, region, est_principal, verifie_le, methode_verification)
select u.id, 1, 'P-' || u.id::text, 'J' || right(u.id::text, 2), 'EUW', 'EUW', true, now(), 'icone_profil'
from auth.users u
where u.id::text like '00000000-0000-0000-0000-00000000008%';
insert into teams (id, game_id, slug, nom, tag, capitaine_id) values
  ('94c00000-0000-0000-0000-00000000000a', 1, 'equipe-kai-5v5', 'Equipe Kai', 'KAI', '00000000-0000-0000-0000-000000000080'),
  ('94c00000-0000-0000-0000-00000000000b', 1, 'equipe-lou-5v5', 'Equipe Lou', 'LOU', '00000000-0000-0000-0000-000000000085');
insert into team_members (team_id, profile_id, accepte_le) values
  ('94c00000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000080', now()),
  ('94c00000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000081', now()),
  ('94c00000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000082', now()),
  ('94c00000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000083', now()),
  ('94c00000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000084', now()),
  ('94c00000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000008a', null),
  ('94c00000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000085', now()),
  ('94c00000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000086', now()),
  ('94c00000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000087', now()),
  ('94c00000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000088', now()),
  ('94c00000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000084', now());
-- Ratings de la saison : Kai 1600, Ken 1400 (les autres n'en ont pas).
insert into ratings (profile_id, game_id, season_id, rating, rd, volatilite)
select v.id::uuid, 1, (select id from seasons where est_courante), v.r, 200, 0.06
from (values ('00000000-0000-0000-0000-000000000080', 1600), ('00000000-0000-0000-0000-000000000081', 1400)) v(id, r);

-- T5 : 5v5 EUW, inscriptions ouvertes, check-in déjà ouvert. T5NA : 5v5 NA.
insert into tournaments (id, game_id, season_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, compte_pour_classement) values
  ('94c00000-0000-0000-0000-000000000001', 1, (select id from seasons where est_courante), '00000000-0000-0000-0000-00000000000a', 't-5v5', 'Coupe 5v5', '5v5', 4, 'EUW', now() + interval '1 day', now() - interval '1 minute', 'ouvert', false),
  ('94c00000-0000-0000-0000-000000000002', 1, (select id from seasons where est_courante), '00000000-0000-0000-0000-00000000000a', 't-5v5-na', 'Coupe 5v5 NA', '5v5', 4, 'NA', now() + interval '1 day', now() + interval '20 hours', 'ouvert', false);

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-00000000000a');
select essai('Alice crée un tournoi 5v5 qui compterait au classement individuel',
  $q$insert into tournaments (game_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, compte_pour_classement) values (1, '00000000-0000-0000-0000-00000000000a', 'cinq-classe', 'Cinq classé', '5v5', 8, 'EUW', now() + interval '3 days', now() + interval '3 days', 'ouvert', true)$q$, 'bloque');
select essai('Alice crée un tournoi 5v5 hors classement individuel',
  $q$insert into tournaments (game_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, compte_pour_classement) values (1, '00000000-0000-0000-0000-00000000000a', 'cinq-amical', 'Cinq amical', '5v5', 8, 'EUW', now() + interval '3 days', now() + interval '3 days', 'ouvert', false)$q$, 'passe');
select essai('Alice invente un format 3v3',
  $q$insert into tournaments (game_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, compte_pour_classement) values (1, '00000000-0000-0000-0000-00000000000a', 'trois', 'Trois', '3v3', 8, 'EUW', now() + interval '3 days', now() + interval '3 days', 'ouvert', false)$q$, 'bloque');

select en_tant_que('00000000-0000-0000-0000-000000000080');
select refus('Kai s''inscrit seul à un tournoi 5v5',
  $q$select public.s_inscrire_tournoi('94c00000-0000-0000-0000-000000000001')$q$, 'TOURNOI_PAR_EQUIPES');
select refus('Kai inscrit son équipe à un tournoi 1v1',
  $q$select public.s_inscrire_equipe('10000000-0000-0000-0000-000000000001', '94c00000-0000-0000-0000-00000000000a', array['00000000-0000-0000-0000-000000000080','00000000-0000-0000-0000-000000000081','00000000-0000-0000-0000-000000000082','00000000-0000-0000-0000-000000000083','00000000-0000-0000-0000-000000000084']::uuid[])$q$, 'TOURNOI_EN_SOLO');
select refus('Kai inscrit l''équipe de Lou',
  $q$select public.s_inscrire_equipe('94c00000-0000-0000-0000-000000000001', '94c00000-0000-0000-0000-00000000000b', array['00000000-0000-0000-0000-000000000080','00000000-0000-0000-0000-000000000081','00000000-0000-0000-0000-000000000082','00000000-0000-0000-0000-000000000083','00000000-0000-0000-0000-000000000084']::uuid[])$q$, 'CAPITAINE_REQUIS');
select refus('Kai aligne quatre joueurs',
  $q$select public.s_inscrire_equipe('94c00000-0000-0000-0000-000000000001', '94c00000-0000-0000-0000-00000000000a', array['00000000-0000-0000-0000-000000000080','00000000-0000-0000-0000-000000000081','00000000-0000-0000-0000-000000000082','00000000-0000-0000-0000-000000000083','00000000-0000-0000-0000-000000000083']::uuid[])$q$, 'ALIGNEMENT_DE_CINQ');
select refus('Kai aligne Max, qui n''a pas accepté son invitation',
  $q$select public.s_inscrire_equipe('94c00000-0000-0000-0000-000000000001', '94c00000-0000-0000-0000-00000000000a', array['00000000-0000-0000-0000-000000000080','00000000-0000-0000-0000-000000000081','00000000-0000-0000-0000-000000000082','00000000-0000-0000-0000-000000000083','00000000-0000-0000-0000-00000000008a']::uuid[])$q$, 'JOUEUR_HORS_EQUIPE');
select refus('Kai aligne cinq joueurs sans lui',
  $q$select public.s_inscrire_equipe('94c00000-0000-0000-0000-000000000001', '94c00000-0000-0000-0000-00000000000a', array['00000000-0000-0000-0000-000000000081','00000000-0000-0000-0000-000000000082','00000000-0000-0000-0000-000000000083','00000000-0000-0000-0000-000000000084','00000000-0000-0000-0000-00000000008a']::uuid[])$q$, 'CAPITAINE_DANS_ALIGNEMENT');
select refus('Kai inscrit son équipe EUW dans un tournoi NA',
  $q$select public.s_inscrire_equipe('94c00000-0000-0000-0000-000000000002', '94c00000-0000-0000-0000-00000000000a', array['00000000-0000-0000-0000-000000000080','00000000-0000-0000-0000-000000000081','00000000-0000-0000-0000-000000000082','00000000-0000-0000-0000-000000000083','00000000-0000-0000-0000-000000000084']::uuid[])$q$, 'ALIGNEMENT_COMPTE_RIOT');
select essai('Kai inscrit son équipe avec cinq membres',
  $q$select public.s_inscrire_equipe('94c00000-0000-0000-0000-000000000001', '94c00000-0000-0000-0000-00000000000a', array['00000000-0000-0000-0000-000000000080','00000000-0000-0000-0000-000000000081','00000000-0000-0000-0000-000000000082','00000000-0000-0000-0000-000000000083','00000000-0000-0000-0000-000000000084']::uuid[])$q$, 'passe');
select refus('Kai inscrit son équipe une deuxième fois',
  $q$select public.s_inscrire_equipe('94c00000-0000-0000-0000-000000000001', '94c00000-0000-0000-0000-00000000000a', array['00000000-0000-0000-0000-000000000080','00000000-0000-0000-0000-000000000081','00000000-0000-0000-0000-000000000082','00000000-0000-0000-0000-000000000083','00000000-0000-0000-0000-000000000084']::uuid[])$q$, 'DEJA_INSCRIT');
select essai('Kai écrit lui-même un alignement',
  $q$insert into alignements (tournament_id, profile_id, registration_id) select '94c00000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000008a', id from registrations where profile_id = '00000000-0000-0000-0000-000000000080' and tournament_id = '94c00000-0000-0000-0000-000000000001'$q$, 'bloque');
select en_tant_que('00000000-0000-0000-0000-000000000085');
select refus('Lou aligne Kit, déjà aligné par Kai',
  $q$select public.s_inscrire_equipe('94c00000-0000-0000-0000-000000000001', '94c00000-0000-0000-0000-00000000000b', array['00000000-0000-0000-0000-000000000085','00000000-0000-0000-0000-000000000086','00000000-0000-0000-0000-000000000087','00000000-0000-0000-0000-000000000088','00000000-0000-0000-0000-000000000084']::uuid[])$q$, 'JOUEUR_DEJA_ALIGNE');
reset role;

select verifie('Équipe de Kai : nom et tag figés à l''inscription, rating moyen des joueurs qui en ont un (1500)',
  (select equipe_nom = 'Equipe Kai' and equipe_tag = 'KAI' and rating_a_inscription = 1500
   from registrations where tournament_id = '94c00000-0000-0000-0000-000000000001' and profile_id = '00000000-0000-0000-0000-000000000080'));
select verifie('Cinq joueurs alignés pour l''équipe de Kai',
  (select count(*) = 5 from alignements where tournament_id = '94c00000-0000-0000-0000-000000000001'));

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select essai('Un visiteur lit les alignements', $q$select 1 from alignements$q$, 'passe');
reset role;

-- Kit quitte l'équipe de Kai pendant les inscriptions : il sort de son
-- alignement, et peut jouer pour Lou.
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000084');
select essai('Kit quitte l''équipe de Kai pendant les inscriptions',
  $q$delete from team_members where team_id = '94c00000-0000-0000-0000-00000000000a' and profile_id = '00000000-0000-0000-0000-000000000084'$q$, 'passe');
reset role;
select verifie('Kit n''est plus aligné avec Kai',
  (select count(*) = 4 from alignements where tournament_id = '94c00000-0000-0000-0000-000000000001'));

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000085');
select essai('Lou inscrit son équipe avec Kit',
  $q$select public.s_inscrire_equipe('94c00000-0000-0000-0000-000000000001', '94c00000-0000-0000-0000-00000000000b', array['00000000-0000-0000-0000-000000000085','00000000-0000-0000-0000-000000000086','00000000-0000-0000-0000-000000000087','00000000-0000-0000-0000-000000000088','00000000-0000-0000-0000-000000000084']::uuid[])$q$, 'passe');
select essai('Lou fait le check-in de son équipe', $q$select 1 where public.confirmer_presence('94c00000-0000-0000-0000-000000000001')$q$, 'passe');
select en_tant_que('00000000-0000-0000-0000-000000000080');
select refus('Kai fait le check-in avec quatre joueurs',
  $q$select public.confirmer_presence('94c00000-0000-0000-0000-000000000001')$q$, 'ALIGNEMENT_INCOMPLET');
select en_tant_que('00000000-0000-0000-0000-00000000008a');
select essai('Max accepte l''invitation de Kai',
  $q$update team_members set accepte_le = now() where team_id = '94c00000-0000-0000-0000-00000000000a' and profile_id = '00000000-0000-0000-0000-00000000008a'$q$, 'passe');
select refus('Max change l''alignement de Kai',
  $q$select public.modifier_alignement('94c00000-0000-0000-0000-000000000001', array['00000000-0000-0000-0000-000000000080','00000000-0000-0000-0000-000000000081','00000000-0000-0000-0000-000000000082','00000000-0000-0000-0000-000000000083','00000000-0000-0000-0000-00000000008a']::uuid[])$q$, 'EQUIPE_NON_INSCRITE');
select en_tant_que('00000000-0000-0000-0000-000000000080');
select essai('Kai complète son alignement avec Max',
  $q$select public.modifier_alignement('94c00000-0000-0000-0000-000000000001', array['00000000-0000-0000-0000-000000000080','00000000-0000-0000-0000-000000000081','00000000-0000-0000-0000-000000000082','00000000-0000-0000-0000-000000000083','00000000-0000-0000-0000-00000000008a']::uuid[])$q$, 'passe');
select essai('Kai fait le check-in de son équipe complète',
  $q$select 1 where public.confirmer_presence('94c00000-0000-0000-0000-000000000001')$q$, 'passe');
reset role;

update tournaments set statut = 'checkin' where id = '94c00000-0000-0000-0000-000000000001';

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000081');
select refus('Ken quitte l''équipe de Kai pendant le check-in',
  $q$delete from team_members where team_id = '94c00000-0000-0000-0000-00000000000a' and profile_id = '00000000-0000-0000-0000-000000000081'$q$, 'ALIGNE_EN_TOURNOI');
reset role;
select refus('L''équipe de Kai, inscrite, est supprimée',
  $q$delete from teams where id = '94c00000-0000-0000-0000-00000000000a'$q$, 'EQUIPE_INSCRITE_EN_TOURNOI');

-- Lin est suspendu : il sort de l'alignement de Lou, dont l'équipe doit
-- refaire son check-in avec un remplaçant.
insert into suspensions (profile_id, motif) values ('00000000-0000-0000-0000-000000000088', 'Essai 5v5');
select verifie('Lin suspendu : retiré de l''alignement, équipe de Lou de nouveau « inscrite »',
  (select count(*) = 4 from alignements a join registrations r on r.id = a.registration_id
   where r.profile_id = '00000000-0000-0000-0000-000000000085' and r.tournament_id = '94c00000-0000-0000-0000-000000000001')
  and (select statut = 'inscrit' from registrations
       where profile_id = '00000000-0000-0000-0000-000000000085' and tournament_id = '94c00000-0000-0000-0000-000000000001'));

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-00000000000a');
select refus('Alice, organisatrice, confirme l''équipe de Lou incomplète depuis son cockpit',
  $q$update registrations set statut = 'confirme' where profile_id = '00000000-0000-0000-0000-000000000085' and tournament_id = '94c00000-0000-0000-0000-000000000001'$q$, 'ALIGNEMENT_INCOMPLET');
select en_tant_que('00000000-0000-0000-0000-000000000085');
select refus('Lou refait le check-in sans remplaçant',
  $q$select public.confirmer_presence('94c00000-0000-0000-0000-000000000001')$q$, 'ALIGNEMENT_INCOMPLET');
select en_tant_que('00000000-0000-0000-0000-000000000080');
select essai('Kai désinscrit son équipe pendant le check-in',
  $q$select 1 where public.se_desinscrire('94c00000-0000-0000-0000-000000000001')$q$, 'passe');
reset role;
select verifie('Équipe de Kai désinscrite : ses joueurs ne sont plus alignés',
  (select count(*) = 0 from alignements a join registrations r on r.id = a.registration_id
   where r.profile_id = '00000000-0000-0000-0000-000000000080'));

update tournaments set statut = 'en_cours' where id = '94c00000-0000-0000-0000-000000000001';
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000085');
select refus('Lou change son alignement après le lancement du bracket',
  $q$select public.modifier_alignement('94c00000-0000-0000-0000-000000000001', array['00000000-0000-0000-0000-000000000085','00000000-0000-0000-0000-000000000086','00000000-0000-0000-0000-000000000087','00000000-0000-0000-0000-000000000084','00000000-0000-0000-0000-000000000080']::uuid[])$q$, 'ALIGNEMENT_FIGE');
reset role;
