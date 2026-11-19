-- Tournois par niveau (19/11/2026).
\set ON_ERROR_STOP 0

insert into tiers (id, game_id, nom, rating_min, ordre) values
  (1, 1, 'Bronze', 0, 1), (2, 1, 'Argent', 1300, 2), (3, 1, 'Or', 1450, 3),
  (4, 1, 'Platine', 1600, 4), (5, 1, 'Diamant', 1750, 5), (6, 1, 'Champion', 1900, 6)
on conflict do nothing;

-- Oli organise ; Ana n'a jamais joué (1500) ; Bea est à 1700 (Platine) ;
-- Cid à 1350 (Argent).
insert into auth.users (id, email, raw_user_meta_data)
select ('9b0b0000-0000-0000-0000-00000000000' || n)::uuid, 'p99k' || n || '@test',
       json_build_object('pseudo', 'Niveau99k' || n, 'slug', 'niveau99k' || n)::jsonb
from generate_series(1, 4) n;
insert into ratings (profile_id, game_id, season_id, rating, rd, volatilite, matchs_joues) values
  ('9b0b0000-0000-0000-0000-000000000003', 1, (select id from seasons where est_courante), 1700, 120, 0.06, 12),
  ('9b0b0000-0000-0000-0000-000000000004', 1, (select id from seasons where est_courante), 1350, 200, 0.06, 4);

set role authenticated;
select en_tant_que('9b0b0000-0000-0000-0000-000000000001');
select essai('Oli crée un tournoi « Or à Platine » (1450 inclus, 1750 exclu)',
  $q$insert into tournaments (id, game_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, rating_min, rating_max)
     values ('9b0b0000-0000-0000-0000-0000000000a1', 1, '9b0b0000-0000-0000-0000-000000000001', 'tournoi-99k-a', 'Coupe niveau A', '1v1', 8, 'EUW',
             now() + interval '3 days', now() + interval '3 days', 'ouvert', 1450, 1750)$q$,
  'passe');
select refus('Une borne qui n''est pas un seuil de palier',
  $q$insert into tournaments (game_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, rating_min)
     values (1, '9b0b0000-0000-0000-0000-000000000001', 'tournoi-99k-b', 'Coupe niveau B', '1v1', 8, 'EUW', now() + interval '3 days', now() + interval '3 days', 'ouvert', 1400)$q$,
  'NIVEAU_INVALIDE');
select refus('Le seuil du Bronze (0) n''est pas une borne',
  $q$insert into tournaments (game_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, rating_min)
     values (1, '9b0b0000-0000-0000-0000-000000000001', 'tournoi-99k-c', 'Coupe niveau C', '1v1', 8, 'EUW', now() + interval '3 days', now() + interval '3 days', 'ouvert', 0)$q$,
  'NIVEAU_INVALIDE');
select refus('Minimum au-dessus du maximum',
  $q$insert into tournaments (game_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, rating_min, rating_max)
     values (1, '9b0b0000-0000-0000-0000-000000000001', 'tournoi-99k-d', 'Coupe niveau D', '1v1', 8, 'EUW', now() + interval '3 days', now() + interval '3 days', 'ouvert', 1600, 1450)$q$,
  'NIVEAU_INVALIDE');
select refus('Pas de niveau pour un tournoi 5v5',
  $q$insert into tournaments (game_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, compte_pour_classement, rating_min)
     values (1, '9b0b0000-0000-0000-0000-000000000001', 'tournoi-99k-e', 'Coupe niveau E', '5v5', 8, 'EUW', now() + interval '3 days', now() + interval '3 days', 'ouvert', false, 1450)$q$,
  'NIVEAU_1V1_SEULEMENT');
select refus('L''organisateur ne change pas le niveau par une écriture directe',
  $q$update tournaments set rating_min = 1300 where id = '9b0b0000-0000-0000-0000-0000000000a1'$q$,
  'CHAMP_NON_MODIFIABLE');
reset role;

