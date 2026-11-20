-- Alertes « tournoi pour toi » (20/11/2026).
\set ON_ERROR_STOP 0

-- Créneaux, heure de Paris (hiver UTC+1, été UTC+2).
select verifie('Samedi 20 h 30 à Paris : week-end, soir', public.creneau_de('2026-11-21 19:30:00+00') = 'weekend_soir');
select verifie('Mercredi 11 h : semaine, journée', public.creneau_de('2026-11-18 10:00:00+00') = 'semaine_journee');
select verifie('Jeudi 23 h 30 : semaine, nuit', public.creneau_de('2026-11-19 22:30:00+00') = 'semaine_nuit');
select verifie('Dimanche 5 h : week-end, nuit', public.creneau_de('2026-11-22 04:00:00+00') = 'weekend_nuit');
select verifie('Vendredi 17 h 59 : semaine, journée', public.creneau_de('2026-11-20 16:59:00+00') = 'semaine_journee');
select verifie('Samedi d''été 18 h 30 (UTC+2) : week-end, soir', public.creneau_de('2026-07-04 16:30:00+00') = 'weekend_soir');

-- 0 organise ; 1 (A) et 3 (C) ont un compte Riot vérifié sur EUW, 2 (B)
-- n'en a pas, 4 (D) est sur EUNE, 5 (E) organise un tournoi et a bloqué A.
-- B et D organisent aussi un tournoi chacun (A9, B1) : un organisateur
-- n'envoie qu'une alerte par joueur et par 24 h.
insert into auth.users (id, email, raw_user_meta_data)
select ('ab0b0000-0000-0000-0000-00000000000' || n)::uuid, 'p99p' || n || '@test',
       json_build_object('pseudo', 'Alerte99p' || n, 'slug', 'alerte99p' || n)::jsonb
from generate_series(0, 5) n;
insert into game_accounts (profile_id, game_id, puuid, riot_game_name, riot_tag_line, region, est_principal, verifie_le, methode_verification)
select ('ab0b0000-0000-0000-0000-00000000000' || n)::uuid, 1, 'P99P-' || n, 'R99p' || n, 'EUW',
       case when n = 4 then 'EUNE' else 'EUW' end, true, now(), 'icone_profil'
from generate_series(0, 5) n where n <> 2;
insert into blocages (bloqueur_id, bloque_id) values ('ab0b0000-0000-0000-0000-000000000005', 'ab0b0000-0000-0000-0000-000000000001');

select public.creneau_de(now() + interval '2 days') as creneau \gset

set role authenticated;
select en_tant_que('ab0b0000-0000-0000-0000-000000000002');
select refus('Sans compte Riot vérifié, pas d''alerte',
  $q$select public.regler_alertes_tournoi(array['semaine_soir'], array['1v1'])$q$, 'COMPTE_RIOT_REQUIS');
select en_tant_que('ab0b0000-0000-0000-0000-000000000001');
select refus('Au moins un créneau',
  $q$select public.regler_alertes_tournoi(array[]::text[], array['1v1'])$q$, 'CRENEAUX_INVALIDES');
select refus('Un créneau connu',
  $q$select public.regler_alertes_tournoi(array['lundi_matin'], array['1v1'])$q$, 'CRENEAUX_INVALIDES');
select refus('Un format connu',
  $q$select public.regler_alertes_tournoi(array['semaine_soir'], array['3v3'])$q$, 'FORMATS_INVALIDES');
select essai('A règle ses alertes (1v1, au créneau des tournois de test)',
  format($q$select public.regler_alertes_tournoi(array[%L, %L], array['1v1', '1v1'])$q$, :'creneau', :'creneau'), 'passe');
select verifie('Doublons retirés',
  (select creneaux = array[:'creneau'] and formats = array['1v1'] from alertes_tournoi where profile_id = 'ab0b0000-0000-0000-0000-000000000001'));
select essai('A n''écrit pas directement dans la table',
  $q$update alertes_tournoi set formats = array['5v5'] where profile_id = 'ab0b0000-0000-0000-0000-000000000001'$q$, 'bloque');
select refus('A ne réserve pas d''alertes lui-même',
  $q$select * from public.reserver_alertes_tournoi(10)$q$, 'permission denied for function reserver_alertes_tournoi');
