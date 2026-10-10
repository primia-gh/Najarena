-- Audit sécurité du 10/10/2026 (C1, M1, M2, M4 à M7), rejoué en appel
-- direct comme le ferait un organisateur ou un joueur avec sa session.
\set ON_ERROR_STOP 0

-- Hugo organise un tournoi ouvert (4 places) ; Ines et Jules y sont
-- confirmés. À côté, un tournoi officiel d'Alice est en cours, avec sa
-- finale déjà occupée par Bob et Carol.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000001a0', 'hugo9410@test', '{"pseudo":"Hugo9410","slug":"hugo9410"}'),
  ('00000000-0000-0000-0000-0000000001a1', 'ines9410@test', '{"pseudo":"Ines9410","slug":"ines9410"}'),
  ('00000000-0000-0000-0000-0000000001a2', 'jules9410@test', '{"pseudo":"Jules9410","slug":"jules9410"}'),
  ('00000000-0000-0000-0000-0000000001a3', 'kim9410@test', '{"pseudo":"Kim9410","slug":"kim9410"}');

insert into tournaments (id, game_id, season_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut) values
  ('ab100000-0000-0000-0000-000000000001', 1, (select id from seasons where est_courante), '00000000-0000-0000-0000-00000000000a', 'officiel-9410', 'Officiel 9410', '1v1', 4, 'EUW', now() - interval '1 hour', now() - interval '2 hours', 'en_cours'),
  ('ab100000-0000-0000-0000-000000000002', 1, (select id from seasons where est_courante), '00000000-0000-0000-0000-0000000001a0', 'hugo-9410', 'Hugo 9410', '1v1', 4, 'EUW', now() + interval '1 day', now() + interval '20 hours', 'ouvert');
insert into matches (id, tournament_id, tour, position, statut) values
  ('ab100000-0000-0000-0000-0000000000a1', 'ab100000-0000-0000-0000-000000000001', 2, 1, 'en_cours');
insert into matches (id, tournament_id, tour, position, statut, match_suivant_id) values
  ('ab100000-0000-0000-0000-0000000000a2', 'ab100000-0000-0000-0000-000000000001', 1, 1, 'en_cours', 'ab100000-0000-0000-0000-0000000000a1');
insert into match_participants (match_id, profile_id, slot) values
  ('ab100000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000b', 1),
  ('ab100000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000c', 2),
  ('ab100000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000010', 1);
insert into registrations (tournament_id, profile_id, statut) values
  ('ab100000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000001a1', 'confirme'),
  ('ab100000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000001a2', 'confirme');

\echo '===== C1 / M2 — Structure du bracket ====='
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000001a0');
select refus('Hugo crée un match dont le suivant est la finale du tournoi officiel',
  $q$insert into matches (tournament_id, tour, position, match_suivant_id) values ('ab100000-0000-0000-0000-000000000002', 1, 1, 'ab100000-0000-0000-0000-0000000000a1')$q$, 'STRUCTURE_BRACKET_INVALIDE');
select refus('Hugo crée un match du tour 1 sans match suivant (fausse finale)',
  $q$insert into matches (tournament_id, tour, position) values ('ab100000-0000-0000-0000-000000000002', 1, 1)$q$, 'STRUCTURE_BRACKET_INVALIDE');
select refus('Hugo crée un tour qui n''existe pas pour 4 places',
  $q$insert into matches (tournament_id, tour, position) values ('ab100000-0000-0000-0000-000000000002', 3, 1)$q$, 'STRUCTURE_BRACKET_INVALIDE');
select essai('Hugo crée la finale de son tournoi',
  $q$insert into matches (id, tournament_id, tour, position) values ('ab100000-0000-0000-0000-0000000000b1', 'ab100000-0000-0000-0000-000000000002', 2, 1)$q$, 'passe');
select essai('Hugo crée une seconde finale',
  $q$insert into matches (tournament_id, tour, position) values ('ab100000-0000-0000-0000-000000000002', 2, 1)$q$, 'bloque');
select essai('Hugo crée un match du tour 1 qui mène à sa finale',
  $q$insert into matches (id, tournament_id, tour, position, match_suivant_id) values ('ab100000-0000-0000-0000-0000000000b2', 'ab100000-0000-0000-0000-000000000002', 1, 1, 'ab100000-0000-0000-0000-0000000000b1')$q$, 'passe');
