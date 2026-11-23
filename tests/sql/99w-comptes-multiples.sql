-- Comptes multiples (contrôle de sécurité du 21/11/2026, M4 ; choix du
-- porteur du 22/11/2026) : niveau Riot gardé avec le verdict, et 5 duels
-- classés au plus par joueur et par 24 h.
\set ON_ERROR_STOP 0

insert into auth.users (id, email, raw_user_meta_data)
select ('b22b000' || n || '-0000-0000-0000-000000000000')::uuid, 'p99w' || n || '@test',
       json_build_object('pseudo', 'Multi99w' || n, 'slug', 'multi99w' || n)::jsonb
from generate_series(1, 8) n;
insert into game_accounts (profile_id, game_id, puuid, riot_game_name, riot_tag_line, region, est_principal, verifie_le, methode_verification)
select ('b22b000' || n || '-0000-0000-0000-000000000000')::uuid, 1, 'P99W-' || n, 'Multi' || n, 'EUW', 'EUW', true, now(), 'icone_profil'
from generate_series(1, 8) n;
insert into admins (profile_id) values ('00000000-0000-0000-0000-00000000000d') on conflict do nothing;

-- Un duel entre deux joueurs, créé comme le ferait l'acceptation d'un défi,
-- puis terminé (au plus 3 défis en cours par joueur). Renvoie « classé ».
create or replace function pg_temp.duel_99w(p_a int, p_b int, p_terminer boolean default true)
returns boolean
language plpgsql
as $$
declare
  v_defi uuid;
  v_slug text;
  v_tournoi uuid;
  v_classe boolean;
begin
  insert into defis (lanceur_id, adversaire_id, expire_le)
  values (('b22b000' || p_a || '-0000-0000-0000-000000000000')::uuid,
          ('b22b000' || p_b || '-0000-0000-0000-000000000000')::uuid, now() + interval '1 day')
  returning id into v_defi;
  v_slug := public.creer_duel(v_defi);
  select id, compte_pour_classement into v_tournoi, v_classe from tournaments where slug = v_slug;
  if p_terminer then
    update matches set statut = 'termine' where tournament_id = v_tournoi;
    update tournaments set statut = 'termine' where id = v_tournoi;
  end if;
  return v_classe;
end;
$$;

-- ---- Plafond de 5 duels classés par joueur et par 24 h ----
select verifie('1er duel classé du joueur 1', pg_temp.duel_99w(1, 2));
select verifie('2e duel classé', pg_temp.duel_99w(1, 3));
select verifie('3e duel classé', pg_temp.duel_99w(1, 4));
select verifie('4e duel classé', pg_temp.duel_99w(1, 5));
select verifie('5e duel classé', pg_temp.duel_99w(1, 6));
select verifie('6e duel du jour, contre un nouvel adversaire : en amical', not pg_temp.duel_99w(1, 7));
select verifie('Son adversaire, lui, peut encore jouer classé ailleurs', pg_temp.duel_99w(7, 8));
select verifie('Deuxième duel de la même paire en 24 h : toujours en amical', not pg_temp.duel_99w(7, 8));

-- Un duel annulé (aucune partie retrouvée) ne compte pas dans les 5.
update tournaments set statut = 'annule'
where id = (select t.id from tournaments t join registrations r on r.tournament_id = t.id
            where t.nature = 'defi' and r.profile_id = 'b22b0006-0000-0000-0000-000000000000');
select verifie('Après l''annulation d''un de ses duels classés, le joueur 1 rejoue classé', pg_temp.duel_99w(1, 8));
select verifie('Puis de nouveau en amical (5 duels classés non annulés)', not pg_temp.duel_99w(1, 6));

-- 24 h plus tard, le compteur repart.
update tournaments set cree_le = cree_le - interval '25 hours'
where id in (select t.id from tournaments t join registrations r on r.tournament_id = t.id
             where t.nature = 'defi' and r.profile_id = 'b22b0001-0000-0000-0000-000000000000');
select verifie('Le lendemain, ses duels sont de nouveau classés', pg_temp.duel_99w(1, 2));

set role authenticated;
select en_tant_que('b22b0001-0000-0000-0000-000000000000');
select refus('Un joueur n''appelle pas le compteur de duels lui-même',
  $q$select public.duel_classe_possible('b22b0001-0000-0000-0000-000000000000', 'b22b0002-0000-0000-0000-000000000000')$q$,
  'permission denied for function duel_classe_possible');
