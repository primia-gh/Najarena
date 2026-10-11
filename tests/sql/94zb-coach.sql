-- Coach vérifié (idée en réserve n°8) : coach classé Diamant ou plus,
-- suivi accepté par les deux, progression lue dans le registre.
\set ON_ERROR_STOP 0

-- Cora (1800, classée), Dan (1700), Eli et Fay (élèves), Gus (suspendu).
insert into auth.users (id, email, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000003e' || n)::uuid, 'c94zb' || n || '@test',
       json_build_object('pseudo', (array['Cora94','Dan94','Eli94','Fay94','Gus94'])[n + 1],
                         'slug', (array['cora94','dan94','eli94','fay94','gus94'])[n + 1])::jsonb
from generate_series(0, 4) n;
insert into ratings (profile_id, game_id, season_id, rating, rd, volatilite)
select v.id::uuid, 1, (select id from seasons where est_courante), v.r, v.rd, 0.06
from (values ('00000000-0000-0000-0000-0000000003e0', 1800, 90),
             ('00000000-0000-0000-0000-0000000003e1', 1700, 90),
             ('00000000-0000-0000-0000-0000000003e2', 1500, 200)) v(id, r, rd);
insert into suspensions (profile_id, motif) values ('00000000-0000-0000-0000-0000000003e4', 'Test de suspension');

set role anon;
select verifie('Cora (1800, classée) peut être coach ; Dan (1700) non',
  public.est_coach_eligible('00000000-0000-0000-0000-0000000003e0') and not public.est_coach_eligible('00000000-0000-0000-0000-0000000003e1'));
reset role;

-- Accord du coach (11/10/2026) : la case « J'accepte des élèves » est
-- décochée par défaut.
set role anon;
select verifie('Par défaut, Cora n''accepte pas d''élèves', not public.accepte_eleves('00000000-0000-0000-0000-0000000003e0'));
select essai('Un visiteur coche la case', $q$select public.regler_eleves(true)$q$, 'bloque');
reset role;

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000003e2');
select refus('Eli demande un suivi à Cora, qui n''a pas coché la case',
  $q$select public.demander_coaching('00000000-0000-0000-0000-0000000003e0')$q$, 'COACH_FERME');
select essai('Eli s''inscrit elle-même comme coach ouverte de Cora',
  $q$insert into coachs_ouverts (profile_id) values ('00000000-0000-0000-0000-0000000003e0')$q$, 'bloque');
select en_tant_que('00000000-0000-0000-0000-0000000003e1');
select refus('Dan (pas Diamant) coche la case', $q$select public.regler_eleves(true)$q$, 'COACH_NON_ELIGIBLE');
select en_tant_que('00000000-0000-0000-0000-0000000003e4');
select refus('Gus (suspendu) coche la case', $q$select public.regler_eleves(true)$q$, 'COMPTE_SUSPENDU');
select en_tant_que('00000000-0000-0000-0000-0000000003e0');
select verifie('Cora coche « J''accepte des élèves »', public.regler_eleves(true));
reset role;
select verifie('Cora accepte maintenant des élèves', public.accepte_eleves('00000000-0000-0000-0000-0000000003e0'));

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000003e2');
select refus('Eli demande un suivi à Dan (pas Diamant)',
  $q$select public.demander_coaching('00000000-0000-0000-0000-0000000003e1')$q$, 'COACH_NON_ELIGIBLE');
select essai('Eli demande un suivi à Cora',
  $q$select public.demander_coaching('00000000-0000-0000-0000-0000000003e0')$q$, 'passe');
select refus('Eli demande un deuxième suivi',
  $q$select public.demander_coaching('00000000-0000-0000-0000-0000000003e0')$q$, 'SUIVI_EN_COURS');
select refus('Eli accepte elle-même sa demande',
  $q$select public.repondre_coaching((select id from coachings where eleve_id = '00000000-0000-0000-0000-0000000003e2'), true)$q$, 'DEMANDE_INTROUVABLE');
select essai('Eli écrit directement un suivi actif',
  $q$update coachings set statut = 'actif' where eleve_id = '00000000-0000-0000-0000-0000000003e2'$q$, 'bloque');
select en_tant_que('00000000-0000-0000-0000-0000000003e4');
select refus('Gus (suspendu) demande un suivi',
  $q$select public.demander_coaching('00000000-0000-0000-0000-0000000003e0')$q$, 'COMPTE_SUSPENDU');
select en_tant_que('00000000-0000-0000-0000-0000000003e3');
select essai('Fay demande un suivi à Cora', $q$select public.demander_coaching('00000000-0000-0000-0000-0000000003e0')$q$, 'passe');
reset role;

select set_config('request.jwt.claim.sub', '', false);
set role anon;
select verifie('Visiteur : les demandes en attente ne sont pas publiques',
  (select count(*) = 0 from public.eleves_coach('00000000-0000-0000-0000-0000000003e0')));
reset role;

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000003e0');
select verifie('Cora voit ses deux demandes',
  (select count(*) = 2 and bool_and(statut = 'demande') from public.eleves_coach('00000000-0000-0000-0000-0000000003e0')));
select verifie('Cora accepte Eli',
  public.repondre_coaching((select id from coachings where eleve_id = '00000000-0000-0000-0000-0000000003e2'), true));
select verifie('Cora refuse Fay',
  not public.repondre_coaching((select id from coachings where eleve_id = '00000000-0000-0000-0000-0000000003e3'), false));
select verifie('La demande de Fay est gardée, refusée (pas publique)',
  (select statut = 'refusee' from coachings where eleve_id = '00000000-0000-0000-0000-0000000003e3')
  and not exists (select 1 from public.eleves_coach('00000000-0000-0000-0000-0000000003e0')
                  where eleve_id = '00000000-0000-0000-0000-0000000003e3'));
select en_tant_que('00000000-0000-0000-0000-0000000003e3');
select refus('Fay redemande aussitôt un suivi à Cora (notification à répétition)',
  $q$select public.demander_coaching('00000000-0000-0000-0000-0000000003e0')$q$, 'DEMANDE_RECENTE');
select en_tant_que('00000000-0000-0000-0000-0000000003e0');
reset role;

-- Le suivi d'Eli a commencé il y a 10 jours : un tournoi avant (ignoré), trois pendant.
-- Chaque ligne « tournoi » du registre est reliée à son tournoi (commencé
-- une heure avant la clôture).
update coachings set debut_le = now() - interval '10 days' where eleve_id = '00000000-0000-0000-0000-0000000003e2';
insert into tournaments (game_id, season_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut)
select 1, (select id from seasons where est_courante), '00000000-0000-0000-0000-0000000003e1', 'coach-94zb-' || n, 'Coach 94zb ' || n,
       '1v1', 8, 'EUW', now() - v.il_y_a - interval '1 hour', now() - v.il_y_a - interval '90 minutes', 'termine'
from (values (1, interval '20 days'), (2, interval '8 days'), (3, interval '5 days'), (4, interval '2 days')) v(n, il_y_a);
insert into rating_events (profile_id, game_id, season_id, motif, tournament_id, rating_avant, rd_avant, rating_apres, rd_apres, cree_le)
select '00000000-0000-0000-0000-0000000003e2', 1, (select id from seasons where est_courante), v.motif,
       (select id from tournaments where slug = v.tournoi), v.av, 300, v.ap, 280, now() - v.il_y_a
from (values ('tournoi', 'coach-94zb-1', 1400, 1450, interval '20 days'),
             ('tournoi', 'coach-94zb-2', 1450, 1480, interval '8 days'),
             ('inactivite', null, 1480, 1480, interval '7 days'),
             ('tournoi', 'coach-94zb-3', 1480, 1470, interval '5 days'),
             ('tournoi', 'coach-94zb-4', 1470, 1530, interval '2 days')) v(motif, tournoi, av, ap, il_y_a);

select set_config('request.jwt.claim.sub', '', false);
set role anon;
select verifie('Visiteur : progression d''Eli pendant le suivi, 3 tournois, +80 points (inactivité et tournoi d''avant exclus)',
  (select tournois = 3 and points = 80 and statut = 'actif' from public.eleves_coach('00000000-0000-0000-0000-0000000003e0')));
reset role;

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000003e2');
select verifie('Eli met fin au suivi',
  public.terminer_coaching((select id from coachings where eleve_id = '00000000-0000-0000-0000-0000000003e2')));
reset role;
select verifie('Suivi terminé, gardé dans l''historique avec sa date de fin',
  (select statut = 'termine' and fin_le is not null from coachings where eleve_id = '00000000-0000-0000-0000-0000000003e2'));

-- Suivi terminé PENDANT un tournoi perdu : la défaite, écrite à la clôture
-- (après la fin du suivi), compte quand même (contrôle de sécurité du
-- 11/10/2026 — sinon un coach pouvait terminer avant la clôture et effacer
-- les défaites de son élève).
update coachings set fin_le = now() - interval '30 minutes' where eleve_id = '00000000-0000-0000-0000-0000000003e2';
insert into tournaments (game_id, season_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut)
values (1, (select id from seasons where est_courante), '00000000-0000-0000-0000-0000000003e1', 'coach-94zb-5', 'Coach 94zb 5',
        '1v1', 8, 'EUW', now() - interval '1 hour', now() - interval '90 minutes', 'termine');
insert into rating_events (profile_id, game_id, season_id, motif, tournament_id, rating_avant, rd_avant, rating_apres, rd_apres)
values ('00000000-0000-0000-0000-0000000003e2', 1, (select id from seasons where est_courante), 'tournoi',
        (select id from tournaments where slug = 'coach-94zb-5'), 1530, 280, 1490, 270);
select verifie('Tournoi commencé pendant le suivi, clos après sa fin : compté (4 tournois, +40 points)',
  (select tournois = 4 and points = 40 from public.eleves_coach('00000000-0000-0000-0000-0000000003e0')
   where eleve_id = '00000000-0000-0000-0000-0000000003e2'));

-- Tournoi annoncé APRÈS la fin du suivi, mais lancé plus tôt (premier match
-- pendant le suivi) : compté aussi.
insert into tournaments (game_id, season_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut)
values (1, (select id from seasons where est_courante), '00000000-0000-0000-0000-0000000003e1', 'coach-94zb-6', 'Coach 94zb 6',
        '1v1', 8, 'EUW', now() + interval '2 hours', now() - interval '2 hours', 'termine');
insert into matches (tournament_id, tour, position, statut, demarre_le)
values ((select id from tournaments where slug = 'coach-94zb-6'), 1, 1, 'termine', now() - interval '45 minutes');
insert into rating_events (profile_id, game_id, season_id, motif, tournament_id, rating_avant, rd_avant, rating_apres, rd_apres)
values ('00000000-0000-0000-0000-0000000003e2', 1, (select id from seasons where est_courante), 'tournoi',
        (select id from tournaments where slug = 'coach-94zb-6'), 1490, 270, 1470, 265);
select verifie('Tournoi lancé avant son heure annoncée, pendant le suivi : compté (5 tournois, +20 points)',
  (select tournois = 5 and points = 20 from public.eleves_coach('00000000-0000-0000-0000-0000000003e0')
   where eleve_id = '00000000-0000-0000-0000-0000000003e2'));

-- Anti-répétition (contrôle de sécurité du 11/10/2026) : demande annulée
-- par l'élève, et plafond de 5 demandes par 24 h.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000003e5', 'c94zb5@test', '{"pseudo":"Hal94","slug":"hal94"}'),
  ('00000000-0000-0000-0000-0000000003e6', 'c94zb6@test', '{"pseudo":"Ivy94","slug":"ivy94"}');
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000003e5');
select verifie('Hal demande un suivi à Cora puis annule sa demande',
  public.terminer_coaching(public.demander_coaching('00000000-0000-0000-0000-0000000003e0')));
