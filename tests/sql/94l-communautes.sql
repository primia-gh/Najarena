-- Espaces communauté (audit N30).
\set ON_ERROR_STOP 0

-- Nadia (offre Organisateur) crée les communautés ; Omar et Pablo les
-- rejoignent ; Rose n'a pas l'offre.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000100', 'nadia952@test', '{"pseudo":"Nadia952","slug":"nadia952"}'),
  ('00000000-0000-0000-0000-000000000101', 'omar952@test', '{"pseudo":"Omar952","slug":"omar952"}'),
  ('00000000-0000-0000-0000-000000000102', 'pablo952@test', '{"pseudo":"Pablo952","slug":"pablo952"}'),
  ('00000000-0000-0000-0000-000000000103', 'rose952@test', '{"pseudo":"Rose952","slug":"rose952"}');
insert into comptes_offres (profile_id, offre) values ('00000000-0000-0000-0000-000000000100', 'organisateur');

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select essai('Un visiteur crée une communauté', $q$select public.creer_communaute('Club Visiteur', 'club-visiteur')$q$, 'bloque');
reset role;

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000103');
select refus('Rose, sans l''offre Organisateur, crée une communauté',
  $q$select public.creer_communaute('Club de Rose', 'club-de-rose')$q$, 'OFFRE_ORGANISATEUR_REQUISE');
select en_tant_que('00000000-0000-0000-0000-000000000100');
select essai('Nadia crée « Club Najaville »',
  $q$select public.creer_communaute('Club Najaville', 'club-najaville', 'Le serveur des joueurs de Najaville.', '#ff6600', 'https://discord.gg/najaville')$q$, 'passe');
select refus('Nadia nomme une communauté avec une insulte',
  $q$select public.creer_communaute('Club FDP', 'club-fdp')$q$, 'NOM_INTERDIT');
select refus('Nadia usurpe le nom du site',
  $q$select public.creer_communaute('Najarena Officiel', 'najarena-officiel')$q$, 'NOM_INTERDIT');
select essai('Nadia choisit une couleur invalide', $q$select public.creer_communaute('Club Rouge', 'club-rouge', null, 'rouge')$q$, 'bloque');
select essai('Nadia met un lien qui n''est pas une invitation Discord',
  $q$select public.creer_communaute('Club Lien', 'club-lien', null, '#112233', 'https://exemple.com/x')$q$, 'bloque');
select essai('Nadia crée une deuxième communauté', $q$select public.creer_communaute('Club Deux', 'club-deux')$q$, 'passe');
select essai('Nadia crée une troisième communauté', $q$select public.creer_communaute('Club Trois', 'club-trois')$q$, 'passe');
select refus('Nadia crée une quatrième communauté', $q$select public.creer_communaute('Club Quatre', 'club-quatre')$q$, 'TROP_DE_COMMUNAUTES');
reset role;

select id as club from communautes where slug = 'club-najaville' \gset
select verifie('Nadia est propriétaire de « Club Najaville », couleur en majuscules',
  (select m.role = 'proprietaire' and c.couleur = '#FF6600'
   from communautes c join membres_communaute m on m.communaute_id = c.id
   where c.id = :'club' and m.profile_id = '00000000-0000-0000-0000-000000000100'));

set role anon;
select essai('Un visiteur voit la communauté et ses membres', format($q$select 1 from communautes c join membres_communaute m on m.communaute_id = c.id where c.id = %L$q$, :'club'), 'passe');
select essai('Un visiteur lit le code de liaison Discord', $q$select code_liaison from communautes$q$, 'bloque');
reset role;

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000101');
select verifie('Omar rejoint la communauté', (select public.rejoindre_communaute(:'club')));
select verifie('Omar rejoint une deuxième fois : rien ne change', (select not public.rejoindre_communaute(:'club')));
select essai('Omar s''ajoute lui-même comme administrateur',
  format($q$insert into membres_communaute (communaute_id, profile_id, role) values (%L, '00000000-0000-0000-0000-000000000101', 'admin')$q$, :'club'), 'bloque');
