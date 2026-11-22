-- Lancement anticipé d'un tournoi classé et « absent » avant le check-in
-- (contrôle de sécurité complet du 21/11/2026, M1).
\set ON_ERROR_STOP 0

-- 0 organise ; 1 et 2 sont inscrits.
insert into auth.users (id, email, raw_user_meta_data)
select ('ad0d0000-0000-0000-0000-00000000000' || n)::uuid, 'p99r' || n || '@test',
       json_build_object('pseudo', 'Lance99r' || n, 'slug', 'lance99r' || n)::jsonb
from generate_series(0, 2) n;
select id as saison from seasons where est_courante \gset

-- a1 : publié il y a une heure, annoncé dans 30 h (« 24 h avant » tenu sur le papier).
-- a2 : publié il y a 30 h, annoncé maintenant.
-- a3 : check-in dans une heure.
insert into tournaments (id, game_id, season_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, compte_pour_classement) values
  ('ad0d0000-0000-0000-0000-0000000000a1', 1, :'saison', 'ad0d0000-0000-0000-0000-000000000000', 'lance-99r-a1', 'Coupe 99r A', '1v1', 8, 'EUW', now() + interval '30 hours', now() + interval '29 hours', 'ouvert', true),
  ('ad0d0000-0000-0000-0000-0000000000a2', 1, :'saison', 'ad0d0000-0000-0000-0000-000000000000', 'lance-99r-a2', 'Coupe 99r B', '1v1', 8, 'EUW', now(), now() - interval '1 hour', 'ouvert', true),
  ('ad0d0000-0000-0000-0000-0000000000a3', 1, :'saison', 'ad0d0000-0000-0000-0000-000000000000', 'lance-99r-a3', 'Coupe 99r C', '1v1', 8, 'EUW', now() + interval '2 hours', now() + interval '1 hour', 'ouvert', true);
-- Publication antidatée (le déclencheur la pose seul).
alter table tournaments disable trigger controle_classement_tournoi;
update tournaments set publie_le = now() - interval '1 hour' where id = 'ad0d0000-0000-0000-0000-0000000000a1';
update tournaments set publie_le = now() - interval '30 hours' where id = 'ad0d0000-0000-0000-0000-0000000000a2';
alter table tournaments enable trigger controle_classement_tournoi;

select verifie('À la création, aucune heure de lancement',
  (select bool_and(lance_le is null) from tournaments where organisateur_id = 'ad0d0000-0000-0000-0000-000000000000'));
select verifie('Avant le lancement, A est « publié à temps » (date annoncée dans 30 h)',
  (select publie_a_temps from criteres_tournoi_classe('ad0d0000-0000-0000-0000-0000000000a1')));

-- L'organisateur lance A tout de suite, 29 h avant l'heure annoncée.
set role authenticated;
select en_tant_que('ad0d0000-0000-0000-0000-000000000000');
select essai('L''organisateur lance A en avance',
  $q$update tournaments set statut = 'en_cours' where id = 'ad0d0000-0000-0000-0000-0000000000a1'$q$, 'passe');
select essai('Il tente de reculer l''heure du lancement',
  $q$update tournaments set lance_le = now() + interval '3 days' where id = 'ad0d0000-0000-0000-0000-0000000000a1'$q$, 'passe');
reset role;
select verifie('La base a noté l''heure réelle du lancement, pas la sienne',
  (select lance_le > now() - interval '1 minute' and lance_le <= now() from tournaments where id = 'ad0d0000-0000-0000-0000-0000000000a1'));
select verifie('La publication antidatée est bien en place',
  (select publie_le < now() - interval '59 minutes' from tournaments where id = 'ad0d0000-0000-0000-0000-0000000000a1'));
select verifie('Lancé une heure après sa publication : plus « publié à temps », donc pas classé',
  (select not publie_a_temps and not classe from criteres_tournoi_classe('ad0d0000-0000-0000-0000-0000000000a1')));

-- Même le serveur n'écrit pas lance_le à la main.
update tournaments set lance_le = now() + interval '3 days' where id = 'ad0d0000-0000-0000-0000-0000000000a1';
select verifie('Le serveur non plus ne réécrit pas l''heure du lancement',
  (select lance_le <= now() from tournaments where id = 'ad0d0000-0000-0000-0000-0000000000a1'));
insert into tournaments (id, game_id, season_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, lance_le) values
  ('ad0d0000-0000-0000-0000-0000000000a4', 1, :'saison', 'ad0d0000-0000-0000-0000-000000000000', 'lance-99r-a4', 'Coupe 99r D', '1v1', 8, 'EUW', now() + interval '2 days', now() + interval '2 days', 'ouvert', now() + interval '5 days');
select verifie('Une heure de lancement fournie à la création est ignorée',
  (select lance_le is null from tournaments where id = 'ad0d0000-0000-0000-0000-0000000000a4'));

-- B, publié 30 h avant, lancé à l'heure : reste « publié à temps ».
set role authenticated;
select en_tant_que('ad0d0000-0000-0000-0000-000000000000');
select essai('L''organisateur lance B à l''heure',
  $q$update tournaments set statut = 'en_cours' where id = 'ad0d0000-0000-0000-0000-0000000000a2'$q$, 'passe');
reset role;
select verifie('B lancé à l''heure reste « publié à temps »',
  (select publie_a_temps from criteres_tournoi_classe('ad0d0000-0000-0000-0000-0000000000a2')));

-- « Absent » seulement une fois le check-in ouvert.
insert into registrations (tournament_id, profile_id, statut) values
  ('ad0d0000-0000-0000-0000-0000000000a3', 'ad0d0000-0000-0000-0000-000000000001', 'inscrit'),
  ('ad0d0000-0000-0000-0000-0000000000a3', 'ad0d0000-0000-0000-0000-000000000002', 'inscrit');
set role authenticated;
select en_tant_que('ad0d0000-0000-0000-0000-000000000000');
select refus('L''organisateur marque un joueur absent avant l''ouverture du check-in',
  $q$update registrations set statut = 'absent' where tournament_id = 'ad0d0000-0000-0000-0000-0000000000a3' and profile_id = 'ad0d0000-0000-0000-0000-000000000001'$q$,
  'CHECKIN_PAS_OUVERT');
select essai('Il peut toujours confirmer un joueur',
  $q$update registrations set statut = 'confirme', confirme_le = now() where tournament_id = 'ad0d0000-0000-0000-0000-0000000000a3' and profile_id = 'ad0d0000-0000-0000-0000-000000000002'$q$,
  'passe');
reset role;
update tournaments set checkin_ouvre_le = now() - interval '1 minute' where id = 'ad0d0000-0000-0000-0000-0000000000a3';
set role authenticated;
select en_tant_que('ad0d0000-0000-0000-0000-000000000000');
select essai('Check-in ouvert : l''organisateur marque le joueur absent',
  $q$update registrations set statut = 'absent' where tournament_id = 'ad0d0000-0000-0000-0000-0000000000a3' and profile_id = 'ad0d0000-0000-0000-0000-000000000001'$q$,
  'passe');
reset role;
select verifie('Le joueur est absent',
  (select statut = 'absent' from registrations where tournament_id = 'ad0d0000-0000-0000-0000-0000000000a3' and profile_id = 'ad0d0000-0000-0000-0000-000000000001'));
