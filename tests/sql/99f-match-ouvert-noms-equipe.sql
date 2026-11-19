-- Pas de défi ni de duel d'arène pendant un match ouvert entre les deux
-- joueurs ; deux équipes ne portent pas le même nom (18/11/2026).
\set ON_ERROR_STOP 0

-- Ava et Bob (EUW) : un match de tournoi encore ouvert entre eux.
-- Cid et Dee (EUW) : pareil, pour l'arène. Eva : capitaine d'équipe.
insert into auth.users (id, email, raw_user_meta_data)
select ('99f00000-0000-0000-0000-00000000000' || n)::uuid, 'p99f' || n || '@test',
       json_build_object('pseudo', 'Ouvert99f' || n, 'slug', 'ouvert99f' || n)::jsonb
from generate_series(1, 5) n;
insert into game_accounts (profile_id, game_id, puuid, riot_game_name, riot_tag_line, region, est_principal, verifie_le, methode_verification)
select ('99f00000-0000-0000-0000-00000000000' || n)::uuid, 1, 'P-99F-' || n, 'Ouvert' || n, 'EUW', 'EUW', true, now(), 'icone_profil'
from generate_series(1, 4) n;
insert into admins (profile_id) values ('00000000-0000-0000-0000-00000000000d') on conflict do nothing;
insert into tournaments (id, game_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, nature)
values
  ('99f00000-0000-0000-0000-0000000000a1', 1, '00000000-0000-0000-0000-00000000000d', 'tournoi-99f-a', 'Tournoi 99f A', '1v1', 4, 'EUW', now(), now(), 'en_cours', 'tournoi'),
  ('99f00000-0000-0000-0000-0000000000a2', 1, '00000000-0000-0000-0000-00000000000d', 'tournoi-99f-b', 'Tournoi 99f B', '1v1', 4, 'EUW', now(), now(), 'en_cours', 'tournoi');
insert into matches (id, tournament_id, tour, position, statut, demarre_le) values
  ('99f00000-0000-0000-0000-0000000000b1', '99f00000-0000-0000-0000-0000000000a1', 1, 1, 'en_cours', now() - interval '10 minutes'),
  ('99f00000-0000-0000-0000-0000000000b2', '99f00000-0000-0000-0000-0000000000a2', 1, 1, 'en_cours', now() - interval '10 minutes');
insert into match_participants (match_id, profile_id, slot) values
  ('99f00000-0000-0000-0000-0000000000b1', '99f00000-0000-0000-0000-000000000001', 1),
  ('99f00000-0000-0000-0000-0000000000b1', '99f00000-0000-0000-0000-000000000002', 2),
  ('99f00000-0000-0000-0000-0000000000b2', '99f00000-0000-0000-0000-000000000003', 1),
  ('99f00000-0000-0000-0000-0000000000b2', '99f00000-0000-0000-0000-000000000004', 2);

select verifie('Un match ouvert entre Ava et Bob se voit dans les deux sens',
  public.match_ouvert_entre('99f00000-0000-0000-0000-000000000001', '99f00000-0000-0000-0000-000000000002')
  and public.match_ouvert_entre('99f00000-0000-0000-0000-000000000002', '99f00000-0000-0000-0000-000000000001')
  and not public.match_ouvert_entre('99f00000-0000-0000-0000-000000000001', '99f00000-0000-0000-0000-000000000003'));

set role authenticated;
select en_tant_que('99f00000-0000-0000-0000-000000000001');
select refus('Un joueur interroge lui-même la fonction',
  $q$select public.match_ouvert_entre('99f00000-0000-0000-0000-000000000001', '99f00000-0000-0000-0000-000000000002')$q$,
  'permission denied for function match_ouvert_entre');
select essai('Ava défie Bob (le défi attend sa réponse)', $q$select public.lancer_defi('99f00000-0000-0000-0000-000000000002')$q$, 'passe');
reset role;
select id as defi_ava from defis where lanceur_id = '99f00000-0000-0000-0000-000000000001' \gset

set role authenticated;
select en_tant_que('99f00000-0000-0000-0000-000000000002');
select refus('Bob accepte pendant que leur match de tournoi est ouvert',
  format($q$select public.repondre_defi(%L, true)$q$, :'defi_ava'), 'MATCH_OUVERT_ENTRE_VOUS');
reset role;
select verifie('Le refus n''a rien changé : défi toujours en attente, aucun duel créé',
  (select statut = 'propose' and tournament_id is null from defis where id = :'defi_ava'));

-- Litige récent : toujours ouvert. Litige de plus de 25 h : plus suivi.
update matches set statut = 'litige', demarre_le = now() - interval '2 hours' where id = '99f00000-0000-0000-0000-0000000000b1';
select verifie('Un litige récent compte comme un match ouvert',
  public.match_ouvert_entre('99f00000-0000-0000-0000-000000000001', '99f00000-0000-0000-0000-000000000002'));
update matches set demarre_le = now() - interval '30 hours' where id = '99f00000-0000-0000-0000-0000000000b1';
select verifie('Un litige de plus de 25 h ne bloque plus',
  not public.match_ouvert_entre('99f00000-0000-0000-0000-000000000001', '99f00000-0000-0000-0000-000000000002'));
update matches set statut = 'termine' where id = '99f00000-0000-0000-0000-0000000000b1';

set role authenticated;
select en_tant_que('99f00000-0000-0000-0000-000000000002');
select verifie('Match joué : Bob accepte, le duel est créé',
  (select public.repondre_defi(:'defi_ava', true) like 'defi-%'));
