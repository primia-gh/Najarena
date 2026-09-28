-- Assistant IA : limite par compte (audit F2) ; abonnement Stripe privé.
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

-- Abonnement Stripe : données privées (portail client).
insert into abonnements_stripe (profile_id, client_stripe_id, abonnement_stripe_id, statut)
values ('00000000-0000-0000-0000-00000000000d', 'cus_test', 'sub_test', 'active');
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-00000000000a');
select essai('Alice lit l''abonnement Stripe de Dave',
  $q$select 1 from abonnements_stripe$q$, 'bloque');
select essai('Alice (sans abonnement) : aucun abonnement renvoyé',
  $q$select 1 from public.mon_abonnement_stripe()$q$, 'bloque');
select en_tant_que('00000000-0000-0000-0000-00000000000d');
select essai('Dave voit l''état de son propre abonnement',
  $q$select 1 from public.mon_abonnement_stripe() where statut = 'active'$q$, 'passe');
reset role;
