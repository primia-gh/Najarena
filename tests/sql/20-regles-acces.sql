-- Contournements relevés par l'audit du 27/09/2026, rejoués en appel direct
-- comme le ferait un visiteur avec la clé publique et sa propre session.
-- « attendu » = comportement voulu (après les migrations du 28/09/2026).
\set ON_ERROR_STOP 0
\set alice '''00000000-0000-0000-0000-00000000000a'''
\set bob   '''00000000-0000-0000-0000-00000000000b'''
\set carol '''00000000-0000-0000-0000-00000000000c'''
\set dave  '''00000000-0000-0000-0000-00000000000d'''
\set eve   '''00000000-0000-0000-0000-00000000000e'''
\set gina  '''00000000-0000-0000-0000-000000000010'''

\echo '===== C2 — Liaison Riot ====='
set role authenticated;
select en_tant_que(:eve);
select essai('Eve lie le compte Riot de Bob en choisissant son icône actuelle (ancienne fonction)',
  $q$select public.lier_compte_riot(1::smallint, 'P-BOB', 'Bob', 'EUW', 'EUW', 7::smallint)$q$, 'bloque');
select essai('Eve appelle directement la nouvelle fonction réservée au serveur',
  $q$select public.lier_compte_riot('00000000-0000-0000-0000-00000000000e'::uuid, 1::smallint, 'P-BOB', 'Bob', 'EUW', 'EUW', 7::smallint)$q$, 'bloque');
reset role;
set role service_role;
select essai('Serveur : Bob lie son compte P-BOB',
  $q$select public.lier_compte_riot('00000000-0000-0000-0000-00000000000b'::uuid, 1::smallint, 'P-BOB', 'Bob', 'EUW', 'EUW', 12::smallint)$q$, 'passe');
select essai('Serveur : Eve tente de lier P-BOB, déjà lié à Bob',
  $q$select public.lier_compte_riot('00000000-0000-0000-0000-00000000000e'::uuid, 1::smallint, 'P-BOB', 'Faker', 'KR1', 'EUW', 3::smallint)$q$, 'bloque');
select essai('Serveur : Bob lie un second compte P-BOB2',
  $q$select public.lier_compte_riot('00000000-0000-0000-0000-00000000000b'::uuid, 1::smallint, 'P-BOB2', 'Bob2', 'EUW', 'EUW', 5::smallint)$q$, 'passe');
reset role;
select verifie('Bob n''a qu''un seul compte Riot principal', (select count(*) = 1 from game_accounts where profile_id = :bob and est_principal));
select verifie('Le compte P-BOB affiche le nom renvoyé par Riot, pas celui choisi par Eve', (select riot_game_name = 'Bob' and profile_id = :bob from game_accounts where puuid = 'P-BOB'));

