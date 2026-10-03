-- Agents libres en 5v5 (audit N23).
\set ON_ERROR_STOP 0

-- Dix joueurs sans équipe, vérifiés sur EUW ; un tournoi 5v5 d'Alice,
-- check-in ouvert.
insert into auth.users (id, email, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000000b' || n)::uuid, 'agent' || n || '@test',
       jsonb_build_object('pseudo', 'Agent' || n, 'slug', 'agent' || n)
from generate_series(0, 9) n;
insert into game_accounts (profile_id, game_id, puuid, riot_game_name, riot_tag_line, region, est_principal, verifie_le, methode_verification)
select ('00000000-0000-0000-0000-0000000000b' || n)::uuid, 1, 'P-AGENT-' || n, 'Agent' || n, 'EUW', 'EUW', true, now(), 'icone_profil'
from generate_series(0, 9) n;
insert into tournaments (id, game_id, season_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, compte_pour_classement)
values ('94e00000-0000-0000-0000-000000000001', 1, (select id from seasons where est_courante), '00000000-0000-0000-0000-00000000000a', 't-agents', 'Coupe des agents', '5v5', 4, 'EUW', now() + interval '1 day', now() - interval '1 minute', 'ouvert', false);

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000000b0');
select refus('Agent0 s''inscrit en agent libre à un tournoi 1v1', $q$select public.s_inscrire_agent_libre('10000000-0000-0000-0000-000000000001', 'mid')$q$, 'TOURNOI_EN_SOLO');
select refus('Agent0 choisit un rôle inconnu', $q$select public.s_inscrire_agent_libre('94e00000-0000-0000-0000-000000000001', 'coach')$q$, 'ROLE_INVALIDE');
select essai('Agent0 s''inscrit en agent libre (mid)', $q$select 1 where public.s_inscrire_agent_libre('94e00000-0000-0000-0000-000000000001', 'mid')$q$, 'passe');
select refus('Agent0 s''inscrit une deuxième fois', $q$select public.s_inscrire_agent_libre('94e00000-0000-0000-0000-000000000001', 'mid')$q$, 'DEJA_INSCRIT');
select essai('Agent0 écrit lui-même sa place dans une équipe', $q$update agents_libres set statut = 'place' where profile_id = '00000000-0000-0000-0000-0000000000b0'$q$, 'bloque');
select en_tant_que('00000000-0000-0000-0000-0000000000b1');
select essai('Agent1 s''inscrit en agent libre (top)', $q$select 1 where public.s_inscrire_agent_libre('94e00000-0000-0000-0000-000000000001', 'top')$q$, 'passe');
select en_tant_que('00000000-0000-0000-0000-0000000000b2');
select essai('Agent2 s''inscrit en agent libre (jungle)', $q$select 1 where public.s_inscrire_agent_libre('94e00000-0000-0000-0000-000000000001', 'jungle')$q$, 'passe');
select en_tant_que('00000000-0000-0000-0000-0000000000b3');
select essai('Agent3 s''inscrit en agent libre (adc)', $q$select 1 where public.s_inscrire_agent_libre('94e00000-0000-0000-0000-000000000001', 'adc')$q$, 'passe');
select en_tant_que('00000000-0000-0000-0000-0000000000b4');
select essai('Agent4 s''inscrit en agent libre (support)', $q$select 1 where public.s_inscrire_agent_libre('94e00000-0000-0000-0000-000000000001', 'support')$q$, 'passe');
select en_tant_que('00000000-0000-0000-0000-0000000000b5');
select essai('Agent5 s''inscrit en agent libre (mid)', $q$select 1 where public.s_inscrire_agent_libre('94e00000-0000-0000-0000-000000000001', 'mid')$q$, 'passe');
select en_tant_que('00000000-0000-0000-0000-0000000000b6');
select essai('Agent6 s''inscrit en agent libre (top)', $q$select 1 where public.s_inscrire_agent_libre('94e00000-0000-0000-0000-000000000001', 'top')$q$, 'passe');
select en_tant_que('00000000-0000-0000-0000-0000000000b7');
select essai('Agent7 s''inscrit en agent libre (jungle)', $q$select 1 where public.s_inscrire_agent_libre('94e00000-0000-0000-0000-000000000001', 'jungle')$q$, 'passe');
select en_tant_que('00000000-0000-0000-0000-0000000000b8');
select essai('Agent8 s''inscrit en agent libre (adc)', $q$select 1 where public.s_inscrire_agent_libre('94e00000-0000-0000-0000-000000000001', 'adc')$q$, 'passe');
select en_tant_que('00000000-0000-0000-0000-0000000000b9');
select essai('Agent9 s''inscrit en agent libre (support)', $q$select 1 where public.s_inscrire_agent_libre('94e00000-0000-0000-0000-000000000001', 'support')$q$, 'passe');
select en_tant_que('00000000-0000-0000-0000-0000000000b0');
select essai('Agent0 confirme sa présence', $q$select 1 where public.confirmer_agent_libre('94e00000-0000-0000-0000-000000000001')$q$, 'passe');
select en_tant_que('00000000-0000-0000-0000-0000000000b1');
select essai('Agent1 confirme sa présence', $q$select 1 where public.confirmer_agent_libre('94e00000-0000-0000-0000-000000000001')$q$, 'passe');
select en_tant_que('00000000-0000-0000-0000-0000000000b2');
select essai('Agent2 confirme sa présence', $q$select 1 where public.confirmer_agent_libre('94e00000-0000-0000-0000-000000000001')$q$, 'passe');
select en_tant_que('00000000-0000-0000-0000-0000000000b3');
select essai('Agent3 confirme sa présence', $q$select 1 where public.confirmer_agent_libre('94e00000-0000-0000-0000-000000000001')$q$, 'passe');
select en_tant_que('00000000-0000-0000-0000-0000000000b4');
select essai('Agent4 confirme sa présence', $q$select 1 where public.confirmer_agent_libre('94e00000-0000-0000-0000-000000000001')$q$, 'passe');
select en_tant_que('00000000-0000-0000-0000-0000000000b5');
select essai('Agent5 confirme sa présence', $q$select 1 where public.confirmer_agent_libre('94e00000-0000-0000-0000-000000000001')$q$, 'passe');
select en_tant_que('00000000-0000-0000-0000-0000000000b6');
select essai('Agent6 confirme sa présence', $q$select 1 where public.confirmer_agent_libre('94e00000-0000-0000-0000-000000000001')$q$, 'passe');
select en_tant_que('00000000-0000-0000-0000-0000000000b7');
select essai('Agent7 confirme sa présence', $q$select 1 where public.confirmer_agent_libre('94e00000-0000-0000-0000-000000000001')$q$, 'passe');
select en_tant_que('00000000-0000-0000-0000-0000000000b8');
select essai('Agent8 confirme sa présence', $q$select 1 where public.confirmer_agent_libre('94e00000-0000-0000-0000-000000000001')$q$, 'passe');
select en_tant_que('00000000-0000-0000-0000-0000000000b5');
select refus('Un agent forme lui-même les équipes', $q$select public.former_equipes_agents_libres('94e00000-0000-0000-0000-000000000001', '[["00000000-0000-0000-0000-0000000000b0","00000000-0000-0000-0000-0000000000b1","00000000-0000-0000-0000-0000000000b2","00000000-0000-0000-0000-0000000000b3","00000000-0000-0000-0000-0000000000b4"]]'::jsonb)$q$, 'NON_ORGANISATEUR');
select en_tant_que('00000000-0000-0000-0000-00000000000a');
select refus('Alice forme une équipe avec un agent qui n''a pas confirmé', $q$select public.former_equipes_agents_libres('94e00000-0000-0000-0000-000000000001', '[["00000000-0000-0000-0000-0000000000b5","00000000-0000-0000-0000-0000000000b6","00000000-0000-0000-0000-0000000000b7","00000000-0000-0000-0000-0000000000b8","00000000-0000-0000-0000-0000000000b9"]]'::jsonb)$q$, 'AGENT_NON_CONFIRME');
select refus('Alice forme une équipe de quatre', $q$select public.former_equipes_agents_libres('94e00000-0000-0000-0000-000000000001', '[["00000000-0000-0000-0000-0000000000b5","00000000-0000-0000-0000-0000000000b6","00000000-0000-0000-0000-0000000000b7","00000000-0000-0000-0000-0000000000b8"]]'::jsonb)$q$, 'ALIGNEMENT_DE_CINQ');
select essai('Alice forme une équipe de cinq agents confirmés', $q$select 1 where public.former_equipes_agents_libres('94e00000-0000-0000-0000-000000000001', '[["00000000-0000-0000-0000-0000000000b0","00000000-0000-0000-0000-0000000000b1","00000000-0000-0000-0000-0000000000b2","00000000-0000-0000-0000-0000000000b3","00000000-0000-0000-0000-0000000000b4"]]'::jsonb) = 1$q$, 'passe');
select en_tant_que('00000000-0000-0000-0000-0000000000b0');
select refus('Agent0, placé, se réinscrit en agent libre', $q$select public.s_inscrire_agent_libre('94e00000-0000-0000-0000-000000000001', 'mid')$q$, 'DEJA_DANS_UNE_EQUIPE');
select en_tant_que('00000000-0000-0000-0000-0000000000b8');
select essai('Agent8 quitte la liste des agents libres', $q$select 1 where public.quitter_agents_libres('94e00000-0000-0000-0000-000000000001')$q$, 'passe');
reset role;

select verifie('Équipe « Agents libres 1 » inscrite et confirmée, capitaine Agent0, cinq joueurs alignés, agents placés',
  (select r.equipe_nom = 'Agents libres 1' and r.equipe_tag = 'AL1' and r.statut = 'confirme' and r.team_id is null
      and (select count(*) from alignements a where a.registration_id = r.id) = 5
      and (select count(*) from agents_libres g where g.registration_id = r.id and g.statut = 'place') = 5
   from registrations r where r.tournament_id = '94e00000-0000-0000-0000-000000000001' and r.profile_id = '00000000-0000-0000-0000-0000000000b0'));
select verifie('Agent8 n''est plus agent libre', not exists (select 1 from agents_libres where profile_id = '00000000-0000-0000-0000-0000000000b8'));

-- Agent6 est suspendu, Agent7 délie son compte Riot : ils quittent la liste.
insert into suspensions (profile_id, motif) values ('00000000-0000-0000-0000-0000000000b6', 'Essai agents libres');
delete from game_accounts where profile_id = '00000000-0000-0000-0000-0000000000b7';
select verifie('Agents suspendu ou sans compte Riot retirés de la liste',
  not exists (select 1 from agents_libres where profile_id in ('00000000-0000-0000-0000-0000000000b6', '00000000-0000-0000-0000-0000000000b7')));
select verifie('Les autres agents restent inscrits',
  (select count(*) = 2 from agents_libres where tournament_id = '94e00000-0000-0000-0000-000000000001' and statut <> 'place'));

