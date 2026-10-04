-- Données de test et outils d'essai (scripts/tester-base.sh). Exécuté en
-- superutilisateur, après docs/schema.sql.

insert into games (id, slug, nom) values (1, 'lol', 'League of Legends');
insert into seasons (game_id, numero, nom, debut_le, fin_le, est_courante)
values (1, 1, 'Saison 1', '2026-09-18T00:00:00Z', '2026-12-18T00:00:00Z', true);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@test', '{"pseudo":"Alice","slug":"alice"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@test',   '{"pseudo":"Bob","slug":"bob"}'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@test', '{"pseudo":"Carol","slug":"carol"}'),
  ('00000000-0000-0000-0000-00000000000d', 'dave@test',  '{"pseudo":"Dave","slug":"dave"}'),
  ('00000000-0000-0000-0000-00000000000e', 'eve@test',   '{"pseudo":"Eve","slug":"eve"}'),
  ('00000000-0000-0000-0000-00000000000f', 'frank@test', '{"pseudo":"Frank","slug":"frank"}'),
  ('00000000-0000-0000-0000-000000000010', 'gina@test',  '{"pseudo":"Gina","slug":"gina"}');

-- Comptes Riot : Gina et Eve vérifiées sur EUW, Carol vérifiée sur NA,
-- Frank lié mais pas encore vérifié.
insert into game_accounts (profile_id, game_id, puuid, riot_game_name, riot_tag_line, region, est_principal, verifie_le, methode_verification) values
  ('00000000-0000-0000-0000-000000000010', 1, 'P-GINA',  'Gina',  'EUW', 'EUW', true, now(), 'icone_profil'),
  ('00000000-0000-0000-0000-00000000000e', 1, 'P-EVE',   'Eve',   'EUW', 'EUW', true, now(), 'icone_profil'),
  ('00000000-0000-0000-0000-00000000000c', 1, 'P-CAROL', 'Carol', 'NA1', 'NA',  true, now(), 'icone_profil'),
  ('00000000-0000-0000-0000-00000000000f', 1, 'P-FRANK', 'Frank', 'EUW', 'EUW', true, null,  'icone_profil');

-- Dave a l'offre Organisateur.
insert into comptes_offres (profile_id, offre) values ('00000000-0000-0000-0000-00000000000d', 'organisateur');

-- Le compte Riot de Bob, pas encore lié à Najarena, porte l'icône 7.
-- T_OUVERT : ouvert, 4 places. T_COMPLET : ouvert, 4 places déjà prises.
-- T_EN_COURS : commencé. T_CHECKIN : check-in ouvert.
insert into tournaments (id, game_id, season_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut)
select v.id::uuid, 1, (select id from seasons where est_courante), '00000000-0000-0000-0000-00000000000a', v.slug, v.slug, '1v1', 4, 'EUW',
       now() + interval '1 day', v.checkin, v.statut::tournament_status
from (values
  ('10000000-0000-0000-0000-000000000001', 't-ouvert',   now() + interval '20 hours', 'ouvert'),
  ('10000000-0000-0000-0000-000000000002', 't-complet',  now() + interval '20 hours', 'ouvert'),
  ('10000000-0000-0000-0000-000000000003', 't-en-cours', now() - interval '2 hours',  'en_cours'),
  ('10000000-0000-0000-0000-000000000004', 't-checkin',  now() - interval '10 minutes','checkin')
) as v(id, slug, checkin, statut);

insert into registrations (tournament_id, profile_id, statut) values
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b', 'inscrit'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000c', 'inscrit'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000d', 'inscrit'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000f', 'inscrit'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000b', 'confirme'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000c', 'confirme'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000e', 'inscrit'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000e', 'inscrit');

-- Une équipe d'Alice (capitaine), Bob invité.
insert into teams (id, game_id, slug, nom, tag, capitaine_id) values
  ('20000000-0000-0000-0000-000000000001', 1, 'equipe-alice', 'Equipe Alice', 'ALI', '00000000-0000-0000-0000-00000000000a'),
  ('20000000-0000-0000-0000-000000000002', 1, 'equipe-dave', 'Equipe Dave', 'DAV', '00000000-0000-0000-0000-00000000000d');
insert into team_members (team_id, profile_id, role, accepte_le) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'Capitaine', now()),
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', null, null),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000d', 'Capitaine', now());

-- Une conversation Dave (organisateur) ↔ Bob.
insert into conversations (id, profile_a, profile_b) values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000b');
insert into messages (id, conversation_id, expediteur_id, contenu) values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d', 'Salut, tu cherches une équipe ?'),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'Oui !');

-- Un bracket commencé dans T_CHECKIN... non : dans T_EN_COURS, match Bob-Carol en cours.
insert into registrations (tournament_id, profile_id, statut) values
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000b', 'confirme'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000c', 'confirme');
insert into matches (id, tournament_id, tour, position, statut, demarre_le) values
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 1, 1, 'en_cours', now() - interval '5 minutes');
insert into match_participants (match_id, profile_id, slot) values
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 1),
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', 2);
insert into disputes (id, match_id, ouvert_par, motif) values
  ('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'Carol ne s''est pas présentée');

update profiles set discord_id = '111' where id = '00000000-0000-0000-0000-00000000000b';

-- Outils d'essai : exécutent une instruction sous l'identité courante.
-- essai : « passe » si au moins une ligne est touchée ou renvoyée, « bloque »
-- si rien ne l'est ou si la base refuse.
create or replace function public.essai(p_libelle text, p_sql text, p_attendu text)
returns void language plpgsql as $$
declare n bigint; r text;
begin
  begin
    execute p_sql;
    get diagnostics n = row_count;
    r := case when n > 0 then 'passe' else 'bloque' end;
  exception when others then
    r := 'bloque';
    p_libelle := p_libelle || '  [' || sqlerrm || ']';
  end;
  raise notice '% %  (attendu : %, obtenu : %)',
    case when r = p_attendu then 'OK   ' else 'ÉCHEC' end, p_libelle, p_attendu, r;
end $$;
grant execute on function public.essai(text, text, text) to anon, authenticated, service_role;

-- verifie : une condition qui doit être vraie.
create or replace function public.verifie(p_libelle text, p_condition boolean)
returns void language plpgsql as $$
begin
  raise notice '% %', case when coalesce(p_condition, false) then 'OK   ' else 'ÉCHEC' end, p_libelle;
end $$;
grant execute on function public.verifie(text, boolean) to anon, authenticated, service_role;

-- refus : l'instruction doit échouer avec exactement ce message d'erreur
-- (distingue « pseudo déjà pris » de « pseudo invalide », par exemple).
create or replace function public.refus(p_libelle text, p_sql text, p_erreur text)
returns void language plpgsql as $$
declare r text := '(aucune erreur)';
begin
  begin
    execute p_sql;
  exception when others then
    r := sqlerrm;
  end;
  raise notice '% %  (erreur attendue : %, obtenue : %)',
    case when r = p_erreur then 'OK   ' else 'ÉCHEC' end, p_libelle, p_erreur, r;
end $$;
grant execute on function public.refus(text, text, text) to anon, authenticated, service_role;

create or replace function public.en_tant_que(p uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', p::text, false);
$$;
grant execute on function public.en_tant_que(uuid) to anon, authenticated, service_role;
