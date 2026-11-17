-- Versement des cash prizes par Stripe Connect (audit N32), toujours éteint
-- côté site tant que CASH_PRIZES_ACTIFS n'est pas activé.
\set ON_ERROR_STOP 0

-- Reprend la dotation de 94m : Jo 1 (vainqueur, déjà noté versé à la main),
-- Jo 5 (finaliste), Jo 3 et Jo 7 (demi-finalistes, Jo 7 décidé à la main).
-- Lou n'a rien gagné. Dave est administrateur.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000150', 'lou956@test', '{"pseudo":"Lou956","slug":"lou956"}');

set role service_role;
select refus('Serveur : compte de versement pour Lou, sans gain', $q$select public.ouvrir_compte_versement('00000000-0000-0000-0000-000000000150', 'acct_1LouLou956')$q$, 'AUCUN_GAIN');
select verifie('Serveur : compte de versement ouvert pour Jo 5',
  (select public.ouvrir_compte_versement('00000000-0000-0000-0000-000000000125', 'acct_1Jo5Jo5956') = 'acct_1Jo5Jo5956'));
select verifie('Serveur : le compte déjà ouvert est rendu, jamais un second',
  (select public.ouvrir_compte_versement('00000000-0000-0000-0000-000000000125', 'acct_1Autre956') = 'acct_1Jo5Jo5956'));
select verifie('Serveur : compte de Jo 7 ouvert', (select public.ouvrir_compte_versement('00000000-0000-0000-0000-000000000127', 'acct_1Jo7Jo7956') is not null));
reset role;

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000125');
select verifie('Jo 5 voit l''état de son compte de versement', (select count(*) = 1 and bool_and(not verifie) from comptes_versement));
select essai('Jo 5 lit l''identifiant Stripe de son compte', $q$select stripe_compte_id from comptes_versement$q$, 'bloque');
select refus('Jo 5 se déclare vérifié', $q$select public.maj_compte_versement('acct_1Jo5Jo5956', true)$q$, 'permission denied for function maj_compte_versement');
select en_tant_que('00000000-0000-0000-0000-000000000123');
select verifie('Jo 3 ne voit pas le compte de Jo 5', (select count(*) = 0 from comptes_versement));
select en_tant_que('00000000-0000-0000-0000-00000000000d');
select refus('Admin : virement à Jo 5, identité pas encore vérifiée',
  $q$select * from public.preparer_virement('9d000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000125', false)$q$, 'IDENTITE_NON_VERIFIEE');
reset role;

set role service_role;
select verifie('Serveur : Stripe a vérifié l''identité de Jo 5', (select public.maj_compte_versement('acct_1Jo5Jo5956', true)));
select verifie('Serveur : et celle de Jo 7', (select public.maj_compte_versement('acct_1Jo7Jo7956', true)));
reset role;

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000125');
select refus('Jo 5 prépare lui-même son virement',
  $q$select * from public.preparer_virement('9d000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000125', false)$q$, 'ADMIN_REQUIS');
select en_tant_que('00000000-0000-0000-0000-00000000000d');
select verifie('Admin : virement à Jo 5 prêt, 50 € vers son compte',
  (select montant_centimes = 5000 and stripe_compte_id = 'acct_1Jo5Jo5956'
   from public.preparer_virement('9d000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000125', false)));
select refus('Admin : virement à Jo 7, rang décidé à la main pas vérifié',
  $q$select * from public.preparer_virement('9d000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000127', false)$q$, 'RANG_A_VERIFIER');
select verifie('Admin : virement à Jo 7 après vérification du rang',
  (select montant_centimes = 2500 from public.preparer_virement('9d000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000127', true)));
select refus('Admin : nouveau virement à Jo 1, déjà versé',
  $q$select * from public.preparer_virement('9d000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000121', false)$q$, 'VERSEMENT_DEJA_TRAITE');
reset role;

set role service_role;
select verifie('Serveur : virement de Jo 5 noté', (select public.noter_virement('9d000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000125', 'tr_1Jo5Virement')));
select verifie('Serveur : le même virement noté deux fois ne change rien',
  (select not public.noter_virement('9d000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000125', 'tr_1Jo5Virement')));
select refus('Serveur : un second virement pour le même gain',
  $q$select public.noter_virement('9d000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000125', 'tr_1Jo5Doublon')$q$, 'VERSEMENT_DEJA_TRAITE');
select refus('Serveur : référence de virement mal formée',
  $q$select public.noter_virement('9d000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000127', 'pas-un-virement')$q$, 'VIREMENT_INVALIDE');
reset role;
select verifie('Gain de Jo 5 versé, référence Stripe gardée',
  (select statut = 'verse' and transfert_stripe_id = 'tr_1Jo5Virement' and reference = 'tr_1Jo5Virement'
   from versements_dotation where tournament_id = '9d000000-0000-0000-0000-000000000001' and profile_id = '00000000-0000-0000-0000-000000000125'));

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-00000000000d');
select refus('Admin : repasser à la main « à verser » un gain versé par Stripe',
  $q$select public.noter_versement('9d000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000125', 'a_verser', null)$q$, 'VIREMENT_STRIPE_FAIT');
select refus('Admin : préparer un second virement pour Jo 5',
  $q$select * from public.preparer_virement('9d000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000125', false)$q$, 'VERSEMENT_DEJA_TRAITE');
reset role;

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select essai('Visiteur : aucun compte de versement lisible', $q$select 1 from comptes_versement$q$, 'bloque');
reset role;
