-- Recherche recruteurs (18/11/2026) : en base, sur tous les comptes Riot
-- vérifiés, avec des critères tirés de données vérifiées.
\set ON_ERROR_STOP 0

-- Oli : organisateur. Pat : sans offre. Joueurs en OCE (et Dan au Japon) :
-- Ana mid classée 1800, en progression, active, fiable, cherche une équipe ;
-- Bob mid classé 1650, en recul, en équipe, un forfait ; Cyd support non
-- classée ; Eve mid classée mais suspendue ; Fay mid au compte non vérifié ;
-- Gus jungle classé, annonce de duo.
insert into auth.users (id, email, raw_user_meta_data)
select ('9990f000-0000-0000-0000-00000000000' || n)::uuid, 'scout' || n || '@test',
       json_build_object('pseudo', 'Scout99i' || n, 'slug', 'scout99i' || n)::jsonb
from generate_series(1, 9) n;
\set oli '9990f000-0000-0000-0000-000000000001'
\set pat '9990f000-0000-0000-0000-000000000002'
\set ana '9990f000-0000-0000-0000-000000000003'
\set bob '9990f000-0000-0000-0000-000000000004'
insert into comptes_offres (profile_id, offre) values (:'oli', 'organisateur');
insert into game_accounts (profile_id, game_id, puuid, riot_game_name, riot_tag_line, region, est_principal, verifie_le, methode_verification, role_prefere)
select ('9990f000-0000-0000-0000-00000000000' || v.n)::uuid, 1, 'P-SCOUT-' || v.n, 'Scout' || v.n, 'T', v.region, true,
       case when v.n = 8 then null else now() end, 'icone_profil', v.role
from (values (3, 'OCE', 'mid'), (4, 'OCE', 'mid'), (5, 'OCE', 'support'), (6, 'JP', 'mid'),
             (7, 'OCE', 'mid'), (8, 'OCE', 'mid'), (9, 'OCE', 'jungle')) as v(n, region, role);
insert into ratings (profile_id, game_id, season_id, rating, rd)
select ('9990f000-0000-0000-0000-00000000000' || v.n)::uuid, 1, s.id, v.rating, v.rd
from (values (3, 1800, 80), (4, 1650, 90), (5, 1700, 300), (6, 1900, 70), (7, 1750, 80), (8, 1700, 80), (9, 1600, 100)) as v(n, rating, rd)
cross join seasons s where s.est_courante;
insert into suspensions (profile_id, motif) values ('9990f000-0000-0000-0000-000000000007', 'Essai recherche');
insert into recherches_coequipiers (profile_id, message) values (:'ana', 'Mid motivée');
insert into annonces_duo (profile_id, poste, postes_cherches, creneaux, objectif)
values ('9990f000-0000-0000-0000-000000000009', 'jungle', array['mid'], array['semaine_soir'], 'classees');
insert into teams (id, game_id, slug, nom, tag, capitaine_id)
values ('9990f000-0000-0000-0000-0000000000e1', 1, 'scout-99i', 'Scout 99i', 'SC', :'bob');
insert into team_members (team_id, profile_id, role, accepte_le) values ('9990f000-0000-0000-0000-0000000000e1', :'bob', 'Capitaine', now());

-- Deux tournois clos : Ana +60, Bob -30, il y a moins de 30 jours.
insert into tournaments (id, game_id, season_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut)
select ('9990f000-0000-0000-0000-0000000000a' || n)::uuid, 1, (select id from seasons where est_courante), :'oli',
       'scout-99i-' || n, 'Scout 99i ' || n, '1v1', 8, 'OCE', now() - interval '10 days', now() - interval '10 days', 'termine'
from generate_series(1, 2) n;
insert into rating_events (profile_id, game_id, season_id, motif, tournament_id, rating_avant, rd_avant, rating_apres, rd_apres, cree_le)
select v.p::uuid, 1, (select id from seasons where est_courante), 'tournoi', v.t::uuid, v.av, 100, v.ap, 90, now() - interval '5 days'
from (values (:'ana', '9990f000-0000-0000-0000-0000000000a1', 1740, 1780),
             (:'ana', '9990f000-0000-0000-0000-0000000000a2', 1780, 1800),
             (:'bob', '9990f000-0000-0000-0000-0000000000a1', 1680, 1650)) as v(p, t, av, ap);
-- Trois matchs Ana contre Bob : deux lus chez Riot, un forfait de Bob.
insert into matches (id, tournament_id, tour, position, statut, demarre_le)
select ('9990f000-0000-0000-0000-0000000000b' || n)::uuid, '9990f000-0000-0000-0000-0000000000a1', 1, n,
       (case when n = 3 then 'forfait' else 'termine' end)::match_status, now() - interval '6 days'
from generate_series(1, 3) n;
insert into match_participants (match_id, profile_id, slot, pret_le)
select ('9990f000-0000-0000-0000-0000000000b' || n)::uuid, v.p::uuid, v.slot,
       case when n = 3 and v.slot = 2 then null else now() - interval '6 days' end
from generate_series(1, 3) n
cross join (values (:'ana', 1), (:'bob', 2)) as v(p, slot);
insert into match_verdicts (match_id, niveau, gagnant_id, est_definitif, niveau_compte_min) values
  ('9990f000-0000-0000-0000-0000000000b1', 'historique', :'ana', true, 120),
  ('9990f000-0000-0000-0000-0000000000b2', 'historique', :'ana', true, 120),
  ('9990f000-0000-0000-0000-0000000000b3', 'manuel', :'ana', true, null);