reset role;
select verifie('Demande annulée par l''élève, gardée',
  (select statut = 'annulee' from coachings where eleve_id = '00000000-0000-0000-0000-0000000003e5'));
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000003e5');
select refus('Hal redemande aussitôt à Cora (7 jours d''attente)',
  $q$select public.demander_coaching('00000000-0000-0000-0000-0000000003e0')$q$, 'DEMANDE_RECENTE');
reset role;
-- Ivy a déjà fait 5 demandes depuis 24 h (à d'autres coachs, annulées).
insert into coachings (coach_id, eleve_id, statut, demande_le)
select p.id, '00000000-0000-0000-0000-0000000003e6', 'annulee', now() - interval '1 hour'
from (select id from profiles
      where id not in ('00000000-0000-0000-0000-0000000003e6', '00000000-0000-0000-0000-0000000003e0')
      order by id limit 5) p;
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000003e6');
select refus('Ivy : sixième demande en 24 h, refusée', $q$select public.demander_coaching('00000000-0000-0000-0000-0000000003e0')$q$, 'DEMANDE_RECENTE');
reset role;

-- Cora décoche la case : plus de nouvelle demande, l'historique reste.
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000003e0');
select verifie('Cora décoche la case', not public.regler_eleves(false));
reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000003e7', 'c94zb7@test', '{"pseudo":"Jo94","slug":"jo94"}');
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000003e7');
select refus('Jo demande un suivi à Cora, qui a décoché', $q$select public.demander_coaching('00000000-0000-0000-0000-0000000003e0')$q$, 'COACH_FERME');
reset role;
