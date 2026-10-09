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
select verifie('La demande de Fay s''est effacée',
  not exists (select 1 from coachings where eleve_id = '00000000-0000-0000-0000-0000000003e3'));
reset role;

-- Le suivi d'Eli a commencé il y a 10 jours : un tournoi avant (ignoré), trois pendant.
update coachings set debut_le = now() - interval '10 days' where eleve_id = '00000000-0000-0000-0000-0000000003e2';
insert into rating_events (profile_id, game_id, season_id, motif, rating_avant, rd_avant, rating_apres, rd_apres, cree_le)
select '00000000-0000-0000-0000-0000000003e2', 1, (select id from seasons where est_courante), v.motif, v.av, 300, v.ap, 280, now() - v.il_y_a
from (values ('tournoi', 1400, 1450, interval '20 days'),
             ('tournoi', 1450, 1480, interval '8 days'),
             ('inactivite', 1480, 1480, interval '7 days'),
             ('tournoi', 1480, 1470, interval '5 days'),
             ('tournoi', 1470, 1530, interval '2 days')) v(motif, av, ap, il_y_a);

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
