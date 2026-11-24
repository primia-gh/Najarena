-- Paliers renommés et arène en pause (24/11/2026, demande de clé
-- production Riot) : la base applique la pause de l'arène, et l'éligibilité
-- des coachs ne dépend plus du nom du palier.
\set ON_ERROR_STOP 0

insert into auth.users (id, email, raw_user_meta_data)
select ('99a00000-0000-0000-0000-00000000000' || n)::uuid, 'p99z' || n || '@test',
       json_build_object('pseudo', 'Palier99z' || n, 'slug', 'palier99z' || n)::jsonb
from generate_series(1, 3) n;
insert into game_accounts (profile_id, game_id, puuid, riot_game_name, riot_tag_line, region, est_principal, verifie_le, methode_verification)
select ('99a00000-0000-0000-0000-00000000000' || n)::uuid, 1, 'P-99Z-' || n, 'Palier' || n, 'T', 'KR', true, now(), 'icone_profil'
from generate_series(1, 3) n;

-- ---- Paliers : le 5e palier se trouve par son rang, pas par son nom ----
insert into tiers (id, game_id, nom, rating_min, ordre) values
  (1, 1, 'Mue', 0, 1), (2, 1, 'Écaille', 1300, 2), (3, 1, 'Crochet', 1450, 3),
  (4, 1, 'Venin', 1600, 4), (5, 1, 'Cobra', 1750, 5), (6, 1, 'Basilic', 1900, 6)
on conflict (id) do nothing;
-- Les scénarios précédents ont pu écrire les anciens noms : on applique le
-- renommage tel que la section du 24/11/2026 le fait.
update tiers set nom = case ordre
    when 1 then 'Mue' when 2 then 'Écaille' when 3 then 'Crochet'
    when 4 then 'Venin' when 5 then 'Cobra' when 6 then 'Basilic' end
where game_id = 1 and ordre between 1 and 6;
select verifie('Les six paliers portent les noms Najarena, du plus bas au plus haut',
  (select array_agg(nom order by ordre) from tiers where game_id = 1)
    = array['Mue', 'Écaille', 'Crochet', 'Venin', 'Cobra', 'Basilic']);
select verifie('Aucun palier ne porte un nom de rang Riot',
  not exists (select 1 from tiers where nom in ('Bronze', 'Argent', 'Or', 'Platine', 'Diamant', 'Champion')));

insert into ratings (profile_id, game_id, season_id, rating, rd)
select v.p::uuid, 1, (select id from seasons where est_courante), v.rating, 80
from (values ('99a00000-0000-0000-0000-000000000001', 1760), ('99a00000-0000-0000-0000-000000000002', 1740)) as v(p, rating);
select verifie('Coach : classé à 1760 (Cobra), éligible',
  public.est_coach_eligible('99a00000-0000-0000-0000-000000000001'));
select verifie('Coach : classé à 1740 (Venin), pas éligible',
  not public.est_coach_eligible('99a00000-0000-0000-0000-000000000002'));

-- ---- Arène en pause ----
-- La section du 24/11/2026 vide la file avant de poser la pause : idem ici.
delete from file_arene;
alter table file_arene enable trigger arene_en_pause;
set role authenticated;
select en_tant_que('99a00000-0000-0000-0000-000000000003');
select refus('Un joueur au compte vérifié n''entre pas dans l''arène en pause',
  $q$select public.rejoindre_arene()$q$, 'ARENE_EN_PAUSE');
reset role;
select refus('Même le serveur n''écrit pas dans la file',
  $q$insert into file_arene (profile_id, region, rating, rd) values ('99a00000-0000-0000-0000-000000000003', 'KR', 1500, 350)$q$,
  'ARENE_EN_PAUSE');
select verifie('La file reste vide, l''appariement n''ouvre aucun duel',
  not exists (select 1 from file_arene) and not exists (select 1 from public.apparier_arene()));
alter table file_arene disable trigger arene_en_pause;
