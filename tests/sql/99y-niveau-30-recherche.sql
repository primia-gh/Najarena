-- Comptes sous le niveau 30 hors de la recherche recruteurs et de la
-- fiabilité (23/11/2026, décision du porteur du projet) : un match lu chez
-- Riot dont le verdict garde un compte sous le niveau 30 ne compte ni dans
-- « activité » de rechercher_joueurs ni dans « matchs joués » de
-- fiabilite_joueur (donc ni dans « fiable »). Même règle que le classement.
\set ON_ERROR_STOP 0

-- Oli : organisateur. Ana et Cyd : comptes de niveau 30 ou plus. Bob :
-- compte de niveau 12. Tous en LAS (aucun autre scénario n'y joue).
insert into auth.users (id, email, raw_user_meta_data)
select ('c0c0f000-0000-0000-0000-00000000000' || n)::uuid, 'niv99y' || n || '@test',
       json_build_object('pseudo', 'Niveau99y' || n, 'slug', 'niveau99y' || n)::jsonb
from generate_series(1, 4) n;
\set oli 'c0c0f000-0000-0000-0000-000000000001'
\set ana 'c0c0f000-0000-0000-0000-000000000002'
\set bob 'c0c0f000-0000-0000-0000-000000000003'
\set cyd 'c0c0f000-0000-0000-0000-000000000004'
insert into comptes_offres (profile_id, offre) values (:'oli', 'organisateur');
insert into game_accounts (profile_id, game_id, puuid, riot_game_name, riot_tag_line, region, est_principal, verifie_le, methode_verification, role_prefere)
select ('c0c0f000-0000-0000-0000-00000000000' || n)::uuid, 1, 'P-99Y-' || n, 'Niveau' || n, 'T', 'LAS', true, now(), 'icone_profil', 'mid'
from generate_series(2, 4) n;

insert into tournaments (id, game_id, season_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut)
values ('c0c0f000-0000-0000-0000-0000000000a1', 1, (select id from seasons where est_courante), :'oli',
        'niveau-99y', 'Niveau 99y', '1v1', 8, 'LAS', now() - interval '10 days', now() - interval '10 days', 'termine');

-- Matchs 1 à 3 : Ana contre Cyd, comptes de niveau 80 (comptent).
-- Matchs 4 à 6 : Ana contre Bob, niveau gardé 12 (ne comptent pas).
-- Match 7 : Ana contre Cyd, verdict d'avant la règle, sans niveau (compte).
insert into matches (id, tournament_id, tour, position, statut, demarre_le)
select ('c0c0f000-0000-0000-0000-0000000000b' || n)::uuid, 'c0c0f000-0000-0000-0000-0000000000a1', 1, n,
       'termine'::match_status, now() - interval '6 days'
from generate_series(1, 7) n;
insert into match_participants (match_id, profile_id, slot, pret_le, est_gagnant)
select ('c0c0f000-0000-0000-0000-0000000000b' || n)::uuid, v.p::uuid, v.slot, now() - interval '6 days', v.slot = 1
from generate_series(1, 7) n
cross join lateral (values (:'ana', 1), (case when n between 4 and 6 then :'bob' else :'cyd' end, 2)) as v(p, slot);
insert into match_verdicts (match_id, niveau, gagnant_id, est_definitif, niveau_compte_min)
select ('c0c0f000-0000-0000-0000-0000000000b' || n)::uuid, 'historique', :'ana', true,
       case when n between 4 and 6 then 12 else 80 end
from generate_series(1, 6) n;
alter table match_verdicts disable trigger niveau_compte_verdict;
insert into match_verdicts (match_id, niveau, gagnant_id, est_definitif, niveau_compte_min)
values ('c0c0f000-0000-0000-0000-0000000000b7', 'historique', :'ana', true, null);
alter table match_verdicts enable trigger niveau_compte_verdict;
insert into stats_match_joueur (match_id, profile_id, champion, kills, deaths, assists, cs, or_gagne, duree_secondes, gagne)
select mp.match_id, mp.profile_id, 'Ahri', 1, 0, 0, 100, 4000, 600, mp.profile_id = :'ana'
from match_participants mp
where mp.match_id::text like 'c0c0f000-0000-0000-0000-0000000000b%';

-- ---- Fiabilité (bloc du CV, lisible par tous) ----
set role anon;
select verifie('Fiabilité d''Ana : 4 matchs joués (les 3 contre un compte de niveau 12 ne comptent pas)',
  (select matchs_joues = 4 from public.fiabilite_joueur(:'ana')));
select verifie('Fiabilité de Bob : aucun match joué (tous avec son compte de niveau 12)',
  (select matchs_joues = 0 and forfaits = 0 from public.fiabilite_joueur(:'bob')));
select verifie('Fiabilité de Cyd : le verdict sans niveau (d''avant la règle) compte comme avant',
  (select matchs_joues = 4 from public.fiabilite_joueur(:'cyd')));
reset role;

-- ---- Recherche recruteurs ----
set role authenticated;
select en_tant_que(:'oli');
select verifie('Activité d''Ana : 4 parties vérifiées sur 90 jours, pas 7',
  (select parties_90j = 4 and matchs_joues = 4
   from public.rechercher_joueurs(p_region => 'LAS') where pseudo = 'Niveau99y2'));
select verifie('Activité de Bob : aucune partie, aucune dernière partie',
  (select parties_90j = 0 and derniere_partie is null and matchs_joues = 0
   from public.rechercher_joueurs(p_region => 'LAS') where pseudo = 'Niveau99y3'));
select verifie('Actifs sur 30 jours : Ana et Cyd, pas Bob',
  (select array_agg(pseudo order by pseudo) from public.rechercher_joueurs(p_region => 'LAS', p_actif_jours => 30))
    = array['Niveau99y2', 'Niveau99y4']);
select verifie('Fiables : Ana et Cyd ; Bob, sans forfait, n''a aucun match qui compte',
  (select array_agg(pseudo order by pseudo) from public.rechercher_joueurs(p_region => 'LAS', p_fiable => true))
    = array['Niveau99y2', 'Niveau99y4']);
select verifie('Tri par activité : Bob en dernier',
  (select pseudo = 'Niveau99y3' from public.rechercher_joueurs(p_region => 'LAS', p_tri => 'activite') offset 2 limit 1));
reset role;

-- ---- 5v5 : verdict sans niveau, niveau du compte lu dans la fiche de partie ----
insert into tournaments (id, game_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, compte_pour_classement)
values ('c0c0f000-0000-0000-0000-0000000000a2', 1, :'oli', 'equipe-99y', 'Equipe 99y', '5v5', 4, 'LAS',
        now() - interval '3 days', now() - interval '3 days', 'termine', false);
insert into matches (id, tournament_id, tour, position, statut, demarre_le)
values ('c0c0f000-0000-0000-0000-0000000000c1', 'c0c0f000-0000-0000-0000-0000000000a2', 1, 1, 'termine', now() - interval '3 days');
-- Bob y représente son équipe (capitaine), qui gagne.
insert into match_participants (match_id, profile_id, slot, est_gagnant)
values ('c0c0f000-0000-0000-0000-0000000000c1', :'bob', 1, true);
insert into match_verdicts (match_id, niveau, gagnant_id, est_definitif)
values ('c0c0f000-0000-0000-0000-0000000000c1', 'historique', :'bob', true);
insert into stats_match_joueur (match_id, profile_id, champion, kills, deaths, assists, cs, or_gagne, duree_secondes, gagne, niveau_compte) values
  ('c0c0f000-0000-0000-0000-0000000000c1', :'bob', 'Lux', 1, 0, 0, 100, 4000, 600, true, 12),
  ('c0c0f000-0000-0000-0000-0000000000c1', :'cyd', 'Leona', 1, 0, 0, 100, 4000, 600, true, 80);
set role authenticated;
select en_tant_que(:'oli');
select verifie('5v5 avec son compte de niveau 12 : Bob reste sans activité',
  (select parties_90j = 0 from public.rechercher_joueurs(p_region => 'LAS') where pseudo = 'Niveau99y3'));
select verifie('5v5 avec un compte de niveau 80 : la partie compte pour Cyd',
  (select parties_90j = 5 from public.rechercher_joueurs(p_region => 'LAS') where pseudo = 'Niveau99y4'));
reset role;

-- ---- Certificat de niveau ----
insert into ratings (profile_id, game_id, season_id, rating, rd)
select p::uuid, 1, (select id from seasons where est_courante), 1500, 200
from unnest(array[:'ana', :'bob']) p;
set role authenticated;
select en_tant_que(:'ana');
select essai('Ana émet un certificat', $q$select public.emettre_certificat() where true$q$, 'passe');
select en_tant_que(:'bob');
select essai('Bob émet un certificat', $q$select public.emettre_certificat() where true$q$, 'passe');
reset role;
select verifie('Certificat d''Ana : 4 matchs vérifiés, 4 victoires (pas les 3 contre un compte de niveau 12)',
  (select matchs_verifies = 4 and victoires = 4 from certificats where profile_id = :'ana'));
select verifie('Certificat de Bob : aucun match vérifié (compte de niveau 12, en 1v1 comme en 5v5)',
  (select matchs_verifies = 0 and victoires = 0 from certificats where profile_id = :'bob'));

-- Le niveau gardé ne se change pas pour repasser au-dessus de 30.
select refus('Un verdict écrit ne se modifie pas (niveau de 12 à 40)',
  $q$update match_verdicts set niveau_compte_min = 40 where match_id = 'c0c0f000-0000-0000-0000-0000000000b4'$q$,
  'VERDICT_IMMUABLE');
