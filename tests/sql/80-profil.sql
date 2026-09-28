-- Profil modifiable (audit E7) et visites anonymes (M10).
\set ON_ERROR_STOP 0

-- Un compte créé sans pseudo (connexion Discord) : pseudo automatique.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000011', 'discord@test');

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-00000000000e');
select essai('Eve visite le profil de Bob (visites visibles)',
  $q$insert into vues_profil (profile_id, vu_par) values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000e')$q$, 'passe');
select essai('Eve change de pseudo',
  $q$select public.modifier_mon_profil('Eve Pro', 'France', false)$q$, 'passe');
select refus('Eve rechange de pseudo le jour même',
  $q$select public.modifier_mon_profil('Eve Legend', 'France', false)$q$, 'PSEUDO_RECEMMENT_MODIFIE');
select essai('Eve garde son pseudo et change seulement de pays',
  $q$select public.modifier_mon_profil('Eve Pro', 'Belgique', false)$q$, 'passe');
select en_tant_que('00000000-0000-0000-0000-00000000000f');
select refus('Frank prend le pseudo « BOB » (déjà pris, majuscules près)',
  $q$select public.modifier_mon_profil('BOB', null, false)$q$, 'PSEUDO_PRIS');
select refus('Frank prend l''ancien pseudo d''Eve (son ancienne adresse redirige vers elle)',
  $q$select public.modifier_mon_profil('eve', null, false)$q$, 'PSEUDO_PRIS');
select refus('Frank prend un pseudo automatique « Joueur-… »',
  $q$select public.modifier_mon_profil('Joueur-1a2b3c4d', null, false)$q$, 'PSEUDO_RESERVE');
select refus('Frank choisit un pseudo trop court',
  $q$select public.modifier_mon_profil('F', null, false)$q$, 'PSEUDO_INVALIDE');
select refus('Frank met du code dans son pays',
  $q$select public.modifier_mon_profil('Frank', '<script>', false)$q$, 'PAYS_INVALIDE');
select en_tant_que('00000000-0000-0000-0000-000000000011');
select essai('Compte Discord : quitte son pseudo automatique',
  $q$select public.modifier_mon_profil('Viper', null, false)$q$, 'passe');
select refus('Compte Discord : rechange de pseudo le jour même',
  $q$select public.modifier_mon_profil('Viper2', null, false)$q$, 'PSEUDO_RECEMMENT_MODIFIE');
select essai('Écriture directe du pseudo (sans passer par la fonction)',
  $q$update profiles set pseudo = 'Hack' where id = '00000000-0000-0000-0000-000000000011'$q$, 'bloque');
select essai('Écriture directe d''une ancienne adresse',
  $q$insert into anciens_slugs (slug, profile_id) values ('alice', '00000000-0000-0000-0000-000000000011')$q$, 'bloque');

select en_tant_que('00000000-0000-0000-0000-00000000000e');
select essai('Eve passe en visites anonymes',
  $q$select public.modifier_mon_profil('Eve Pro', 'Belgique', true)$q$, 'passe');
select essai('Eve (anonyme) enregistre une visite du profil de Bob',
  $q$insert into vues_profil (profile_id, vu_par) values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000e')$q$, 'bloque');
select en_tant_que('00000000-0000-0000-0000-000000000010');
select essai('Gina (pas anonyme) enregistre une visite du profil de Bob',
  $q$insert into vues_profil (profile_id, vu_par) values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000010')$q$, 'passe');
select essai('Gina lit la préférence de visite d''Eve',
  $q$select visites_anonymes from profiles where id = '00000000-0000-0000-0000-00000000000e'$q$, 'bloque');
select en_tant_que('00000000-0000-0000-0000-00000000000e');
select verifie('Eve lit ses propres réglages', (select visites_anonymes from public.mes_reglages_profil()));
reset role;

select verifie('Eve anonyme : sa visite déjà enregistrée chez Bob est effacée',
  not exists (select 1 from vues_profil where vu_par = '00000000-0000-0000-0000-00000000000e'));
select verifie('Eve : nouvelle adresse eve-pro, l''ancienne « eve » redirige vers elle',
  (select p.slug = 'eve-pro' and a.profile_id = p.id
     from profiles p join anciens_slugs a on a.slug = 'eve'
     where p.id = '00000000-0000-0000-0000-00000000000e'));
select refus('Inscription d''un nouveau compte sur l''ancienne adresse d''Eve',
  $q$insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-000000000012', 'faux@test', '{"pseudo":"eve","slug":"eve"}')$q$, 'PSEUDO_PRIS');
