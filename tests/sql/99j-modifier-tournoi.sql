-- Modifier un tournoi avant la première inscription (19/11/2026, audit M7).
\set ON_ERROR_STOP 0

-- Oli organise (sans l'offre Organisateur) ; Pia est une autre joueuse.
insert into auth.users (id, email, raw_user_meta_data)
select ('9a0a0000-0000-0000-0000-00000000000' || n)::uuid, 'p99j' || n || '@test',
       json_build_object('pseudo', 'Modif99j' || n, 'slug', 'modif99j' || n)::jsonb
from generate_series(1, 2) n;

insert into tournaments (id, game_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, nature, creneau_auto)
values
  -- Publié il y a 3 jours pour dans 10 jours.
  ('9a0a0000-0000-0000-0000-0000000000a1', 1, '9a0a0000-0000-0000-0000-000000000001', 'tournoi-99j-a', 'Tournoi 99j A', '1v1', 8, 'EUW',
   now() + interval '10 days', now() + interval '10 days' - interval '1 hour', 'ouvert', 'tournoi', null),
  -- Brouillon, 128 places obtenues avec l'offre (depuis perdue).
  ('9a0a0000-0000-0000-0000-0000000000a2', 1, '9a0a0000-0000-0000-0000-000000000001', 'tournoi-99j-b', 'Tournoi 99j B', '1v1', 128, 'EUW',
   now() + interval '5 days', now() + interval '5 days', 'brouillon', 'tournoi', null),
  -- Déjà en check-in.
  ('9a0a0000-0000-0000-0000-0000000000a3', 1, '9a0a0000-0000-0000-0000-000000000001', 'tournoi-99j-c', 'Tournoi 99j C', '1v1', 8, 'EUW',
   now() + interval '1 hour', now() - interval '10 minutes', 'checkin', 'tournoi', null),
  -- Une inscription a eu lieu (puis a été retirée).
  ('9a0a0000-0000-0000-0000-0000000000a4', 1, '9a0a0000-0000-0000-0000-000000000001', 'tournoi-99j-d', 'Tournoi 99j D', '1v1', 8, 'EUW',
   now() + interval '4 days', now() + interval '4 days', 'ouvert', 'tournoi', null),
  -- Tournoi automatique dont Oli serait l'organisateur désigné.
  ('9a0a0000-0000-0000-0000-0000000000a5', 1, '9a0a0000-0000-0000-0000-000000000001', 'najarena-99j-auto', 'Daily 99j', '1v1', 16, 'EUW',
   now() + interval '6 hours', now() + interval '5 hours', 'ouvert', 'tournoi', 'test-99j');
insert into registrations (tournament_id, profile_id, statut) values
  ('9a0a0000-0000-0000-0000-0000000000a4', '9a0a0000-0000-0000-0000-000000000002', 'retire');

-- Publication datée d'il y a 3 jours (le déclencheur la pose seul).
alter table tournaments disable trigger controle_classement_tournoi;
update tournaments set publie_le = now() - interval '3 days' where id = '9a0a0000-0000-0000-0000-0000000000a1';
alter table tournaments enable trigger controle_classement_tournoi;

set role anon;
select refus('Un visiteur ne modifie rien',
  $q$select public.modifier_tournoi('9a0a0000-0000-0000-0000-0000000000a1', 'Nouveau nom', 8, 1, 'EUW', now() + interval '2 days', now() + interval '2 days')$q$,
  'permission denied for function modifier_tournoi');
reset role;

set role authenticated;
select en_tant_que('9a0a0000-0000-0000-0000-000000000002');
select refus('Pia ne modifie pas le tournoi d''Oli',
  $q$select public.modifier_tournoi('9a0a0000-0000-0000-0000-0000000000a1', 'Tournoi de Pia', 8, 1, 'EUW', now() + interval '2 days', now() + interval '2 days')$q$,
  'TOURNOI_INTROUVABLE');

select en_tant_que('9a0a0000-0000-0000-0000-000000000001');
select refus('Oli ne change toujours pas la date par une écriture directe',
  $q$update tournaments set debute_le = now() + interval '2 days' where id = '9a0a0000-0000-0000-0000-0000000000a1'$q$,
  'CHAMP_NON_MODIFIABLE');

-- Mêmes règles qu'à la création.
select refus('Nom trop court',
  $q$select public.modifier_tournoi('9a0a0000-0000-0000-0000-0000000000a1', ' ab ', 8, 1, 'EUW', now() + interval '2 days', now() + interval '2 days')$q$,
  'NOM_INVALIDE');
select refus('Capacité hors liste',
  $q$select public.modifier_tournoi('9a0a0000-0000-0000-0000-0000000000a1', 'Nouveau nom', 12, 1, 'EUW', now() + interval '2 days', now() + interval '2 days')$q$,
  'CAPACITE_INVALIDE');
select refus('Best-of hors liste',
  $q$select public.modifier_tournoi('9a0a0000-0000-0000-0000-0000000000a1', 'Nouveau nom', 8, 2, 'EUW', now() + interval '2 days', now() + interval '2 days')$q$,
  'BEST_OF_INVALIDE');
select refus('128 places sans l''offre Organisateur',
  $q$select public.modifier_tournoi('9a0a0000-0000-0000-0000-0000000000a1', 'Nouveau nom', 128, 1, 'EUW', now() + interval '2 days', now() + interval '2 days')$q$,
  'OFFRE_ORGANISATEUR_REQUISE');
select refus('Best-of 3 sans l''offre Organisateur',
  $q$select public.modifier_tournoi('9a0a0000-0000-0000-0000-0000000000a1', 'Nouveau nom', 8, 3, 'EUW', now() + interval '2 days', now() + interval '2 days')$q$,
  'OFFRE_ORGANISATEUR_REQUISE');
select refus('Serveur inconnu',
  $q$select public.modifier_tournoi('9a0a0000-0000-0000-0000-0000000000a1', 'Nouveau nom', 8, 1, 'XX', now() + interval '2 days', now() + interval '2 days')$q$,
  'REGION_INVALIDE');
select refus('Date passée',
  $q$select public.modifier_tournoi('9a0a0000-0000-0000-0000-0000000000a1', 'Nouveau nom', 8, 1, 'EUW', now() - interval '1 hour', now() - interval '2 hours')$q$,
  'DATE_PASSEE');
select refus('Check-in après le début',
  $q$select public.modifier_tournoi('9a0a0000-0000-0000-0000-0000000000a1', 'Nouveau nom', 8, 1, 'EUW', now() + interval '2 days', now() + interval '3 days')$q$,
  'CHECKIN_APRES_DEBUT');
select refus('Nom refusé par la modération',
  $q$select public.modifier_tournoi('9a0a0000-0000-0000-0000-0000000000a1', 'Tournoi officiel Najarena', 8, 1, 'EUW', now() + interval '10 days', now() + interval '10 days')$q$,
  'NOM_INTERDIT');
reset role;
select verifie('Aucun refus n''a rien changé ni compté dans la limite',
  (select nom = 'Tournoi 99j A' and capacite = 8 from tournaments where id = '9a0a0000-0000-0000-0000-0000000000a1')
  and (select count(*) = 0 from limites_usage where profile_id = '9a0a0000-0000-0000-0000-000000000001'));

-- Nom seul : la date de publication ne bouge pas.
set role authenticated;
select en_tant_que('9a0a0000-0000-0000-0000-000000000001');
select essai('Oli corrige le nom (même date)',
  $q$select public.modifier_tournoi('9a0a0000-0000-0000-0000-0000000000a1', '  Coupe du jeudi  ', 16, 1, 'EUNE',
     (select debute_le from tournaments where id = '9a0a0000-0000-0000-0000-0000000000a1'),
     (select checkin_ouvre_le from tournaments where id = '9a0a0000-0000-0000-0000-0000000000a1'))$q$,
  'passe');
reset role;
select verifie('Nom (sans espaces autour), capacité et serveur changés ; publication toujours datée d''il y a 3 jours',
  (select nom = 'Coupe du jeudi' and capacite = 16 and region = 'EUNE' and publie_le < now() - interval '2 days'
   from tournaments where id = '9a0a0000-0000-0000-0000-0000000000a1'));

-- Date avancée : la nouvelle date n'est publique que maintenant.
set role authenticated;
select en_tant_que('9a0a0000-0000-0000-0000-000000000001');
select essai('Oli avance le tournoi à dans 2 heures',
  $q$select public.modifier_tournoi('9a0a0000-0000-0000-0000-0000000000a1', 'Coupe du jeudi', 16, 1, 'EUNE', now() + interval '2 hours', now() + interval '1 hour')$q$,
  'passe');
reset role;
select verifie('Date changée : publication reposée à maintenant (plus « publié 24 h avant »)',
  (select publie_le > now() - interval '1 minute' and debute_le < now() + interval '3 hours'
   from tournaments where id = '9a0a0000-0000-0000-0000-0000000000a1')
  and not (select publie_a_temps from public.criteres_tournoi_classe('9a0a0000-0000-0000-0000-0000000000a1')));

-- Brouillon : 128 places gardées sans l'offre, publication toujours nulle.
set role authenticated;
select en_tant_que('9a0a0000-0000-0000-0000-000000000001');
select essai('Oli décale son brouillon en gardant ses 128 places',
  $q$select public.modifier_tournoi('9a0a0000-0000-0000-0000-0000000000a2', 'Tournoi 99j B', 128, 1, 'EUW', now() + interval '6 days', now() + interval '6 days')$q$,
  'passe');
reset role;
select verifie('Brouillon décalé, toujours non publié',
  (select capacite = 128 and statut = 'brouillon' and publie_le is null and debute_le > now() + interval '5 days'
   from tournaments where id = '9a0a0000-0000-0000-0000-0000000000a2'));

set role authenticated;
select en_tant_que('9a0a0000-0000-0000-0000-000000000001');
select refus('Tournoi déjà en check-in',
  $q$select public.modifier_tournoi('9a0a0000-0000-0000-0000-0000000000a3', 'Tournoi 99j C', 8, 1, 'EUW', now() + interval '2 days', now() + interval '2 days')$q$,
  'TOURNOI_NON_MODIFIABLE');
select refus('Une inscription a eu lieu, même retirée depuis',
  $q$select public.modifier_tournoi('9a0a0000-0000-0000-0000-0000000000a4', 'Tournoi 99j D', 8, 1, 'EUW', now() + interval '2 days', now() + interval '2 days')$q$,
  'INSCRIPTIONS_COMMENCEES');
select refus('Tournoi automatique',
  $q$select public.modifier_tournoi('9a0a0000-0000-0000-0000-0000000000a5', 'Daily 99j', 16, 1, 'EUW', now() + interval '2 days', now() + interval '2 days')$q$,
  'TOURNOI_NON_MODIFIABLE');
reset role;

-- Plafond : 10 modifications par 24 h.
insert into limites_usage (profile_id, action)
select '9a0a0000-0000-0000-0000-000000000001', 'modification_tournoi' from generate_series(1, 8);
set role authenticated;
select en_tant_que('9a0a0000-0000-0000-0000-000000000001');
select refus('Onzième modification en 24 h',
  $q$select public.modifier_tournoi('9a0a0000-0000-0000-0000-0000000000a2', 'Tournoi 99j B', 128, 1, 'EUW', now() + interval '7 days', now() + interval '7 days')$q$,
  'LIMITE_ATTEINTE');
reset role;
select verifie('Le refus pour limite n''a rien changé',
  (select debute_le < now() + interval '6 days' + interval '1 minute' from tournaments where id = '9a0a0000-0000-0000-0000-0000000000a2'));
