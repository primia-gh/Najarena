-- Cash prizes sponsorisés, désactivés par défaut (audit N32).
\set ON_ERROR_STOP 0

-- Tournoi 1v1 à 8, ouvert ; huit joueurs ; Dave est administrateur.
insert into auth.users (id, email, raw_user_meta_data)
select ('00000000-0000-0000-0000-00000000012' || n)::uuid, 'dot953' || n || '@test',
       format('{"pseudo":"Dot953%s","slug":"dot953%s"}', n, n)::jsonb
from generate_series(1, 8) n;
insert into admins (profile_id) values ('00000000-0000-0000-0000-00000000000d') on conflict do nothing;
insert into tournaments (id, game_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, compte_pour_classement) values
  ('9d000000-0000-0000-0000-000000000001', 1, '00000000-0000-0000-0000-000000000121', 'dote-1', 'Coupe dotée', '1v1', 8, 'EUW', now() + interval '3 days', now() + interval '3 days', 'ouvert', true),
  ('9d000000-0000-0000-0000-000000000002', 1, '00000000-0000-0000-0000-000000000121', 'dote-5v5', 'Coupe 5v5', '5v5', 8, 'EUW', now() + interval '3 days', now() + interval '3 days', 'ouvert', false),
  ('9d000000-0000-0000-0000-000000000003', 1, '00000000-0000-0000-0000-000000000121', 'dote-tard', 'Déjà lancé', '1v1', 8, 'EUW', now() - interval '1 hour', now() - interval '2 hours', 'en_cours', true);

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000121');
select refus('Un organisateur ajoute lui-même une dotation',
  $q$select public.enregistrer_dotation('9d000000-0000-0000-0000-000000000001', 'Sponsor', null, array[10000])$q$, 'ADMIN_REQUIS');
select essai('Un joueur écrit lui-même une dotation',
  $q$insert into dotations (tournament_id, sponsor_nom, repartition, cree_par) values ('9d000000-0000-0000-0000-000000000001', 'X', array[1], '00000000-0000-0000-0000-000000000121')$q$, 'bloque');
select en_tant_que('00000000-0000-0000-0000-00000000000d');
select refus('Admin : dotation sur un tournoi 5v5', $q$select public.enregistrer_dotation('9d000000-0000-0000-0000-000000000002', 'Sponsor', null, array[10000])$q$, 'DOTATION_FORMAT');
select refus('Admin : dotation ajoutée après la fin des inscriptions', $q$select public.enregistrer_dotation('9d000000-0000-0000-0000-000000000003', 'Sponsor', null, array[10000])$q$, 'DOTATION_TROP_TARD');
select refus('Admin : sponsor au nom insultant', $q$select public.enregistrer_dotation('9d000000-0000-0000-0000-000000000001', 'Sponsor FDP', null, array[10000])$q$, 'NOM_INTERDIT');
select essai('Admin : répartition avec un montant nul', $q$select public.enregistrer_dotation('9d000000-0000-0000-0000-000000000001', 'Sponsor', null, array[10000, 0])$q$, 'bloque');
select essai('Admin : dotation de 100 €, 50 € et 25 € par demi-finaliste',
  $q$select public.enregistrer_dotation('9d000000-0000-0000-0000-000000000001', 'Brasserie du Coin', 'https://exemple.fr', array[10000, 5000, 2500])$q$, 'passe');
select refus('Admin : versements avant la fin du tournoi', $q$select public.preparer_versements('9d000000-0000-0000-0000-000000000001')$q$, 'TOURNOI_PAS_TERMINE');
reset role;

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select verifie('Visiteur : la dotation validée est publique',
  (select repartition = array[10000, 5000, 2500] from dotations where tournament_id = '9d000000-0000-0000-0000-000000000001'));
reset role;

-- Le tournoi se joue : quarts (tour 1), demies (tour 2), finale (tour 3).
-- Jo 1 gagne tout ; la demi Jo 5 contre Jo 7 est tranchée à la main.
update tournaments set statut = 'termine' where id = '9d000000-0000-0000-0000-000000000001';
insert into matches (id, tournament_id, tour, position, statut)
select ('9d000000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid, '9d000000-0000-0000-0000-000000000001', t, p, 'termine'
from (values (11, 1, 1), (12, 1, 2), (13, 1, 3), (14, 1, 4), (21, 2, 1), (22, 2, 2), (31, 3, 1)) as m(i, t, p);
insert into match_participants (match_id, profile_id, slot)
select ('9d000000-0000-0000-0000-0000000000' || m)::uuid, ('00000000-0000-0000-0000-00000000012' || j)::uuid, s
from (values (11, 1, 1), (11, 2, 2), (12, 3, 1), (12, 4, 2), (13, 5, 1), (13, 6, 2), (14, 7, 1), (14, 8, 2),
             (21, 1, 1), (21, 3, 2), (22, 5, 1), (22, 7, 2), (31, 1, 1), (31, 5, 2)) as x(m, j, s);
insert into match_verdicts (match_id, niveau, gagnant_id, est_definitif)
select ('9d000000-0000-0000-0000-0000000000' || m)::uuid, n::verdict_level, ('00000000-0000-0000-0000-00000000012' || g)::uuid, true
from (values (11, 'historique', 1), (12, 'historique', 3), (13, 'historique', 5), (14, 'historique', 7),
             (21, 'historique', 1), (22, 'manuel', 5), (31, 'historique', 1)) as v(m, n, g);

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-00000000000d');
select verifie('Admin : quatre gagnants dotés (vainqueur, finaliste, deux demi-finalistes)',
  (select public.preparer_versements('9d000000-0000-0000-0000-000000000001') = 4));
select verifie('Admin : une relance n''ajoute rien', (select public.preparer_versements('9d000000-0000-0000-0000-000000000001') = 0));
reset role;
select verifie('Montants par rang, et la demi tranchée à la main est à vérifier',
  (select array_agg(substr(profile_id::text, 36) || ':' || rang || ':' || montant_centimes || ':' || a_verifier order by rang, profile_id)
          = array['1:1:10000:false', '5:2:5000:false', '3:3:2500:false', '7:3:2500:true']
   from versements_dotation where tournament_id = '9d000000-0000-0000-0000-000000000001'));

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000123');
select verifie('Jo 3 voit son propre versement, et lui seul',
  (select count(*) = 1 and bool_and(profile_id = '00000000-0000-0000-0000-000000000123') from versements_dotation));
select refus('Jo 3 se marque lui-même payé',
  $q$select public.noter_versement('9d000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000123', 'verse', 'moi')$q$, 'ADMIN_REQUIS');
select en_tant_que('00000000-0000-0000-0000-00000000000d');
select verifie('Admin : versement à Jo 1 noté avec sa référence',
  (select public.noter_versement('9d000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000121', 'verse', 'VIR-2026-001')));
select refus('Admin : annuler une dotation déjà en partie versée',
  $q$select public.annuler_dotation('9d000000-0000-0000-0000-000000000001')$q$, 'DOTATION_DEJA_VERSEE');
reset role;

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select essai('Visiteur : aucun versement lisible', $q$select 1 from versements_dotation$q$, 'bloque');
reset role;