select en_tant_que('ab0b0000-0000-0000-0000-000000000003');
select essai('C règle ses alertes (1v1 et 5v5)',
  format($q$select public.regler_alertes_tournoi(array[%L], array['1v1', '5v5'])$q$, :'creneau'), 'passe');
select verifie('C ne lit pas les alertes de A',
  not exists (select 1 from alertes_tournoi where profile_id = 'ab0b0000-0000-0000-0000-000000000001'));
select en_tant_que('ab0b0000-0000-0000-0000-000000000004');
select essai('D règle ses alertes', format($q$select public.regler_alertes_tournoi(array[%L], array['1v1'])$q$, :'creneau'), 'passe');
reset role;
set role anon;
select essai('Un visiteur ne lit aucune alerte', $q$select * from alertes_tournoi$q$, 'bloque');
reset role;

select id as saison from seasons where est_courante \gset
insert into tournaments (id, game_id, season_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, rating_min, compte_pour_classement) values
  ('ab0b0000-0000-0000-0000-0000000000a1', 1, :'saison', 'ab0b0000-0000-0000-0000-000000000000', 'alerte-99p-a1', 'Coupe 99p A1', '1v1', 8, 'EUW', now() + interval '2 days', now() + interval '2 days', 'ouvert', null, true),
  ('ab0b0000-0000-0000-0000-0000000000a2', 1, :'saison', 'ab0b0000-0000-0000-0000-000000000000', 'alerte-99p-a2', 'Coupe 99p A2', '5v5', 8, 'EUW', now() + interval '2 days', now() + interval '2 days', 'ouvert', null, false),
  ('ab0b0000-0000-0000-0000-0000000000a3', 1, :'saison', 'ab0b0000-0000-0000-0000-000000000000', 'alerte-99p-a3', 'Coupe 99p A3', '1v1', 8, 'EUNE', now() + interval '2 days', now() + interval '2 days', 'ouvert', null, true),
  ('ab0b0000-0000-0000-0000-0000000000a4', 1, :'saison', 'ab0b0000-0000-0000-0000-000000000000', 'alerte-99p-a4', 'Coupe 99p A4', '1v1', 8, 'EUW', now() + interval '2 days', now() + interval '2 days', 'brouillon', null, true),
  ('ab0b0000-0000-0000-0000-0000000000a5', 1, :'saison', 'ab0b0000-0000-0000-0000-000000000000', 'alerte-99p-a5', 'Coupe 99p A5', '1v1', 8, 'EUW', now() + interval '30 minutes', now() + interval '10 minutes', 'ouvert', null, true),
  ('ab0b0000-0000-0000-0000-0000000000a6', 1, :'saison', 'ab0b0000-0000-0000-0000-000000000000', 'alerte-99p-a6', 'Coupe 99p A6', '1v1', 8, 'EUW', now() + interval '2 days', now() + interval '2 days', 'ouvert', 1600, true),
  ('ab0b0000-0000-0000-0000-0000000000a7', 1, :'saison', 'ab0b0000-0000-0000-0000-000000000001', 'alerte-99p-a7', 'Coupe 99p A7', '1v1', 8, 'EUW', now() + interval '2 days', now() + interval '2 days', 'ouvert', null, true),
  ('ab0b0000-0000-0000-0000-0000000000a8', 1, :'saison', 'ab0b0000-0000-0000-0000-000000000005', 'alerte-99p-a8', 'Coupe 99p A8', '1v1', 8, 'EUW', now() + interval '2 days', now() + interval '2 days', 'ouvert', null, true),
  ('ab0b0000-0000-0000-0000-0000000000a9', 1, :'saison', 'ab0b0000-0000-0000-0000-000000000002', 'alerte-99p-a9', 'Coupe 99p A9', '1v1', 8, 'EUW', now() + interval '2 days', now() + interval '2 days', 'ouvert', null, true),
  ('ab0b0000-0000-0000-0000-0000000000b1', 1, :'saison', 'ab0b0000-0000-0000-0000-000000000004', 'alerte-99p-b1', 'Coupe 99p B1', '1v1', 8, 'EUW', now() + interval '2 days', now() + interval '2 days', 'ouvert', null, true),
  ('ab0b0000-0000-0000-0000-0000000000b2', 1, :'saison', 'ab0b0000-0000-0000-0000-000000000000', 'alerte-99p-b2', 'Coupe 99p B2', '1v1', 4, 'EUW', now() + interval '2 days', now() + interval '2 days', 'ouvert', null, true),
  ('ab0b0000-0000-0000-0000-0000000000b3', 1, :'saison', 'ab0b0000-0000-0000-0000-000000000000', 'alerte-99p-b3', 'Coupe 99p B3', '1v1', 8, 'EUW', now() + interval '8 days', now() + interval '8 days', 'ouvert', null, true);