reset role;

-- Arène : Cid et Dee ont un match ouvert entre eux.
set role authenticated;
select en_tant_que('99f00000-0000-0000-0000-000000000003');
select verifie('Cid entre dans l''arène', (select public.rejoindre_arene() is null));
select en_tant_que('99f00000-0000-0000-0000-000000000004');
select verifie('Dee entre : pas de duel contre Cid tant que leur match est ouvert', (select public.rejoindre_arene() is null));
reset role;
select verifie('Les deux attendent toujours dans la file',
  (select count(*) = 2 from file_arene where profile_id in ('99f00000-0000-0000-0000-000000000003', '99f00000-0000-0000-0000-000000000004')));
update matches set statut = 'termine' where id = '99f00000-0000-0000-0000-0000000000b2';
set role service_role;
select verifie('Match joué : la tâche d''appariement les met face à face',
  exists (select 1 from public.apparier_arene()));
reset role;
select verifie('Leur duel d''arène est ouvert',
  exists (select 1 from tournaments t
          join registrations r3 on r3.tournament_id = t.id and r3.profile_id = '99f00000-0000-0000-0000-000000000003'
          join registrations r4 on r4.tournament_id = t.id and r4.profile_id = '99f00000-0000-0000-0000-000000000004'
          where t.nature = 'defi' and t.statut = 'en_cours' and t.nom like 'Arène %'));

-- Noms d'équipe.
select verifie('Clé d''un nom : casse, accents, espaces et tirets ignorés, chiffres gardés',
  public.cle_nom_equipe('Lès Loups') = 'lesloups' and public.cle_nom_equipe('LES-LOUPS') = 'lesloups'
  and public.cle_nom_equipe('Team 1') <> public.cle_nom_equipe('Team I')
  and public.cle_nom_equipe('!!!') is null);
set role authenticated;
select en_tant_que('99f00000-0000-0000-0000-000000000005');
select essai('Eva crée « Les Loups 99f »',
  $q$insert into teams (game_id, slug, nom, tag, capitaine_id) values (1, 'les-loups-99f', 'Les Loups 99f', 'LL', '99f00000-0000-0000-0000-000000000005')$q$, 'passe');
select refus('Eva crée « LES-LOUPS 99F »',
  $q$insert into teams (game_id, slug, nom, tag, capitaine_id) values (1, 'les-loups-99f-2', 'LES-LOUPS 99F', 'LL', '99f00000-0000-0000-0000-000000000005')$q$, 'duplicate key value violates unique constraint "teams_nom_unique"');
select refus('Eva crée « Lès Loups 99f »',
  $q$insert into teams (game_id, slug, nom, tag, capitaine_id) values (1, 'les-loups-99f-3', 'Lès Loups 99f', 'LL', '99f00000-0000-0000-0000-000000000005')$q$, 'duplicate key value violates unique constraint "teams_nom_unique"');
select essai('Eva crée « Les Loups 99f 2 »',
  $q$insert into teams (game_id, slug, nom, tag, capitaine_id) values (1, 'les-loups-99f-4', 'Les Loups 99f 2', 'LL', '99f00000-0000-0000-0000-000000000005')$q$, 'passe');
select refus('Eva crée « Lеs Loups 99f » avec un « е » cyrillique',
  $q$insert into teams (game_id, slug, nom, tag, capitaine_id) values (1, 'les-loups-99f-5', 'Lеs Loups 99f', 'LL', '99f00000-0000-0000-0000-000000000005')$q$, 'NOM_EQUIPE_INVALIDE');
select refus('Eva crée « Agents libres 7 », nom réservé aux équipes formées par la base',
  $q$insert into teams (game_id, slug, nom, tag, capitaine_id) values (1, 'agents-libres-99f', 'Agents libres 7', 'AL', '99f00000-0000-0000-0000-000000000005')$q$, 'NOM_EQUIPE_INVALIDE');
select refus('Eva crée une équipe au nom de deux lettres',
  $q$insert into teams (game_id, slug, nom, tag, capitaine_id) values (1, 'xy-99f', 'XY', 'XY', '99f00000-0000-0000-0000-000000000005')$q$, 'NOM_EQUIPE_INVALIDE');
select essai('Eva crée « L''Équipe d''Éva 99f » (accents, apostrophes)',
  $q$insert into teams (game_id, slug, nom, tag, capitaine_id) values (1, 'equipe-eva-99f', 'L''Équipe d''Éva 99f', 'EE', '99f00000-0000-0000-0000-000000000005')$q$, 'passe');
select refus('Eva crée une quatrième équipe en 24 h',
  $q$insert into teams (game_id, slug, nom, tag, capitaine_id) values (1, 'quatrieme-99f', 'Quatrième 99f', 'QQ', '99f00000-0000-0000-0000-000000000005')$q$, 'LIMITE_ATTEINTE');
reset role;
-- Plafond de 5 équipes dont on est capitaine (compté même hors limite d'usage).
insert into teams (game_id, slug, nom, tag, capitaine_id)
select 1, 'capitaine-99f-' || n, 'Capitaine 99f ' || n, 'CP', '99f00000-0000-0000-0000-000000000004' from generate_series(1, 5) n;
select refus('Une sixième équipe pour le même capitaine',
  $q$insert into teams (game_id, slug, nom, tag, capitaine_id) values (1, 'capitaine-99f-6', 'Capitaine 99f 6', 'CP', '99f00000-0000-0000-0000-000000000004')$q$, 'TROP_D_EQUIPES');
