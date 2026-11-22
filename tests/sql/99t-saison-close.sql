-- Tournoi clos après le changement de saison (contrôle de sécurité
-- complet du 21/11/2026, M2) : un rating ne s'écrit que dans la saison en
-- cours, jamais dans une saison archivée.
\set ON_ERROR_STOP 0

insert into auth.users (id, email, raw_user_meta_data)
select ('af0f000' || n || '-0000-0000-0000-000000000000')::uuid, 'p99t' || n || '@test',
       json_build_object('pseudo', 'Saison99t' || n, 'slug', 'saison99t' || n)::jsonb
from generate_series(0, 1) n;
select id as courante from seasons where game_id = 1 and est_courante \gset
select id as passee from seasons where game_id = 1 and not est_courante order by numero limit 1 \gset
insert into tournaments (id, game_id, season_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut) values
  ('af0f0000-0000-0000-0000-0000000000a1', 1, :'passee', 'af0f0000-0000-0000-0000-000000000000', 'saison-99t', 'Coupe 99t', '1v1', 8, 'EUW', now() - interval '2 days', now() - interval '2 days', 'ouvert');
alter table tournaments disable trigger controle_classement_tournoi;
update tournaments set classe = true where id = 'af0f0000-0000-0000-0000-0000000000a1';
alter table tournaments enable trigger controle_classement_tournoi;

set role service_role;
select refus('Points d''un tournoi dans une saison archivée : refusés',
  format($q$select public.cloturer_rating_joueur('af0f0001-0000-0000-0000-000000000000'::uuid, 1::smallint, %L::uuid,
     'af0f0000-0000-0000-0000-0000000000a1'::uuid, 1500, 350, 0.06, 1600, 300, 0.06, 1, 'tournoi')$q$, :'passee'),
  'SAISON_CLOSE');
select essai('Dans la saison en cours : écrits',
  format($q$select public.cloturer_rating_joueur('af0f0001-0000-0000-0000-000000000000'::uuid, 1::smallint, %L::uuid,
     'af0f0000-0000-0000-0000-0000000000a1'::uuid, 1500, 350, 0.06, 1600, 300, 0.06, 1, 'tournoi')$q$, :'courante'),
  'passe');
reset role;
select verifie('La saison archivée n''a reçu aucune ligne',
  not exists (select 1 from ratings where profile_id = 'af0f0001-0000-0000-0000-000000000000' and season_id = :'passee')
  and not exists (select 1 from rating_events where profile_id = 'af0f0001-0000-0000-0000-000000000000' and season_id = :'passee'));
select verifie('La saison en cours a reçu les points',
  (select rating = 1600 from ratings where profile_id = 'af0f0001-0000-0000-0000-000000000000' and season_id = :'courante'));
set role service_role;
select verifie('Une relance après coup ne recrédite rien, même vers l''ancienne saison',
  (select public.cloturer_rating_joueur('af0f0001-0000-0000-0000-000000000000'::uuid, 1::smallint, :'passee'::uuid,
     'af0f0000-0000-0000-0000-0000000000a1'::uuid, 1500, 350, 0.06, 1600, 300, 0.06, 1, 'tournoi')) = false);
reset role;

-- Décroissance d'inactivité : jamais sur une saison archivée (contre-contrôle).
insert into ratings (profile_id, game_id, season_id, rating, rd, volatilite, matchs_joues)
values ('af0f0001-0000-0000-0000-000000000000', 1, :'passee', 1700, 140, 0.06, 12);
set role service_role;
select verifie('Décroissance demandée sur la saison archivée : rien n''est écrit',
  (select public.appliquer_decroissance_rd('af0f0001-0000-0000-0000-000000000000'::uuid, 1::smallint, :'passee'::uuid, 1700, 140, 160, 0.06)) = false);
reset role;
select verifie('Son classement final archivé est intact (RD 140, classé)',
  (select rd = 140 and est_classe from ratings where profile_id = 'af0f0001-0000-0000-0000-000000000000' and season_id = :'passee')
  and not exists (select 1 from rating_events where profile_id = 'af0f0001-0000-0000-0000-000000000000' and season_id = :'passee'));

-- Saison suivante déjà commencée mais pas encore activée : la clôture attend.
insert into seasons (id, game_id, numero, nom, debut_le, fin_le) values
  ('af0f0000-0000-0000-0000-0000000000c2', 1, 2, 'Saison 99t suivante', now() - interval '1 hour', now() + interval '90 days');
insert into tournaments (id, game_id, season_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut) values
  ('af0f0000-0000-0000-0000-0000000000a2', 1, :'courante', 'af0f0000-0000-0000-0000-000000000000', 'saison-99t-b', 'Coupe 99t B', '1v1', 8, 'EUW', now() - interval '2 days', now() - interval '2 days', 'ouvert');
alter table tournaments disable trigger controle_classement_tournoi;
update tournaments set classe = true where id = 'af0f0000-0000-0000-0000-0000000000a2';
alter table tournaments enable trigger controle_classement_tournoi;
set role service_role;
select refus('Pendant la bascule, la clôture est refusée (reprise après la bascule)',
  format($q$select public.cloturer_rating_joueur('af0f0001-0000-0000-0000-000000000000'::uuid, 1::smallint, %L::uuid,
     'af0f0000-0000-0000-0000-0000000000a2'::uuid, 1600, 300, 0.06, 1650, 280, 0.06, 1, 'tournoi')$q$, :'courante'),
  'SAISON_EN_BASCULE');
reset role;
delete from seasons where id = 'af0f0000-0000-0000-0000-0000000000c2';