select refus('Hugo place Ines en la marquant déjà « prête »',
  $q$insert into match_participants (match_id, profile_id, slot, pret_le) values ('ab100000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000001a1', 1, now() - interval '16 minutes')$q$, 'CHAMP_RESERVE');
select essai('Hugo place Ines normalement',
  $q$insert into match_participants (match_id, profile_id, slot) values ('ab100000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000001a1', 1)$q$, 'passe');
select essai('Hugo lance son tournoi',
  $q$update tournaments set statut = 'en_cours' where id = 'ab100000-0000-0000-0000-000000000002'$q$, 'passe');
select refus('Tournoi lancé : Hugo ajoute un match',
  $q$insert into matches (tournament_id, tour, position, match_suivant_id) values ('ab100000-0000-0000-0000-000000000002', 1, 2, 'ab100000-0000-0000-0000-0000000000b1')$q$, 'BRACKET_FIGE');
select refus('Tournoi lancé : Hugo place Jules',
  $q$insert into match_participants (match_id, profile_id, slot) values ('ab100000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000001a2', 2)$q$, 'BRACKET_FIGE');
reset role;

-- Dernier rempart : même avec une structure invalide écrite par le
-- serveur, le vainqueur n'avance jamais dans un autre tournoi ni dans un
-- match complet.
insert into matches (id, tournament_id, tour, position, statut, match_suivant_id) values
  ('ab100000-0000-0000-0000-0000000000b3', 'ab100000-0000-0000-0000-000000000002', 1, 2, 'en_cours', 'ab100000-0000-0000-0000-0000000000a1');
insert into match_participants (match_id, profile_id, slot) values
  ('ab100000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000001a2', 1);
select refus('Le gagnant d''un match de Hugo avance dans la finale officielle',
  $q$select public.avancer_vainqueur('ab100000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000001a2')$q$, 'MATCH_SUIVANT_INVALIDE');
select refus('Un vainqueur avance dans une finale déjà complète',
  $q$select public.avancer_vainqueur('ab100000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000010')$q$, 'MATCH_COMPLET');
