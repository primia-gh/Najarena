-- Revue de match et dossier de litige rédigés par l'IA (audit N25, N28).
\set ON_ERROR_STOP 0

-- Le serveur a écrit une revue pour Bob et un dossier pour le litige du
-- match Bob-Carol (tournoi d'Alice, données de 10-donnees.sql).
insert into revues_match_ia (match_id, profile_id, points, conseil, modele)
values ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', array['Constat'], 'Conseil', 'essai');
insert into dossiers_litige (dispute_id, faits, synthese, modele)
values ('60000000-0000-0000-0000-000000000001', array['Fait'], '{}'::jsonb, 'essai');

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-00000000000b');
select essai('Bob lit sa revue', $q$select 1 from revues_match_ia$q$, 'passe');
select essai('Bob écrit lui-même une revue',
  $q$insert into revues_match_ia (match_id, profile_id, points, conseil, modele) values ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', array['x'], 'y', 'z')$q$, 'bloque');
select essai('Bob, joueur du litige, ne lit pas le dossier préparé pour l''organisatrice', $q$select 1 from dossiers_litige$q$, 'bloque');
select en_tant_que('00000000-0000-0000-0000-00000000000c');
select essai('Carol ne lit pas la revue de Bob', $q$select 1 from revues_match_ia$q$, 'bloque');
select en_tant_que('00000000-0000-0000-0000-00000000000a');
select essai('Alice, organisatrice, lit le dossier du litige', $q$select 1 from dossiers_litige$q$, 'passe');
select essai('Alice modifie le dossier', $q$update dossiers_litige set faits = array['Autre']$q$, 'bloque');
reset role;
