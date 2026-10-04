-- Forfait automatique : « Je suis prêt », puis 15 minutes pour l'adversaire (audit N4).
\set ON_ERROR_STOP 0

-- Pia (…050) contre Paul (…051) ; Quentin (…052) regarde.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000050', 'pia@test',     '{"pseudo":"Pia","slug":"pia"}'),
  ('00000000-0000-0000-0000-000000000051', 'paul@test',    '{"pseudo":"Paul","slug":"paul"}'),
  ('00000000-0000-0000-0000-000000000052', 'quentin@test', '{"pseudo":"Quentin","slug":"quentin"}');

insert into tournaments (id, game_id, season_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut)
values ('92000000-0000-0000-0000-000000000001', 1, (select id from seasons where est_courante), '00000000-0000-0000-0000-00000000000a',
        'essai-forfait', 'Essai forfait', '1v1', 4, 'EUW', now() - interval '1 hour', now() - interval '2 hours', 'en_cours');
insert into matches (id, tournament_id, tour, position, statut) values
  ('50000000-0000-0000-0000-000000000929', '92000000-0000-0000-0000-000000000001', 2, 1, 'en_attente');
insert into matches (id, tournament_id, tour, position, statut, demarre_le, match_suivant_id) values
  ('50000000-0000-0000-0000-000000000921', '92000000-0000-0000-0000-000000000001', 1, 1, 'en_cours', now() - interval '30 minutes', '50000000-0000-0000-0000-000000000929'),
  ('50000000-0000-0000-0000-000000000922', '92000000-0000-0000-0000-000000000001', 1, 2, 'en_cours', now() - interval '30 minutes', '50000000-0000-0000-0000-000000000929');
insert into match_participants (match_id, profile_id, slot) values
  ('50000000-0000-0000-0000-000000000921', '00000000-0000-0000-0000-000000000050', 1),
  ('50000000-0000-0000-0000-000000000921', '00000000-0000-0000-0000-000000000051', 2),
  ('50000000-0000-0000-0000-000000000922', '00000000-0000-0000-0000-000000000052', 1);

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000052');
select refus('Quentin se déclare prêt dans un match qui n''est pas le sien',
  $q$select public.declarer_pret('50000000-0000-0000-0000-000000000921')$q$, 'NON_PARTICIPANT');
select refus('Quentin se déclare prêt sans adversaire connu',
  $q$select public.declarer_pret('50000000-0000-0000-0000-000000000922')$q$, 'ADVERSAIRE_ABSENT');
select en_tant_que('00000000-0000-0000-0000-000000000050');
select essai('Pia se déclare prête', $q$select 1 where public.declarer_pret('50000000-0000-0000-0000-000000000921')$q$, 'passe');
select essai('Pia clique une deuxième fois : rien de nouveau',
  $q$select 1 where not public.declarer_pret('50000000-0000-0000-0000-000000000921')$q$, 'passe');
select essai('Pia antidate elle-même sa déclaration',
  $q$update match_participants set pret_le = now() - interval '1 hour' where match_id = '50000000-0000-0000-0000-000000000921' and profile_id = '00000000-0000-0000-0000-000000000050'$q$, 'bloque');
select essai('Pia applique elle-même le forfait (réservé au serveur)',
  $q$select public.appliquer_forfait_absence('50000000-0000-0000-0000-000000000921')$q$, 'bloque');
reset role;

set role service_role;
select essai('Serveur : Paul a encore le temps, aucun forfait',
  $q$select 1 where public.appliquer_forfait_absence('50000000-0000-0000-0000-000000000921') is null$q$, 'passe');
reset role;

-- 16 minutes plus tard.
update match_participants set pret_le = now() - interval '16 minutes'
where match_id = '50000000-0000-0000-0000-000000000921' and profile_id = '00000000-0000-0000-0000-000000000050';

set role service_role;
select essai('Serveur : 15 minutes écoulées, Paul perd par forfait',
  $q$select 1 where public.appliquer_forfait_absence('50000000-0000-0000-0000-000000000921') = '00000000-0000-0000-0000-000000000050'$q$, 'passe');
select essai('Serveur : relance, rien de plus',
  $q$select 1 where public.appliquer_forfait_absence('50000000-0000-0000-0000-000000000921') is null$q$, 'passe');
reset role;

select verifie('Forfait : verdict manuel (hors classement), motif public, match « forfait », Pia en finale',
  (select v.niveau = 'manuel' and v.gagnant_id = '00000000-0000-0000-0000-000000000050'
          and v.motif like 'Forfait : Paul ne s''est pas déclaré prêt%' and m.statut = 'forfait'
          and exists (select 1 from match_participants f
                      where f.match_id = '50000000-0000-0000-0000-000000000929'
                        and f.profile_id = '00000000-0000-0000-0000-000000000050')
     from match_verdicts v join matches m on m.id = v.match_id
     where v.match_id = '50000000-0000-0000-0000-000000000921' and v.est_definitif));

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000051');
select refus('Paul se déclare prêt après coup',
  $q$select public.declarer_pret('50000000-0000-0000-0000-000000000921')$q$, 'MATCH_NON_OUVERT');
reset role;

-- Les deux prêts depuis longtemps : jamais de forfait.
insert into match_participants (match_id, profile_id, slot, pret_le) values
  ('50000000-0000-0000-0000-000000000922', '00000000-0000-0000-0000-000000000051', 2, now() - interval '40 minutes');
update match_participants set pret_le = now() - interval '40 minutes'
where match_id = '50000000-0000-0000-0000-000000000922' and profile_id = '00000000-0000-0000-0000-000000000052';
set role service_role;
select essai('Serveur : les deux joueurs sont prêts, aucun forfait',
  $q$select 1 where public.appliquer_forfait_absence('50000000-0000-0000-0000-000000000922') is null$q$, 'passe');
reset role;
