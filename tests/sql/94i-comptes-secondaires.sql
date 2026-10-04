-- Comptes Riot secondaires déclarés (audit N15).
\set ON_ERROR_STOP 0

-- Rita : compte principal vérifié P-RITA, inscrite à un tournoi ouvert.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000d0', 'rita949@test', '{"pseudo":"Rita949","slug":"rita949"}');
insert into game_accounts (profile_id, game_id, puuid, riot_game_name, riot_tag_line, region, est_principal, verifie_le, methode_verification)
values ('00000000-0000-0000-0000-0000000000d0', 1, 'P-RITA', 'Rita', 'EUW', 'EUW', true, now(), 'icone_profil');
insert into registrations (tournament_id, profile_id, statut)
values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d0', 'inscrit');

set role service_role;
select refus('Serveur : Rita lie un nouveau compte principal pendant un tournoi',
  $q$select public.lier_compte_riot('00000000-0000-0000-0000-0000000000d0'::uuid, 1::smallint, 'P-RITA-2', 'RitaSmurf', 'EUW', 'EUW', 4::smallint, true)$q$, 'INSCRIT_A_UN_TOURNOI');
select essai('Serveur : Rita déclare un compte secondaire',
  $q$select public.lier_compte_riot('00000000-0000-0000-0000-0000000000d0'::uuid, 1::smallint, 'P-RITA-2', 'RitaSmurf', 'EUW', 'EUW', 4::smallint, false)$q$, 'passe');
select essai('Serveur : Rita déclare un troisième compte',
  $q$select public.lier_compte_riot('00000000-0000-0000-0000-0000000000d0'::uuid, 1::smallint, 'P-RITA-3', 'RitaTrois', 'EUW', 'EUW', 4::smallint, false)$q$, 'passe');
select refus('Serveur : Rita déclare un quatrième compte',
  $q$select public.lier_compte_riot('00000000-0000-0000-0000-0000000000d0'::uuid, 1::smallint, 'P-RITA-4', 'RitaQuatre', 'EUW', 'EUW', 4::smallint, false)$q$, 'TROP_DE_COMPTES');
reset role;
select verifie('Le compte principal de Rita n''a pas changé',
  (select puuid = 'P-RITA' from game_accounts where profile_id = '00000000-0000-0000-0000-0000000000d0' and est_principal));

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select essai('Un visiteur ne voit pas le compte secondaire pas encore vérifié',
  $q$select 1 from game_accounts where puuid = 'P-RITA-2'$q$, 'bloque');
reset role;

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000000d0');
select refus('Rita passe sur son compte secondaire non vérifié',
  $q$select public.definir_compte_principal(1::smallint, 'P-RITA-2')$q$, 'COMPTE_NON_VERIFIE');
reset role;
update game_accounts set verifie_le = now(), defi_icone_id = null where puuid = 'P-RITA-2';

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select essai('Un visiteur voit le compte secondaire vérifié', $q$select 1 from game_accounts where puuid = 'P-RITA-2'$q$, 'passe');
reset role;

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000000d0');
select refus('Rita change de compte principal pendant son tournoi',
  $q$select public.definir_compte_principal(1::smallint, 'P-RITA-2')$q$, 'INSCRIT_A_UN_TOURNOI');
select essai('Rita se désinscrit', $q$select 1 where public.se_desinscrire('10000000-0000-0000-0000-000000000001')$q$, 'passe');
select essai('Rita passe sur son compte secondaire vérifié',
  $q$select 1 where public.definir_compte_principal(1::smallint, 'P-RITA-2')$q$, 'passe');
select essai('Rita retire son ancien compte, devenu secondaire',
  $q$select 1 where public.delier_compte_secondaire(1::smallint, 'P-RITA')$q$, 'passe');
select essai('Rita ne peut pas retirer son compte principal par cette voie',
  $q$select 1 where public.delier_compte_secondaire(1::smallint, 'P-RITA-2')$q$, 'bloque');
reset role;
select verifie('Rita : P-RITA-2 principal, P-RITA retiré, P-RITA-3 secondaire',
  (select count(*) = 2 from game_accounts where profile_id = '00000000-0000-0000-0000-0000000000d0')
  and (select puuid = 'P-RITA-2' from game_accounts where profile_id = '00000000-0000-0000-0000-0000000000d0' and est_principal));
