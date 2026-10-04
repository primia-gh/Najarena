-- Modération automatique des textes saisis par les joueurs (audit N27).
\set ON_ERROR_STOP 0

-- L'analyse elle-même, contexte par contexte.
select verifie('Un pseudo ordinaire passe', public.analyser_texte('Faker Jr', 'nom') is null);
select verifie('Usurpation : « Najarena_Admin » refusé comme nom', public.analyser_texte('Najarena_Admin', 'nom') = 'refus:usurpation');
select verifie('Usurpation collée : « ModoNajarena » refusé', public.analyser_texte('ModoNajarena', 'nom') like 'refus:%');
select verifie('« Badminton » n''est pas « admin » (mot entier)', public.analyser_texte('Badminton', 'nom') is null);
select verifie('Insulte déguisée « c.0.n.n.a.r.d » refusée comme nom', public.analyser_texte('c.0.n.n.a.r.d', 'nom') = 'refus:insulte');
select verifie('Insulte à lettres répétées « saaalooope » refusée', public.analyser_texte('saaalooope', 'nom') = 'refus:insulte');
select verifie('« Unique » n''est pas une insulte (mot entier)', public.analyser_texte('Unique', 'nom') is null);
select verifie('« Dispute » n''est pas une insulte (mot entier)', public.analyser_texte('La dispute', 'texte_public') is null);
select verifie('Lien refusé dans un nom', public.analyser_texte('Team www.exemple.com', 'nom') = 'refus:lien');
select verifie('Message : insulte mise en revue, pas refusée', public.analyser_texte('t''es un connard', 'prive') = 'revue:insulte');
select verifie('Message : grossièreté acceptée', public.analyser_texte('putain la game', 'prive') is null);
select verifie('Message : lien mis en revue', public.analyser_texte('regarde https://exemple.com/vod', 'prive') = 'revue:lien');
select verifie('Message : arnaque refusée', public.analyser_texte('Free Nitro ici', 'prive') = 'refus:arnaque');
select verifie('Message : propos haineux refusés', public.analyser_texte('kill yourself', 'prive') = 'refus:haine');
select verifie('Texte public : mot « modo » accepté hors nom', public.analyser_texte('Ancien modo, cherche équipe', 'texte_public') is null);

set role anon;
select essai('Visiteur : lit la liste des termes', $q$select 1 from moderation_termes$q$, 'bloque');
select essai('Visiteur : vérifie un pseudo avant de s''inscrire',
  $q$select 1 where not public.texte_acceptable('Najarena_Admin')$q$, 'passe');
select essai('Visiteur : appelle directement l''analyse', $q$select public.analyser_texte('x', 'nom')$q$, 'bloque');
reset role;

-- Pseudos : remplacé à l'inscription, refusé à la modification.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000070', 'modo@test', '{"pseudo":"Modo Officiel","slug":"modo-officiel"}'),
  ('00000000-0000-0000-0000-000000000071', 'wes@test', '{"pseudo":"Wes","slug":"wes"}');
select verifie('Inscription avec un pseudo d''usurpation : pseudo automatique attribué',
  (select pseudo like 'Joueur-%' and slug = lower(pseudo) from profiles where id = '00000000-0000-0000-0000-000000000070'));

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000071');
select refus('Wes prend le pseudo « Admin Wes »',
  $q$select public.modifier_mon_profil('Admin Wes', null, false)$q$, 'PSEUDO_INTERDIT');
select refus('Wes crée l''équipe « Najarena Staff »',
  $q$insert into teams (game_id, slug, nom, tag, capitaine_id) values (1, 'najarena-staff', 'Najarena Staff', 'NAJ', '00000000-0000-0000-0000-000000000071')$q$, 'NOM_INTERDIT');
select refus('Wes crée une équipe au tag injurieux',
  $q$insert into teams (game_id, slug, nom, tag, capitaine_id) values (1, 'equipe-wes', 'Equipe Wes', 'FDP', '00000000-0000-0000-0000-000000000071')$q$, 'NOM_INTERDIT');
select essai('Wes crée une équipe au nom ordinaire',
  $q$insert into teams (game_id, slug, nom, tag, capitaine_id) values (1, 'les-wes', 'Les Wes', 'WES', '00000000-0000-0000-0000-000000000071')$q$, 'passe');
select refus('Wes nomme son tournoi « Tournoi officiel Najarena »',
  $q$insert into tournaments (game_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut) values (1, '00000000-0000-0000-0000-000000000071', 'faux-officiel', 'Tournoi officiel Najarena', '1v1', 8, 'EUW', now() + interval '3 days', now() + interval '3 days', 'ouvert')$q$, 'NOM_INTERDIT');
select refus('Wes publie une annonce injurieuse',
  $q$insert into recherches_coequipiers (profile_id, message) values ('00000000-0000-0000-0000-000000000071', 'cherche équipe, pas de bâtards')$q$, 'TEXTE_INTERDIT');
reset role;

-- Messages : la conversation de Dave (organisateur) et Bob.
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-00000000000d');
select refus('Dave envoie une arnaque',
  $q$insert into messages (conversation_id, expediteur_id, contenu) values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d', 'nitro gratuit ici')$q$, 'MESSAGE_INTERDIT');
select essai('Dave envoie une insulte (mise en revue)',
  $q$insert into messages (id, conversation_id, expediteur_id, contenu) values ('40000000-0000-0000-0000-000000000091', '30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d', 'espèce de connard')$q$, 'passe');
select essai('Dave revoit son propre message en attente', $q$select 1 from messages where id = '40000000-0000-0000-0000-000000000091'$q$, 'passe');
select essai('Dave valide lui-même le signalement', $q$select public.traiter_signalement((select id from moderation_signalements limit 1), true)$q$, 'bloque');
select en_tant_que('00000000-0000-0000-0000-00000000000b');
select essai('Bob ne reçoit pas le message en attente de relecture',
  $q$select 1 from messages where id = '40000000-0000-0000-0000-000000000091'$q$, 'bloque');
select essai('Bob lit la file de modération', $q$select 1 from moderation_signalements$q$, 'bloque');
reset role;
select verifie('Le message est dans la file de modération (insulte)',
  (select statut = 'a_examiner' and raison = 'insulte' and auteur_id = '00000000-0000-0000-0000-00000000000d'
     from moderation_signalements where cible_id = '40000000-0000-0000-0000-000000000091'));

-- Un administrateur valide : Bob reçoit le message.
insert into admins (profile_id) values ('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-00000000000a');
select essai('Alice (administratrice) valide le message',
  $q$select public.traiter_signalement((select id from moderation_signalements where cible_id = '40000000-0000-0000-0000-000000000091'), true)$q$, 'passe');
select refus('Alice le traite une deuxième fois',
  $q$select public.traiter_signalement((select id from moderation_signalements where cible_id = '40000000-0000-0000-0000-000000000091'), false)$q$, 'SIGNALEMENT_DEJA_TRAITE');
select en_tant_que('00000000-0000-0000-0000-00000000000b');
select essai('Bob reçoit le message validé', $q$select 1 from messages where id = '40000000-0000-0000-0000-000000000091'$q$, 'passe');
select refus('Bob ouvre un litige au motif haineux',
  $q$insert into disputes (match_id, ouvert_par, motif) values ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'sale nigger')$q$, 'MOTIF_INTERDIT');
reset role;
delete from admins where profile_id = '00000000-0000-0000-0000-00000000000a';
