-- Défis entre joueurs et « Invite ton rival » (audit N16, N18).
\set ON_ERROR_STOP 0

-- Rex, Sam (EUW, vérifiés), Tia (NA), Uma (sans compte Riot), Vic (EUW, suspendu).
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000060', 'rex@test', '{"pseudo":"Rex","slug":"rex"}'),
  ('00000000-0000-0000-0000-000000000061', 'sam@test', '{"pseudo":"Sam","slug":"sam"}'),
  ('00000000-0000-0000-0000-000000000062', 'tia@test', '{"pseudo":"Tia","slug":"tia"}'),
  ('00000000-0000-0000-0000-000000000063', 'uma@test', '{"pseudo":"Uma","slug":"uma"}'),
  ('00000000-0000-0000-0000-000000000064', 'vic@test', '{"pseudo":"Vic","slug":"vic"}');
insert into game_accounts (profile_id, game_id, puuid, riot_game_name, riot_tag_line, region, est_principal, verifie_le, methode_verification) values
  ('00000000-0000-0000-0000-000000000060', 1, 'P-REX', 'Rex', 'EUW', 'EUW', true, now(), 'icone_profil'),
  ('00000000-0000-0000-0000-000000000061', 1, 'P-SAM', 'Sam', 'EUW', 'EUW', true, now(), 'icone_profil'),
  ('00000000-0000-0000-0000-000000000062', 1, 'P-TIA', 'Tia', 'NA1', 'NA',  true, now(), 'icone_profil'),
  ('00000000-0000-0000-0000-000000000064', 1, 'P-VIC', 'Vic', 'EUW', 'EUW', true, now(), 'icone_profil');
insert into suspensions (profile_id, motif) values ('00000000-0000-0000-0000-000000000064', 'Essai défis');

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000060');
select essai('Rex défie Sam', $q$select public.lancer_defi('00000000-0000-0000-0000-000000000061')$q$, 'passe');
select refus('Rex défie Sam une deuxième fois', $q$select public.lancer_defi('00000000-0000-0000-0000-000000000061')$q$, 'DEFI_DEJA_PROPOSE');
select refus('Rex se défie lui-même', $q$select public.lancer_defi('00000000-0000-0000-0000-000000000060')$q$, 'DEFI_SOI_MEME');
select refus('Rex défie Tia, qui joue sur NA', $q$select public.lancer_defi('00000000-0000-0000-0000-000000000062')$q$, 'REGION_DIFFERENTE');
select refus('Rex défie Uma, sans compte Riot vérifié', $q$select public.lancer_defi('00000000-0000-0000-0000-000000000063')$q$, 'ADVERSAIRE_SANS_COMPTE_RIOT');
select refus('Rex choisit une condition de victoire inconnue', $q$select public.lancer_defi('00000000-0000-0000-0000-000000000061', 'premier_mort')$q$, 'CONDITION_INVALIDE');
select essai('Rex écrit lui-même un défi accepté',
  $q$insert into defis (lanceur_id, adversaire_id, statut, expire_le) values ('00000000-0000-0000-0000-000000000060', '00000000-0000-0000-0000-000000000061', 'accepte', now() + interval '1 day')$q$, 'bloque');
select refus('Rex crée lui-même un tournoi « défi »',
  $q$insert into tournaments (game_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, nature) values (1, '00000000-0000-0000-0000-000000000060', 'faux-defi', 'Faux défi', '1v1', 2, 'EUW', now() + interval '2 days', now() + interval '2 days', 'ouvert', 'defi')$q$, 'CHAMP_RESERVE');