reset role;

-- ---- Niveau Riot gardé avec le verdict ----
select pg_temp.duel_99w(3, 4, false);
select essai('Verdict lu chez Riot avec le niveau des comptes',
  $q$select public.enregistrer_verdict_historique(
       (select m.id from matches m join tournaments t on t.id = m.tournament_id
        where t.nature = 'defi' and t.statut = 'en_cours'
          and exists (select 1 from match_participants p where p.match_id = m.id and p.profile_id = 'b22b0003-0000-0000-0000-000000000000')
          and exists (select 1 from match_participants p where p.match_id = m.id and p.profile_id = 'b22b0004-0000-0000-0000-000000000000')),
       'b22b0003-0000-0000-0000-000000000000', 'EUW1_99W1', 12)$q$,
  'passe');
select verifie('Le niveau le plus bas des deux comptes est gardé avec le verdict',
  (select niveau_compte_min = 12 from match_verdicts where riot_match_id = 'EUW1_99W1'));

select pg_temp.duel_99w(5, 6, false);
select refus('Un niveau impossible est refusé',
  $q$select public.enregistrer_verdict_historique(
       (select m.id from matches m join tournaments t on t.id = m.tournament_id
        where t.nature = 'defi' and t.statut = 'en_cours'
          and exists (select 1 from match_participants p where p.match_id = m.id and p.profile_id = 'b22b0005-0000-0000-0000-000000000000')),
       'b22b0005-0000-0000-0000-000000000000', 'EUW1_99W2', -3)$q$,
  'NIVEAU_COMPTE_INVALIDE');
select refus('Un verdict 1v1 lu chez Riot sans niveau de compte est refusé (23/11/2026)',
  $q$select public.enregistrer_verdict_historique(
       p_match_id => (select m.id from matches m join tournaments t on t.id = m.tournament_id
        where t.nature = 'defi' and t.statut = 'en_cours'
          and exists (select 1 from match_participants p where p.match_id = m.id and p.profile_id = 'b22b0005-0000-0000-0000-000000000000')),
       p_gagnant_id => 'b22b0006-0000-0000-0000-000000000000', p_riot_match_id => 'EUW1_99W3')$q$,
  'NIVEAU_COMPTE_REQUIS');
select verifie('Sans niveau : rien n''est écrit, ni verdict ni partie réservée (le match attend l''organisateur)',
  not exists (select 1 from match_verdicts where riot_match_id = 'EUW1_99W3')
  and not exists (select 1 from parties_utilisees where riot_match_id = 'EUW1_99W3'));
select refus('Un verdict écrit ne se modifie plus : ni son niveau de compte…',
  $q$update match_verdicts set niveau_compte_min = 40 where riot_match_id = 'EUW1_99W1'$q$,
  'VERDICT_IMMUABLE');
select refus('… ni son match',
  $q$update match_verdicts set match_id = gen_random_uuid() where riot_match_id = 'EUW1_99W1'$q$,
  'VERDICT_IMMUABLE');
select verifie('Le verdict est resté tel quel',
  (select niveau_compte_min = 12 from match_verdicts where riot_match_id = 'EUW1_99W1'));
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-00000000000d');
select essai('Une décision manuelle n''a pas besoin de niveau',
  $q$select public.enregistrer_verdict_manuel(
       (select m.id from matches m join tournaments t on t.id = m.tournament_id
        where t.nature = 'defi' and t.statut = 'en_cours'
          and exists (select 1 from match_participants p where p.match_id = m.id and p.profile_id = 'b22b0005-0000-0000-0000-000000000000')),
       'b22b0005-0000-0000-0000-000000000000', 'Partie jouée hors Riot') where true$q$,
  'passe');
reset role;

set role authenticated;
select en_tant_que('b22b0003-0000-0000-0000-000000000000');
select refus('Un joueur n''écrit pas de verdict lu chez Riot',
  $q$select public.enregistrer_verdict_historique(gen_random_uuid(), 'b22b0003-0000-0000-0000-000000000000', 'EUW1_99W4', 400)$q$,
  'permission denied for function enregistrer_verdict_historique');
select verifie('Le niveau gardé est lisible avec le verdict (preuve publique)',
  (select niveau_compte_min = 12 from match_verdicts where riot_match_id = 'EUW1_99W1'));
