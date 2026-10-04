-- Rappels et alertes des tournois automatiques : une seule fois par tournoi et par type.
\set ON_ERROR_STOP 0
set role service_role;
select essai('Serveur : alerte « clé Riot expirée » réservée pour un tournoi',
  $q$insert into rappels_tournoi (tournament_id, type) values ('10000000-0000-0000-0000-000000000004', 'cle_riot_invalide')$q$, 'passe');
select essai('Serveur : la même alerte une deuxième fois (déjà envoyée)',
  $q$insert into rappels_tournoi (tournament_id, type) values ('10000000-0000-0000-0000-000000000004', 'cle_riot_invalide')$q$, 'bloque');
select essai('Serveur : type de rappel inconnu',
  $q$insert into rappels_tournoi (tournament_id, type) values ('10000000-0000-0000-0000-000000000004', 'n_importe_quoi')$q$, 'bloque');
reset role;
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-00000000000e');
select essai('Eve lit la table des rappels (réservée au serveur)',
  $q$select * from rappels_tournoi$q$, 'bloque');
reset role;
