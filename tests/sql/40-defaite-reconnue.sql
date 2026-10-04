-- Défaite reconnue par le perdant (audit N3).
\set ON_ERROR_STOP 0

-- Deux matchs dans le tournoi en cours : Bob-Carol en cours, Eve-Gina en litige.
insert into matches (id, tournament_id, tour, position, statut, demarre_le) values
  ('50000000-0000-0000-0000-000000000020', '10000000-0000-0000-0000-000000000003', 1, 2, 'en_cours', now() - interval '30 minutes'),
  ('50000000-0000-0000-0000-000000000021', '10000000-0000-0000-0000-000000000003', 1, 3, 'litige',   now() - interval '2 hours');
insert into match_participants (match_id, profile_id, slot) values
  ('50000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-00000000000b', 1),
  ('50000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-00000000000c', 2),
  ('50000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-00000000000e', 1),
  ('50000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000010', 2);

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000010');
select essai('Gina reconnaît une défaite dans un match qui n''est pas le sien',
  $q$select public.reconnaitre_defaite('50000000-0000-0000-0000-000000000020')$q$, 'bloque');
select en_tant_que('00000000-0000-0000-0000-00000000000b');
select essai('Bob reconnaît sa défaite dans son match en cours',
  $q$select public.reconnaitre_defaite('50000000-0000-0000-0000-000000000020')$q$, 'passe');
select essai('Bob appelle lui-même la fonction qui tranche (réservée au serveur)',
  $q$select public.enregistrer_defaite_reconnue('50000000-0000-0000-0000-000000000020')$q$, 'bloque');
select en_tant_que('00000000-0000-0000-0000-00000000000c');
select essai('Carol reconnaît à son tour sa défaite dans le même match',
  $q$select public.reconnaitre_defaite('50000000-0000-0000-0000-000000000020')$q$, 'bloque');
select en_tant_que('00000000-0000-0000-0000-00000000000a');
select essai('Alice (organisatrice) efface la défaite reconnue par appel direct',
  $q$update matches set defaite_reconnue_par = null where id = '50000000-0000-0000-0000-000000000020'$q$, 'bloque');
reset role;

select verifie('Match en cours : la défaite est notée, le match attend encore Riot',
  (select statut = 'en_cours' and defaite_reconnue_par = '00000000-0000-0000-0000-00000000000b'
     from matches where id = '50000000-0000-0000-0000-000000000020'));

set role service_role;
select essai('Serveur : 20 minutes sans partie Riot, le match est tranché',
  $q$select public.enregistrer_defaite_reconnue('50000000-0000-0000-0000-000000000020')$q$, 'passe');
reset role;
select verifie('Carol gagne au niveau 1 (manuel), motif public, match terminé',
  (select v.niveau = 'manuel' and v.gagnant_id = '00000000-0000-0000-0000-00000000000c'
          and v.motif like 'Défaite reconnue par Bob%' and m.statut = 'termine'
     from match_verdicts v join matches m on m.id = v.match_id
     where v.match_id = '50000000-0000-0000-0000-000000000020' and v.est_definitif));

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-00000000000e');
select essai('Eve reconnaît sa défaite dans un match déjà en litige',
  $q$select public.reconnaitre_defaite('50000000-0000-0000-0000-000000000021')$q$, 'passe');
reset role;
select verifie('Match en litige : tranché tout de suite, Gina gagne',
  (select v.gagnant_id = '00000000-0000-0000-0000-000000000010' and m.statut = 'termine'
     from match_verdicts v join matches m on m.id = v.match_id
     where v.match_id = '50000000-0000-0000-0000-000000000021' and v.est_definitif));