-- C est déjà inscrit à A1 ; B2 (4 places) est complet.
insert into registrations (tournament_id, profile_id, statut) values
  ('ab0b0000-0000-0000-0000-0000000000a1', 'ab0b0000-0000-0000-0000-000000000003', 'inscrit');
insert into auth.users (id, email, raw_user_meta_data)
select ('ab0b0000-0000-0000-0000-0000000000c' || n)::uuid, 'p99pc' || n || '@test',
       json_build_object('pseudo', 'Plein99p' || n, 'slug', 'plein99p' || n)::jsonb
from generate_series(1, 4) n;
insert into registrations (tournament_id, profile_id, statut)
select 'ab0b0000-0000-0000-0000-0000000000b2', ('ab0b0000-0000-0000-0000-0000000000c' || n)::uuid, 'inscrit'
from generate_series(1, 4) n;

-- Les tournois des autres scénarios sont tenus pour déjà annoncés (il y a
-- deux jours : hors plafond), pour ne regarder que ceux de ce scénario.
insert into alertes_envoyees (profile_id, tournament_id, envoye_le)
select p.id, t.id, now() - interval '2 days'
from tournaments t
cross join (values ('ab0b0000-0000-0000-0000-000000000001'::uuid), ('ab0b0000-0000-0000-0000-000000000003'::uuid),
                   ('ab0b0000-0000-0000-0000-000000000004'::uuid)) as p(id)
where t.slug not like 'alerte-99p-%';

set role service_role;
create temp table envoi1 as select * from public.reserver_alertes_tournoi(200);
reset role;
select verifie('A : trois alertes au plus (A1, A9, B1 retenus)',
  (select count(*) = 3 and bool_and(tournament_id in ('ab0b0000-0000-0000-0000-0000000000a1', 'ab0b0000-0000-0000-0000-0000000000a9', 'ab0b0000-0000-0000-0000-0000000000b1'))
   from envoi1 where profile_id = 'ab0b0000-0000-0000-0000-000000000001'));
select verifie('A : jamais le 5v5 qu''il n''a pas choisi, un autre serveur, un brouillon, un tournoi trop proche ou trop lointain, hors niveau, le sien, celui d''un joueur qui l''a bloqué, un complet',
  not exists (select 1 from envoi1 where profile_id = 'ab0b0000-0000-0000-0000-000000000001'
              and tournament_id in ('ab0b0000-0000-0000-0000-0000000000a2', 'ab0b0000-0000-0000-0000-0000000000a3', 'ab0b0000-0000-0000-0000-0000000000a4',
                                    'ab0b0000-0000-0000-0000-0000000000a5', 'ab0b0000-0000-0000-0000-0000000000a6', 'ab0b0000-0000-0000-0000-0000000000a7',
                                    'ab0b0000-0000-0000-0000-0000000000a8', 'ab0b0000-0000-0000-0000-0000000000b2', 'ab0b0000-0000-0000-0000-0000000000b3')));
select verifie('C : le 5v5 compris, jamais le tournoi où il est déjà inscrit',
  (select count(*) = 3 and bool_or(tournament_id = 'ab0b0000-0000-0000-0000-0000000000a2')
          and not bool_or(tournament_id = 'ab0b0000-0000-0000-0000-0000000000a1')
   from envoi1 where profile_id = 'ab0b0000-0000-0000-0000-000000000003'));
select verifie('D (EUNE) : le tournoi de son serveur seulement',
  (select array_agg(tournament_id) = array['ab0b0000-0000-0000-0000-0000000000a3'::uuid]
   from envoi1 where profile_id = 'ab0b0000-0000-0000-0000-000000000004'));