\echo '===== E1 — Inscriptions et check-in ====='
set role authenticated;
select en_tant_que(:eve);
select essai('Eve s''inscrit directement à un tournoi complet',
  $q$insert into registrations (tournament_id, profile_id) values ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000e')$q$, 'bloque');
select essai('Eve s''inscrit directement à un tournoi commencé',
  $q$insert into registrations (tournament_id, profile_id) values ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000e')$q$, 'bloque');
select essai('Eve se confirme présente alors que le check-in n''est pas ouvert',
  $q$update registrations set statut = 'confirme' where tournament_id = '10000000-0000-0000-0000-000000000001' and profile_id = '00000000-0000-0000-0000-00000000000e'$q$, 'bloque');
select essai('Eve se donne la tête de série n°1',
  $q$update registrations set seed = 1 where tournament_id = '10000000-0000-0000-0000-000000000001' and profile_id = '00000000-0000-0000-0000-00000000000e'$q$, 'bloque');
select essai('Eve déplace son inscription vers le tournoi complet',
  $q$update registrations set tournament_id = '10000000-0000-0000-0000-000000000002' where tournament_id = '10000000-0000-0000-0000-000000000001' and profile_id = '00000000-0000-0000-0000-00000000000e'$q$, 'bloque');
select essai('Eve s''inscrit par la fonction à un tournoi complet',
  $q$select public.s_inscrire_tournoi('10000000-0000-0000-0000-000000000002')$q$, 'bloque');
select essai('Eve s''inscrit par la fonction à un tournoi commencé',
  $q$select public.s_inscrire_tournoi('10000000-0000-0000-0000-000000000003')$q$, 'bloque');
select essai('Eve s''inscrit une seconde fois au même tournoi',
  $q$select public.s_inscrire_tournoi('10000000-0000-0000-0000-000000000001')$q$, 'bloque');
select essai('Eve fait son check-in avant l''ouverture',
  $q$select public.confirmer_presence('10000000-0000-0000-0000-000000000001')$q$, 'bloque');
select essai('Eve fait son check-in pendant la fenêtre',
  $q$select public.confirmer_presence('10000000-0000-0000-0000-000000000004')$q$, 'passe');
select en_tant_que(:gina);
select essai('Gina s''inscrit normalement à un tournoi ouvert',
  $q$select public.s_inscrire_tournoi('10000000-0000-0000-0000-000000000001')$q$, 'passe');
select en_tant_que(:alice);
select essai('Alice (organisatrice) confirme l''inscription d''Eve',
  $q$update registrations set statut = 'confirme', confirme_le = now() where tournament_id = '10000000-0000-0000-0000-000000000001' and profile_id = '00000000-0000-0000-0000-00000000000e'$q$, 'passe');
select essai('Alice modifie la tête de série d''un joueur',
  $q$update registrations set seed = 1 where tournament_id = '10000000-0000-0000-0000-000000000001'$q$, 'bloque');
reset role;
select verifie('Le check-in d''Eve est enregistré', (select statut = 'confirme' from registrations where tournament_id = '10000000-0000-0000-0000-000000000004' and profile_id = :eve));

\echo '===== M3 — Tournois ====='
set role authenticated;
select en_tant_que(:alice);
select essai('Alice passe son tournoi à 128 places sans l''offre',
  $q$update tournaments set capacite = 128 where id = '10000000-0000-0000-0000-000000000001'$q$, 'bloque');
select essai('Alice passe son tournoi en Best-of 5 sans l''offre',
  $q$update tournaments set best_of = 5 where id = '10000000-0000-0000-0000-000000000001'$q$, 'bloque');
select essai('Alice ajoute un logo sans l''offre',
  $q$update tournaments set logo_url = 'https://abcd1234.supabase.co/storage/v1/object/public/logos/tournoi/10000000-0000-0000-0000-000000000001.png' where id = '10000000-0000-0000-0000-000000000001'$q$, 'bloque');
select essai('Alice décale la date d''un tournoi qui a des inscrits',
  $q$update tournaments set debute_le = now() + interval '3 days' where id = '10000000-0000-0000-0000-000000000001'$q$, 'bloque');
select essai('Alice déclare terminé un tournoi en cours (plus aucun point écrit)',
  $q$update tournaments set statut = 'termine' where id = '10000000-0000-0000-0000-000000000003'$q$, 'bloque');
select essai('Alice crée un tournoi 128 places sans l''offre',
  $q$insert into tournaments (game_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut) values (1, '00000000-0000-0000-0000-00000000000a', 'gros-alice', 'Gros', '1v1', 128, 'EUW', now() + interval '2 days', now() + interval '2 days', 'ouvert')$q$, 'bloque');
select essai('Alice crée un tournoi normal de 8 places',
  $q$insert into tournaments (game_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut) values (1, '00000000-0000-0000-0000-00000000000a', 'normal-alice', 'Normal', '1v1', 8, 'EUW', now() + interval '2 days', now() + interval '2 days', 'ouvert')$q$, 'passe');
select essai('Alice se fait passer pour un tournoi automatique',
  $q$insert into tournaments (game_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, creneau_auto) values (1, '00000000-0000-0000-0000-00000000000a', 'faux-auto', 'Faux', '1v1', 8, 'EUW', now() + interval '2 days', now() + interval '2 days', 'ouvert', 'quotidien-21h')$q$, 'bloque');
select en_tant_que(:dave);
select essai('Dave (offre Organisateur) crée un tournoi 128 places en Bo3',
  $q$insert into tournaments (game_id, organisateur_id, slug, nom, format, capacite, best_of, region, debute_le, checkin_ouvre_le, statut) values (1, '00000000-0000-0000-0000-00000000000d', 'gros-dave', 'Gros', '1v1', 128, 3, 'EUW', now() + interval '2 days', now() + interval '2 days', 'ouvert')$q$, 'passe');
reset role;

\echo '===== M3 — Matchs ====='
set role authenticated;
select en_tant_que(:alice);
select essai('Alice avance l''heure de début d''un match à hier',
  $q$update matches set demarre_le = now() - interval '1 day' where id = '50000000-0000-0000-0000-000000000001'$q$, 'bloque');
select essai('Alice termine un match sans verdict',
  $q$update matches set statut = 'termine' where id = '50000000-0000-0000-0000-000000000001'$q$, 'bloque');
select essai('Alice désigne elle-même un gagnant',
  $q$update match_participants set est_gagnant = true where match_id = '50000000-0000-0000-0000-000000000001' and profile_id = '00000000-0000-0000-0000-00000000000b'$q$, 'bloque');
select essai('Génération du bracket : Alice crée un match vide',
  $q$insert into matches (id, tournament_id, tour, position) values ('50000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001', 1, 1)$q$, 'passe');
select essai('Génération du bracket : Alice place Gina (inscrite, pas confirmée)',
  $q$insert into match_participants (match_id, profile_id, slot) values ('50000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000010', 1)$q$, 'bloque');
select essai('Génération du bracket : Alice place Eve (confirmée)',
  $q$insert into match_participants (match_id, profile_id, slot) values ('50000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-00000000000e', 1)$q$, 'passe');
select essai('Génération du bracket : Alice lance le match maintenant',
  $q$update matches set statut = 'en_cours', demarre_le = now() where id = '50000000-0000-0000-0000-000000000009'$q$, 'passe');
select essai('Alice passe un tournoi en check-in au statut « en cours »',
  $q$update tournaments set statut = 'en_cours' where id = '10000000-0000-0000-0000-000000000004'$q$, 'passe');
reset role;

\echo '===== M1 — Équipes ====='
set role authenticated;
select en_tant_que(:alice);
select essai('Alice ajoute Carol comme membre déjà acceptée, sans son accord',
  $q$insert into team_members (team_id, profile_id, accepte_le) values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', now())$q$, 'bloque');
select essai('Alice invite Carol normalement',
  $q$insert into team_members (team_id, profile_id) values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c')$q$, 'passe');
select essai('Alice ajoute un logo d''équipe sans l''offre',
  $q$update teams set logo_url = 'https://abcd1234.supabase.co/storage/v1/object/public/logos/equipe/20000000-0000-0000-0000-000000000001.png' where id = '20000000-0000-0000-0000-000000000001'$q$, 'bloque');
select essai('Alice modifie la description de son équipe',
  $q$update teams set description = 'On recrute' where id = '20000000-0000-0000-0000-000000000001'$q$, 'passe');
select en_tant_que(:bob);
select essai('Bob (invité chez Alice) se déplace dans l''équipe de Dave, déjà accepté',
  $q$update team_members set team_id = '20000000-0000-0000-0000-000000000002', accepte_le = now() where profile_id = '00000000-0000-0000-0000-00000000000b'$q$, 'bloque');
select essai('Bob s''attribue le rôle « Capitaine »',
  $q$update team_members set role = 'Capitaine' where profile_id = '00000000-0000-0000-0000-00000000000b'$q$, 'bloque');
select essai('Bob accepte son invitation',
  $q$update team_members set accepte_le = now() where team_id = '20000000-0000-0000-0000-000000000001' and profile_id = '00000000-0000-0000-0000-00000000000b'$q$, 'passe');
select en_tant_que(:dave);
select essai('Dave (offre payante) ajoute un logo d''équipe',
  $q$update teams set logo_url = 'https://abcd1234.supabase.co/storage/v1/object/public/logos/equipe/20000000-0000-0000-0000-000000000002.png' where id = '20000000-0000-0000-0000-000000000002'$q$, 'passe');
reset role;

\echo '===== M2 — Messagerie ====='
set role authenticated;
select en_tant_que(:bob);
select essai('Bob réécrit le message de Dave',
  $q$update messages set contenu = 'Je te paie 500 € pour perdre' where id = '40000000-0000-0000-0000-000000000001'$q$, 'bloque');
select essai('Bob s''attribue son propre message comme venant de Dave',
  $q$update messages set expediteur_id = '00000000-0000-0000-0000-00000000000d' where id = '40000000-0000-0000-0000-000000000002'$q$, 'bloque');
select essai('Bob marque comme lu le message de Dave',
  $q$update messages set lu_le = now() where id = '40000000-0000-0000-0000-000000000001'$q$, 'passe');
reset role;

\echo '===== M4 — Profils ====='
set role authenticated;
select en_tant_que(:eve);
select essai('Eve s''attribue un identifiant Discord',
  $q$update profiles set discord_id = '222' where id = '00000000-0000-0000-0000-00000000000e'$q$, 'bloque');
select essai('Eve change l''adresse publique de son CV',
  $q$update profiles set slug = 'faker' where id = '00000000-0000-0000-0000-00000000000e'$q$, 'bloque');
select essai('Eve lit l''identifiant Discord de Bob',
  $q$select discord_id from profiles where id = '00000000-0000-0000-0000-00000000000b'$q$, 'bloque');
select essai('Eve lit le pseudo et l''adresse de Bob',
  $q$select pseudo, slug from profiles where id = '00000000-0000-0000-0000-00000000000b'$q$, 'passe');
reset role;
set role anon;
select essai('Visiteur anonyme : liste des pseudos (plan du site, classement)',
  $q$select slug, created_at from profiles$q$, 'passe');
reset role;

\echo '===== Litiges ====='
set role authenticated;
select en_tant_que(:alice);
select essai('Alice (organisatrice) réécrit le motif du joueur',
  $q$update disputes set motif = 'Rien à signaler' where id = '60000000-0000-0000-0000-000000000001'$q$, 'bloque');
select essai('Alice rédige la résolution du litige',
  $q$update disputes set resolution = 'Carol absente : Bob passe', resolu_par = '00000000-0000-0000-0000-00000000000a', resolu_le = now() where id = '60000000-0000-0000-0000-000000000001'$q$, 'passe');
reset role;

\echo '===== Verdict manuel (chemin normal, fonction existante) ====='
set role authenticated;
select en_tant_que(:alice);
select essai('Alice enregistre un verdict manuel Bob vainqueur',
  $q$select public.enregistrer_verdict_manuel('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'Carol absente')$q$, 'passe');
reset role;
select verifie('Le match est terminé après le verdict', (select statut = 'termine' from matches where id = '50000000-0000-0000-0000-000000000001'));
