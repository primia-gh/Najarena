-- Registre des points scellé (audit N8).
\set ON_ERROR_STOP 0

-- Trois lignes écrites comme le fait le serveur à la clôture.
insert into rating_events (profile_id, game_id, season_id, tournament_id, motif, rating_avant, rd_avant, rating_apres, rd_apres, cree_le)
values
  ('00000000-0000-0000-0000-00000000000b', 1, (select id from seasons where est_courante), '10000000-0000-0000-0000-000000000003', 'tournoi', 1500, 350, 1562.5, 290.12, '2026-09-28T19:30:00.123456Z'),
  ('00000000-0000-0000-0000-00000000000c', 1, (select id from seasons where est_courante), '10000000-0000-0000-0000-000000000003', 'tournoi', 1500, 350, 1437.5, 290.12, '2026-09-28T19:30:00.223456Z');
insert into rating_events (profile_id, game_id, season_id, motif, rating_avant, rd_avant, rating_apres, rd_apres, cree_le)
values ('00000000-0000-0000-0000-00000000000d', 1, (select id from seasons where est_courante), 'inactivite', 1500, 200, 1500, 215.4, '2026-09-29T03:00:00Z');

select verifie('Registre : chaque ligne porte un numéro et son empreinte, chaînée à la précédente',
  (select bool_and(e.empreinte_precedente = coalesce(p.empreinte, repeat('0', 64)))
     from rating_events e left join rating_events p on p.numero = e.numero - 1));
select verifie('Registre : la chaîne complète est intacte',
  (select premiere_rupture is null and lignes = (select count(*) from rating_events) from public.verifier_registre()));
select verifie('Registre : l''export public donne les nombres et la date sous leur forme scellée',
  (select rating_apres = '1562.50' and rd_apres = '290.12' and cree_le_us = '1790623800123456'
     from registre_public where profile_id = '00000000-0000-0000-0000-00000000000b' and motif = 'tournoi'));
select verifie('Registre : empreinte de référence (même calcul que scripts/verifier-registre.mjs)',
  (select empreinte = public.empreinte_rating_event(concat_ws('|', numero::text, empreinte_precedente,
      profile_id::text, game_id::text, season_id::text, '', tournament_id::text, motif,
      '1500.00', '350.00', '1562.50', '290.12', '', '1790623800123456'))
     from rating_events where profile_id = '00000000-0000-0000-0000-00000000000b' and motif = 'tournoi'));

select refus('Le serveur lui-même modifie une ligne du registre',
  $q$update rating_events set rating_apres = 1900 where profile_id = '00000000-0000-0000-0000-00000000000b'$q$, 'REGISTRE_IMMUABLE');
select refus('Le serveur lui-même efface une ligne du registre',
  $q$delete from rating_events where profile_id = '00000000-0000-0000-0000-00000000000c'$q$, 'REGISTRE_IMMUABLE');
select refus('Le serveur lui-même vide le registre',
  $q$truncate rating_events$q$, 'REGISTRE_IMMUABLE');

-- Même un administrateur de la base qui coupe la protection et retouche
-- une ligne est démasqué par la vérification.
alter table rating_events disable trigger rating_events_immuable;
update rating_events set rating_apres = 1900 where profile_id = '00000000-0000-0000-0000-00000000000b' and motif = 'tournoi';
alter table rating_events enable trigger rating_events_immuable;
select verifie('Registre : une ligne retouchée en contournant la protection est détectée',
  (select premiere_rupture = (select numero from rating_events where profile_id = '00000000-0000-0000-0000-00000000000b' and motif = 'tournoi')
     from public.verifier_registre()));
-- Remise en état pour la suite des tests.
alter table rating_events disable trigger rating_events_immuable;
update rating_events set rating_apres = 1562.5 where profile_id = '00000000-0000-0000-0000-00000000000b' and motif = 'tournoi';
alter table rating_events enable trigger rating_events_immuable;

set role anon;
select essai('Visiteur : lit l''export public du registre', $q$select 1 from registre_public$q$, 'passe');
select essai('Visiteur : vérifie la chaîne', $q$select 1 from public.verifier_registre() where premiere_rupture is null$q$, 'passe');
select essai('Visiteur : publie une fausse empreinte du jour',
  $q$insert into empreintes_publiees (jour, numero, empreinte) values (current_date, 1, 'faux')$q$, 'bloque');
reset role;

-- Récap de la semaine : publication réservée au serveur.
insert into recaps_semaine (semaine, annonce) values ('2026-09-14', true);
set role anon;
select essai('Visiteur : lit la liste des récaps publiés', $q$select 1 from recaps_semaine where semaine = '2026-09-14'$q$, 'passe');
select essai('Visiteur : marque une semaine comme publiée',
  $q$insert into recaps_semaine (semaine, annonce) values ('2026-09-21', true)$q$, 'bloque');
reset role;