select en_tant_que('00000000-0000-0000-0000-000000000061');
select refus('Sam défie Rex en retour pendant que le défi de Rex attend', $q$select public.lancer_defi('00000000-0000-0000-0000-000000000060')$q$, 'DEFI_DEJA_PROPOSE');
select essai('Sam voit le défi de Rex', $q$select 1 from defis where lanceur_id = '00000000-0000-0000-0000-000000000060'$q$, 'passe');
select en_tant_que('00000000-0000-0000-0000-000000000063');
select refus('Uma, sans compte Riot, défie Rex', $q$select public.lancer_defi('00000000-0000-0000-0000-000000000060')$q$, 'COMPTE_RIOT_REQUIS');
select en_tant_que('00000000-0000-0000-0000-000000000064');
select refus('Vic, suspendu, défie Rex', $q$select public.lancer_defi('00000000-0000-0000-0000-000000000060')$q$, 'COMPTE_SUSPENDU');
select en_tant_que('00000000-0000-0000-0000-000000000062');
select essai('Tia ne voit pas les défis des autres', $q$select 1 from defis$q$, 'bloque');
reset role;

select id as defi_rex from defis where lanceur_id = '00000000-0000-0000-0000-000000000060' and adversaire_id = '00000000-0000-0000-0000-000000000061' \gset

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000062');
select refus('Tia accepte un défi qui ne lui est pas adressé',
  format($q$select public.repondre_defi(%L, true)$q$, :'defi_rex'), 'NON_DESTINATAIRE');
select en_tant_que('00000000-0000-0000-0000-000000000061');
select refus('Sam accepte alors que personne ne peut arbitrer',
  format($q$select public.repondre_defi(%L, true)$q$, :'defi_rex'), 'AUCUN_ARBITRE');
reset role;

-- Un administrateur arbitre les défis.
insert into admins (profile_id) values ('00000000-0000-0000-0000-00000000000d');

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000061');
select essai('Sam accepte le défi de Rex', format($q$select public.repondre_defi(%L, true)$q$, :'defi_rex'), 'passe');
select refus('Sam accepte une deuxième fois', format($q$select public.repondre_defi(%L, true)$q$, :'defi_rex'), 'DEFI_DEJA_TRAITE');
reset role;

select verifie('Duel créé : défi à deux, en cours, classé, arbitré par un administrateur, match ouvert',
  (select t.nature = 'defi' and t.capacite = 2 and t.statut = 'en_cours' and t.compte_pour_classement
          and t.organisateur_id = '00000000-0000-0000-0000-00000000000d' and t.region = 'EUW'
          and (select count(*) from registrations r where r.tournament_id = t.id and r.statut = 'confirme') = 2
          and (select count(*) from matches m join match_participants mp on mp.match_id = m.id
               where m.tournament_id = t.id and m.statut = 'en_cours' and m.demarre_le is not null) = 2
     from defis d join tournaments t on t.id = d.tournament_id
     where d.id = :'defi_rex' and d.statut = 'accepte'));
select tournament_id as duel_1 from defis where id = :'defi_rex' \gset
set role anon;
select verifie('Visiteur : un défi est classé d''office (sauf en amical)',
  (select classe and defi from public.criteres_tournoi_classe(:'duel_1')));
reset role;

-- Deuxième défi entre les deux mêmes joueurs le même jour : amical.
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000060');
select essai('Rex relance Sam le même jour', $q$select public.lancer_defi('00000000-0000-0000-0000-000000000061')$q$, 'passe');
reset role;
select id as defi_rex_2 from defis where lanceur_id = '00000000-0000-0000-0000-000000000060' and statut = 'propose' \gset
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000061');
select essai('Sam accepte le deuxième défi', format($q$select public.repondre_defi(%L, true)$q$, :'defi_rex_2'), 'passe');
reset role;
select verifie('Deuxième défi de la paire en 24 h : joué en amical (pas de points)',
  (select not t.compte_pour_classement from defis d join tournaments t on t.id = d.tournament_id where d.id = :'defi_rex_2'));

-- Refus et annulation.
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000061');
select essai('Sam défie Rex', $q$select public.lancer_defi('00000000-0000-0000-0000-000000000060')$q$, 'passe');
reset role;
select id as defi_sam from defis where lanceur_id = '00000000-0000-0000-0000-000000000061' and statut = 'propose' \gset
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000060');
select essai('Rex refuse', format($q$select 1 where public.repondre_defi(%L, false) is null$q$, :'defi_sam'), 'passe');
select essai('Rex crée un lien « Invite ton rival »', $q$select public.creer_invitation_defi('classique')$q$, 'passe');
reset role;
select verifie('Défi de Sam refusé', (select statut = 'refuse' from defis where id = :'defi_sam'));
select code_invitation as code_rex from defis where lanceur_id = '00000000-0000-0000-0000-000000000060' and code_invitation is not null \gset

