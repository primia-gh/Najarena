-- Scrims calés sur une échéance (audit N24). Reprend les équipes de 94d.
\set ON_ERROR_STOP 0

insert into echeances (id, type, nom, region, debut_le, lien_officiel) values
  ('94e00000-0000-0000-0000-0000000000e1', 'clash', 'Clash EUW du samedi', 'EUW', now() + interval '10 days', 'https://www.leagueoflegends.com/fr-fr/'),
  ('94e00000-0000-0000-0000-0000000000e2', 'clash', 'Clash passé', 'EUW', now() - interval '1 day', 'https://www.leagueoflegends.com/fr-fr/'),
  ('94e00000-0000-0000-0000-0000000000e3', 'clash', 'Clash NA', 'NA', now() + interval '10 days', 'https://www.leagueoflegends.com/fr-fr/');

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000000a0');
select refus('Ana vise une échéance passée',
  $q$select public.proposer_scrim('94d00000-0000-0000-0000-00000000000a', '94d00000-0000-0000-0000-00000000000b', now() + interval '2 days', 1::smallint, array['00000000-0000-0000-0000-0000000000a0','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-0000000000a4']::uuid[], '94e00000-0000-0000-0000-0000000000e2')$q$, 'OBJECTIF_INVALIDE');
select refus('Ana vise une échéance d''une autre région',
  $q$select public.proposer_scrim('94d00000-0000-0000-0000-00000000000a', '94d00000-0000-0000-0000-00000000000b', now() + interval '2 days', 1::smallint, array['00000000-0000-0000-0000-0000000000a0','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-0000000000a4']::uuid[], '94e00000-0000-0000-0000-0000000000e3')$q$, 'OBJECTIF_INVALIDE');
select refus('Ana place le scrim après l''échéance qu''il prépare',
  $q$select public.proposer_scrim('94d00000-0000-0000-0000-00000000000a', '94d00000-0000-0000-0000-00000000000b', now() + interval '12 days', 1::smallint, array['00000000-0000-0000-0000-0000000000a0','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-0000000000a4']::uuid[], '94e00000-0000-0000-0000-0000000000e1')$q$, 'OBJECTIF_INVALIDE');
select essai('Ana propose un scrim de préparation au Clash',
  $q$select public.proposer_scrim('94d00000-0000-0000-0000-00000000000a', '94d00000-0000-0000-0000-00000000000b', now() + interval '2 days', 1::smallint, array['00000000-0000-0000-0000-0000000000a0','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-0000000000a4']::uuid[], '94e00000-0000-0000-0000-0000000000e1')$q$, 'passe');
reset role;
select id as scrim_clash from scrims where objectif_id = '94e00000-0000-0000-0000-0000000000e1' \gset
select verifie('Proposition enregistrée avec son échéance', (select statut = 'propose' from scrims where id = :'scrim_clash'));

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000000a5');
select essai('Bob5 accepte le scrim de préparation',
  format($q$select 1 where public.repondre_scrim(%L, true, array['00000000-0000-0000-0000-0000000000a5','00000000-0000-0000-0000-0000000000a6','00000000-0000-0000-0000-0000000000a7','00000000-0000-0000-0000-0000000000a8','00000000-0000-0000-0000-0000000000a9']::uuid[]) like 'scrim-%%'$q$, :'scrim_clash'), 'passe');
reset role;
select verifie('Le match du scrim porte l''échéance préparée',
  (select t.objectif_id = '94e00000-0000-0000-0000-0000000000e1' from scrims s join tournaments t on t.id = s.tournament_id where s.id = :'scrim_clash'));

select refus('Un tournoi ordinaire ne vise pas une échéance',
  $q$insert into tournaments (game_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, objectif_id) values (1, '00000000-0000-0000-0000-0000000000a0', 'objectif-interdit', 'Objectif interdit', '1v1', 8, 'EUW', now() + interval '3 days', now() + interval '3 days', 'ouvert', '94e00000-0000-0000-0000-0000000000e1')$q$,
  'new row for relation "tournaments" violates check constraint "tournaments_objectif_scrim"');
