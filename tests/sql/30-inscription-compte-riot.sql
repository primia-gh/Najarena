-- Inscription : compte Riot vérifié, dans la région du tournoi (audit E2).
\set ON_ERROR_STOP 0
set role authenticated;

select en_tant_que('00000000-0000-0000-0000-00000000000f');
select essai('Frank (compte Riot lié mais pas vérifié) s''inscrit',
  $q$select public.s_inscrire_tournoi('10000000-0000-0000-0000-000000000001')$q$, 'bloque');

select en_tant_que('00000000-0000-0000-0000-00000000000c');
select essai('Carol (compte vérifié sur NA) s''inscrit à un tournoi EUW',
  $q$select public.s_inscrire_tournoi('10000000-0000-0000-0000-000000000001')$q$, 'bloque');

select en_tant_que('00000000-0000-0000-0000-00000000000a');
select essai('Alice (aucun compte Riot) s''inscrit',
  $q$select public.s_inscrire_tournoi('10000000-0000-0000-0000-000000000001')$q$, 'bloque');

reset role;
select verifie('Aucune de ces trois inscriptions n''a été créée',
  (select count(*) = 0 from registrations where tournament_id = '10000000-0000-0000-0000-000000000001'
     and profile_id in ('00000000-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000a')));
select verifie('Gina (compte vérifié EUW) est bien inscrite (fichier 20)',
  (select count(*) = 1 from registrations where tournament_id = '10000000-0000-0000-0000-000000000001'
     and profile_id = '00000000-0000-0000-0000-000000000010'));