set role service_role;
select verifie('Second passage : rien de plus (plafond atteint, déjà prévenus)',
  (select count(*) = 0 from public.reserver_alertes_tournoi(200)));
reset role;

-- 25 heures plus tard, A et C peuvent recevoir de nouvelles alertes, jamais
-- pour un tournoi déjà annoncé. A est désormais classé (RD 100) : ni le
-- tournoi plafonné à Argent (B5, A à 1500), ni la coupe des non-classés
-- (B6) ; C, non classé, reçoit B6, mais pas le 5v5 B7 où il s'est proposé
-- comme remplaçant.
update alertes_envoyees set envoye_le = now() - interval '25 hours'
where profile_id in ('ab0b0000-0000-0000-0000-000000000001', 'ab0b0000-0000-0000-0000-000000000003');
insert into ratings (profile_id, game_id, season_id, rating, rd, volatilite, matchs_joues) values
  ('ab0b0000-0000-0000-0000-000000000001', 1, :'saison', 1500, 100, 0.06, 12);
insert into tournaments (id, game_id, season_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, rating_max, reserve_non_classes, compte_pour_classement) values
  ('ab0b0000-0000-0000-0000-0000000000b4', 1, :'saison', 'ab0b0000-0000-0000-0000-000000000000', 'alerte-99p-b4', 'Coupe 99p B4', '1v1', 8, 'EUW', now() + interval '2 days', now() + interval '2 days', 'ouvert', null, false, true),
  ('ab0b0000-0000-0000-0000-0000000000b5', 1, :'saison', 'ab0b0000-0000-0000-0000-000000000000', 'alerte-99p-b5', 'Coupe 99p B5', '1v1', 8, 'EUW', now() + interval '2 days', now() + interval '2 days', 'ouvert', 1450, false, true),
  ('ab0b0000-0000-0000-0000-0000000000b6', 1, :'saison', 'ab0b0000-0000-0000-0000-000000000000', 'alerte-99p-b6', 'Coupe 99p B6', '1v1', 8, 'EUW', now() + interval '2 days', now() + interval '2 days', 'ouvert', null, true, true),
  ('ab0b0000-0000-0000-0000-0000000000b7', 1, :'saison', 'ab0b0000-0000-0000-0000-000000000000', 'alerte-99p-b7', 'Coupe 99p B7', '5v5', 8, 'EUW', now() + interval '2 days', now() + interval '2 days', 'ouvert', null, false, false);
insert into remplacants_disponibles (tournament_id, profile_id) values
  ('ab0b0000-0000-0000-0000-0000000000b7', 'ab0b0000-0000-0000-0000-000000000003');
set role service_role;
create temp table envoi2 as select * from public.reserver_alertes_tournoi(200);
reset role;
select verifie('Le lendemain : A est prévenu du nouveau tournoi seulement',
  (select array_agg(tournament_id) = array['ab0b0000-0000-0000-0000-0000000000b4'::uuid]
   from envoi2 where profile_id = 'ab0b0000-0000-0000-0000-000000000001'));
select verifie('Le lendemain : C est plafonné à 3 alertes',
  (select count(*) = 3 from envoi2 where profile_id = 'ab0b0000-0000-0000-0000-000000000003'));
-- Encore 25 heures plus tard : il ne reste à C que la coupe des non-classés
-- (B6) ; jamais le 5v5 où il se propose comme remplaçant (B7). A, classé,
-- n'a plus rien.
update alertes_envoyees set envoye_le = now() - interval '25 hours'
where profile_id in ('ab0b0000-0000-0000-0000-000000000001', 'ab0b0000-0000-0000-0000-000000000003')
  and envoye_le > now() - interval '2 hours';
set role service_role;
create temp table envoi3 as select * from public.reserver_alertes_tournoi(200);
reset role;
select verifie('C reçoit la coupe des non-classés, jamais le 5v5 où il se propose comme remplaçant',
  (select array_agg(tournament_id) = array['ab0b0000-0000-0000-0000-0000000000b6'::uuid]
   from envoi3 where profile_id = 'ab0b0000-0000-0000-0000-000000000003'));
