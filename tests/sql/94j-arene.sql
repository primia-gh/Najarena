-- Arène 1v1 à la demande (audit N19).
\set ON_ERROR_STOP 0

-- Ana (1500, RD 100), Ben (1550, RD 100), Cyd (1900, RD 60), Dan (sans
-- rating : 1500, RD 350), Eli (NA), Fay et Gus (EUW, sans rating).
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e0', 'ana950@test', '{"pseudo":"Ana950","slug":"ana950"}'),
  ('00000000-0000-0000-0000-0000000000e1', 'ben950@test', '{"pseudo":"Ben950","slug":"ben950"}'),
  ('00000000-0000-0000-0000-0000000000e2', 'cyd950@test', '{"pseudo":"Cyd950","slug":"cyd950"}'),
  ('00000000-0000-0000-0000-0000000000e3', 'dan950@test', '{"pseudo":"Dan950","slug":"dan950"}'),
  ('00000000-0000-0000-0000-0000000000e4', 'eli950@test', '{"pseudo":"Eli950","slug":"eli950"}'),
  ('00000000-0000-0000-0000-0000000000e5', 'fay950@test', '{"pseudo":"Fay950","slug":"fay950"}'),
  ('00000000-0000-0000-0000-0000000000e6', 'gus950@test', '{"pseudo":"Gus950","slug":"gus950"}');
insert into game_accounts (profile_id, game_id, puuid, riot_game_name, riot_tag_line, region, est_principal, verifie_le, methode_verification) values
  ('00000000-0000-0000-0000-0000000000e0', 1, 'P-ANA950', 'Ana', 'EUW', 'EUW', true, now(), 'icone_profil'),
  ('00000000-0000-0000-0000-0000000000e1', 1, 'P-BEN950', 'Ben', 'EUW', 'EUW', true, now(), 'icone_profil'),
  ('00000000-0000-0000-0000-0000000000e2', 1, 'P-CYD950', 'Cyd', 'EUW', 'EUW', true, now(), 'icone_profil'),
  ('00000000-0000-0000-0000-0000000000e3', 1, 'P-DAN950', 'Dan', 'EUW', 'EUW', true, now(), 'icone_profil'),
  ('00000000-0000-0000-0000-0000000000e4', 1, 'P-ELI950', 'Eli', 'NA1', 'NA',  true, now(), 'icone_profil'),
  ('00000000-0000-0000-0000-0000000000e5', 1, 'P-FAY950', 'Fay', 'EUW', 'EUW', true, now(), 'icone_profil'),
  ('00000000-0000-0000-0000-0000000000e6', 1, 'P-GUS950', 'Gus', 'EUW', 'EUW', true, now(), 'icone_profil');
insert into ratings (profile_id, game_id, season_id, rating, rd)
select p.id, 1, s.id, p.rating, p.rd
from (values
  ('00000000-0000-0000-0000-0000000000e0'::uuid, 1500::numeric, 100::numeric),
  ('00000000-0000-0000-0000-0000000000e1'::uuid, 1550::numeric, 100::numeric),
  ('00000000-0000-0000-0000-0000000000e2'::uuid, 1900::numeric, 60::numeric)
) as p(id, rating, rd)
cross join seasons s where s.est_courante;
-- Un administrateur arbitre les duels (déjà présent si 94-defis est passé).
insert into admins (profile_id) values ('00000000-0000-0000-0000-00000000000d') on conflict do nothing;

select verifie('Écart toléré : 100 + moitié du plus grand RD + 20 par minute, 500 au plus',
  public.ecart_arene(100, 60, 0) = 150 and public.ecart_arene(350, 60, 10) = 475 and public.ecart_arene(350, 350, 60) = 500);

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select essai('Un visiteur entre dans l''arène', $q$select public.rejoindre_arene()$q$, 'bloque');
reset role;

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000000e0');
select verifie('Ana entre dans l''arène : personne n''attend encore', (select public.rejoindre_arene() is null));
select refus('Ana entre une deuxième fois', $q$select public.rejoindre_arene()$q$, 'DEJA_EN_FILE');
select verifie('Ana voit sa place et le nombre de joueurs en attente dans sa région',
  (select en_file and entree_le is not null and en_attente_region = 1 from public.etat_arene()));
select essai('Ana écrit elle-même dans la file',
  $q$insert into file_arene (profile_id, region, rating, rd) values ('00000000-0000-0000-0000-0000000000e1', 'EUW', 1500, 350)$q$, 'bloque');
select refus('Ana lance elle-même l''appariement', $q$select * from public.apparier_arene()$q$, 'permission denied for function apparier_arene');
select refus('Ana choisit une condition de victoire inconnue', $q$select public.rejoindre_arene('premier_mort')$q$, 'CONDITION_INVALIDE');
reset role;
select verifie('Ana est toujours en file (la tentative refusée n''a rien changé)',
  exists (select 1 from file_arene where profile_id = '00000000-0000-0000-0000-0000000000e0'));

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000000e1');
select essai('Ben ne voit pas la place d''Ana', $q$select 1 from file_arene where profile_id = '00000000-0000-0000-0000-0000000000e0'$q$, 'bloque');
select verifie('Ben entre : 50 points d''écart, duel créé tout de suite', (select public.rejoindre_arene() like 'defi-%'));
reset role;

