-- Certificat de niveau vérifiable (audit N9).
\set ON_ERROR_STOP 0

insert into tiers (id, game_id, nom, rating_min, ordre) values
  (1, 1, 'Bronze', 0, 1), (2, 1, 'Argent', 1300, 2), (3, 1, 'Or', 1450, 3),
  (4, 1, 'Platine', 1600, 4), (5, 1, 'Diamant', 1750, 5), (6, 1, 'Champion', 1900, 6)
on conflict do nothing;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000030', 'lea@test', '{"pseudo":"Lea","slug":"lea"}');
insert into ratings (profile_id, game_id, season_id, rating, rd, volatilite, matchs_joues)
values ('00000000-0000-0000-0000-000000000030', 1, (select id from seasons where est_courante), 1780, 90, 0.06, 14);

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000030');
select essai('Léa émet un certificat de niveau',
  $q$select public.emettre_certificat()$q$, 'passe');
select essai('Léa écrit elle-même un faux certificat',
  $q$insert into certificats (code, profile_id, game_id, rating, rd, est_classe, matchs_verifies, victoires) values ('faux', '00000000-0000-0000-0000-000000000030', 1, 2400, 30, true, 99, 99)$q$, 'bloque');
select essai('Léa voit ses propres certificats', $q$select 1 from certificats$q$, 'passe');
select en_tant_que('00000000-0000-0000-0000-00000000000a');
select essai('Alice liste les certificats des autres', $q$select 1 from certificats$q$, 'bloque');
select refus('Alice (sans rating cette saison) émet un certificat',
  $q$select public.emettre_certificat()$q$, 'AUCUN_RATING');
reset role;

select verifie('Certificat de Léa : instantané calculé par la base (Diamant, classée, adossé au registre)',
  (select palier = 'Diamant' and est_classe and rating = 1780 and rd = 90
          and registre_numero = (select max(numero) from rating_events)
     from certificats where profile_id = '00000000-0000-0000-0000-000000000030'));
select refus('Le serveur lui-même retouche un certificat',
  $q$update certificats set rating = 2400 where profile_id = '00000000-0000-0000-0000-000000000030'$q$, 'CERTIFICAT_IMMUABLE');

select code as code_lea from certificats where profile_id = '00000000-0000-0000-0000-000000000030' limit 1 \gset
set role anon;
select essai('Visiteur : lit le certificat dont il a reçu le lien',
  format($q$select 1 from public.lire_certificat(%L) where pseudo = 'Lea' and palier = 'Diamant'$q$, :'code_lea'), 'passe');
select essai('Visiteur : ne trouve aucun certificat sans en connaître le code',
  $q$select 1 from certificats$q$, 'bloque');
reset role;

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000030');
select essai('Léa : 4 émissions de plus dans la journée',
  $q$select public.emettre_certificat() from generate_series(1, 4)$q$, 'passe');
select refus('Léa : 6e émission de la journée refusée',
  $q$select public.emettre_certificat()$q$, 'LIMITE_CERTIFICATS');
reset role;
