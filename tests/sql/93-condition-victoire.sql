-- Conditions de victoire du 1v1 : choisies à la création, figées ensuite (audit N5).
\set ON_ERROR_STOP 0

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-00000000000a');
select essai('Alice crée un tournoi au 1v1 classique',
  $q$insert into tournaments (id, game_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, condition_victoire) values ('93000000-0000-0000-0000-000000000001', 1, '00000000-0000-0000-0000-00000000000a', 'classique-alice', 'Classique Alice', '1v1', 8, 'EUW', now() + interval '3 days', now() + interval '3 days', 'ouvert', 'classique')$q$, 'passe');
select refus('Alice repasse son tournoi au Nexus après sa création',
  $q$update tournaments set condition_victoire = 'nexus' where id = '93000000-0000-0000-0000-000000000001'$q$, 'CHAMP_NON_MODIFIABLE');
select essai('Alice invente une condition de victoire',
  $q$insert into tournaments (game_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, condition_victoire) values (1, '00000000-0000-0000-0000-00000000000a', 'invente-alice', 'Invente', '1v1', 8, 'EUW', now() + interval '3 days', now() + interval '3 days', 'ouvert', 'premier_mort')$q$, 'bloque');
select essai('Alice applique la règle du 1v1 à un tournoi 5v5',
  $q$insert into tournaments (game_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, condition_victoire) values (1, '00000000-0000-0000-0000-00000000000a', 'cinq-alice', 'Cinq', '5v5', 8, 'EUW', now() + interval '3 days', now() + interval '3 days', 'ouvert', 'classique')$q$, 'bloque');
reset role;

select verifie('Tournoi sans condition précisée : destruction du Nexus',
  (select condition_victoire = 'nexus' from tournaments where id = '10000000-0000-0000-0000-000000000001'));
