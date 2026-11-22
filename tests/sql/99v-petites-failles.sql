-- Petites failles du contrôle de sécurité du 21/11/2026 : adresses de
-- notification push (F2), texte_acceptable (F4), date des annonces (F5).
\set ON_ERROR_STOP 0

insert into auth.users (id, email, raw_user_meta_data) values
  ('b11b0001-0000-0000-0000-000000000000', 'p99v1@test', '{"pseudo":"Faille99v","slug":"faille99v"}');

set role authenticated;
select en_tant_que('b11b0001-0000-0000-0000-000000000000');
select refus('Adresse de notification hors des services de push : refusée',
  $q$insert into push_subscriptions (profile_id, endpoint, p256dh, auth) values ('b11b0001-0000-0000-0000-000000000000', 'https://exemple.com/push', 'k', 'a')$q$,
  'ADRESSE_PUSH_INVALIDE');
select refus('Adresse en http : refusée',
  $q$insert into push_subscriptions (profile_id, endpoint, p256dh, auth) values ('b11b0001-0000-0000-0000-000000000000', 'http://fcm.googleapis.com/fcm/send/x', 'k', 'a')$q$,
  'ADRESSE_PUSH_INVALIDE');
select refus('Faux service dont le nom commence comme un vrai : refusé',
  $q$insert into push_subscriptions (profile_id, endpoint, p256dh, auth) values ('b11b0001-0000-0000-0000-000000000000', 'https://fcm.googleapis.com.exemple.com/x', 'k', 'a')$q$,
  'ADRESSE_PUSH_INVALIDE');
select essai('Douze appareils déclarés à la suite',
  $q$insert into push_subscriptions (profile_id, endpoint, p256dh, auth)
     select 'b11b0001-0000-0000-0000-000000000000', 'https://fcm.googleapis.com/fcm/send/99v-' || n, 'k', 'a' from generate_series(1, 12) n$q$,
  'passe');
reset role;
select verifie('Dix appareils au plus par joueur',
  (select count(*) = 10 from push_subscriptions where profile_id = 'b11b0001-0000-0000-0000-000000000000'));

set role authenticated;
select en_tant_que('b11b0001-0000-0000-0000-000000000000');
select essai('Un appareil déjà enregistré se réabonne (même adresse)',
  $q$insert into push_subscriptions (profile_id, endpoint, p256dh, auth)
     select profile_id, endpoint, 'k2', 'a2' from push_subscriptions
     where profile_id = 'b11b0001-0000-0000-0000-000000000000' order by endpoint limit 1
     on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth$q$,
  'passe');
reset role;
select verifie('Se réabonner ne retire aucun appareil',
  (select count(*) = 10 and count(*) filter (where p256dh = 'k2') = 1
   from push_subscriptions where profile_id = 'b11b0001-0000-0000-0000-000000000000'));

set role authenticated;
select en_tant_que('b11b0001-0000-0000-0000-000000000000');
select essai('Adresse Safari d''un autre serveur Apple',
  $q$insert into push_subscriptions (profile_id, endpoint, p256dh, auth)
     values ('b11b0001-0000-0000-0000-000000000000', 'https://api.push.apple.com/99v', 'k', 'a')$q$,
  'passe');
select refus('Faux serveur Apple',
  $q$insert into push_subscriptions (profile_id, endpoint, p256dh, auth)
     values ('b11b0001-0000-0000-0000-000000000000', 'https://push.apple.com.exemple.com/x', 'k', 'a')$q$,
  'ADRESSE_PUSH_INVALIDE');
reset role;
select verifie('Un nouvel appareil prend la place du plus ancien',
  (select count(*) = 10 and bool_or(endpoint = 'https://api.push.apple.com/99v')
   from push_subscriptions where profile_id = 'b11b0001-0000-0000-0000-000000000000'));

set role anon;
select refus('Un visiteur ne teste plus un mot contre la liste de modération',
  $q$select public.texte_acceptable('test')$q$, 'permission denied for function texte_acceptable');
reset role;
set role authenticated;
select en_tant_que('b11b0001-0000-0000-0000-000000000000');
select refus('Un joueur non plus',
  $q$select public.texte_acceptable('test')$q$, 'permission denied for function texte_acceptable');
reset role;
set role service_role;
select verifie('Le serveur, oui', (select public.texte_acceptable('Joueur99v')));
reset role;

set role authenticated;
select en_tant_que('b11b0001-0000-0000-0000-000000000000');
select essai('Il publie une annonce antidatée',
  $q$insert into recherches_coequipiers (profile_id, message, cree_le) values ('b11b0001-0000-0000-0000-000000000000', 'Je cherche une équipe.', '2020-01-01')$q$,
  'passe');
select essai('Puis la date dans le futur',
  $q$update recherches_coequipiers set cree_le = now() + interval '30 days' where profile_id = 'b11b0001-0000-0000-0000-000000000000'$q$,
  'passe');
reset role;
select verifie('La date de l''annonce est celle de la base (maintenant)',
  (select cree_le > now() - interval '1 minute' and cree_le <= now() from recherches_coequipiers where profile_id = 'b11b0001-0000-0000-0000-000000000000'));