insert into stats_match_joueur (match_id, profile_id, champion, kills, deaths, assists, cs, or_gagne, duree_secondes, gagne) values
  ('9990f000-0000-0000-0000-0000000000b1', :'ana', 'Ahri', 1, 0, 0, 100, 4000, 600, true),
  ('9990f000-0000-0000-0000-0000000000b2', :'ana', 'Ahri', 1, 0, 0, 100, 4000, 600, true),
  ('9990f000-0000-0000-0000-0000000000b1', :'bob', 'Zed', 0, 1, 0, 90, 3500, 600, false);

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select refus('Un visiteur cherche des joueurs', $q$select * from public.rechercher_joueurs()$q$,
  'permission denied for function rechercher_joueurs');
reset role;

set role authenticated;
select en_tant_que(:'pat');
select refus('Pat, sans l''offre Organisateur, cherche des joueurs', $q$select * from public.rechercher_joueurs()$q$, 'OFFRE_ORGANISATEUR_REQUISE');
select en_tant_que(:'oli');
select refus('Oli demande un tri inconnu', $q$select * from public.rechercher_joueurs(p_tri => 'au_hasard')$q$, 'TRI_INVALIDE');
select verifie('Mids d''OCE : Ana puis Bob ; ni la suspendue, ni le compte non vérifié, ni le Japon',
  (select array_agg(pseudo) from public.rechercher_joueurs(p_role => 'mid', p_region => 'OCE')) = array['Scout99i3', 'Scout99i4']);
select verifie('Non classée : ni rating ni confiance',
  (select rating is null and rd is null from public.rechercher_joueurs(p_region => 'OCE', p_role => 'support')));
select verifie('Rating minimum 1700 : les classés seulement (Cyd, non classée à 1700, n''y est pas)',
  (select array_agg(pseudo) from public.rechercher_joueurs(p_region => 'OCE', p_rating_min => 1700)) = array['Scout99i3']);
select verifie('Classés seulement',
  (select array_agg(pseudo) from public.rechercher_joueurs(p_region => 'OCE', p_classes_seulement => true)) = array['Scout99i3', 'Scout99i4', 'Scout99i9']);
select verifie('Cherche une équipe : Ana',
  (select array_agg(pseudo) from public.rechercher_joueurs(p_region => 'OCE', p_disponible => true)) = array['Scout99i3']);
select verifie('Sans équipe : Bob écarté',
  (select array_agg(pseudo) from public.rechercher_joueurs(p_region => 'OCE', p_role => 'mid', p_sans_equipe => true)) = array['Scout99i3']);
select verifie('En progression sur 30 jours : Ana',
  (select array_agg(pseudo) from public.rechercher_joueurs(p_region => 'OCE', p_en_progression => true)) = array['Scout99i3']);
select verifie('Tri par progression : Ana (+60), Bob (-30), puis ceux sans tournoi récent',
  (select (array_agg(pseudo))[1:2] from public.rechercher_joueurs(p_region => 'OCE', p_tri => 'progression')) = array['Scout99i3', 'Scout99i4']);
select verifie('Actifs sur 30 jours (parties lues chez Riot) : Ana et Bob, Ana devant au tri par activité',
  (select array_agg(pseudo) from public.rechercher_joueurs(p_region => 'OCE', p_actif_jours => 30, p_tri => 'activite')) = array['Scout99i3', 'Scout99i4']);
select verifie('Fiables : Ana ; Bob a un forfait, les autres n''ont pas 3 matchs',
  (select array_agg(pseudo) from public.rechercher_joueurs(p_region => 'OCE', p_fiable => true)) = array['Scout99i3']);
select verifie('Ligne d''Ana : progression +60 sur 2 tournois, 2 parties vérifiées (le verdict manuel ne compte pas), cherche une équipe, sans équipe',
  (select progression_30j = 60 and tournois_30j = 2 and parties_90j = 2 and cherche_equipe and not en_equipe
          and matchs_joues = 3 and forfaits = 0
   from public.rechercher_joueurs(p_region => 'OCE') where pseudo = 'Scout99i3'));
select verifie('Ligne de Bob : -30, en équipe, un forfait',
  (select progression_30j = -30 and en_equipe and forfaits = 1 from public.rechercher_joueurs(p_region => 'OCE') where pseudo = 'Scout99i4'));
select verifie('Gus : annonce de duo en cours',
  (select cherche_duo from public.rechercher_joueurs(p_region => 'OCE') where pseudo = 'Scout99i9'));
select verifie('Limite : 1 résultat demandé, 1 reçu',
  (select count(*) = 1 from public.rechercher_joueurs(p_region => 'OCE', p_limite => 1)));
select verifie('Sans « fiables », la fiabilité est quand même donnée pour les joueurs gardés',
  (select matchs_joues = 3 from public.rechercher_joueurs(p_region => 'OCE', p_limite => 1) where pseudo = 'Scout99i3'));
reset role;
-- 120 recherches par heure au plus.
insert into limites_usage (profile_id, action)
select :'oli', 'recherche_joueurs' from generate_series(1, 120);
set role authenticated;
select en_tant_que(:'oli');
select refus('Oli lance une 121e recherche dans l''heure', $q$select * from public.rechercher_joueurs()$q$, 'LIMITE_ATTEINTE');
reset role;
