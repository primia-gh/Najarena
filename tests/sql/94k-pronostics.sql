-- Pronostics gratuits (audit N20).
\set ON_ERROR_STOP 0

-- Tournoi à 8 en cours, organisé par Olga : un quart (pas de pronostic),
-- deux demi-finales (l'une ouverte, l'autre ouverte depuis 20 minutes), la
-- finale (adversaires pas encore connus). Pia et Quin pronostiquent.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f0', 'olga951@test', '{"pseudo":"Olga951","slug":"olga951"}'),
  ('00000000-0000-0000-0000-0000000000f1', 'jo951a@test', '{"pseudo":"Jo951a","slug":"jo951a"}'),
  ('00000000-0000-0000-0000-0000000000f2', 'jo951b@test', '{"pseudo":"Jo951b","slug":"jo951b"}'),
  ('00000000-0000-0000-0000-0000000000f3', 'jo951c@test', '{"pseudo":"Jo951c","slug":"jo951c"}'),
  ('00000000-0000-0000-0000-0000000000f4', 'jo951d@test', '{"pseudo":"Jo951d","slug":"jo951d"}'),
  ('00000000-0000-0000-0000-0000000000f8', 'pia951@test', '{"pseudo":"Pia951","slug":"pia951"}'),
  ('00000000-0000-0000-0000-0000000000f9', 'quin951@test', '{"pseudo":"Quin951","slug":"quin951"}');
insert into tournaments (id, game_id, season_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut)
select '94a00000-0000-0000-0000-000000000001'::uuid, 1, s.id, '00000000-0000-0000-0000-0000000000f0'::uuid, 'olga-1', 'Olga 1', '1v1', 8, 'EUW',
       now() - interval '2 hours', now() - interval '3 hours', 'en_cours'
from seasons s where s.est_courante;
insert into registrations (tournament_id, profile_id, statut) values
  ('94a00000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f1', 'confirme'),
  ('94a00000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f2', 'confirme'),
  ('94a00000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f3', 'confirme'),
  ('94a00000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f4', 'confirme');
insert into matches (id, tournament_id, tour, position, statut, demarre_le) values
  ('94a00000-0000-0000-0000-0000000000a1', '94a00000-0000-0000-0000-000000000001', 1, 1, 'en_cours', now()),
  ('94a00000-0000-0000-0000-0000000000b1', '94a00000-0000-0000-0000-000000000001', 2, 1, 'en_cours', now()),
  ('94a00000-0000-0000-0000-0000000000b2', '94a00000-0000-0000-0000-000000000001', 2, 2, 'en_cours', now() - interval '20 minutes'),
  ('94a00000-0000-0000-0000-0000000000c1', '94a00000-0000-0000-0000-000000000001', 3, 1, 'en_attente', null);
insert into match_participants (match_id, profile_id, slot) values
  ('94a00000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f1', 1),
  ('94a00000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f2', 2),
  ('94a00000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f1', 1),
  ('94a00000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f3', 2),
  ('94a00000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000f2', 1),
  ('94a00000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000f4', 2);

select verifie('Points : 2 en finale, 1 en demi-finale, 0 avant',
  public.points_pronostic(3::smallint, 8) = 2 and public.points_pronostic(2::smallint, 8) = 1
  and public.points_pronostic(1::smallint, 8) = 0 and public.points_pronostic(1::smallint, 2) = 0);

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select essai('Un visiteur pronostique',
  $q$select public.pronostiquer('94a00000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f1')$q$, 'bloque');
reset role;

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000000f8');
select essai('Pia pronostique Jo951c en demi-finale',
  $q$select public.pronostiquer('94a00000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f3')$q$, 'passe');
select essai('Pia change d''avis avant le match',
  $q$select public.pronostiquer('94a00000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f1')$q$, 'passe');
select verifie('Un seul pronostic de Pia sur ce match, le dernier',
  (select count(*) = 1 and bool_and(gagnant_prevu = '00000000-0000-0000-0000-0000000000f1')
   from pronostics where match_id = '94a00000-0000-0000-0000-0000000000b1'));
select refus('Pia pronostique un quart de finale',
  $q$select public.pronostiquer('94a00000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f1')$q$, 'PRONOSTIC_HORS_PHASE');
select refus('Pia pronostique la demi-finale ouverte depuis 20 minutes',
  $q$select public.pronostiquer('94a00000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000f2')$q$, 'PRONOSTIC_FERME');