select verifie('A, classé, ne reçoit ni le tournoi plafonné à Argent ni la coupe des non-classés',
  not exists (select 1 from envoi3 where profile_id = 'ab0b0000-0000-0000-0000-000000000001'));

set role authenticated;
select en_tant_que('ab0b0000-0000-0000-0000-000000000001');
select verifie('A coupe ses alertes', public.couper_alertes_tournoi());
select verifie('Plus rien à couper', not public.couper_alertes_tournoi());
reset role;

-- Compte supprimé : ses alertes disparaissent.
update profiles set supprime_le = now() where id = 'ab0b0000-0000-0000-0000-000000000003';
select verifie('Compte supprimé : alertes et historique effacés',
  not exists (select 1 from alertes_tournoi where profile_id = 'ab0b0000-0000-0000-0000-000000000003')
  and not exists (select 1 from alertes_envoyees where profile_id = 'ab0b0000-0000-0000-0000-000000000003'));

-- Rien n'est gardé plus de 30 jours.
update alertes_envoyees set envoye_le = now() - interval '31 days'
where profile_id = 'ab0b0000-0000-0000-0000-000000000004';
set role service_role;
select count(*) from public.reserver_alertes_tournoi(200);
reset role;
select verifie('Les alertes de plus de 30 jours sont effacées',
  not exists (select 1 from alertes_envoyees where envoye_le < now() - interval '30 days'));

-- Contrôle de sécurité du 20/11/2026 : chaque cas avec son joueur, les
-- autres tournois tenus pour déjà annoncés (il y a deux jours, hors
-- plafond). d1 : cas ordinaire ; d2 : suspendu ; d3 : a bloqué
-- l'organisateur ; d4 : hors communauté ; d5 : membre ; d6 : agent libre.
-- d9 : organisateur suspendu.
insert into auth.users (id, email, raw_user_meta_data)
select ('ab0b0000-0000-0000-0000-0000000001d' || n)::uuid, 'p99pd' || n || '@test',
       json_build_object('pseudo', 'Cas99p' || n, 'slug', 'cas99p' || n)::jsonb
from generate_series(1, 9) n;
insert into game_accounts (profile_id, game_id, puuid, riot_game_name, riot_tag_line, region, est_principal, verifie_le, methode_verification)
select ('ab0b0000-0000-0000-0000-0000000001d' || n)::uuid, 1, 'P99PD-' || n, 'R99pd' || n, 'EUW', 'EUW', true, now(), 'icone_profil'
from generate_series(1, 6) n;
insert into comptes_offres (profile_id, offre) values ('ab0b0000-0000-0000-0000-000000000000', 'organisateur');

set role authenticated;
select en_tant_que('ab0b0000-0000-0000-0000-000000000000');
select essai('L''organisateur crée « Club 99p »', $q$select public.creer_communaute('Club 99p', 'club-99p')$q$, 'passe');
reset role;
select id as club from communautes where slug = 'club-99p' \gset
insert into membres_communaute (communaute_id, profile_id) values (:'club', 'ab0b0000-0000-0000-0000-0000000001d5');
insert into blocages (bloqueur_id, bloque_id) values ('ab0b0000-0000-0000-0000-0000000001d3', 'ab0b0000-0000-0000-0000-000000000000');