reset role;

-- ---- Créations de duel simultanées (contrôle de sécurité du 22/11/2026) ----
select verifie('creer_duel prend le verrou de création de duel',
  (select pg_get_functiondef('public.creer_duel(uuid)'::regprocedure) like '%pg_advisory_xact_lock(hashtext(''najarena:creation-duel''))%'));
select verifie('je_suis_la_division prend le même verrou',
  (select pg_get_functiondef('public.je_suis_la_division(uuid)'::regprocedure) like '%pg_advisory_xact_lock(hashtext(''najarena:creation-duel''))%'));
select verifie('L''arène aussi, avant tout le reste (rejoindre, apparier, passage périodique)',
  (select bool_and(position('pg_advisory_xact_lock(hashtext(''najarena:creation-duel''))' in d)
                   < least(coalesce(nullif(position('controler_lanceur_defi' in d), 0), 1000000),
                           coalesce(nullif(position('arene:' in d), 0), 1000000),
                           coalesce(nullif(position('delete from public.file_arene' in d), 0), 1000000))
                   and position('pg_advisory_xact_lock(hashtext(''najarena:creation-duel''))' in d) > 0)
   from (select pg_get_functiondef(f::regprocedure) as d
         from unnest(array['public.rejoindre_arene(text)', 'public.apparier_joueur_arene(uuid)', 'public.apparier_arene()']) f) x));

-- Preuve par l'exemple, quand dblink est disponible : pendant qu'une
-- session tient le verrou, une acceptation venue d'une autre session
-- attend (coupée ici au bout de 500 ms) au lieu de passer.
do $$ begin create extension if not exists dblink; exception when others then null; end $$;
insert into defis (id, lanceur_id, adversaire_id, expire_le) values
  ('b22bdef1-0000-0000-0000-000000000000', 'b22b0002-0000-0000-0000-000000000000', 'b22b0004-0000-0000-0000-000000000000', now() + interval '1 day');
create or replace function pg_temp.acceptation_concurrente()
returns text
language plpgsql
as $$
declare
  v_connexion text;
begin
  if not exists (select 1 from pg_extension where extname = 'dblink') then
    return 'indisponible';
  end if;
  v_connexion := format('host=%s port=%s dbname=%s user=%s',
    split_part(current_setting('unix_socket_directories'), ',', 1), current_setting('port'), current_database(), current_user);
  perform pg_advisory_xact_lock(hashtext('najarena:creation-duel'));
  begin
    perform * from dblink(v_connexion,
      'set statement_timeout = 500; select public.creer_duel(''b22bdef1-0000-0000-0000-000000000000'')') as t(slug text);
    return 'passe';
  exception
    -- L'attente coupée par statement_timeout (« query_canceled » n'est pas
    -- compris dans « others »).
    when query_canceled then
      return 'attend';
    when others then
      return 'indisponible';
  end;
end;
$$;
-- dblink est requis (image postgres:16 de la CI, base locale) : un test
-- sauté en silence ne protégerait plus rien.
select verifie('Une acceptation simultanée attend la fin de la première',
  pg_temp.acceptation_concurrente() = 'attend');

-- Même preuve pour l'arène : un joueur qui la rejoint pendant une création
-- de duel attend dès le début (avant de verrouiller son profil).
create or replace function pg_temp.arene_concurrente()
returns text
language plpgsql
as $$
declare
  v_connexion text;
begin
  v_connexion := format('host=%s port=%s dbname=%s user=%s',
    split_part(current_setting('unix_socket_directories'), ',', 1), current_setting('port'), current_database(), current_user);
  perform pg_advisory_xact_lock(hashtext('najarena:creation-duel'));
  begin
    perform * from dblink(v_connexion,
      'set statement_timeout = 500; set role authenticated; '
      || 'select set_config(''request.jwt.claim.sub'', ''b22b0007-0000-0000-0000-000000000000'', false); '
      || 'select public.rejoindre_arene()') as t(slug text);
    return 'passe';
  exception
    when query_canceled then
      return 'attend';
    when others then
      return 'erreur : ' || sqlerrm;
  end;
end;
$$;
select verifie('Rejoindre l''arène pendant une création de duel attend son tour',
  pg_temp.arene_concurrente() = 'attend');
