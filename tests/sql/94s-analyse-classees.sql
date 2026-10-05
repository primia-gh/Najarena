-- Bilan du joueur, étape 2 : parties classées analysées sur accord, repères
-- anonymes, bilan de la semaine (05/10/2026).
\set ON_ERROR_STOP 0

-- Quin (compte Riot vérifié) ; Rex (compte lié mais pas vérifié) ; Tia ;
-- dix autres joueurs or au poste milieu, dont quatre aussi diamant.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000001a0', 'quin958@test', '{"pseudo":"Quin958","slug":"quin958"}'),
  ('00000000-0000-0000-0000-0000000001a1', 'rex958@test', '{"pseudo":"Rex958","slug":"rex958"}'),
  ('00000000-0000-0000-0000-0000000001a2', 'tia958@test', '{"pseudo":"Tia958","slug":"tia958"}');
insert into auth.users (id, email, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000001b' || n)::uuid, 'cla958' || n || '@test',
       format('{"pseudo":"Cla958%s","slug":"cla958%s"}', n, n)::jsonb
from generate_series(0, 9) n;
insert into game_accounts (profile_id, game_id, puuid, riot_game_name, riot_tag_line, region, est_principal, verifie_le, methode_verification) values
  ('00000000-0000-0000-0000-0000000001a0', 1, 'P-QUIN958', 'Quin', 'EUW', 'EUW', true, now(), 'icone_profil'),
  ('00000000-0000-0000-0000-0000000001a1', 1, 'P-REX958', 'Rex', 'EUW', 'EUW', true, null, 'icone_profil'),
  ('00000000-0000-0000-0000-0000000001a2', 1, 'P-TIA958', 'Tia', 'EUW', 'EUW', true, now(), 'icone_profil');
insert into game_accounts (profile_id, game_id, puuid, riot_game_name, riot_tag_line, region, est_principal, verifie_le, methode_verification)
select ('00000000-0000-0000-0000-0000000001b' || n)::uuid, 1, 'P-CLA958-' || n, 'Cla' || n, 'EUW', 'EUW', true, now(), 'icone_profil'
from generate_series(0, 9) n;

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000001a1');
select refus('Sans compte Riot vérifié, pas d''analyse des parties classées',
  $q$select public.regler_analyse(true, false)$q$, 'COMPTE_RIOT_NON_VERIFIE');
select en_tant_que('00000000-0000-0000-0000-0000000001a0');
select refus('Bilan de la semaine sans l''offre Elite', $q$select public.regler_analyse(true, true)$q$, 'OFFRE_ELITE_REQUISE');
reset role;
insert into comptes_offres (profile_id, offre) values ('00000000-0000-0000-0000-0000000001a0', 'elite');
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000001a0');
select refus('Bilan de la semaine sans Discord lié', $q$select public.regler_analyse(true, true)$q$, 'DISCORD_NON_LIE');
reset role;
update profiles set discord_id = '958000' where id = '00000000-0000-0000-0000-0000000001a0';
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000001a0');
select essai('Quin active ses parties classées et son bilan de la semaine', $q$select public.regler_analyse(true, true)$q$, 'passe');
select verifie('Réglages de Quin enregistrés',
  (select classees and bilan_hebdo and classees_depuis is not null from analyse_reglages where profile_id = '00000000-0000-0000-0000-0000000001a0'));
select essai('Quin modifie lui-même son rang', $q$update analyse_reglages set palier = 'CHALLENGER' where profile_id = '00000000-0000-0000-0000-0000000001a0'$q$, 'bloque');
reset role;

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select essai('Visiteur : régler une analyse', $q$select public.regler_analyse(true, false)$q$, 'bloque');
reset role;

-- Le serveur ne lit jamais les parties classées d'un joueur sans son accord.
select refus('Partie classée enregistrée sans accord',
  $q$insert into parties_classees (profile_id, riot_match_id, puuid, region) values ('00000000-0000-0000-0000-0000000001a1', 'EUW1_1', 'P-REX958', 'EUW')$q$,
  'ANALYSE_NON_ACTIVEE');
select refus('Partie lue sans sa fiche',
  $q$insert into parties_classees (profile_id, riot_match_id, puuid, region, etat) values ('00000000-0000-0000-0000-0000000001a0', 'EUW1_2', 'P-QUIN958', 'EUW', 'complete')$q$,
  'new row for relation "parties_classees" violates check constraint "parties_classees_fiche_lue"');

-- Les dix autres joueurs ont donné leur accord ; six parties or au milieu
-- chacun (sbires par minute : 5,0 pour le premier, puis +0,3 par joueur),
-- quatre d'entre eux ont aussi deux parties diamant sur Zed.
insert into analyse_reglages (profile_id, classees, classees_depuis)
select ('00000000-0000-0000-0000-0000000001b' || n)::uuid, true, now() from generate_series(0, 9) n;
insert into analyse_reglages (profile_id, classees, classees_depuis) values ('00000000-0000-0000-0000-0000000001a2', true, now());
insert into parties_classees (profile_id, riot_match_id, puuid, region, etat, file, joue_le, duree_secondes, patch, palier, gagne, equipe,
                              champion, champion_id, poste, kills, deaths, assists, cs, or_gagne, degats_champions, score_vision,
                              part_kills, part_degats, sbires_10, premier_sang, objets, rune_principale, sorts, ecart_or_15, morts_avant_10,
                              morts_secondes, morts_x, morts_y)
select ('00000000-0000-0000-0000-0000000001b' || n)::uuid, 'EUW1_' || (1000 + n * 10 + g), 'P-CLA958-' || n, 'EUW', 'complete', 420,
       now() - (g || ' days')::interval, 1800, '15.19', 'GOLD', g % 2 = 0, 100, 'Ahri', 103, 'MIDDLE', 4, 3, 6,
       round((5 + 0.3 * n) * 30)::integer, 12000, 24000, 30, 0.5, 0.25, 70, false, array[6655, 3020], 8112, array[4, 14], 300, 1,
       array[480], array[7000], array[7200]
from generate_series(0, 9) n cross join generate_series(1, 6) g;
insert into parties_classees (profile_id, riot_match_id, puuid, region, etat, file, joue_le, duree_secondes, palier, gagne, champion, poste,
                              kills, deaths, assists, cs, or_gagne)
select ('00000000-0000-0000-0000-0000000001b' || n)::uuid, 'EUW1_' || (2000 + n * 10 + g), 'P-CLA958-' || n, 'EUW', 'complete', 420,
       now() - (g || ' hours')::interval, 1800, 'DIAMOND', true, 'Zed', 'MIDDLE', 5, 2, 5, 240, 13000
from generate_series(0, 3) n cross join generate_series(1, 2) g;
-- Quin : six parties or au milieu, 6,5 sbires par minute.
insert into parties_classees (profile_id, riot_match_id, puuid, region, etat, file, joue_le, duree_secondes, patch, palier, gagne, equipe,
                              champion, champion_id, poste, kills, deaths, assists, cs, or_gagne, degats_champions, score_vision,
                              sbires_10, objets, rune_principale, sorts, ecart_or_15, morts_avant_10, morts_secondes, morts_x, morts_y)
select '00000000-0000-0000-0000-0000000001a0', 'EUW1_' || (3000 + g), 'P-QUIN958', 'EUW', case when g = 6 then 'lue' else 'complete' end, 420,
       now() - (g || ' days')::interval, 1800, '15.19', 'GOLD', g <= 4, 200, 'Ahri', 103, 'MIDDLE', 6, 2, 4,
       195, 12600, 27000, 33, 72, array[6655], 8112, array[4, 14], 450, 2,
       array[300, 900], array[5000, 9000], array[6000, 9500]
from generate_series(1, 6) g;
-- Tia : une partie de 15 minutes (écart d'or à 15 minutes non retenu).
insert into parties_classees (profile_id, riot_match_id, puuid, region, etat, file, joue_le, duree_secondes, palier, gagne, champion, poste,
                              kills, deaths, assists, cs, or_gagne, degats_champions, score_vision, ecart_or_15, morts_avant_10)
values ('00000000-0000-0000-0000-0000000001a2', 'EUW1_4000', 'P-TIA958', 'EUW', 'complete', 440, now(), 900, 'SILVER', false, 'Lux', 'UTILITY',
        0, 3, 9, 30, 6000, 9000, 45, -800, 3);

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000001a0');
select verifie('Quin ne lit que ses six parties classées', (select count(*) = 6 from parties_classees));
select verifie('Indicateurs de Quin : KDA 5, 6,5 sbires par minute, écart d''or à 15 minutes, morts avant 10 minutes',
  (select count(*) = 6 and bool_and(kda = 5.00 and sbires_min = 6.50 and ecart_or_15 = 450 and morts_avant_10 = 2 and vision_min = 1.10)
   from indicateurs_classees));
select essai('Quin ajoute lui-même une partie classée',
  $q$insert into parties_classees (profile_id, riot_match_id, puuid, region) values ('00000000-0000-0000-0000-0000000001a0', 'EUW1_9', 'P-QUIN958', 'EUW')$q$, 'bloque');
select essai('Quin retouche une de ses parties', $q$update parties_classees set gagne = true where profile_id = '00000000-0000-0000-0000-0000000001a0'$q$, 'bloque');
select essai('Quin lit les parties classées d''un autre joueur',
  $q$select 1 from parties_classees where profile_id = '00000000-0000-0000-0000-0000000001b0'$q$, 'bloque');
select verifie('Repères or au milieu : les dix autres joueurs, sans Quin',
  (select joueurs = 10 and parties = 60 and moyenne_gagnants = 6.350 from public.reperes_classees('GOLD', 'MIDDLE') where indicateur = 'sbires_min'));
select verifie('Repères diamant : moins de 5 joueurs, rien n''est montré',
  (select count(*) = 0 from public.reperes_classees('DIAMOND', 'MIDDLE')));
select verifie('Position de Quin parmi les joueurs or au milieu : 5 en dessous, 1 à égalité, sur 10',
  (select joueurs = 10 and en_dessous = 5 and egaux = 1 from public.percentiles_classees('GOLD', 'MIDDLE') where indicateur = 'sbires_min'));
select verifie('Build de référence d''Ahri en classée : 60 parties d''autres joueurs, objets comptés',
  (select bool_or(genre = 'total' and parties = 60 and victoires = 30) and bool_or(genre = 'objet' and valeur = '3020' and parties = 60)
   from public.reperes_build_classees('Ahri')));
select verifie('Build de Zed : 4 joueurs seulement, la seule ligne « total »',
  (select count(*) = 1 and bool_and(genre = 'total') from public.reperes_build_classees('Zed')));
select en_tant_que('00000000-0000-0000-0000-0000000001a1');
select verifie('Rex, sans partie classée, n''a pas de position', (select count(*) = 0 from public.percentiles_classees('GOLD', 'MIDDLE')));
select en_tant_que('00000000-0000-0000-0000-0000000001a2');
select verifie('Partie de 15 minutes : pas d''écart d''or à 15 minutes',
  (select ecart_or_15 is null and morts_avant_10 = 3 from indicateurs_classees where riot_match_id = 'EUW1_4000'));
reset role;

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select essai('Visiteur : lire des parties classées', $q$select 1 from parties_classees$q$, 'bloque');
select essai('Visiteur : lire des indicateurs de classées', $q$select 1 from indicateurs_classees$q$, 'bloque');
select essai('Visiteur : repères des classées', $q$select * from public.reperes_classees('GOLD', 'MIDDLE')$q$, 'bloque');
reset role;

-- 100 parties classées au plus par joueur : les plus anciennes s'effacent.
insert into parties_classees (profile_id, riot_match_id, puuid, region)
select '00000000-0000-0000-0000-0000000001b9', 'EUW1_' || (5000 + g), 'P-CLA958-9', 'EUW' from generate_series(1, 105) g;
select verifie('Au plus 100 parties classées gardées par joueur, les plus anciennes effacées',
  (select count(*) = 100 and count(*) filter (where etat = 'complete') = 0
   from parties_classees where profile_id = '00000000-0000-0000-0000-0000000001b9'));

-- Bilan de la semaine : un lundi, une seule fois par joueur.
select refus('Bilan de la semaine daté d''un mardi',
  $q$insert into bilans_hebdo (profile_id, semaine) values ('00000000-0000-0000-0000-0000000001a0', '2026-09-29')$q$,
  'new row for relation "bilans_hebdo" violates check constraint "bilans_hebdo_semaine_check"');
insert into bilans_hebdo (profile_id, semaine) values ('00000000-0000-0000-0000-0000000001a0', '2026-09-28');
select refus('Bilan de la semaine envoyé deux fois',
  $q$insert into bilans_hebdo (profile_id, semaine) values ('00000000-0000-0000-0000-0000000001a0', '2026-09-28')$q$,
  'duplicate key value violates unique constraint "bilans_hebdo_pkey"');

-- Retirer son accord efface ses parties classées et son rang.
update analyse_reglages set palier = 'GOLD', division = 'II', points_ligue = 40, rang_lu_le = now()
where profile_id = '00000000-0000-0000-0000-0000000001a0';
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000001a0');
select essai('Quin lit l''envoi de ses bilans de la semaine', $q$select 1 from bilans_hebdo$q$, 'bloque');
select essai('Quin retire son accord pour les parties classées', $q$select public.regler_analyse(false, true)$q$, 'passe');
select verifie('Accord retiré : parties classées et rang effacés, bilan de la semaine gardé',
  (select r.palier is null and r.division is null and not r.classees and r.classees_depuis is null and r.bilan_hebdo
          and not exists (select 1 from parties_classees)
   from analyse_reglages r where r.profile_id = '00000000-0000-0000-0000-0000000001a0'));
reset role;
