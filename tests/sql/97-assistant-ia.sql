-- Assistant IA : limite par compte (audit F2).
\set ON_ERROR_STOP 0

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-00000000000d');
select essai('Dave fait 10 demandes dans la journée (toutes acceptées, voir plus bas)',
  $q$select 1 from generate_series(1, 10) where public.reserver_appel_assistant_ia()$q$, 'passe');
select essai('Dave : 11e demande de la journée refusée',
  $q$select 1 where public.reserver_appel_assistant_ia()$q$, 'bloque');
select essai('Dave lit ou efface le compteur lui-même',
  $q$delete from appels_assistant_ia where profile_id = '00000000-0000-0000-0000-00000000000d'$q$, 'bloque');
select en_tant_que('00000000-0000-0000-0000-00000000000a');
select essai('Alice (autre compte) garde sa propre limite',
  $q$select 1 where public.reserver_appel_assistant_ia()$q$, 'passe');
reset role;
select verifie('Dave : exactement 10 demandes enregistrées',
  (select count(*) = 10 from appels_assistant_ia where profile_id = '00000000-0000-0000-0000-00000000000d'));