select verifie('Duel d''arène : nommé « Arène », en cours, classé, Ana (la plus ancienne en file) en premier',
  (select t.nom = 'Arène Ana950 contre Ben950' and t.nature = 'defi' and t.statut = 'en_cours'
          and t.compte_pour_classement and t.region = 'EUW' and t.condition_victoire = 'nexus'
          and (select count(*) from registrations r where r.tournament_id = t.id and r.statut = 'confirme') = 2
          and (select profile_id from match_participants mp join matches m on m.id = mp.match_id
               where m.tournament_id = t.id and mp.slot = 1) = '00000000-0000-0000-0000-0000000000e0'
     from defis d join tournaments t on t.id = d.tournament_id
     where d.lanceur_id = '00000000-0000-0000-0000-0000000000e0' and d.adversaire_id = '00000000-0000-0000-0000-0000000000e1'
       and d.statut = 'accepte'));
select verifie('Ana et Ben ont quitté la file',
  not exists (select 1 from file_arene where profile_id in ('00000000-0000-0000-0000-0000000000e0', '00000000-0000-0000-0000-0000000000e1')));

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000000e0');
select refus('Ana revient dans l''arène pendant son duel', $q$select public.rejoindre_arene()$q$, 'DUEL_EN_COURS');
select en_tant_que('00000000-0000-0000-0000-0000000000e2');
select verifie('Cyd (1900) entre dans l''arène', (select public.rejoindre_arene() is null));
select en_tant_que('00000000-0000-0000-0000-0000000000e3');
select verifie('Dan (sans rating : 1500, RD 350) entre : 400 points d''écart, trop loin pour l''instant',
  (select public.rejoindre_arene() is null));
reset role;
select verifie('Dan est en file avec la valeur de départ du classement',
  (select rating = 1500 and rd = 350 from file_arene where profile_id = '00000000-0000-0000-0000-0000000000e3'));

set role service_role;
select verifie('Serveur : passage immédiat, toujours trop loin', (select count(*) = 0 from public.apparier_arene()));
reset role;
-- Cyd attend depuis 10 minutes : l'écart toléré passe à 275 + 200 = 475.
update file_arene set entree_le = now() - interval '10 minutes' where profile_id = '00000000-0000-0000-0000-0000000000e2';
set role service_role;
select verifie('Serveur : après 10 minutes d''attente, Cyd et Dan sont appariés', (select count(*) = 1 from public.apparier_arene()));
reset role;
select verifie('Duel Cyd contre Dan créé, file vide',
  exists (select 1 from defis where lanceur_id = '00000000-0000-0000-0000-0000000000e2'
          and adversaire_id = '00000000-0000-0000-0000-0000000000e3' and statut = 'accepte')
  and not exists (select 1 from file_arene where region = 'EUW'));

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000000e4');
select verifie('Eli (NA) entre dans l''arène', (select public.rejoindre_arene() is null));
select en_tant_que('00000000-0000-0000-0000-0000000000e5');
select verifie('Fay (EUW) entre en partie classique : Eli joue sur une autre région', (select public.rejoindre_arene('classique') is null));
select verifie('Fay ne compte que les joueurs de sa région', (select en_attente_region = 1 from public.etat_arene()));
reset role;
update file_arene set entree_le = now() - interval '31 minutes' where profile_id = '00000000-0000-0000-0000-0000000000e5';
set role service_role;
select verifie('Serveur : rien à apparier entre régions', (select count(*) = 0 from public.apparier_arene()));
reset role;
select verifie('La place de Fay, vieille de 31 minutes, a expiré ; Eli attend toujours',
  not exists (select 1 from file_arene where profile_id = '00000000-0000-0000-0000-0000000000e5')
  and exists (select 1 from file_arene where profile_id = '00000000-0000-0000-0000-0000000000e4'));

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000000e4');
select verifie('Eli quitte l''arène', (select public.quitter_arene()));
select verifie('Eli quitte une deuxième fois : plus de place', (select not public.quitter_arene()));
reset role;

-- Ana, encore en duel, se retrouve en file (un défi accepté pendant
-- l'attente) : personne ne lui est apparié avant la fin de ce duel.
insert into file_arene (profile_id, region, rating, rd, entree_le)
values ('00000000-0000-0000-0000-0000000000e0', 'EUW', 1500, 100, now() - interval '1 minute');
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000000e6');
select verifie('Gus entre : Ana, déjà en duel, ne lui est pas proposée', (select public.rejoindre_arene() is null));
reset role;
set role service_role;
select verifie('Serveur : Ana reste en attente tant que son duel n''est pas fini', (select count(*) = 0 from public.apparier_arene()));
reset role;
select verifie('Ana et Gus sont toujours en file',
  (select count(*) = 2 from file_arene where profile_id in ('00000000-0000-0000-0000-0000000000e0', '00000000-0000-0000-0000-0000000000e6')));
delete from file_arene;
