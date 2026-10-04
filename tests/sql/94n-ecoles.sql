-- Ligues écoles et universités, tournois réservés aux membres (analyse
-- concurrentielle de l'audit : Battlefy, hubs FACEIT).
\set ON_ERROR_STOP 0

-- Flora (offre Organisateur) fonde l'école ; Alix, Basile, Côme, Dina,
-- Ewan, Fanny, Gael et Iris en sont étudiants ; Hugo est extérieur.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000130', 'flora954@test', '{"pseudo":"Flora954","slug":"flora954"}'),
  ('00000000-0000-0000-0000-000000000131', 'alix954@test', '{"pseudo":"Alix954","slug":"alix954"}'),
  ('00000000-0000-0000-0000-000000000132', 'basile954@test', '{"pseudo":"Basile954","slug":"basile954"}'),
  ('00000000-0000-0000-0000-000000000133', 'hugo954@test', '{"pseudo":"Hugo954","slug":"hugo954"}'),
  ('00000000-0000-0000-0000-000000000134', 'come954@test', '{"pseudo":"Come954","slug":"come954"}'),
  ('00000000-0000-0000-0000-000000000135', 'dina954@test', '{"pseudo":"Dina954","slug":"dina954"}'),
  ('00000000-0000-0000-0000-000000000136', 'ewan954@test', '{"pseudo":"Ewan954","slug":"ewan954"}'),
  ('00000000-0000-0000-0000-000000000137', 'fanny954@test', '{"pseudo":"Fanny954","slug":"fanny954"}'),
  ('00000000-0000-0000-0000-000000000138', 'gael954@test', '{"pseudo":"Gael954","slug":"gael954"}'),
  ('00000000-0000-0000-0000-000000000139', 'iris954@test', '{"pseudo":"Iris954","slug":"iris954"}');
insert into comptes_offres (profile_id, offre) values ('00000000-0000-0000-0000-000000000130', 'organisateur');
insert into game_accounts (profile_id, game_id, puuid, riot_game_name, riot_tag_line, region, est_principal, verifie_le, methode_verification)
select p.id, 1, 'P-954-' || right(p.id::text, 3), 'Joueur' || right(p.id::text, 3), 'EUW', 'EUW', true, now(), 'icone_profil'
from (values
  ('00000000-0000-0000-0000-000000000131'::uuid), ('00000000-0000-0000-0000-000000000132'::uuid),
  ('00000000-0000-0000-0000-000000000133'::uuid), ('00000000-0000-0000-0000-000000000134'::uuid)
) as p(id);

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000130');
select essai('Flora crée « Esport Univ 954 »', $q$select public.creer_communaute('Esport Univ 954', 'esport-univ-954')$q$, 'passe');
reset role;
select id as ecole from communautes where slug = 'esport-univ-954' \gset

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000131');
select verifie('Alix rejoint la communauté', (select public.rejoindre_communaute(:'ecole')));
select refus('Alix, simple membre, en fait une école', format($q$select public.definir_ecole(%L, array['univ-954.fr'])$q$, :'ecole'), 'GESTION_RESERVEE');
select en_tant_que('00000000-0000-0000-0000-000000000132');
select verifie('Basile rejoint la communauté', (select public.rejoindre_communaute(:'ecole')));
select en_tant_que('00000000-0000-0000-0000-000000000130');
select refus('Flora indique une messagerie grand public', format($q$select public.definir_ecole(%L, array['gmail.com'])$q$, :'ecole'), 'DOMAINE_GRAND_PUBLIC');
select refus('Flora indique un domaine invalide', format($q$select public.definir_ecole(%L, array['pas un domaine'])$q$, :'ecole'), 'DOMAINE_INVALIDE');
select refus('Flora n''indique aucun domaine', format($q$select public.definir_ecole(%L, array['  '])$q$, :'ecole'), 'DOMAINES_ECOLE');
select essai('Flora en fait une école : @etu.univ-954.fr et univ-954.fr',
  format($q$select public.definir_ecole(%L, array['@Etu.Univ-954.fr', 'univ-954.fr'])$q$, :'ecole'), 'passe');
reset role;
select verifie('Domaines enregistrés en minuscules, sans arobase, triés',
  (select type = 'ecole' and domaines_email = array['etu.univ-954.fr', 'univ-954.fr'] from communautes where id = :'ecole'));

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select essai('Un visiteur voit le type et les domaines de l''école',
  format($q$select 1 from communautes where id = %L and type = 'ecole' and cardinality(domaines_email) = 2$q$, :'ecole'), 'passe');
select essai('Un visiteur lit l''empreinte d''une adresse d''école', $q$select email_empreinte from membres_communaute$q$, 'bloque');
reset role;

-- Vérification d'une adresse d'école.
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000131');
select refus('Alix prépare elle-même un code', format($q$select public.preparer_verification_ecole('00000000-0000-0000-0000-000000000131', %L, 'alix@etu.univ-954.fr', '123456')$q$, :'ecole'),
  'permission denied for function preparer_verification_ecole');
reset role;
set role service_role;
select refus('Serveur : Hugo n''est pas membre', format($q$select public.preparer_verification_ecole('00000000-0000-0000-0000-000000000133', %L, 'hugo@etu.univ-954.fr', '123456')$q$, :'ecole'), 'NON_MEMBRE');
select refus('Serveur : adresse d''un autre domaine', format($q$select public.preparer_verification_ecole('00000000-0000-0000-0000-000000000131', %L, 'alix@gmail.com', '123456')$q$, :'ecole'), 'DOMAINE_NON_ACCEPTE');
select refus('Serveur : adresse invalide', format($q$select public.preparer_verification_ecole('00000000-0000-0000-0000-000000000131', %L, 'pas-une-adresse', '123456')$q$, :'ecole'), 'EMAIL_INVALIDE');
select refus('Serveur : code mal formé', format($q$select public.preparer_verification_ecole('00000000-0000-0000-0000-000000000131', %L, 'alix@etu.univ-954.fr', '12ab')$q$, :'ecole'), 'CODE_INVALIDE');
select verifie('Serveur : code préparé pour Alix (domaine renvoyé)',
  (select public.preparer_verification_ecole('00000000-0000-0000-0000-000000000131', :'ecole', ' Alix.Dupont@Etu.Univ-954.fr ', '123456') = 'etu.univ-954.fr'));
reset role;
select verifie('Seules des empreintes sont gardées, jamais l''adresse ni le code',
  (select email_empreinte !~ '@' and code_empreinte <> '123456' and domaine = 'etu.univ-954.fr'
   from verifications_ecole where profile_id = '00000000-0000-0000-0000-000000000131'));

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000131');
select verifie('Alix se trompe de code : faux, essai compté', (select not public.confirmer_verification_ecole(:'ecole', '000000')));
reset role;
select verifie('Un essai compté', (select essais = 1 from verifications_ecole where profile_id = '00000000-0000-0000-0000-000000000131'));
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000131');
select verifie('Alix saisit le bon code : étudiante vérifiée', (select public.confirmer_verification_ecole(:'ecole', ' 123456 ')));
reset role;
select verifie('Alix vérifiée, demande en attente effacée',
  (select m.verifie_le is not null and m.domaine = 'etu.univ-954.fr'
   from membres_communaute m where m.communaute_id = :'ecole' and m.profile_id = '00000000-0000-0000-0000-000000000131')
  and not exists (select 1 from verifications_ecole where profile_id = '00000000-0000-0000-0000-000000000131'));

set role service_role;
select refus('Serveur : Basile reprend l''adresse d''Alix', format($q$select public.preparer_verification_ecole('00000000-0000-0000-0000-000000000132', %L, 'alix.dupont@etu.univ-954.fr', '111111')$q$, :'ecole'), 'EMAIL_DEJA_UTILISE');
select essai('Serveur : 1er code pour Basile', format($q$select public.preparer_verification_ecole('00000000-0000-0000-0000-000000000132', %L, 'basile@univ-954.fr', '111111')$q$, :'ecole'), 'passe');
select essai('Serveur : 2e code pour Basile', format($q$select public.preparer_verification_ecole('00000000-0000-0000-0000-000000000132', %L, 'basile@univ-954.fr', '222222')$q$, :'ecole'), 'passe');
select essai('Serveur : 3e code pour Basile', format($q$select public.preparer_verification_ecole('00000000-0000-0000-0000-000000000132', %L, 'basile@univ-954.fr', '333333')$q$, :'ecole'), 'passe');
select refus('Serveur : 4e code dans l''heure', format($q$select public.preparer_verification_ecole('00000000-0000-0000-0000-000000000132', %L, 'basile@univ-954.fr', '444444')$q$, :'ecole'), 'TROP_DE_CODES');
reset role;

-- Une même adresse ne reçoit pas plus de 3 codes par heure, même demandés
-- depuis plusieurs comptes.
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000139');
select verifie('Iris rejoint la communauté', (select public.rejoindre_communaute(:'ecole')));
reset role;
set role service_role;
select refus('Serveur : Iris demande un code pour l''adresse de Basile', format($q$select public.preparer_verification_ecole('00000000-0000-0000-0000-000000000139', %L, 'basile@univ-954.fr', '555555')$q$, :'ecole'), 'TROP_DE_CODES');
select essai('Serveur : Iris demande un code pour sa propre adresse', format($q$select public.preparer_verification_ecole('00000000-0000-0000-0000-000000000139', %L, 'iris@univ-954.fr', '555555')$q$, :'ecole'), 'passe');
reset role;

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000132');
select verifie('Basile : l''ancien code ne vaut plus', (select not public.confirmer_verification_ecole(:'ecole', '111111')));
select verifie('Basile : 2e essai faux', (select not public.confirmer_verification_ecole(:'ecole', '000001')));
select verifie('Basile : 3e essai faux', (select not public.confirmer_verification_ecole(:'ecole', '000002')));
select verifie('Basile : 4e essai faux', (select not public.confirmer_verification_ecole(:'ecole', '000003')));
select verifie('Basile : 5e essai faux', (select not public.confirmer_verification_ecole(:'ecole', '000004')));
select refus('Basile : un 6e essai, même juste', format($q$select public.confirmer_verification_ecole(%L, '333333')$q$, :'ecole'), 'TROP_D_ESSAIS');
reset role;
update verifications_ecole set essais = 0, expire_le = now() - interval '1 minute' where profile_id = '00000000-0000-0000-0000-000000000132';
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000132');
select refus('Basile : code expiré', format($q$select public.confirmer_verification_ecole(%L, '333333')$q$, :'ecole'), 'CODE_EXPIRE');
select en_tant_que('00000000-0000-0000-0000-000000000133');
select refus('Hugo confirme sans demande en attente', format($q$select public.confirmer_verification_ecole(%L, '123456')$q$, :'ecole'), 'AUCUNE_VERIFICATION');
reset role;

-- Une demande abandonnée n'est pas gardée : effacée 24 h après
-- l'expiration de son code.
update verifications_ecole set expire_le = now() - interval '25 hours' where profile_id = '00000000-0000-0000-0000-000000000132';
set role service_role;
select essai('Serveur : 2e code pour Iris', format($q$select public.preparer_verification_ecole('00000000-0000-0000-0000-000000000139', %L, 'iris@univ-954.fr', '666666')$q$, :'ecole'), 'passe');
reset role;
select verifie('La demande abandonnée de Basile est effacée',
  not exists (select 1 from verifications_ecole where profile_id = '00000000-0000-0000-0000-000000000132'));
set role authenticated;

-- Changer les domaines : un sous-domaine reste couvert, un domaine retiré
-- fait perdre la vérification.
select en_tant_que('00000000-0000-0000-0000-000000000130');
select essai('Flora ne garde que univ-954.fr', format($q$select public.definir_ecole(%L, array['univ-954.fr'])$q$, :'ecole'), 'passe');
reset role;
select verifie('Alix (etu.univ-954.fr) reste vérifiée : sous-domaine de univ-954.fr',
  (select verifie_le is not null from membres_communaute where communaute_id = :'ecole' and profile_id = '00000000-0000-0000-0000-000000000131'));
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000130');
select essai('Flora passe à autre-954.fr', format($q$select public.definir_ecole(%L, array['autre-954.fr'])$q$, :'ecole'), 'passe');
reset role;
select verifie('Alix perd sa vérification',
  (select verifie_le is null and email_empreinte is null from membres_communaute where communaute_id = :'ecole' and profile_id = '00000000-0000-0000-0000-000000000131'));
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000130');
select essai('Flora revient à univ-954.fr', format($q$select public.definir_ecole(%L, array['univ-954.fr'])$q$, :'ecole'), 'passe');
reset role;
set role service_role;
select essai('Serveur : nouveau code pour Alix', format($q$select public.preparer_verification_ecole('00000000-0000-0000-0000-000000000131', %L, 'alix.dupont@etu.univ-954.fr', '654321')$q$, :'ecole'), 'passe');
reset role;
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000131');
select verifie('Alix se vérifie à nouveau', (select public.confirmer_verification_ecole(:'ecole', '654321')));
reset role;

-- Tournois réservés aux membres.
select id as saison from seasons where est_courante \gset
select refus('Un tournoi réservé sans communauté',
  $q$insert into tournaments (game_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, reserve_membres) values (1, '00000000-0000-0000-0000-000000000130', 'reserve-954-x', 'Réservé sans club', '1v1', 8, 'EUW', now() + interval '3 days', now() + interval '3 days', 'ouvert', true)$q$,
  'RESERVE_SANS_COMMUNAUTE');
insert into tournaments (id, game_id, season_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, communaute_id, reserve_membres, compte_pour_classement) values
  ('9e000000-0000-0000-0000-000000000001', 1, :'saison', '00000000-0000-0000-0000-000000000130', 'ecole-954-1v1', 'Coupe de l''école', '1v1', 8, 'EUW', now() + interval '3 days', now() + interval '3 days', 'ouvert', :'ecole', true, true),
  ('9e000000-0000-0000-0000-000000000002', 1, :'saison', '00000000-0000-0000-0000-000000000130', 'ecole-954-brouillon', 'Brouillon de l''école', '1v1', 8, 'EUW', now() + interval '3 days', now() + interval '3 days', 'brouillon', :'ecole', false, true),
  ('9e000000-0000-0000-0000-000000000003', 1, :'saison', '00000000-0000-0000-0000-000000000130', 'ecole-954-5v5', 'Coupe 5v5 de l''école', '5v5', 8, 'EUW', now() + interval '3 days', now() + interval '3 days', 'ouvert', :'ecole', true, false);

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000133');
select refus('Hugo, extérieur, s''inscrit au tournoi réservé', $q$select public.s_inscrire_tournoi('9e000000-0000-0000-0000-000000000001')$q$, 'RESERVE_MEMBRES');
select en_tant_que('00000000-0000-0000-0000-000000000132');
select refus('Basile, membre non vérifié, s''inscrit', $q$select public.s_inscrire_tournoi('9e000000-0000-0000-0000-000000000001')$q$, 'RESERVE_MEMBRES');
select en_tant_que('00000000-0000-0000-0000-000000000131');
select essai('Alix, étudiante vérifiée, s''inscrit', $q$select public.s_inscrire_tournoi('9e000000-0000-0000-0000-000000000001')$q$, 'passe');
select en_tant_que('00000000-0000-0000-0000-000000000130');
select refus('Flora ouvre à tous son tournoi publié',
  $q$update tournaments set reserve_membres = false where id = '9e000000-0000-0000-0000-000000000001'$q$, 'CHAMP_NON_MODIFIABLE');
select essai('Flora réserve son brouillon aux membres',
  $q$update tournaments set reserve_membres = true where id = '9e000000-0000-0000-0000-000000000002'$q$, 'passe');
select en_tant_que('00000000-0000-0000-0000-000000000133');
select refus('Hugo s''inscrit comme agent libre au 5v5 réservé', $q$select public.s_inscrire_agent_libre('9e000000-0000-0000-0000-000000000003')$q$, 'RESERVE_MEMBRES');
select en_tant_que('00000000-0000-0000-0000-000000000132');
select refus('Basile, non vérifié, s''inscrit comme agent libre', $q$select public.s_inscrire_agent_libre('9e000000-0000-0000-0000-000000000003')$q$, 'RESERVE_MEMBRES');
reset role;

-- Une équipe inscrite au 5v5 réservé : chacun de ses joueurs doit être
-- étudiant vérifié.
insert into teams (id, game_id, slug, nom, tag, capitaine_id) values
  ('9e000000-0000-0000-0000-0000000000e1', 1, 'equipe-954', 'Equipe 954', 'E954', '00000000-0000-0000-0000-000000000131');
insert into registrations (id, tournament_id, profile_id, statut, team_id, equipe_nom, equipe_tag) values
  ('9e000000-0000-0000-0000-0000000000f1', '9e000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000131', 'inscrit', '9e000000-0000-0000-0000-0000000000e1', 'Equipe 954', 'E954');
select refus('Un joueur extérieur dans l''alignement d''une équipe',
  $q$insert into alignements (tournament_id, profile_id, registration_id) values ('9e000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000133', '9e000000-0000-0000-0000-0000000000f1')$q$,
  'RESERVE_MEMBRES');
select essai('Une étudiante vérifiée dans l''alignement',
  $q$insert into alignements (tournament_id, profile_id, registration_id) values ('9e000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000131', '9e000000-0000-0000-0000-0000000000f1')$q$,
  'passe');

-- Dans une communauté ordinaire, être membre suffit.
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000130');
select essai('Flora crée « Club 954 »', $q$select public.creer_communaute('Club 954', 'club-954')$q$, 'passe');
reset role;
select id as club from communautes where slug = 'club-954' \gset
insert into tournaments (id, game_id, season_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, communaute_id, reserve_membres, compte_pour_classement) values
  ('9e000000-0000-0000-0000-000000000004', 1, :'saison', '00000000-0000-0000-0000-000000000130', 'club-954-1v1', 'Coupe du club', '1v1', 8, 'EUW', now() + interval '3 days', now() + interval '3 days', 'ouvert', :'club', true, true);
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000134');
select refus('Côme, pas membre du club, s''inscrit', $q$select public.s_inscrire_tournoi('9e000000-0000-0000-0000-000000000004')$q$, 'RESERVE_MEMBRES');
select verifie('Côme rejoint le club', (select public.rejoindre_communaute(:'club')));
select essai('Côme, membre, s''inscrit', $q$select public.s_inscrire_tournoi('9e000000-0000-0000-0000-000000000004')$q$, 'passe');
reset role;

-- Classement inter-écoles : moyenne des 5 meilleurs ratings des étudiants
-- vérifiés et classés (Gael, 6e, n'y entre pas) ; une deuxième école,
-- avec 2 classés seulement, est « en constitution ».
insert into membres_communaute (communaute_id, profile_id, verifie_le, domaine, email_empreinte)
select :'ecole', p, now(), 'univ-954.fr', md5(p::text)
from unnest(array['00000000-0000-0000-0000-000000000134', '00000000-0000-0000-0000-000000000135', '00000000-0000-0000-0000-000000000136',
                  '00000000-0000-0000-0000-000000000137', '00000000-0000-0000-0000-000000000138']::uuid[]) p;
insert into ratings (profile_id, game_id, season_id, rating, rd)
select p.id, 1, :'saison', p.rating, 100
from (values
  ('00000000-0000-0000-0000-000000000131'::uuid, 1800), ('00000000-0000-0000-0000-000000000134'::uuid, 1700),
  ('00000000-0000-0000-0000-000000000135'::uuid, 1600), ('00000000-0000-0000-0000-000000000136'::uuid, 1500),
  ('00000000-0000-0000-0000-000000000137'::uuid, 1400), ('00000000-0000-0000-0000-000000000138'::uuid, 1300),
  ('00000000-0000-0000-0000-000000000132'::uuid, 2000)
) as p(id, rating);
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000130');
select essai('Flora crée une deuxième école', $q$select public.creer_communaute('Ecole Deux 954', 'ecole-deux-954')$q$, 'passe');
reset role;
select id as ecole2 from communautes where slug = 'ecole-deux-954' \gset
update communautes set type = 'ecole', domaines_email = array['deux-954.fr'] where id = :'ecole2';
insert into membres_communaute (communaute_id, profile_id, verifie_le, domaine, email_empreinte)
select :'ecole2', p, now(), 'deux-954.fr', md5('deux' || p::text)
from unnest(array['00000000-0000-0000-0000-000000000134', '00000000-0000-0000-0000-000000000135']::uuid[]) p;

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select verifie('Classement inter-écoles : 1 600 de moyenne (5 meilleurs), 6 vérifiés classés ; Basile, non vérifié, ne compte pas',
  (select moyenne_top5 = 1600 and verifies = 6 and classes = 6
   from public.classement_ecoles() where slug = 'esport-univ-954'));
select verifie('L''école à 2 classés est en constitution, après',
  (select array_agg(slug || ':' || coalesce(moyenne_top5::text, 'en constitution') order by ordre)
          = array['esport-univ-954:1600.00', 'ecole-deux-954:en constitution']
   from (select slug, moyenne_top5, row_number() over () as ordre from public.classement_ecoles()) x
   where slug in ('esport-univ-954', 'ecole-deux-954')));
reset role;