select refus('Omar modifie la communauté', format($q$select public.modifier_communaute(%L, 'Pris', '#000000', null)$q$, :'club'), 'GESTION_RESERVEE');
select refus('Omar demande le code de liaison Discord', format($q$select public.code_liaison_discord(%L)$q$, :'club'), 'GESTION_RESERVEE');
select en_tant_que('00000000-0000-0000-0000-000000000102');
select verifie('Pablo rejoint la communauté', (select public.rejoindre_communaute(:'club')));
select refus('Pablo retire Omar', format($q$select public.retirer_membre_communaute(%L, '00000000-0000-0000-0000-000000000101')$q$, :'club'), 'GESTION_RESERVEE');
select en_tant_que('00000000-0000-0000-0000-000000000100');
select refus('Nadia quitte sa propre communauté', format($q$select public.quitter_communaute(%L)$q$, :'club'), 'COMMUNAUTE_PROPRIETAIRE');
select verifie('Nadia nomme Omar administrateur', (select public.nommer_admin_communaute(:'club', '00000000-0000-0000-0000-000000000101', true)));
select en_tant_que('00000000-0000-0000-0000-000000000101');
select refus('Omar, administrateur, nomme Pablo administrateur',
  format($q$select public.nommer_admin_communaute(%L, '00000000-0000-0000-0000-000000000102', true)$q$, :'club'), 'GESTION_RESERVEE');
select essai('Omar, administrateur, modifie la description', format($q$select public.modifier_communaute(%L, 'Tournois tous les vendredis.', '#3366FF', null)$q$, :'club'), 'passe');
select refus('Omar écrit une description haineuse', format($q$select public.modifier_communaute(%L, 'pas de tarlouze ici', '#3366FF', null)$q$, :'club'), 'TEXTE_INTERDIT');
select refus('Omar retire Nadia, la propriétaire', format($q$select public.retirer_membre_communaute(%L, '00000000-0000-0000-0000-000000000100')$q$, :'club'), 'GESTION_RESERVEE');
select verifie('Omar retire Pablo', (select public.retirer_membre_communaute(:'club', '00000000-0000-0000-0000-000000000102')));
select en_tant_que('00000000-0000-0000-0000-000000000102');
select verifie('Pablo revient, puis quitte la communauté', (select public.rejoindre_communaute(:'club') and public.quitter_communaute(:'club')));
reset role;

-- Tournois de la communauté : publiés par son propriétaire ou un administrateur.
select refus('Rose publie un tournoi dans la communauté',
  format($q$insert into tournaments (game_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, communaute_id) values (1, '00000000-0000-0000-0000-000000000103', 'club-rose-1', 'Tournoi de Rose', '1v1', 8, 'EUW', now() + interval '3 days', now() + interval '3 days', 'brouillon', %L)$q$, :'club'), 'COMMUNAUTE_INTERDITE');
select essai('Omar, administrateur, publie un tournoi dans la communauté',
  format($q$insert into tournaments (game_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, communaute_id) values (1, '00000000-0000-0000-0000-000000000101', 'club-omar-1', 'Vendredi du club', '1v1', 8, 'EUW', now() + interval '3 days', now() + interval '3 days', 'brouillon', %L)$q$, :'club'), 'passe');

-- Liaison du serveur Discord.
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000100');
select verifie('Nadia obtient un code de liaison (8 caractères)', (select char_length(public.code_liaison_discord(:'club')) = 8));
select refus('Nadia enregistre elle-même un serveur', $q$select public.lier_serveur_discord('X', '123456789012')$q$, 'permission denied for function lier_serveur_discord');
reset role;
select code_liaison as code from communautes where id = :'club' \gset
set role service_role;
select refus('Serveur : code inconnu', $q$select public.lier_serveur_discord('ZZZZZZZZ', '123456789012')$q$, 'CODE_INVALIDE');
select verifie('Serveur : /lier avec le bon code lie le serveur Discord',
  (select public.lier_serveur_discord(lower(:'code'), '123456789012') = 'Club Najaville'));
select refus('Serveur : le code ne resert pas', format($q$select public.lier_serveur_discord(%L, '999999999999')$q$, :'code'), 'CODE_INVALIDE');
reset role;
select verifie('Serveur Discord enregistré, code effacé',
  (select discord_guild_id = '123456789012' and code_liaison is null from communautes where id = :'club'));

select id as club2 from communautes where slug = 'club-deux' \gset
update communautes set code_liaison = 'DEUXDEUX', code_liaison_expire_le = now() + interval '5 minutes' where id = :'club2';
set role service_role;
select refus('Serveur : un serveur déjà lié à une autre communauté', $q$select public.lier_serveur_discord('DEUXDEUX', '123456789012')$q$, 'SERVEUR_DEJA_LIE');
reset role;
update communautes set code_liaison_expire_le = now() - interval '1 minute' where id = :'club2';
set role service_role;
select refus('Serveur : code expiré', $q$select public.lier_serveur_discord('DEUXDEUX', '555555555555')$q$, 'CODE_INVALIDE');
reset role;

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000101');
select refus('Omar, administrateur, délie le serveur', format($q$select public.delier_serveur_discord(%L)$q$, :'club'), 'GESTION_RESERVEE');
select en_tant_que('00000000-0000-0000-0000-000000000100');
select verifie('Nadia délie le serveur', (select public.delier_serveur_discord(:'club')));
reset role;