select verifie('La finale officielle n''a toujours que Bob et Carol',
  (select count(*) = 2 and bool_and(profile_id in ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c'))
   from match_participants where match_id = 'ab100000-0000-0000-0000-0000000000a1'));

\echo '===== M4 — Litiges ====='
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000001a1');
select essai('Ines ouvre un litige déjà « résolu » au nom de Hugo, daté d''il y a un an',
  $q$insert into disputes (match_id, ouvert_par, motif, resolution, resolu_par, resolu_le, cree_le) values ('ab100000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000001a1', 'Faux', 'Réglé', '00000000-0000-0000-0000-0000000001a0', now() - interval '1 year', now() - interval '1 year')$q$, 'bloque');
select essai('Ines ouvre un litige normalement',
  $q$insert into disputes (match_id, ouvert_par, motif) values ('ab100000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000001a1', 'Mon adversaire n''est pas venu')$q$, 'passe');
select essai('Ines ouvre un second litige sur le même match',
  $q$insert into disputes (match_id, ouvert_par, motif) values ('ab100000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000001a1', 'Encore')$q$, 'bloque');
select en_tant_que('00000000-0000-0000-0000-0000000001a0');
select essai('Hugo résout le litige en le signant du nom d''Alice, daté d''hier',
  $q$update disputes set resolution = 'Rejoué', resolu_par = '00000000-0000-0000-0000-00000000000a', resolu_le = now() - interval '1 day' where match_id = 'ab100000-0000-0000-0000-0000000000b2'$q$, 'passe');
reset role;
select verifie('La résolution porte la signature de Hugo et l''heure réelle',
  (select resolu_par = '00000000-0000-0000-0000-0000000001a0' and resolu_le > now() - interval '1 minute'
   from disputes where match_id = 'ab100000-0000-0000-0000-0000000000b2'));

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000001a0');
select essai('Hugo vide la résolution (espaces seulement)',
  $q$update disputes set resolution = '   ' where match_id = 'ab100000-0000-0000-0000-0000000000b2'$q$, 'passe');
select essai('Hugo pose une date de résolution sans rien écrire',
  $q$update disputes set resolu_le = now() where match_id = 'ab100000-0000-0000-0000-0000000000b2'$q$, 'passe');
reset role;
select verifie('Sans texte, le litige reste ouvert : ni résolution, ni signature, ni date',
  (select resolution is null and resolu_par is null and resolu_le is null
   from disputes where match_id = 'ab100000-0000-0000-0000-0000000000b2'));

\echo '===== Bracket d''organisateur avec bye (chemin normal de genererBracket) ====='
insert into tournaments (id, game_id, season_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut) values
  ('ab100000-0000-0000-0000-000000000004', 1, (select id from seasons where est_courante), '00000000-0000-0000-0000-0000000001a0', 'hugo-bye-9410', 'Hugo bye 9410', '1v1', 8, 'EUW', now() + interval '1 day', now() + interval '20 hours', 'checkin');
insert into registrations (tournament_id, profile_id, statut) values
  ('ab100000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000001a1', 'confirme');
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000001a0');
select essai('Hugo crée la finale (tour 3 pour 8 places)',
  $q$insert into matches (id, tournament_id, tour, position) values ('ab100000-0000-0000-0000-0000000000c1', 'ab100000-0000-0000-0000-000000000004', 3, 1)$q$, 'passe');
select essai('Hugo crée la demi-finale 1',
  $q$insert into matches (id, tournament_id, tour, position, match_suivant_id) values ('ab100000-0000-0000-0000-0000000000c2', 'ab100000-0000-0000-0000-000000000004', 2, 1, 'ab100000-0000-0000-0000-0000000000c1')$q$, 'passe');
select refus('Hugo relie le match 3 du tour 1 à la demi-finale 1 (mauvaise position)',
  $q$insert into matches (tournament_id, tour, position, match_suivant_id) values ('ab100000-0000-0000-0000-000000000004', 1, 3, 'ab100000-0000-0000-0000-0000000000c2')$q$, 'STRUCTURE_BRACKET_INVALIDE');
select essai('Hugo crée le match 1 du tour 1',
  $q$insert into matches (id, tournament_id, tour, position, match_suivant_id) values ('ab100000-0000-0000-0000-0000000000c3', 'ab100000-0000-0000-0000-000000000004', 1, 1, 'ab100000-0000-0000-0000-0000000000c2')$q$, 'passe');
select essai('Hugo place Ines seule dans ce match',
  $q$insert into match_participants (match_id, profile_id, slot) values ('ab100000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000001a1', 1)$q$, 'passe');
select essai('Hugo tranche le bye en faveur d''Ines',
  $q$select public.enregistrer_verdict_manuel('ab100000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000001a1', 'Bye — moins d''inscrits confirmés que de places dans le bracket.')$q$, 'passe');
reset role;
select verifie('Ines est passée en demi-finale',
  exists (select 1 from match_participants where match_id = 'ab100000-0000-0000-0000-0000000000c2' and profile_id = '00000000-0000-0000-0000-0000000001a1'));
select essai('Relance du même avancement (idempotente)',
  $q$select public.avancer_vainqueur('ab100000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000001a1')$q$, 'passe');
select verifie('Ines n''apparaît qu''une fois en demi-finale',
  (select count(*) = 1 from match_participants where match_id = 'ab100000-0000-0000-0000-0000000000c2'));

\echo '===== M7 — Messages ====='
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-00000000000d');
select refus('Dave envoie 31 messages d''un coup',
  $q$insert into messages (conversation_id, expediteur_id, contenu) select '30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d', 'Message ' || i from generate_series(1, 31) as i$q$, 'LIMITE_ATTEINTE');
reset role;

\echo '===== M1 — Délier son compte Riot en plein tournoi 5v5 ====='
insert into game_accounts (profile_id, game_id, puuid, riot_game_name, riot_tag_line, region, est_principal, verifie_le, methode_verification)
values ('00000000-0000-0000-0000-0000000001a3', 1, 'P-KIM9410', 'Kim', 'EUW', 'EUW', true, now(), 'icone_profil');
insert into tournaments (id, game_id, season_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, compte_pour_classement) values
  ('ab100000-0000-0000-0000-000000000003', 1, (select id from seasons where est_courante), '00000000-0000-0000-0000-00000000000a', 'cinq-9410', 'Cinq 9410', '5v5', 4, 'EUW', now() + interval '1 day', now() + interval '20 hours', 'ouvert', false);
insert into agents_libres (tournament_id, profile_id, statut) values
  ('ab100000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000001a3', 'inscrit');
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000001a3');
select refus('Kim, agent libre d''un tournoi 5v5, délie son compte Riot',
  $q$select public.delier_compte_riot(1::smallint)$q$, 'INSCRIT_A_UN_TOURNOI');
reset role;
select verifie('Le compte Riot de Kim est toujours lié', exists (select 1 from game_accounts where puuid = 'P-KIM9410'));

\echo '===== M5 / M6 / M7 — Création de tournoi ====='
insert into seasons (game_id, numero, nom, debut_le, fin_le, est_courante)
values (1, 90, 'Saison archivée 9410', now() - interval '200 days', now() - interval '100 days', false);
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000001a0');
select refus('Hugo crée un tournoi dont la région est un lien',
  $q$insert into tournaments (game_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut) values (1, '00000000-0000-0000-0000-0000000001a0', 'region-9410', 'Région 9410', '1v1', 8, '[Nitro](https://arnaque.example)', now() + interval '3 days', now() + interval '3 days', 'brouillon')$q$,
  'new row for relation "tournaments" violates check constraint "tournaments_region_check"');
select essai('Hugo crée un tournoi rattaché à une saison archivée',
  $q$insert into tournaments (game_id, season_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut) values (1, (select id from seasons where numero = 90), '00000000-0000-0000-0000-0000000001a0', 'saison-9410', 'Saison 9410', '1v1', 8, 'EUW', now() + interval '3 days', now() + interval '3 days', 'brouillon')$q$, 'passe');
reset role;
select verifie('Le tournoi est rattaché à la saison courante, pas à l''archive',
  (select season_id = (select id from seasons where est_courante) from tournaments where slug = 'saison-9410'));

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000001a0');
select essai('Hugo crée son 2e tournoi du jour',
  $q$insert into tournaments (game_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut) values (1, '00000000-0000-0000-0000-0000000001a0', 'limite-9410-2', 'Limite deux', '1v1', 8, 'EUW', now() + interval '3 days', now() + interval '3 days', 'brouillon')$q$, 'passe');
select essai('Hugo crée son 3e tournoi du jour',
  $q$insert into tournaments (game_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut) values (1, '00000000-0000-0000-0000-0000000001a0', 'limite-9410-3', 'Limite trois', '1v1', 8, 'EUW', now() + interval '3 days', now() + interval '3 days', 'brouillon')$q$, 'passe');
select essai('Hugo crée son 4e tournoi du jour',
  $q$insert into tournaments (game_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut) values (1, '00000000-0000-0000-0000-0000000001a0', 'limite-9410-4', 'Limite quatre', '1v1', 8, 'EUW', now() + interval '3 days', now() + interval '3 days', 'brouillon')$q$, 'passe');
select essai('Hugo crée son 5e tournoi du jour',
  $q$insert into tournaments (game_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut) values (1, '00000000-0000-0000-0000-0000000001a0', 'limite-9410-5', 'Limite cinq', '1v1', 8, 'EUW', now() + interval '3 days', now() + interval '3 days', 'brouillon')$q$, 'passe');
select refus('Hugo crée un 6e tournoi le même jour',
  $q$insert into tournaments (game_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut) values (1, '00000000-0000-0000-0000-0000000001a0', 'limite-9410-6', 'Limite six', '1v1', 8, 'EUW', now() + interval '3 days', now() + interval '3 days', 'brouillon')$q$, 'LIMITE_ATTEINTE');

select en_tant_que('00000000-0000-0000-0000-0000000001a2');
select verifie('Jules tente 10 liaisons Riot dans l''heure : toutes acceptées',
  (select bool_and(public.consommer_limite('liaison_riot')) from generate_series(1, 10)));
select verifie('La 11e liaison Riot de l''heure est refusée', not public.consommer_limite('liaison_riot'));
select refus('Une action inconnue est refusée',
  $q$select public.consommer_limite('inventee')$q$, 'ACTION_INCONNUE');
reset role;

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select essai('Un visiteur appelle consommer_limite',
  $q$select public.consommer_limite('liaison_riot')$q$, 'bloque');
reset role;