-- Inscriptions (le déclencheur s'applique à toute écriture).
select essai('Ana (jamais joué : 1500) entre dans « Or à Platine »',
  $q$insert into registrations (tournament_id, profile_id, statut) values ('9b0b0000-0000-0000-0000-0000000000a1', '9b0b0000-0000-0000-0000-000000000002', 'inscrit')$q$,
  'passe');
select essai('Bea (1700) entre',
  $q$insert into registrations (tournament_id, profile_id, statut) values ('9b0b0000-0000-0000-0000-0000000000a1', '9b0b0000-0000-0000-0000-000000000003', 'inscrit')$q$,
  'passe');
select refus('Cid (1350) est sous le niveau',
  $q$insert into registrations (tournament_id, profile_id, statut) values ('9b0b0000-0000-0000-0000-0000000000a1', '9b0b0000-0000-0000-0000-000000000004', 'inscrit')$q$,
  'NIVEAU_HORS_TOURNOI');

-- Bea monte à 1760 (Diamant) avant le check-in : elle ne confirme plus.
update ratings set rating = 1760 where profile_id = '9b0b0000-0000-0000-0000-000000000003';
select refus('Bea, passée au-dessus du niveau, ne confirme pas sa présence',
  $q$update registrations set statut = 'confirme' where tournament_id = '9b0b0000-0000-0000-0000-0000000000a1' and profile_id = '9b0b0000-0000-0000-0000-000000000003'$q$,
  'NIVEAU_HORS_TOURNOI');
select essai('Ana confirme',
  $q$update registrations set statut = 'confirme' where tournament_id = '9b0b0000-0000-0000-0000-0000000000a1' and profile_id = '9b0b0000-0000-0000-0000-000000000002'$q$,
  'passe');
select essai('Bea peut être déclarée absente (le niveau ne bloque que l''entrée)',
  $q$update registrations set statut = 'absent' where tournament_id = '9b0b0000-0000-0000-0000-0000000000a1' and profile_id = '9b0b0000-0000-0000-0000-000000000003'$q$,
  'passe');

-- Modification avant la première inscription : le niveau aussi.
insert into tournaments (id, game_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut)
values ('9b0b0000-0000-0000-0000-0000000000a2', 1, '9b0b0000-0000-0000-0000-000000000001', 'tournoi-99k-f', 'Coupe niveau F', '1v1', 8, 'EUW',
        now() + interval '3 days', now() + interval '3 days', 'ouvert');
set role authenticated;
select en_tant_que('9b0b0000-0000-0000-0000-000000000001');
select essai('Oli réserve son tournoi « Argent à Or » en le modifiant',
  $q$select public.modifier_tournoi('9b0b0000-0000-0000-0000-0000000000a2', 'Coupe niveau F', 8, 1, 'EUW',
     now() + interval '3 days', now() + interval '3 days', 1300, 1600)$q$,
  'passe');
select refus('Bornes égales',
  $q$select public.modifier_tournoi('9b0b0000-0000-0000-0000-0000000000a2', 'Coupe niveau F', 8, 1, 'EUW',
     now() + interval '3 days', now() + interval '3 days', 1450, 1450)$q$,
  'NIVEAU_INVALIDE');
reset role;
select verifie('Niveau enregistré : 1300 à 1600',
  (select rating_min = 1300 and rating_max = 1600 from tournaments where id = '9b0b0000-0000-0000-0000-0000000000a2'));
set role authenticated;
select en_tant_que('9b0b0000-0000-0000-0000-000000000001');
select essai('Oli rouvre son tournoi à tous',
  $q$select public.modifier_tournoi('9b0b0000-0000-0000-0000-0000000000a2', 'Coupe niveau F', 8, 1, 'EUW',
     now() + interval '3 days', now() + interval '3 days', null, null)$q$,
  'passe');
reset role;
select verifie('Plus de niveau',
  (select rating_min is null and rating_max is null from tournaments where id = '9b0b0000-0000-0000-0000-0000000000a2'));

-- Contrôle de sécurité du 19/11/2026 : changer seulement le niveau d'un
-- tournoi publié repose sa date de publication (règle « publié 24 h
-- avant » d'un tournoi classé), comme la date, le serveur ou la capacité.
-- Tournoi dans 2 heures, publié il y a 3 jours (le déclencheur pose seul
-- la date de publication : il est suspendu le temps de la préparer).
alter table tournaments disable trigger controle_classement_tournoi;
update tournaments
set publie_le = now() - interval '3 days', debute_le = now() + interval '2 hours', checkin_ouvre_le = now() + interval '1 hour'
where id = '9b0b0000-0000-0000-0000-0000000000a2';
alter table tournaments enable trigger controle_classement_tournoi;
select verifie('Avant : publié à temps',
  (select publie_a_temps from public.criteres_tournoi_classe('9b0b0000-0000-0000-0000-0000000000a2')));
set role authenticated;
select en_tant_que('9b0b0000-0000-0000-0000-000000000001');
select essai('Oli ne change que le niveau (« Bronze à Argent »)',
  $q$select public.modifier_tournoi('9b0b0000-0000-0000-0000-0000000000a2', 'Coupe niveau F', 8, 1, 'EUW',
     (select debute_le from tournaments where id = '9b0b0000-0000-0000-0000-0000000000a2'),
     (select checkin_ouvre_le from tournaments where id = '9b0b0000-0000-0000-0000-0000000000a2'), null, 1450)$q$,
  'passe');
reset role;
select verifie('Changer le niveau repose la date de publication : plus « publié à temps »',
  (select rating_max = 1450 and publie_le > now() - interval '1 minute' from tournaments where id = '9b0b0000-0000-0000-0000-0000000000a2')
  and not (select publie_a_temps from public.criteres_tournoi_classe('9b0b0000-0000-0000-0000-0000000000a2')));

-- Jamais pour un tournoi automatique.
select refus('Pas de niveau pour un tournoi automatique',
  $q$insert into tournaments (game_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, creneau_auto, rating_min)
     values (1, '9b0b0000-0000-0000-0000-000000000001', 'najarena-99k-auto', 'Daily niveau', '1v1', 16, 'EUW', now() + interval '6 hours', now() + interval '5 hours', 'ouvert', 'test-99k', 1450)$q$,
  'NIVEAU_1V1_SEULEMENT');

-- ---------- Limite haute : meilleur rating de la saison (décision du 19/11/2026) ----------
-- Tournoi « Bronze à Argent » (sous 1450). Cid est à 1350 mais avait
-- atteint 1500 cette saison (il est redescendu) ; Eve est à 1380, son
-- meilleur est 1420.
insert into auth.users (id, email, raw_user_meta_data) values
  ('9b0b0000-0000-0000-0000-000000000005', 'p99k5@test', '{"pseudo": "Niveau99k5", "slug": "niveau99k5"}'::jsonb);
insert into ratings (profile_id, game_id, season_id, rating, rd, volatilite, matchs_joues) values
  ('9b0b0000-0000-0000-0000-000000000005', 1, (select id from seasons where est_courante), 1380, 200, 0.06, 4);
insert into rating_events (profile_id, game_id, season_id, motif, rating_avant, rd_avant, rating_apres, rd_apres) values
  ('9b0b0000-0000-0000-0000-000000000004', 1, (select id from seasons where est_courante), 'tournoi', 1450, 220, 1500, 210),
  ('9b0b0000-0000-0000-0000-000000000004', 1, (select id from seasons where est_courante), 'tournoi', 1500, 210, 1350, 200),
  ('9b0b0000-0000-0000-0000-000000000005', 1, (select id from seasons where est_courante), 'tournoi', 1500, 250, 1420, 230),
  ('9b0b0000-0000-0000-0000-000000000005', 1, (select id from seasons where est_courante), 'tournoi', 1420, 230, 1380, 200);
set role authenticated;
select en_tant_que('9b0b0000-0000-0000-0000-000000000004');
select verifie('Cid lit son niveau : 1350 aujourd''hui, 1500 au mieux, a déjà joué',
  (select actuel = 1350 and meilleur = 1500 and a_joue from public.mon_niveau_tournoi()));
select en_tant_que('9b0b0000-0000-0000-0000-000000000005');
select verifie('Eve lit son niveau : 1380 aujourd''hui, 1420 au mieux',
  (select actuel = 1380 and meilleur = 1420 from public.mon_niveau_tournoi()));
reset role;
select refus('Cid, redescendu à 1350 après 1500, n''entre pas en « Bronze à Argent »',
  $q$insert into registrations (tournament_id, profile_id, statut) values ('9b0b0000-0000-0000-0000-0000000000a2', '9b0b0000-0000-0000-0000-000000000004', 'inscrit')$q$,
  'NIVEAU_HORS_TOURNOI');
select essai('Eve (meilleur 1420) entre en « Bronze à Argent »',
  $q$insert into registrations (tournament_id, profile_id, statut) values ('9b0b0000-0000-0000-0000-0000000000a2', '9b0b0000-0000-0000-0000-000000000005', 'inscrit')$q$,
  'passe');
select verifie('Le plancher reste lu sur le rating actuel : Cid (1350) entre en « Argent et plus »',
  public.rating_niveau('9b0b0000-0000-0000-0000-000000000004') >= 1300);
