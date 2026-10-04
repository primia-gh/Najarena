-- Scrims vérifiés entre équipes (audit N22).
\set ON_ERROR_STOP 0

-- Équipe S : Ana (capitaine) et quatre coéquipiers ; équipe T : Bob5 et
-- quatre coéquipiers. Tous vérifiés sur EUW. Un administrateur arbitre.
insert into auth.users (id, email, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000000a' || n)::uuid, 'scrim' || n || '@test',
       jsonb_build_object('pseudo', 'Scrim' || n, 'slug', 'scrim' || n)
from generate_series(0, 9) n;
insert into game_accounts (profile_id, game_id, puuid, riot_game_name, riot_tag_line, region, est_principal, verifie_le, methode_verification)
select ('00000000-0000-0000-0000-0000000000a' || n)::uuid, 1, 'P-SCRIM-' || n, 'Scrim' || n, 'EUW', 'EUW', true, now(), 'icone_profil'
from generate_series(0, 9) n;
insert into teams (id, game_id, slug, nom, tag, capitaine_id) values
  ('94d00000-0000-0000-0000-00000000000a', 1, 'equipe-scrim-s', 'Equipe Sud', 'SUD', '00000000-0000-0000-0000-0000000000a0'),
  ('94d00000-0000-0000-0000-00000000000b', 1, 'equipe-scrim-t', 'Equipe Terre', 'TER', '00000000-0000-0000-0000-0000000000a5');
insert into team_members (team_id, profile_id, accepte_le)
select '94d00000-0000-0000-0000-00000000000a'::uuid, ('00000000-0000-0000-0000-0000000000a' || n)::uuid, now() from generate_series(0, 4) n
union all
select '94d00000-0000-0000-0000-00000000000b'::uuid, ('00000000-0000-0000-0000-0000000000a' || n)::uuid, now() from generate_series(5, 9) n;
insert into admins (profile_id) values ('00000000-0000-0000-0000-00000000000d') on conflict do nothing;

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000000a0');
select refus('Ana propose un scrim dans cinq minutes',
  $q$select public.proposer_scrim('94d00000-0000-0000-0000-00000000000a', '94d00000-0000-0000-0000-00000000000b', now() + interval '5 minutes', 1::smallint, array['00000000-0000-0000-0000-0000000000a0','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-0000000000a4']::uuid[])$q$, 'DATE_SCRIM_INVALIDE');
select refus('Ana propose un scrim en Bo2',
  $q$select public.proposer_scrim('94d00000-0000-0000-0000-00000000000a', '94d00000-0000-0000-0000-00000000000b', now() + interval '1 day', 2::smallint, array['00000000-0000-0000-0000-0000000000a0','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-0000000000a4']::uuid[])$q$, 'FORMAT_INVALIDE');
select refus('Ana propose un scrim à sa propre équipe',
  $q$select public.proposer_scrim('94d00000-0000-0000-0000-00000000000a', '94d00000-0000-0000-0000-00000000000a', now() + interval '1 day', 1::smallint, array['00000000-0000-0000-0000-0000000000a0','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-0000000000a4']::uuid[])$q$, 'SCRIM_CONTRE_SOI');
select refus('Ana aligne un joueur de l''équipe adverse',
  $q$select public.proposer_scrim('94d00000-0000-0000-0000-00000000000a', '94d00000-0000-0000-0000-00000000000b', now() + interval '1 day', 1::smallint, array['00000000-0000-0000-0000-0000000000a0','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-0000000000a9']::uuid[])$q$, 'JOUEUR_HORS_EQUIPE');
select essai('Ana propose un scrim pour demain soir',
  $q$select public.proposer_scrim('94d00000-0000-0000-0000-00000000000a', '94d00000-0000-0000-0000-00000000000b', now() + interval '1 day', 3::smallint, array['00000000-0000-0000-0000-0000000000a0','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-0000000000a4']::uuid[])$q$, 'passe');
select refus('Ana propose un deuxième scrim à la même équipe',
  $q$select public.proposer_scrim('94d00000-0000-0000-0000-00000000000a', '94d00000-0000-0000-0000-00000000000b', now() + interval '2 days', 1::smallint, array['00000000-0000-0000-0000-0000000000a0','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-0000000000a4']::uuid[])$q$, 'SCRIM_DEJA_PROPOSE');
select essai('Ana écrit elle-même un scrim accepté',
  $q$insert into scrims (equipe_a_id, equipe_b_id, joueurs_a, region, prevu_le, statut) values ('94d00000-0000-0000-0000-00000000000a', '94d00000-0000-0000-0000-00000000000b', '{}', 'EUW', now() + interval '1 day', 'accepte')$q$, 'bloque');
select en_tant_que('00000000-0000-0000-0000-0000000000a1');
select refus('Un coéquipier d''Ana propose un scrim',
  $q$select public.proposer_scrim('94d00000-0000-0000-0000-00000000000a', '94d00000-0000-0000-0000-00000000000b', now() + interval '1 day', 1::smallint, array['00000000-0000-0000-0000-0000000000a0','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-0000000000a4']::uuid[])$q$, 'CAPITAINE_REQUIS');
select essai('Un coéquipier d''Ana ne voit pas la proposition', $q$select 1 from scrims$q$, 'bloque');
select en_tant_que('00000000-0000-0000-0000-0000000000a5');
select essai('Bob5, capitaine adverse, voit la proposition', $q$select 1 from scrims$q$, 'passe');
reset role;

select id as scrim_1 from scrims where equipe_a_id = '94d00000-0000-0000-0000-00000000000a' \gset

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000000a6');
select refus('Un coéquipier de Bob5 accepte à sa place',
  format($q$select public.repondre_scrim(%L, true, array['00000000-0000-0000-0000-0000000000a5','00000000-0000-0000-0000-0000000000a6','00000000-0000-0000-0000-0000000000a7','00000000-0000-0000-0000-0000000000a8','00000000-0000-0000-0000-0000000000a9']::uuid[])$q$, :'scrim_1'), 'NON_DESTINATAIRE');
select en_tant_que('00000000-0000-0000-0000-0000000000a5');
select refus('Bob5 accepte avec quatre joueurs',
  format($q$select public.repondre_scrim(%L, true, array['00000000-0000-0000-0000-0000000000a5','00000000-0000-0000-0000-0000000000a6','00000000-0000-0000-0000-0000000000a7','00000000-0000-0000-0000-0000000000a8']::uuid[])$q$, :'scrim_1'), 'ALIGNEMENT_DE_CINQ');
select essai('Bob5 accepte avec ses cinq joueurs',
  format($q$select 1 where public.repondre_scrim(%L, true, array['00000000-0000-0000-0000-0000000000a5','00000000-0000-0000-0000-0000000000a6','00000000-0000-0000-0000-0000000000a7','00000000-0000-0000-0000-0000000000a8','00000000-0000-0000-0000-0000000000a9']::uuid[]) like 'scrim-%%'$q$, :'scrim_1'), 'passe');
select refus('Bob5 accepte une deuxième fois',
  format($q$select public.repondre_scrim(%L, true, array['00000000-0000-0000-0000-0000000000a5','00000000-0000-0000-0000-0000000000a6','00000000-0000-0000-0000-0000000000a7','00000000-0000-0000-0000-0000000000a8','00000000-0000-0000-0000-0000000000a9']::uuid[])$q$, :'scrim_1'), 'SCRIM_DEJA_TRAITE');
reset role;

select verifie('Scrim créé : 5v5 à deux équipes, hors classement, arbitré, dix joueurs alignés, match ouvert à l''heure prévue',
  (select t.nature = 'scrim' and t.format = '5v5' and t.capacite = 2 and not t.compte_pour_classement
      and t.best_of = 3 and t.organisateur_id = '00000000-0000-0000-0000-00000000000d'
      and (select count(*) from alignements a where a.tournament_id = t.id) = 10
      and (select count(*) from registrations r where r.tournament_id = t.id and r.statut = 'confirme' and r.team_id is not null) = 2
      and (select m.demarre_le = s.prevu_le and m.statut = 'en_cours' from matches m where m.tournament_id = t.id)
   from scrims s join tournaments t on t.id = s.tournament_id
   where s.id = :'scrim_1'));

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000000a6');
select refus('Un joueur aligné quitte son équipe avant le scrim',
  $q$delete from team_members where team_id = '94d00000-0000-0000-0000-00000000000b' and profile_id = '00000000-0000-0000-0000-0000000000a6'$q$, 'ALIGNE_EN_TOURNOI');
select en_tant_que('00000000-0000-0000-0000-0000000000a1');
select refus('Un coéquipier d''Ana annule le scrim', format($q$select public.annuler_scrim(%L)$q$, :'scrim_1'), 'NON_AUTORISE');
select en_tant_que('00000000-0000-0000-0000-0000000000a0');
select essai('Ana annule le scrim avant son heure', format($q$select 1 where public.annuler_scrim(%L)$q$, :'scrim_1'), 'passe');
reset role;
select verifie('Scrim annulé : son match ne sera pas cherché',
  (select t.statut = 'annule' from scrims s join tournaments t on t.id = s.tournament_id where s.id = :'scrim_1'));

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000000a5');
select essai('Bob5 propose à son tour un scrim',
  $q$select public.proposer_scrim('94d00000-0000-0000-0000-00000000000b', '94d00000-0000-0000-0000-00000000000a', now() + interval '3 days', 1::smallint, array['00000000-0000-0000-0000-0000000000a5','00000000-0000-0000-0000-0000000000a6','00000000-0000-0000-0000-0000000000a7','00000000-0000-0000-0000-0000000000a8','00000000-0000-0000-0000-0000000000a9']::uuid[])$q$, 'passe');
reset role;
select id as scrim_2 from scrims where equipe_a_id = '94d00000-0000-0000-0000-00000000000b' \gset
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000000a0');
select essai('Ana refuse', format($q$select 1 where public.repondre_scrim(%L, false) is null$q$, :'scrim_2'), 'passe');
reset role;
select verifie('Proposition refusée', (select statut = 'refuse' from scrims where id = :'scrim_2'));