-- Tournois des cas : C1 et C2 (même organisateur ordinaire), C3 (tournoi
-- automatique du même organisateur), C4 (organisateur suspendu), C5 (réservé
-- aux membres du club), C6 (5v5).
insert into tournaments (id, game_id, season_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, compte_pour_classement, communaute_id, reserve_membres) values
  ('ab0b0000-0000-0000-0000-0000000000c1', 1, :'saison', 'ab0b0000-0000-0000-0000-000000000000', 'cas-99p-c1', 'Cas 99p C1', '1v1', 8, 'EUW', now() + interval '2 days', now() + interval '2 days', 'ouvert', true, null, false),
  ('ab0b0000-0000-0000-0000-0000000000c2', 1, :'saison', 'ab0b0000-0000-0000-0000-000000000000', 'cas-99p-c2', 'Cas 99p C2', '1v1', 8, 'EUW', now() + interval '2 days', now() + interval '2 days', 'ouvert', true, null, false),
  ('ab0b0000-0000-0000-0000-0000000000c4', 1, :'saison', 'ab0b0000-0000-0000-0000-0000000001d9', 'cas-99p-c4', 'Cas 99p C4', '1v1', 8, 'EUW', now() + interval '2 days', now() + interval '2 days', 'ouvert', true, null, false),
  ('ab0b0000-0000-0000-0000-0000000000c5', 1, :'saison', 'ab0b0000-0000-0000-0000-000000000000', 'cas-99p-c5', 'Cas 99p C5', '1v1', 8, 'EUW', now() + interval '2 days', now() + interval '2 days', 'ouvert', true, :'club', true),
  ('ab0b0000-0000-0000-0000-0000000000c6', 1, :'saison', 'ab0b0000-0000-0000-0000-000000000000', 'cas-99p-c6', 'Cas 99p C6', '5v5', 8, 'EUW', now() + interval '2 days', now() + interval '2 days', 'ouvert', false, null, false);
insert into tournaments (id, game_id, season_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, compte_pour_classement, creneau_auto) values
  ('ab0b0000-0000-0000-0000-0000000000c3', 1, :'saison', 'ab0b0000-0000-0000-0000-000000000000', 'cas-99p-c3', 'Cas 99p C3', '1v1', 8, 'EUW', now() + interval '2 days', now() + interval '2 days', 'ouvert', true, 'essai-99p');
insert into suspensions (profile_id, motif) values ('ab0b0000-0000-0000-0000-0000000001d9', 'Test organisateur suspendu');
insert into agents_libres (tournament_id, profile_id) values ('ab0b0000-0000-0000-0000-0000000000c6', 'ab0b0000-0000-0000-0000-0000000001d6');

set role authenticated;
select en_tant_que('ab0b0000-0000-0000-0000-0000000001d1');
select essai('d1 règle ses alertes', format($q$select public.regler_alertes_tournoi(array[%L], array['1v1'])$q$, :'creneau'), 'passe');
select en_tant_que('ab0b0000-0000-0000-0000-0000000001d2');
select essai('d2 règle ses alertes', format($q$select public.regler_alertes_tournoi(array[%L], array['1v1'])$q$, :'creneau'), 'passe');
select en_tant_que('ab0b0000-0000-0000-0000-0000000001d3');
select essai('d3 règle ses alertes', format($q$select public.regler_alertes_tournoi(array[%L], array['1v1'])$q$, :'creneau'), 'passe');
select en_tant_que('ab0b0000-0000-0000-0000-0000000001d4');
select essai('d4 règle ses alertes', format($q$select public.regler_alertes_tournoi(array[%L], array['1v1'])$q$, :'creneau'), 'passe');
select en_tant_que('ab0b0000-0000-0000-0000-0000000001d5');
select essai('d5 règle ses alertes', format($q$select public.regler_alertes_tournoi(array[%L], array['1v1'])$q$, :'creneau'), 'passe');
select en_tant_que('ab0b0000-0000-0000-0000-0000000001d6');
select essai('d6 règle ses alertes', format($q$select public.regler_alertes_tournoi(array[%L], array['5v5'])$q$, :'creneau'), 'passe');
reset role;
insert into suspensions (profile_id, motif) values ('ab0b0000-0000-0000-0000-0000000001d2', 'Test joueur suspendu');

insert into alertes_envoyees (profile_id, tournament_id, envoye_le)
select p.id, t.id, now() - interval '2 days'
from tournaments t
cross join (values ('ab0b0000-0000-0000-0000-0000000001d1'::uuid, array['cas-99p-c1', 'cas-99p-c2', 'cas-99p-c3', 'cas-99p-c4']),
                   ('ab0b0000-0000-0000-0000-0000000001d2'::uuid, array['cas-99p-c1', 'cas-99p-c2', 'cas-99p-c3', 'cas-99p-c4']),
                   ('ab0b0000-0000-0000-0000-0000000001d3'::uuid, array['cas-99p-c1', 'cas-99p-c2', 'cas-99p-c3', 'cas-99p-c4']),
                   ('ab0b0000-0000-0000-0000-0000000001d4'::uuid, array['cas-99p-c5']),
                   ('ab0b0000-0000-0000-0000-0000000001d5'::uuid, array['cas-99p-c5']),
                   ('ab0b0000-0000-0000-0000-0000000001d6'::uuid, array['cas-99p-c6'])) as p(id, siens)
