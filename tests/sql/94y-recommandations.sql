-- Recommandations vérifiées (idée en réserve n°7) : seulement entre joueurs
-- qui ont joué ensemble ou l'un contre l'autre une partie lue chez Riot.
\set ON_ERROR_STOP 0

-- Pia, Quentin, Rose, Sam (suspendu), Tom (n'a jamais joué avec Pia).
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000003b0', 'pia94y@test', '{"pseudo":"Pia94y","slug":"pia94y"}'),
  ('00000000-0000-0000-0000-0000000003b1', 'quentin94y@test', '{"pseudo":"Quentin94y","slug":"quentin94y"}'),
  ('00000000-0000-0000-0000-0000000003b2', 'rose94y@test', '{"pseudo":"Rose94y","slug":"rose94y"}'),
  ('00000000-0000-0000-0000-0000000003b3', 'sam94y@test', '{"pseudo":"Sam94y","slug":"sam94y"}'),
  ('00000000-0000-0000-0000-0000000003b4', 'tom94y@test', '{"pseudo":"Tom94y","slug":"tom94y"}');
insert into suspensions (profile_id, motif) values ('00000000-0000-0000-0000-0000000003b3', 'Test de suspension');

insert into tournaments (id, game_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut) values
  ('a7e00000-0000-0000-0000-000000000001', 1, '00000000-0000-0000-0000-0000000003b4', 'reco-94y', 'Reco 94y', '1v1', 8, 'EUW',
   now() - interval '3 days', now() - interval '3 days', 'en_cours');
insert into matches (id, tournament_id, tour, position, statut) values
  ('a7e00000-0000-0000-0000-000000000011', 'a7e00000-0000-0000-0000-000000000001', 1, 1, 'termine'),
  ('a7e00000-0000-0000-0000-000000000012', 'a7e00000-0000-0000-0000-000000000001', 1, 2, 'termine'),
  ('a7e00000-0000-0000-0000-000000000013', 'a7e00000-0000-0000-0000-000000000001', 1, 3, 'termine');
-- m11 : Pia contre Quentin, lu chez Riot. m12 : Pia contre Rose, verdict
-- manuel (ne compte pas). m13 : Sam contre Pia, lu chez Riot.
insert into match_verdicts (match_id, niveau, gagnant_id, est_definitif) values
  ('a7e00000-0000-0000-0000-000000000011', 'historique', '00000000-0000-0000-0000-0000000003b0', true),
  ('a7e00000-0000-0000-0000-000000000012', 'manuel', '00000000-0000-0000-0000-0000000003b0', true),
  ('a7e00000-0000-0000-0000-000000000013', 'historique', '00000000-0000-0000-0000-0000000003b3', true);
insert into stats_match_joueur (match_id, profile_id, champion, kills, deaths, assists, cs, or_gagne, duree_secondes, gagne) values
  ('a7e00000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-0000000003b0', 'Ahri', 5, 2, 1, 120, 6000, 900, true),
  ('a7e00000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-0000000003b1', 'Zed', 2, 5, 1, 110, 5000, 900, false),
  ('a7e00000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-0000000003b0', 'Ahri', 5, 2, 1, 120, 6000, 900, true),
  ('a7e00000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-0000000003b2', 'Lux', 2, 5, 1, 110, 5000, 900, false),
  ('a7e00000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-0000000003b3', 'Lux', 5, 2, 1, 120, 6000, 900, true),
  ('a7e00000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-0000000003b0', 'Ahri', 2, 5, 1, 110, 5000, 900, false);

set role anon;
select verifie('Matchs communs : Pia et Quentin, 1 match vérifié l''un contre l''autre',
  (select ensemble = 0 and contre = 1 from public.matchs_communs('00000000-0000-0000-0000-0000000003b0', '00000000-0000-0000-0000-0000000003b1')));
select verifie('Matchs communs : un verdict manuel ne compte pas (Pia et Rose)',
  (select ensemble + contre = 0 from public.matchs_communs('00000000-0000-0000-0000-0000000003b0', '00000000-0000-0000-0000-0000000003b2')));
select refus('Visiteur : recommande un joueur',
  $q$select public.recommander('00000000-0000-0000-0000-0000000003b0', 'Très bon joueur, toujours à l''heure.')$q$,
  'permission denied for function recommander');
reset role;

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000003b1');
select essai('Quentin recommande Pia, affrontée dans une partie lue chez Riot',
  $q$select public.recommander('00000000-0000-0000-0000-0000000003b0', 'Joueuse solide, à l''heure et fair-play jusqu''au bout.')$q$, 'passe');
select essai('Quentin modifie sa recommandation (toujours une seule)',
  $q$select public.recommander('00000000-0000-0000-0000-0000000003b0', 'Joueuse solide et régulière, très bon placement en fin de partie.')$q$, 'passe');
select verifie('Une seule recommandation de Quentin pour Pia, texte modifié',
  (select count(*) = 1 and bool_and(texte like '%placement%') from public.recommandations
    where auteur_id = '00000000-0000-0000-0000-0000000003b1'));
select refus('Quentin se recommande lui-même',
  $q$select public.recommander('00000000-0000-0000-0000-0000000003b1', 'Je suis vraiment un excellent joueur.')$q$, 'RECOMMANDATION_SOI_MEME');
select refus('Quentin écrit un texte trop court',
  $q$select public.recommander('00000000-0000-0000-0000-0000000003b0', 'Top')$q$, 'TEXTE_LONGUEUR');
select refus('Quentin écrit une insulte',
  $q$select public.recommander('00000000-0000-0000-0000-0000000003b0', 'Joue bien pour une bâtarde, franchement.')$q$, 'TEXTE_INTERDIT');
select essai('Quentin écrit directement dans la table',
  $q$insert into recommandations (auteur_id, destinataire_id, texte) values ('00000000-0000-0000-0000-0000000003b1', '00000000-0000-0000-0000-0000000003b2', 'Texte écrit sans passer par la fonction.')$q$, 'bloque');
reset role;

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000003b2');
select refus('Rose recommande Pia : leur seul match a un verdict manuel',
  $q$select public.recommander('00000000-0000-0000-0000-0000000003b0', 'Je la connais bien, elle joue très bien.')$q$, 'PAS_JOUE_ENSEMBLE');
reset role;
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000003b4');
select refus('Tom recommande Pia sans avoir joué avec elle',
  $q$select public.recommander('00000000-0000-0000-0000-0000000003b0', 'Je la connais bien, elle joue très bien.')$q$, 'PAS_JOUE_ENSEMBLE');
select essai('Tom lit la recommandation de Quentin dans la table',
  $q$select * from recommandations where destinataire_id = '00000000-0000-0000-0000-0000000003b0'$q$, 'bloque');
reset role;
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000003b3');
select refus('Sam (suspendu) recommande Pia',
  $q$select public.recommander('00000000-0000-0000-0000-0000000003b0', 'Bonne adversaire, partie très propre.')$q$, 'COMPTE_SUSPENDU');
reset role;

select set_config('request.jwt.claim.sub', '', false);
set role anon;
select verifie('Visiteur : le CV de Pia montre la recommandation de Quentin et le match commun',
  (select count(*) = 1 and bool_and(auteur_pseudo = 'Quentin94y' and matchs_contre = 1)
     from public.recommandations_joueur('00000000-0000-0000-0000-0000000003b0')));
reset role;

-- Pia masque la recommandation : elle disparaît pour les visiteurs, pas pour elle.
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000003b1');
select verifie('Quentin ne peut pas masquer une recommandation qu''il a reçue d''un autre',
  not public.masquer_recommandation('00000000-0000-0000-0000-0000000003b1', true));
select en_tant_que('00000000-0000-0000-0000-0000000003b0');
select verifie('Pia masque la recommandation de Quentin', public.masquer_recommandation('00000000-0000-0000-0000-0000000003b1', true));
select verifie('Pia la voit encore, marquée masquée',
  (select bool_and(masquee) and count(*) = 1 from public.recommandations_joueur('00000000-0000-0000-0000-0000000003b0')));
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select verifie('Visiteur : la recommandation masquée n''apparaît plus',
  (select count(*) = 0 from public.recommandations_joueur('00000000-0000-0000-0000-0000000003b0')));
reset role;

-- Compte supprimé : ses recommandations disparaissent.
update profiles set supprime_le = now() where id = '00000000-0000-0000-0000-0000000003b1';
select verifie('Compte de Quentin supprimé : sa recommandation est effacée',
  (select count(*) = 0 from recommandations where auteur_id = '00000000-0000-0000-0000-0000000003b1'));