select refus('Pia pronostique la finale, adversaires pas encore connus',
  $q$select public.pronostiquer('94a00000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1')$q$, 'CHOIX_INVALIDE');
select refus('Pia désigne un joueur qui n''est pas dans le match',
  $q$select public.pronostiquer('94a00000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f4')$q$, 'CHOIX_INVALIDE');
select essai('Pia écrit elle-même un pronostic',
  $q$insert into pronostics (match_id, profile_id, gagnant_prevu) values ('94a00000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000f8', '00000000-0000-0000-0000-0000000000f2')$q$, 'bloque');
select en_tant_que('00000000-0000-0000-0000-0000000000f2');
select refus('Jo951b, joueur du tournoi, pronostique',
  $q$select public.pronostiquer('94a00000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f1')$q$, 'JOUEUR_DU_TOURNOI');
select en_tant_que('00000000-0000-0000-0000-0000000000f0');
select refus('Olga, l''organisatrice, pronostique',
  $q$select public.pronostiquer('94a00000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f1')$q$, 'JOUEUR_DU_TOURNOI');
select en_tant_que('00000000-0000-0000-0000-000000000064');
select refus('Vic, suspendu, pronostique',
  $q$select public.pronostiquer('94a00000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f1')$q$, 'COMPTE_SUSPENDU');
select en_tant_que('00000000-0000-0000-0000-0000000000f9');
select essai('Quin pronostique Jo951c', $q$select public.pronostiquer('94a00000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f3')$q$, 'passe');
select essai('Quin ne voit pas le pronostic de Pia',
  $q$select 1 from pronostics where profile_id = '00000000-0000-0000-0000-0000000000f8'$q$, 'bloque');
reset role;

set role anon;
select verifie('Visiteur : répartition publique, 1 pronostic pour chacun',
  (select count(*) = 2 and bool_and(nombre = 1) from public.repartition_pronostics('94a00000-0000-0000-0000-000000000001')));
reset role;

update match_participants set pret_le = now()
where match_id = '94a00000-0000-0000-0000-0000000000b1' and profile_id = '00000000-0000-0000-0000-0000000000f3';
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000000f9');
select refus('Quin change d''avis une fois un joueur prêt',
  $q$select public.pronostiquer('94a00000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f1')$q$, 'PRONOSTIC_FERME');
reset role;

-- Jo951a gagne sa demi-finale (lue chez Riot) ; l'autre demi se termine
-- par une décision manuelle, la finale est lue chez Riot.
insert into match_verdicts (match_id, niveau, gagnant_id, est_definitif) values
  ('94a00000-0000-0000-0000-0000000000b1', 'historique', '00000000-0000-0000-0000-0000000000f1', true);
insert into pronostics (match_id, profile_id, gagnant_prevu) values
  ('94a00000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000f8', '00000000-0000-0000-0000-0000000000f2');
insert into match_verdicts (match_id, niveau, gagnant_id, motif, est_definitif) values
  ('94a00000-0000-0000-0000-0000000000b2', 'manuel', '00000000-0000-0000-0000-0000000000f2', 'Forfait', true);
insert into match_participants (match_id, profile_id, slot) values
  ('94a00000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1', 1),
  ('94a00000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f2', 2);
update matches set statut = 'en_cours', demarre_le = now() where id = '94a00000-0000-0000-0000-0000000000c1';
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000000f9');
select essai('Quin pronostique la finale', $q$select public.pronostiquer('94a00000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1')$q$, 'passe');
reset role;
insert into match_verdicts (match_id, niveau, gagnant_id, est_definitif) values
  ('94a00000-0000-0000-0000-0000000000c1', 'code_tournoi', '00000000-0000-0000-0000-0000000000f1', true);

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000000f8');
select refus('Pia pronostique une finale déjà jouée',
  $q$select public.pronostiquer('94a00000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1')$q$, 'PRONOSTIC_FERME');
reset role;

set role anon;
select verifie('Classement : Quin 2 points (finale juste, demi fausse), Pia 1 point (la décision manuelle ne compte pas)',
  (select array_agg(pseudo || ':' || points || ':' || justes || '/' || comptes order by points desc)
          = array['Quin951:2:1/2', 'Pia951:1:1/1']
   from public.classement_pronostics()
   where slug in ('pia951', 'quin951')));
reset role;
