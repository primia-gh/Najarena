-- Bourse aux remplaçants (idée en réserve n°15) : un joueur vérifié
-- disponible remplace un aligné absent, jusqu'au lancement du bracket.
\set ON_ERROR_STOP 0

-- Équipe R : Rex (capitaine), Ria, Rod, Roy, Rue. Disponibles : Sol, Sky,
-- Sun (EUW) ; Nia (compte NA) ; Ugo (sans compte Riot).
insert into auth.users (id, email, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000003d' || n)::uuid, 'r94za' || n || '@test',
       json_build_object('pseudo', 'R94za' || n, 'slug', 'r94za' || n)::jsonb
from generate_series(0, 9) n;
-- 0 Rex, 1 Ria, 2 Rod, 3 Roy, 4 Rue, 5 Sol, 6 Sky, 7 Sun, 8 Nia (NA), 9 Ugo (aucun compte).
insert into game_accounts (profile_id, game_id, puuid, riot_game_name, riot_tag_line, region, est_principal, verifie_le, methode_verification)
select ('00000000-0000-0000-0000-0000000003d' || n)::uuid, 1, 'P-94za-' || n, 'R' || n, 'EUW',
       case when n = 8 then 'NA' else 'EUW' end, true, now(), 'icone_profil'
from generate_series(0, 8) n;
insert into teams (id, game_id, slug, nom, tag, capitaine_id) values
  ('a8000000-0000-0000-0000-00000000000a', 1, 'equipe-r-94za', 'Equipe R', 'RRR', '00000000-0000-0000-0000-0000000003d0');
insert into team_members (team_id, profile_id, accepte_le)
select 'a8000000-0000-0000-0000-00000000000a', ('00000000-0000-0000-0000-0000000003d' || n)::uuid, now()
from generate_series(0, 4) n;
insert into tournaments (id, game_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, compte_pour_classement) values
  ('a8000000-0000-0000-0000-000000000001', 1, '00000000-0000-0000-0000-00000000000a', 'bourse-94za', 'Bourse 94za', '5v5', 4, 'EUW', now() + interval '1 day', now() + interval '20 hours', 'ouvert', false);

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000003d0');
select essai('Rex inscrit son équipe de cinq',
  $q$select public.s_inscrire_equipe('a8000000-0000-0000-0000-000000000001', 'a8000000-0000-0000-0000-00000000000a', array['00000000-0000-0000-0000-0000000003d0','00000000-0000-0000-0000-0000000003d1','00000000-0000-0000-0000-0000000003d2','00000000-0000-0000-0000-0000000003d3','00000000-0000-0000-0000-0000000003d4']::uuid[])$q$, 'passe');
select refus('Rex, aligné, se propose comme remplaçant',
  $q$select public.proposer_remplacement('a8000000-0000-0000-0000-000000000001')$q$, 'DEJA_DANS_UNE_EQUIPE');

select en_tant_que('00000000-0000-0000-0000-0000000003d5');
select essai('Sol se propose comme remplaçant (jungle)',
  $q$select public.proposer_remplacement('a8000000-0000-0000-0000-000000000001', 'jungle')$q$, 'passe');
select en_tant_que('00000000-0000-0000-0000-0000000003d6');
select essai('Sky se propose', $q$select public.proposer_remplacement('a8000000-0000-0000-0000-000000000001')$q$, 'passe');
select en_tant_que('00000000-0000-0000-0000-0000000003d7');
select essai('Sun se propose', $q$select public.proposer_remplacement('a8000000-0000-0000-0000-000000000001')$q$, 'passe');
select en_tant_que('00000000-0000-0000-0000-0000000003d8');
select refus('Nia (compte NA) se propose pour un tournoi EUW',
  $q$select public.proposer_remplacement('a8000000-0000-0000-0000-000000000001')$q$, 'REGION_DIFFERENTE');
select en_tant_que('00000000-0000-0000-0000-0000000003d9');
select refus('Ugo, sans compte Riot, se propose',
  $q$select public.proposer_remplacement('a8000000-0000-0000-0000-000000000001')$q$, 'COMPTE_RIOT_REQUIS');
select essai('Ugo s''ajoute directement à la bourse',
  $q$insert into remplacants_disponibles (tournament_id, profile_id) values ('a8000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000003d9')$q$, 'bloque');

select en_tant_que('00000000-0000-0000-0000-0000000003d1');
select refus('Ria (pas capitaine) remplace Rod par Sol',
  $q$select public.remplacer_aligne('a8000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000003d2', '00000000-0000-0000-0000-0000000003d5')$q$, 'EQUIPE_NON_INSCRITE');

select en_tant_que('00000000-0000-0000-0000-0000000003d0');
select refus('Rex se remplace lui-même',
  $q$select public.remplacer_aligne('a8000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000003d0', '00000000-0000-0000-0000-0000000003d5')$q$, 'REMPLACER_CAPITAINE');
select refus('Rex prend Ugo, qui n''est pas dans la bourse',
  $q$select public.remplacer_aligne('a8000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000003d2', '00000000-0000-0000-0000-0000000003d9')$q$, 'REMPLACANT_INDISPONIBLE');
select essai('Rex remplace Rod par Sol',
  $q$select public.remplacer_aligne('a8000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000003d2', '00000000-0000-0000-0000-0000000003d5')$q$, 'passe');
select verifie('Sol est aligné à la place de Rod, et a quitté la bourse',
  (select remplace_profile_id = '00000000-0000-0000-0000-0000000003d2' from alignements
    where tournament_id = 'a8000000-0000-0000-0000-000000000001' and profile_id = '00000000-0000-0000-0000-0000000003d5')
  and not exists (select 1 from alignements where tournament_id = 'a8000000-0000-0000-0000-000000000001' and profile_id = '00000000-0000-0000-0000-0000000003d2')
  and not exists (select 1 from remplacants_disponibles where profile_id = '00000000-0000-0000-0000-0000000003d5'));
select essai('Rex remplace Roy par Sky (deuxième remplaçant)',
  $q$select public.remplacer_aligne('a8000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000003d3', '00000000-0000-0000-0000-0000000003d6')$q$, 'passe');
select refus('Rex remplace Rue par Sun : déjà deux remplaçants',
  $q$select public.remplacer_aligne('a8000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000003d4', '00000000-0000-0000-0000-0000000003d7')$q$, 'LIMITE_REMPLACANTS');
select essai('Rex remplace Sky (remplaçant) par Sun : la limite ne bouge pas',
  $q$select public.remplacer_aligne('a8000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000003d6', '00000000-0000-0000-0000-0000000003d7')$q$, 'passe');
select verifie('Sun garde la place d''origine de Roy ; toujours cinq alignés',
  (select remplace_profile_id = '00000000-0000-0000-0000-0000000003d3' from alignements
    where tournament_id = 'a8000000-0000-0000-0000-000000000001' and profile_id = '00000000-0000-0000-0000-0000000003d7')
  and (select count(*) = 5 from alignements where tournament_id = 'a8000000-0000-0000-0000-000000000001'));
reset role;

-- Bracket lancé : alignement figé, bourse vidée.
update tournaments set statut = 'en_cours' where id = 'a8000000-0000-0000-0000-000000000001';
select verifie('Bracket lancé : la bourse du tournoi est vide',
  not exists (select 1 from remplacants_disponibles where tournament_id = 'a8000000-0000-0000-0000-000000000001'));
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000003d0');
select refus('Rex remplace un joueur une fois le bracket lancé',
  $q$select public.remplacer_aligne('a8000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000003d4', '00000000-0000-0000-0000-0000000003d6')$q$, 'ALIGNEMENT_FIGE');
reset role;