select set_config('request.jwt.claim.sub', '', false);
set role anon;
select essai('Visiteur : lit l''invitation de Rex (pseudo, région, règle)',
  format($q$select 1 from public.lire_invitation_defi(%L) where lanceur_pseudo = 'Rex' and region = 'EUW' and condition_victoire = 'classique'$q$, :'code_rex'), 'passe');
select essai('Visiteur : accepte sans compte', format($q$select public.accepter_invitation_defi(%L)$q$, :'code_rex'), 'bloque');
reset role;

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000063');
select refus('Uma accepte le lien avant d''avoir vérifié son compte Riot',
  format($q$select public.accepter_invitation_defi(%L)$q$, :'code_rex'), 'COMPTE_RIOT_REQUIS');
select en_tant_que('00000000-0000-0000-0000-000000000060');
select refus('Rex accepte son propre lien', format($q$select public.accepter_invitation_defi(%L)$q$, :'code_rex'), 'DEFI_SOI_MEME');
select en_tant_que('00000000-0000-0000-0000-000000000061');
select essai('Sam accepte le lien de Rex (troisième défi en cours)', format($q$select public.accepter_invitation_defi(%L)$q$, :'code_rex'), 'passe');
reset role;
select verifie('Invitation acceptée : Sam devient l''adversaire, duel au 1v1 classique',
  (select d.adversaire_id = '00000000-0000-0000-0000-000000000061' and t.condition_victoire = 'classique'
     from defis d join tournaments t on t.id = d.tournament_id where d.code_invitation = :'code_rex'));

-- Plafonds : trois défis en cours, cinq propositions ouvertes.
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000060');
select essai('Rex lance un quatrième défi à Sam', $q$select public.lancer_defi('00000000-0000-0000-0000-000000000061')$q$, 'passe');
reset role;
select id as defi_rex_4 from defis where lanceur_id = '00000000-0000-0000-0000-000000000060' and adversaire_id is not null and statut = 'propose' \gset
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000061');
select refus('Sam accepte un quatrième défi en cours', format($q$select public.repondre_defi(%L, true)$q$, :'defi_rex_4'), 'TROP_DE_DEFIS_EN_COURS');
select en_tant_que('00000000-0000-0000-0000-000000000060');
select essai('Rex ouvre quatre liens de plus (cinq propositions ouvertes)',
  $q$select public.creer_invitation_defi() from generate_series(1, 4)$q$, 'passe');
select refus('Rex ouvre une sixième proposition', $q$select public.creer_invitation_defi()$q$, 'LIMITE_DEFIS');
select essai('Rex retire son défi en attente', format($q$select 1 where public.annuler_defi(%L)$q$, :'defi_rex_4'), 'passe');
reset role;

update defis set expire_le = now() - interval '1 minute' where code_invitation is not null and statut = 'propose';
select code_invitation as code_expire from defis where code_invitation is not null and statut = 'propose' limit 1 \gset
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000062');
select refus('Tia accepte un lien expiré', format($q$select public.accepter_invitation_defi(%L)$q$, :'code_expire'), 'DEFI_EXPIRE');
reset role;

-- Clôture : le duel classé écrit des points, le duel amical non.
update matches set statut = 'termine' where tournament_id in (select tournament_id from defis where id in (:'defi_rex', :'defi_rex_2'));
set role service_role;
select essai('Serveur : le premier duel est déclaré classé à sa clôture',
  format($q$select 1 where public.figer_classement_tournoi(%L)$q$, :'duel_1'), 'passe');
select essai('Serveur : le duel amical ne l''est pas',
  format($q$select 1 where not public.figer_classement_tournoi((select tournament_id from defis where id = %L))$q$, :'defi_rex_2'), 'passe');
reset role;

delete from admins where profile_id = '00000000-0000-0000-0000-00000000000d';