where not (t.slug = any (p.siens));

set role service_role;
create temp table envoi_cas as select * from public.reserver_alertes_tournoi(200);
reset role;
select verifie('Un organisateur ordinaire : une alerte par joueur et par 24 h ; ses tournois automatiques ne comptent pas ; jamais un organisateur suspendu',
  (select array_agg(tournament_id order by tournament_id) = array['ab0b0000-0000-0000-0000-0000000000c1'::uuid, 'ab0b0000-0000-0000-0000-0000000000c3'::uuid]
   from envoi_cas where profile_id = 'ab0b0000-0000-0000-0000-0000000001d1'));
select verifie('Un joueur suspendu ne reçoit rien',
  not exists (select 1 from envoi_cas where profile_id = 'ab0b0000-0000-0000-0000-0000000001d2'));
select verifie('Un joueur qui a bloqué l''organisateur ne reçoit pas ses tournois',
  not exists (select 1 from envoi_cas where profile_id = 'ab0b0000-0000-0000-0000-0000000001d3'));
select verifie('Tournoi réservé aux membres : le membre est prévenu, pas l''autre',
  exists (select 1 from envoi_cas where profile_id = 'ab0b0000-0000-0000-0000-0000000001d5' and tournament_id = 'ab0b0000-0000-0000-0000-0000000000c5')
  and not exists (select 1 from envoi_cas where profile_id = 'ab0b0000-0000-0000-0000-0000000001d4'));
select verifie('Un agent libre déjà inscrit au 5v5 n''en est pas prévenu',
  not exists (select 1 from envoi_cas where profile_id = 'ab0b0000-0000-0000-0000-0000000001d6'));
select verifie('Chaque joueur examiné est daté (rotation des passages)',
  (select bool_and(examine_le is not null) from alertes_tournoi
   where profile_id in ('ab0b0000-0000-0000-0000-0000000001d1', 'ab0b0000-0000-0000-0000-0000000001d3')));

-- Lot plein : un joueur dont une alerte est coupée par la limite garde sa
-- place en tête de file ; un joueur sans tournoi pour lui passe derrière.
update alertes_envoyees set envoye_le = now() - interval '25 hours'
where profile_id in ('ab0b0000-0000-0000-0000-0000000001d1', 'ab0b0000-0000-0000-0000-0000000001d5');
update alertes_tournoi set examine_le = null
where profile_id in ('ab0b0000-0000-0000-0000-0000000001d1', 'ab0b0000-0000-0000-0000-0000000001d3',
                     'ab0b0000-0000-0000-0000-0000000001d5');
insert into tournaments (id, game_id, season_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, compte_pour_classement, creneau_auto) values
  ('ab0b0000-0000-0000-0000-0000000000c7', 1, :'saison', 'ab0b0000-0000-0000-0000-000000000000', 'cas-99p-c7', 'Cas 99p C7', '1v1', 8, 'EUW', now() + interval '2 days', now() + interval '2 days', 'ouvert', true, 'essai-99p-b');
set role service_role;
create temp table envoi_lot as select * from public.reserver_alertes_tournoi(1);
reset role;
select verifie('Lot d''une alerte : une seule réservée (C2 pour d1)',
  (select array_agg(tournament_id) = array['ab0b0000-0000-0000-0000-0000000000c2'::uuid] from envoi_lot
   where profile_id = 'ab0b0000-0000-0000-0000-0000000001d1')
  and (select count(*) = 1 from envoi_lot));
select verifie('d1 et d5, dont une alerte (C7) a été coupée, restent en tête de file ; d3, sans tournoi pour lui, passe derrière',
  (select count(*) = 2 from alertes_tournoi
   where profile_id in ('ab0b0000-0000-0000-0000-0000000001d1', 'ab0b0000-0000-0000-0000-0000000001d5') and examine_le is null)
  and (select examine_le is not null from alertes_tournoi where profile_id = 'ab0b0000-0000-0000-0000-0000000001d3'));
