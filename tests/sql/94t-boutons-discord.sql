-- Boutons des messages privés Discord (idée en réserve n°10) : un clic
-- agit au nom du joueur lié au compte Discord, par les fonctions du site.
\set ON_ERROR_STOP 0

-- Ada (…0a0, Discord D-ADA) et Bob (…0a1, D-BOB), EUW vérifiés ; Cyd (…0a2,
-- D-CYD) regarde ; Dan (…0a3) n'a pas lié Discord.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a0', 'ada@test', '{"pseudo":"Ada","slug":"ada"}'),
  ('00000000-0000-0000-0000-0000000000a1', 'bob@test', '{"pseudo":"Bob","slug":"bob"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'cyd@test', '{"pseudo":"Cyd","slug":"cyd"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'dan@test', '{"pseudo":"Dan","slug":"dan"}');
update profiles set discord_id = 'D-ADA' where id = '00000000-0000-0000-0000-0000000000a0';
update profiles set discord_id = 'D-BOB' where id = '00000000-0000-0000-0000-0000000000a1';
update profiles set discord_id = 'D-CYD' where id = '00000000-0000-0000-0000-0000000000a2';
insert into game_accounts (profile_id, game_id, puuid, riot_game_name, riot_tag_line, region, est_principal, verifie_le, methode_verification) values
  ('00000000-0000-0000-0000-0000000000a0', 1, 'P-ADA', 'Ada', 'EUW', 'EUW', true, now(), 'icone_profil'),
  ('00000000-0000-0000-0000-0000000000a1', 1, 'P-BOB', 'Bob', 'EUW', 'EUW', true, now(), 'icone_profil');

-- Un tournoi en check-in (Ada et Cyd inscrites), un tournoi pas encore en
-- check-in (Ada inscrite), un match ouvert Ada contre Bob.
insert into tournaments (id, game_id, season_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut) values
  ('94700000-0000-0000-0000-000000000001', 1, (select id from seasons where est_courante), '00000000-0000-0000-0000-00000000000a',
   'essai-discord-checkin', 'Essai Discord check-in', '1v1', 8, 'EUW', now() + interval '20 minutes', now() - interval '10 minutes', 'checkin'),
  ('94700000-0000-0000-0000-000000000002', 1, (select id from seasons where est_courante), '00000000-0000-0000-0000-00000000000a',
   'essai-discord-plus-tard', 'Essai Discord plus tard', '1v1', 8, 'EUW', now() + interval '2 days', now() + interval '1 day', 'ouvert'),
  ('94700000-0000-0000-0000-000000000003', 1, (select id from seasons where est_courante), '00000000-0000-0000-0000-00000000000a',
   'essai-discord-match', 'Essai Discord match', '1v1', 4, 'EUW', now() - interval '1 hour', now() - interval '2 hours', 'en_cours');
insert into registrations (tournament_id, profile_id, statut) values
  ('94700000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a0', 'inscrit'),
  ('94700000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a2', 'inscrit'),
  ('94700000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a0', 'inscrit');
insert into matches (id, tournament_id, tour, position, statut, demarre_le) values
  ('94700000-0000-0000-0000-000000000031', '94700000-0000-0000-0000-000000000003', 1, 1, 'en_cours', now() - interval '10 minutes');
insert into match_participants (match_id, profile_id, slot) values
  ('94700000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-0000000000a0', 1),
  ('94700000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-0000000000a1', 2);

-- Personne d'autre que le serveur.
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000000a0');
select essai('Ada appelle elle-même la fonction des boutons Discord',
  $q$select public.agir_depuis_discord('D-ADA', 'checkin', '94700000-0000-0000-0000-000000000001')$q$, 'bloque');
reset role;
set role anon;
select essai('Un visiteur appelle la fonction des boutons Discord',
  $q$select public.agir_depuis_discord('D-ADA', 'checkin', '94700000-0000-0000-0000-000000000001')$q$, 'bloque');
reset role;

set role service_role;
select refus('Clic d''un compte Discord lié à aucun joueur',
  $q$select public.agir_depuis_discord('D-INCONNU', 'checkin', '94700000-0000-0000-0000-000000000001')$q$, 'COMPTE_DISCORD_INCONNU');
select refus('Bouton inconnu',
  $q$select public.agir_depuis_discord('D-ADA', 'supprimer', '94700000-0000-0000-0000-000000000001')$q$, 'ACTION_INCONNUE');

-- Check-in.
select essai('Ada confirme sa présence depuis Discord',
  $q$select 1 where (public.agir_depuis_discord('D-ADA', 'checkin', '94700000-0000-0000-0000-000000000001') ->> 'ok')::boolean$q$, 'passe');
select verifie('Son inscription est confirmée, à son nom seulement',
  (select statut = 'confirme' and confirme_le is not null from registrations
   where tournament_id = '94700000-0000-0000-0000-000000000001' and profile_id = '00000000-0000-0000-0000-0000000000a0')
  and (select statut = 'inscrit' from registrations
   where tournament_id = '94700000-0000-0000-0000-000000000001' and profile_id = '00000000-0000-0000-0000-0000000000a2'));
select essai('Ada clique une deuxième fois : rien de plus à confirmer',
  $q$select 1 where not (public.agir_depuis_discord('D-ADA', 'checkin', '94700000-0000-0000-0000-000000000001') ->> 'ok')::boolean$q$, 'passe');
select refus('Ada confirme avant l''ouverture du check-in',
  $q$select public.agir_depuis_discord('D-ADA', 'checkin', '94700000-0000-0000-0000-000000000002')$q$, 'CHECKIN_FERME');
select essai('Bob, pas inscrit, « confirme » : rien ne change',
  $q$select 1 where not (public.agir_depuis_discord('D-BOB', 'checkin', '94700000-0000-0000-0000-000000000001') ->> 'ok')::boolean$q$, 'passe');

-- « Je suis prêt ».
select refus('Cyd se déclare prête dans le match d''Ada et Bob',
  $q$select public.agir_depuis_discord('D-CYD', 'pret', '94700000-0000-0000-0000-000000000031')$q$, 'NON_PARTICIPANT');
select essai('Ada se déclare prête depuis Discord',
  $q$select 1 where (public.agir_depuis_discord('D-ADA', 'pret', '94700000-0000-0000-0000-000000000031') ->> 'nouveau')::boolean$q$, 'passe');
select verifie('Ada est prête, Bob pas encore',
  (select pret_le is not null from match_participants
   where match_id = '94700000-0000-0000-0000-000000000031' and profile_id = '00000000-0000-0000-0000-0000000000a0')
  and (select pret_le is null from match_participants
   where match_id = '94700000-0000-0000-0000-000000000031' and profile_id = '00000000-0000-0000-0000-0000000000a1'));
reset role;

-- Défi : Bob défie Ada sur le site, Ada répond depuis Discord.
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000000a1');
select essai('Bob défie Ada', $q$select public.lancer_defi('00000000-0000-0000-0000-0000000000a0')$q$, 'passe');
reset role;
select id as defi_bob from defis
where lanceur_id = '00000000-0000-0000-0000-0000000000a1' and adversaire_id = '00000000-0000-0000-0000-0000000000a0' \gset

set role service_role;
select refus('Cyd accepte depuis Discord un défi qui ne lui est pas adressé',
  format($q$select public.agir_depuis_discord('D-CYD', 'defi_oui', %L)$q$, :'defi_bob'), 'NON_DESTINATAIRE');
select essai('Ada accepte le défi depuis Discord : un duel s''ouvre',
  format($q$select 1 where public.agir_depuis_discord('D-ADA', 'defi_oui', %L) ->> 'slug' is not null$q$, :'defi_bob'), 'passe');
select refus('Ada accepte une deuxième fois',
  format($q$select public.agir_depuis_discord('D-ADA', 'defi_oui', %L)$q$, :'defi_bob'), 'DEFI_DEJA_TRAITE');
reset role;
select d.tournament_id as duel from defis d where d.id = :'defi_bob' \gset

-- Revanche après le duel.
set role service_role;
select refus('Cyd demande une revanche pour un duel qu''elle n''a pas joué',
  format($q$select public.agir_depuis_discord('D-CYD', 'revanche', %L)$q$, :'duel'), 'NON_PARTICIPANT');
select refus('Revanche demandée sur un tournoi qui n''est pas un duel',
  $q$select public.agir_depuis_discord('D-ADA', 'revanche', '94700000-0000-0000-0000-000000000003')$q$, 'NON_PARTICIPANT');
select essai('Ada propose une revanche à Bob depuis Discord',
  format($q$select 1 where public.agir_depuis_discord('D-ADA', 'revanche', %L) ->> 'adversaire' = '00000000-0000-0000-0000-0000000000a1'$q$, :'duel'), 'passe');
select verifie('La revanche est un défi d''Ada à Bob, en attente de réponse',
  exists (select 1 from defis where lanceur_id = '00000000-0000-0000-0000-0000000000a0'
          and adversaire_id = '00000000-0000-0000-0000-0000000000a1' and statut = 'propose'));
select refus('Ada propose la même revanche une deuxième fois',
  format($q$select public.agir_depuis_discord('D-ADA', 'revanche', %L)$q$, :'duel'), 'DEFI_DEJA_PROPOSE');
reset role;

-- Compte suspendu : les règles du site s'appliquent aussi aux boutons.
insert into suspensions (profile_id, motif) values ('00000000-0000-0000-0000-0000000000a2', 'Essai boutons Discord');
set role service_role;
select refus('Cyd, suspendue, confirme sa présence depuis Discord',
  $q$select public.agir_depuis_discord('D-CYD', 'checkin', '94700000-0000-0000-0000-000000000001')$q$, 'COMPTE_SUSPENDU');
reset role;
