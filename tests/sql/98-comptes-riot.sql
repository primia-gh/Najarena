-- Comptes Riot : délier, Riot ID non vérifiés privés (audit M9).
\set ON_ERROR_STOP 0

-- Kim : un compte Riot vérifié, aucune inscription.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000022', 'kim@test', '{"pseudo":"Kim","slug":"kim"}');
insert into game_accounts (profile_id, game_id, puuid, riot_game_name, riot_tag_line, region, est_principal, verifie_le, methode_verification)
values ('00000000-0000-0000-0000-000000000022', 1, 'P-KIM', 'Kim', 'EUW', 'EUW', true, now(), 'icone_profil');

set role anon;
select en_tant_que(null);
select essai('Visiteur : lit le Riot ID vérifié de Gina',
  $q$select 1 from game_accounts where profile_id = '00000000-0000-0000-0000-000000000010'$q$, 'passe');
select essai('Visiteur : lit le Riot ID non vérifié de Frank',
  $q$select 1 from game_accounts where profile_id = '00000000-0000-0000-0000-00000000000f'$q$, 'bloque');
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-00000000000f');
select essai('Frank lit son propre Riot ID non vérifié',
  $q$select 1 from game_accounts where profile_id = '00000000-0000-0000-0000-00000000000f'$q$, 'passe');
select en_tant_que('00000000-0000-0000-0000-00000000000e');
select refus('Eve (inscrite à un tournoi ouvert) délie son compte Riot',
  $q$select public.delier_compte_riot(1::smallint)$q$, 'INSCRIT_A_UN_TOURNOI');
select en_tant_que('00000000-0000-0000-0000-000000000022');
select essai('Kim (inscrite nulle part) délie son compte Riot',
  $q$select 1 where public.delier_compte_riot(1::smallint)$q$, 'passe');
reset role;
select verifie('Kim : plus aucun compte Riot lié',
  not exists (select 1 from game_accounts where profile_id = '00000000-0000-0000-0000-000000000022'));
