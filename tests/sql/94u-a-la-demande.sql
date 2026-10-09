-- Tournois à la demande (idée en réserve n°11) : 8 joueurs disponibles à
-- la même heure ouvrent un tournoi et y sont inscrits.
\set ON_ERROR_STOP 0

-- Dix joueurs EUW vérifiés (…2d0 à …2d9), Nina joue sur NA (…2da), Omar
-- n'a pas de compte Riot (…2db), Pia est suspendue (…2dc).
insert into auth.users (id, email, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000002d' || n)::uuid, 'dispo' || n || '@test',
       jsonb_build_object('pseudo', 'Dispo' || n, 'slug', 'dispo' || n)
from generate_series(0, 9) n;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000002da', 'nina@test', '{"pseudo":"Nina","slug":"nina"}'),
  ('00000000-0000-0000-0000-0000000002db', 'omar@test', '{"pseudo":"Omar","slug":"omar"}'),
  ('00000000-0000-0000-0000-0000000002dc', 'pia2@test', '{"pseudo":"PiaD","slug":"piad"}');
insert into game_accounts (profile_id, game_id, puuid, riot_game_name, riot_tag_line, region, est_principal, verifie_le, methode_verification)
select ('00000000-0000-0000-0000-0000000002d' || n)::uuid, 1, 'P-DISPO-' || n, 'Dispo' || n, 'EUW', 'EUW', true, now(), 'icone_profil'
from generate_series(0, 9) n;
insert into game_accounts (profile_id, game_id, puuid, riot_game_name, riot_tag_line, region, est_principal, verifie_le, methode_verification) values
  ('00000000-0000-0000-0000-0000000002da', 1, 'P-NINA', 'Nina', 'NA1', 'NA', true, now(), 'icone_profil'),
  ('00000000-0000-0000-0000-0000000002dc', 1, 'P-PIAD', 'PiaD', 'EUW', 'EUW', true, now(), 'icone_profil');
insert into suspensions (profile_id, motif) values ('00000000-0000-0000-0000-0000000002dc', 'Essai disponibilités');

-- Heures d'essai : après-demain à 20 h, 21 h et 22 h (heure de Paris).
select (date_trunc('day', now() at time zone 'Europe/Paris') + interval '2 days 20 hours') at time zone 'Europe/Paris' as h20,
       (date_trunc('day', now() at time zone 'Europe/Paris') + interval '2 days 21 hours') at time zone 'Europe/Paris' as h21,
       (date_trunc('day', now() at time zone 'Europe/Paris') + interval '2 days 22 hours') at time zone 'Europe/Paris' as h22,
       (date_trunc('day', now() at time zone 'Europe/Paris') + interval '2 days 20 hours 30 minutes') at time zone 'Europe/Paris' as h2030,
       (date_trunc('day', now() at time zone 'Europe/Paris') + interval '2 days 3 hours') at time zone 'Europe/Paris' as h03,
       (date_trunc('day', now() at time zone 'Europe/Paris') + interval '4 days 20 hours') at time zone 'Europe/Paris' as loin
\gset

-- Le quotidien est déjà prévu à 22 h.
insert into tournaments (game_id, season_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, creneau_auto)
values (1, (select id from seasons where est_courante), '00000000-0000-0000-0000-00000000000a', 'essai-quotidien-22h', 'Essai quotidien 22h',
        '1v1', 16, 'EUW', :'h22', (:'h22')::timestamptz - interval '30 minutes', 'ouvert', 'quotidien-21h');

set role anon;
select essai('Visiteur : se déclare disponible', format($q$select public.declarer_disponibilite(%L)$q$, :'h20'), 'bloque');
select essai('Visiteur : voit combien de joueurs sont disponibles', $q$select count(*) from public.disponibilites_creneaux('EUW')$q$, 'passe');
reset role;

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000002d0');
select refus('Heure qui n''est pas pleine', format($q$select public.declarer_disponibilite(%L)$q$, :'h2030'), 'HEURE_INVALIDE');
select refus('3 h du matin', format($q$select public.declarer_disponibilite(%L)$q$, :'h03'), 'HEURE_INVALIDE');
select refus('Plus de 3 jours à l''avance', format($q$select public.declarer_disponibilite(%L)$q$, :'loin'), 'HEURE_INVALIDE');
select refus('Dans moins de 90 minutes',
  format($q$select public.declarer_disponibilite(%L)$q$, date_trunc('hour', now() + interval '1 hour')), 'HEURE_INVALIDE');
select refus('À l''heure du quotidien déjà prévu', format($q$select public.declarer_disponibilite(%L)$q$, :'h22'), 'TOURNOI_DEJA_PREVU');
select essai('Dispo0 se déclare disponible à 20 h', format($q$select 1 where public.declarer_disponibilite(%L) = 1$q$, :'h20'), 'passe');
select essai('Dispo0 se déclare une deuxième fois : compté une seule fois',
  format($q$select 1 where public.declarer_disponibilite(%L) = 1$q$, :'h20'), 'passe');
select essai('Dispo0 écrit elle-même une disponibilité',
  format($q$insert into disponibilites (profile_id, region, debut) values ('00000000-0000-0000-0000-0000000002d0', 'EUW', %L)$q$, :'h21'), 'bloque');
select en_tant_que('00000000-0000-0000-0000-0000000002db');
select refus('Omar, sans compte Riot', format($q$select public.declarer_disponibilite(%L)$q$, :'h20'), 'COMPTE_RIOT_REQUIS');
select en_tant_que('00000000-0000-0000-0000-0000000002dc');
select refus('PiaD, suspendue', format($q$select public.declarer_disponibilite(%L)$q$, :'h20'), 'COMPTE_SUSPENDU');
select en_tant_que('00000000-0000-0000-0000-0000000002da');
select essai('Nina (NA) se déclare disponible à 20 h : compte à part',
  format($q$select 1 where public.declarer_disponibilite(%L) = 1$q$, :'h20'), 'passe');
reset role;

-- Six de plus à 20 h : 7 en EUW.
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000002d1'); select public.declarer_disponibilite(:'h20');
select en_tant_que('00000000-0000-0000-0000-0000000002d2'); select public.declarer_disponibilite(:'h20');
select en_tant_que('00000000-0000-0000-0000-0000000002d3'); select public.declarer_disponibilite(:'h20');
select en_tant_que('00000000-0000-0000-0000-0000000002d4'); select public.declarer_disponibilite(:'h20');
select en_tant_que('00000000-0000-0000-0000-0000000002d5'); select public.declarer_disponibilite(:'h20');
select en_tant_que('00000000-0000-0000-0000-0000000002d6'); select public.declarer_disponibilite(:'h20');
select essai('Dispo6 ne voit que ses propres disponibilités',
  $q$select 1 where (select count(*) from disponibilites) = 1$q$, 'passe');
select verifie('Le nombre de disponibles est public, pas leurs noms',
  (select joueurs from public.disponibilites_creneaux('EUW') where debut = :'h20') = 7);
reset role;

set role service_role;
select verifie('À 7 joueurs, aucun tournoi ne s''ouvre',
  not exists (select 1 from public.ouvrir_tournois_a_la_demande('00000000-0000-0000-0000-00000000000a')));
reset role;

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000002d7');
select essai('Dispo7, huitième joueur disponible à 20 h',
  format($q$select 1 where public.declarer_disponibilite(%L) = 8$q$, :'h20'), 'passe');
reset role;

set role service_role;
create temp table ouverts as
  select * from public.ouvrir_tournois_a_la_demande('00000000-0000-0000-0000-00000000000a');
reset role;
select verifie('À 8 joueurs, un tournoi s''ouvre avec les 8 inscrits',
  (select count(*) from ouverts) = 1 and (select cardinality(inscrits) from ouverts) = 8);
select tournament_id as tournoi_demande from ouverts \gset
select verifie('Tournoi 1v1 à 20 h, région EUW, 16 places, check-in 30 min avant, ouvert',
  exists (select 1 from tournaments where id = :'tournoi_demande' and format = '1v1' and region = 'EUW'
          and debute_le = :'h20' and capacite = 16 and checkin_ouvre_le = debute_le - interval '30 minutes'
          and statut = 'ouvert' and creneau_auto = 'a-la-demande' and nature = 'tournoi'));
select verifie('Les 8 joueurs sont inscrits',
  (select count(*) from registrations where tournament_id = :'tournoi_demande' and statut = 'inscrit') = 8);
select verifie('Les disponibilités EUW de 20 h sont effacées, celle de Nina (NA) reste',
  not exists (select 1 from disponibilites where region = 'EUW' and debut = :'h20')
  and exists (select 1 from disponibilites where profile_id = '00000000-0000-0000-0000-0000000002da'));
select verifie('Un tournoi à la demande n''est pas officiel (règle des tournois d''organisateur)',
  (select not officiel from public.criteres_tournoi_classe(:'tournoi_demande')));
select verifie('Le quotidien reste officiel',
  (select officiel from public.criteres_tournoi_classe((select id from tournaments where slug = 'essai-quotidien-22h'))));

set role service_role;
select verifie('Passage suivant : rien de plus',
  not exists (select 1 from public.ouvrir_tournois_a_la_demande('00000000-0000-0000-0000-00000000000a')));
reset role;

-- Retrait, et plafond de 8 heures à venir.
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000002d8');
select public.declarer_disponibilite(:'h21');
select essai('Dispo8 retire sa disponibilité de 21 h', format($q$select 1 where public.retirer_disponibilite(%L)$q$, :'h21'), 'passe');
select verifie('Plus de disponibilité pour Dispo8', not exists (select 1 from disponibilites));
select public.declarer_disponibilite((date_trunc('day', now() at time zone 'Europe/Paris') + make_interval(days => 2, hours => h)) at time zone 'Europe/Paris')
from generate_series(12, 19) h;
select refus('Dispo8 : neuvième heure à venir',
  format($q$select public.declarer_disponibilite(%L)$q$, :'h21'), 'LIMITE_DISPONIBILITES');
reset role;

set role service_role;
select essai('Serveur : efface les disponibilités passées', $q$select public.effacer_disponibilites_passees()$q$, 'passe');
reset role;
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000002d8');
select essai('Un joueur ne lance pas lui-même l''ouverture des tournois',
  $q$select public.ouvrir_tournois_a_la_demande('00000000-0000-0000-0000-0000000002d8')$q$, 'bloque');
reset role;
