-- Défis : 20 lancés par 24 h, retirés compris (M6) ; registre : vérification
-- gardée, plus calculée à chaque visite (M7). Contrôle de sécurité complet
-- du 21/11/2026.
\set ON_ERROR_STOP 0

insert into auth.users (id, email, raw_user_meta_data)
select ('b00b000' || n || '-0000-0000-0000-000000000000')::uuid, 'p99u' || n || '@test',
       json_build_object('pseudo', 'Defi99u' || n, 'slug', 'defi99u' || n)::jsonb
from generate_series(1, 2) n;
insert into game_accounts (profile_id, game_id, puuid, riot_game_name, riot_tag_line, region, est_principal, verifie_le, methode_verification) values
  ('b00b0001-0000-0000-0000-000000000000', 1, 'P99U-1', 'Lanceur', 'EUW', 'EUW', true, now(), 'icone_profil'),
  ('b00b0002-0000-0000-0000-000000000000', 1, 'P99U-2', 'Cible', 'EUW', 'EUW', true, now(), 'icone_profil');

-- ---- M6 ----
set role authenticated;
select en_tant_que('b00b0001-0000-0000-0000-000000000000');
do $$
declare
  v_id uuid;
begin
  -- 19 défis lancés puis retirés…
  for i in 1..19 loop
    v_id := public.lancer_defi('b00b0002-0000-0000-0000-000000000000');
    perform public.annuler_defi(v_id);
  end loop;
end;
$$;
select essai('Le 20e défi du jour (lien d''invitation) passe',
  $q$select public.creer_invitation_defi()$q$, 'passe');
select refus('Le 21e est refusé, même si tous les autres ont été retirés',
  $q$select public.lancer_defi('b00b0002-0000-0000-0000-000000000000')$q$, 'DEFIS_DU_JOUR_ATTEINTS');
reset role;
select verifie('20 défis lancés en tout, aucun 21e',
  (select count(*) = 20 from defis where lanceur_id = 'b00b0001-0000-0000-0000-000000000000'));
-- Le lendemain, la limite repart.
update limites_usage set cree_le = cree_le - interval '25 hours'
where profile_id = 'b00b0001-0000-0000-0000-000000000000' and action = 'defi';
set role authenticated;
select en_tant_que('b00b0001-0000-0000-0000-000000000000');
select essai('24 h plus tard, il relance un défi',
  $q$select public.lancer_defi('b00b0002-0000-0000-0000-000000000000')$q$, 'passe');
reset role;

-- ---- M7 ----
set role anon;
select refus('Un visiteur ne lance plus la vérification complète',
  $q$select * from public.verifier_registre()$q$, 'permission denied for function verifier_registre');
reset role;
set role authenticated;
select en_tant_que('b00b0001-0000-0000-0000-000000000000');
select refus('Un joueur non plus',
  $q$select * from public.verifier_registre()$q$, 'permission denied for function verifier_registre');
select refus('Ni la vérification gardée',
  $q$select * from public.garder_verification_registre()$q$, 'permission denied for function garder_verification_registre');
reset role;

set role service_role;
select verifie('Premier passage : toute la chaîne est vérifiée',
  (select complete and premiere_rupture is null and lignes = (select count(*) from rating_events)
   from public.garder_verification_registre()));
reset role;
insert into rating_events (profile_id, game_id, season_id, motif, rating_avant, rd_avant, rating_apres, rd_apres)
values ('b00b0001-0000-0000-0000-000000000000', 1, (select id from seasons where est_courante), 'correction', 1500, 350, 1500, 350);
set role service_role;
select verifie('Passage suivant : seulement la nouvelle ligne, chaîne intacte',
  (select not complete and premiere_rupture is null and lignes = (select count(*) from rating_events)
   from public.garder_verification_registre()));
reset role;

set role anon;
select verifie('La page lit le résultat gardé, avec son heure et la dernière empreinte',
  (select lignes > 0 and premiere_rupture is null and verifie_le > now() - interval '1 minute'
     and derniere_empreinte = (select empreinte from rating_events order by numero desc limit 1)
   from verification_registre where id = 1));
select refus('Un visiteur n''écrit pas le résultat',
  $q$update verification_registre set premiere_rupture = 1 where id = 1 returning 1$q$, 'permission denied for table verification_registre');
reset role;

-- Rupture simulée (contenu retouché, triggers d'immuabilité contournés) :
-- la vérification complète du jour la trouve.
alter table rating_events disable trigger rating_events_immuable;
update rating_events set rating_apres = rating_apres + 1
where numero = (select max(numero) from rating_events);
alter table rating_events enable trigger rating_events_immuable;
update verification_registre set verification_complete_le = now() - interval '25 hours' where id = 1;
set role service_role;
select verifie('La relecture complète trouve la ligne retouchée',
  (select complete and premiere_rupture = (select max(numero) from rating_events)
   from public.garder_verification_registre()));
reset role;
-- Remise en état pour les scénarios suivants.
alter table rating_events disable trigger rating_events_immuable;
update rating_events set rating_apres = rating_apres - 1
where numero = (select max(numero) from rating_events);
alter table rating_events enable trigger rating_events_immuable;
