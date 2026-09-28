-- Clôture de tournoi : jamais de double crédit, jamais d'état écrasé (audit M16).
\set ON_ERROR_STOP 0
\set saison '(select id from seasons where est_courante)'

set role service_role;
select essai('Clôture de Gina pour le tournoi en cours (état de départ 1500 ± 350)',
  $q$select public.cloturer_rating_joueur('00000000-0000-0000-0000-000000000010', 1::smallint, (select id from seasons where est_courante), '10000000-0000-0000-0000-000000000003', 1500, 350, 0.06, 1662.31, 290.5, 0.06, 1, 'tournoi')$q$, 'passe');
select essai('Relance de la même clôture : rien n''est recrédité',
  $q$select 1 where public.cloturer_rating_joueur('00000000-0000-0000-0000-000000000010', 1::smallint, (select id from seasons where est_courante), '10000000-0000-0000-0000-000000000003', 1500, 350, 0.06, 1662.31, 290.5, 0.06, 1, 'tournoi')$q$, 'bloque');
select essai('Autre tournoi clôturé avec un état de départ périmé (1500 au lieu de 1662,31)',
  $q$select public.cloturer_rating_joueur('00000000-0000-0000-0000-000000000010', 1::smallint, (select id from seasons where est_courante), '10000000-0000-0000-0000-000000000004', 1500, 350, 0.06, 1400, 280, 0.06, 1, 'tournoi')$q$, 'bloque');
select essai('Le même tournoi repris avec l''état à jour',
  $q$select public.cloturer_rating_joueur('00000000-0000-0000-0000-000000000010', 1::smallint, (select id from seasons where est_courante), '10000000-0000-0000-0000-000000000004', 1662.31, 290.5, 0.06, 1700.12, 250.4, 0.06, 1, 'tournoi')$q$, 'passe');
reset role;

select verifie('Le journal se suit : « avant » du 2e tournoi = « après » du 1er',
  (select bool_and(e2.rating_avant = e1.rating_apres)
     from rating_events e1 join rating_events e2 on e2.profile_id = e1.profile_id
     where e1.tournament_id = '10000000-0000-0000-0000-000000000003'
       and e2.tournament_id = '10000000-0000-0000-0000-000000000004'
       and e1.profile_id = '00000000-0000-0000-0000-000000000010'));
select verifie('Rating final de Gina = 1700,12, 2 matchs comptés',
  (select rating = 1700.12 and matchs_joues = 2 from ratings where profile_id = '00000000-0000-0000-0000-000000000010'));
select essai('Doublon inséré de force dans le journal (contrainte d''unicité)',
  $q$insert into rating_events (profile_id, game_id, season_id, tournament_id, motif, rating_avant, rd_avant, rating_apres, rd_apres) select '00000000-0000-0000-0000-000000000010', 1, id, '10000000-0000-0000-0000-000000000003', 'tournoi', 1, 1, 1, 1 from seasons where est_courante$q$, 'bloque');
