-- Équipes qui recrutent (19/11/2026).
\set ON_ERROR_STOP 0

insert into tiers (id, game_id, nom, rating_min, ordre) values
  (1, 1, 'Bronze', 0, 1), (2, 1, 'Argent', 1300, 2), (3, 1, 'Or', 1450, 3),
  (4, 1, 'Platine', 1600, 4), (5, 1, 'Diamant', 1750, 5), (6, 1, 'Champion', 1900, 6)
on conflict do nothing;

-- 1 : Cap, capitaine (EUW). 2 : Pia, support (EUW, jamais joué : 1500).
-- 3 : Nao (NA). 4 : Lou (EUW, 1350). 5 : Sam, cherche une équipe (EUW,
-- support). 6, 7, 8 : de quoi compléter l'équipe.
insert into auth.users (id, email, raw_user_meta_data)
select ('9d0d0000-0000-0000-0000-00000000000' || n)::uuid, 'p99m' || n || '@test',
       json_build_object('pseudo', 'Recrue99m' || n, 'slug', 'recrue99m' || n)::jsonb
from generate_series(1, 8) n;
insert into game_accounts (profile_id, game_id, puuid, riot_game_name, riot_tag_line, region, est_principal, verifie_le, methode_verification, role_prefere)
select ('9d0d0000-0000-0000-0000-00000000000' || n)::uuid, 1, 'P-99M-' || n, 'Recrue' || n, case when n = 3 then 'NA1' else 'EUW' end,
       case when n = 3 then 'NA' else 'EUW' end, true, now(), 'icone_profil', case when n in (2, 5) then 'support' else 'mid' end
from generate_series(1, 5) n;
insert into ratings (profile_id, game_id, season_id, rating, rd, volatilite, matchs_joues) values
  ('9d0d0000-0000-0000-0000-000000000004', 1, (select id from seasons where est_courante), 1350, 200, 0.06, 4);
insert into recherches_coequipiers (profile_id, message) values ('9d0d0000-0000-0000-0000-000000000005', 'Support, dispo le soir');
insert into teams (id, game_id, slug, nom, tag, capitaine_id) values
  ('9d0d0000-0000-0000-0000-0000000000e1', 1, 'equipe-99m', 'Les Recrues', 'REC', '9d0d0000-0000-0000-0000-000000000001');
insert into team_members (team_id, profile_id, role, accepte_le) values
  ('9d0d0000-0000-0000-0000-0000000000e1', '9d0d0000-0000-0000-0000-000000000001', 'Top', now());

set role authenticated;
select en_tant_que('9d0d0000-0000-0000-0000-000000000002');
select refus('Pia ne publie pas pour une équipe dont elle n''est pas capitaine',
  $q$select public.publier_recrutement('9d0d0000-0000-0000-0000-0000000000e1', array['support'], null, null)$q$,
  'NON_CAPITAINE');
select en_tant_que('9d0d0000-0000-0000-0000-000000000001');
select refus('Poste inconnu',
  $q$select public.publier_recrutement('9d0d0000-0000-0000-0000-0000000000e1', array['support', 'coach'], null, null)$q$,
  'POSTES_INVALIDES');
select refus('Niveau qui n''est pas un seuil de palier',
  $q$select public.publier_recrutement('9d0d0000-0000-0000-0000-0000000000e1', array['support'], 1400, null)$q$,
  'NIVEAU_INVALIDE');
select refus('Message insultant',
  $q$select public.publier_recrutement('9d0d0000-0000-0000-0000-0000000000e1', array['support'], null, 'pas de bâtards')$q$,
  'TEXTE_INTERDIT');
select essai('Cap publie : support et jungle, Or et plus',
  $q$select public.publier_recrutement('9d0d0000-0000-0000-0000-0000000000e1', array['support', 'jungle', 'support'], 1450, '  On vise Clash  ')$q$,
  'passe');
reset role;
select verifie('Annonce enregistrée : postes sans doublon, région du capitaine, message sans espaces autour',
  (select postes = array['jungle', 'support'] and niveau_min = 1450 and region = 'EUW' and message = 'On vise Clash'
   from annonces_recrutement where team_id = '9d0d0000-0000-0000-0000-0000000000e1'));

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select verifie('Un visiteur voit l''annonce sur EUW (effectif 1), pas sur NA',
  (select count(*) = 1 and min(effectif) = 1 from public.annonces_recrutement_publiques('EUW') where team_id = '9d0d0000-0000-0000-0000-0000000000e1')
  and (select count(*) = 0 from public.annonces_recrutement_publiques('NA') where team_id = '9d0d0000-0000-0000-0000-0000000000e1'));
reset role;

set role authenticated;
select en_tant_que('9d0d0000-0000-0000-0000-000000000003');
select refus('Nao (NA) ne postule pas sur une annonce EUW',
  $q$select public.postuler_equipe('9d0d0000-0000-0000-0000-0000000000e1', 'support', null)$q$,
  'REGION_DIFFERENTE');
select en_tant_que('9d0d0000-0000-0000-0000-000000000004');
select refus('Lou (1350) est sous le niveau demandé',
  $q$select public.postuler_equipe('9d0d0000-0000-0000-0000-0000000000e1', 'support', null)$q$,
  'NIVEAU_INSUFFISANT');
select en_tant_que('9d0d0000-0000-0000-0000-000000000002');
select refus('Pia ne postule pas à un poste non recherché',
  $q$select public.postuler_equipe('9d0d0000-0000-0000-0000-0000000000e1', 'mid', null)$q$,
  'POSTE_NON_RECHERCHE');
select essai('Pia postule comme support',
  $q$select public.postuler_equipe('9d0d0000-0000-0000-0000-0000000000e1', 'support', 'Je main Nautilus')$q$,
  'passe');
select refus('Une seule candidature en attente',
  $q$select public.postuler_equipe('9d0d0000-0000-0000-0000-0000000000e1', 'jungle', null)$q$,
  'CANDIDATURE_EN_COURS');
select verifie('Pia voit sa candidature', (select count(*) = 1 from candidatures_equipe));
select en_tant_que('9d0d0000-0000-0000-0000-000000000003');
select verifie('Nao ne voit pas celle de Pia', (select count(*) = 0 from candidatures_equipe));
select refus('Nao ne voit pas les propositions de joueurs de l''équipe',
  $q$select * from public.joueurs_pour_recrutement('9d0d0000-0000-0000-0000-0000000000e1')$q$,
  'NON_CAPITAINE');
select en_tant_que('9d0d0000-0000-0000-0000-000000000001');
select verifie('Cap voit la candidature de Pia', (select count(*) = 1 from candidatures_equipe));
select verifie('Cap voit Sam parmi les joueurs qui cherchent une équipe et correspondent (pas Pia, sans annonce)',
  (select array_agg(slug) = array['recrue99m5'] from public.joueurs_pour_recrutement('9d0d0000-0000-0000-0000-0000000000e1')));
select essai('Cap accepte Pia',
  $q$select public.repondre_candidature((select id from candidatures_equipe where profile_id = '9d0d0000-0000-0000-0000-000000000002'), true)$q$,
  'passe');
reset role;
select verifie('Pia est membre de l''équipe (poste Support), sa candidature est acceptée',
  (select accepte_le is not null and role = 'Support' from team_members
   where team_id = '9d0d0000-0000-0000-0000-0000000000e1' and profile_id = '9d0d0000-0000-0000-0000-000000000002')
  and (select statut = 'acceptee' from candidatures_equipe where profile_id = '9d0d0000-0000-0000-0000-000000000002'));

set role authenticated;
select en_tant_que('9d0d0000-0000-0000-0000-000000000002');
select refus('Pia, déjà membre, ne repostule pas',
  $q$select public.postuler_equipe('9d0d0000-0000-0000-0000-0000000000e1', 'jungle', null)$q$,
  'DEJA_MEMBRE');
select en_tant_que('9d0d0000-0000-0000-0000-000000000005');
select essai('Sam postule',
  $q$select public.postuler_equipe('9d0d0000-0000-0000-0000-0000000000e1', 'support', null)$q$,
  'passe');
select refus('Sam ne répond pas lui-même à sa candidature',
  $q$select public.repondre_candidature((select id from candidatures_equipe where profile_id = '9d0d0000-0000-0000-0000-000000000005'), true)$q$,
  'NON_CAPITAINE');
select en_tant_que('9d0d0000-0000-0000-0000-000000000001');
select essai('Cap décline Sam',
  $q$select public.repondre_candidature((select id from candidatures_equipe where profile_id = '9d0d0000-0000-0000-0000-000000000005'), false)$q$,
  'passe');
select en_tant_que('9d0d0000-0000-0000-0000-000000000005');
select refus('Sam ne repostule pas avant 30 jours après un refus',
  $q$select public.postuler_equipe('9d0d0000-0000-0000-0000-0000000000e1', 'jungle', null)$q$,
  'CANDIDATURE_REFUSEE_RECEMMENT');
reset role;

-- Équipe complète : l'annonce disparaît, plus de publication.
insert into team_members (team_id, profile_id, accepte_le)
select '9d0d0000-0000-0000-0000-0000000000e1', ('9d0d0000-0000-0000-0000-00000000000' || n)::uuid, now()
from generate_series(6, 8) n;
select verifie('Équipe à 5 : plus dans la liste', (select count(*) = 0 from public.annonces_recrutement_publiques('EUW') where team_id = '9d0d0000-0000-0000-0000-0000000000e1'));
set role authenticated;
select en_tant_que('9d0d0000-0000-0000-0000-000000000001');
select refus('Équipe complète : pas de nouvelle annonce',
  $q$select public.publier_recrutement('9d0d0000-0000-0000-0000-0000000000e1', array['support'], null, null)$q$,
  'EQUIPE_COMPLETE');
select verifie('Retirer l''annonce', (select public.retirer_recrutement('9d0d0000-0000-0000-0000-0000000000e1')));
reset role;

-- ---------- Contrôle de sécurité du 19/11/2026 : capitaine suspendu ----------
-- Lou (EUW) crée une équipe et recrute ; Pia postule ; Lou est suspendu.
insert into teams (id, game_id, slug, nom, tag, capitaine_id) values
  ('9d0d0000-0000-0000-0000-0000000000e2', 1, 'equipe-99m-b', 'Les Suspendus', 'SUS', '9d0d0000-0000-0000-0000-000000000004');
insert into team_members (team_id, profile_id, role, accepte_le) values
  ('9d0d0000-0000-0000-0000-0000000000e2', '9d0d0000-0000-0000-0000-000000000004', 'Mid', now());
set role authenticated;
select en_tant_que('9d0d0000-0000-0000-0000-000000000004');
select essai('Lou publie une annonce (support)',
  $q$select public.publier_recrutement('9d0d0000-0000-0000-0000-0000000000e2', array['support'], null, null)$q$,
  'passe');
select en_tant_que('9d0d0000-0000-0000-0000-000000000002');
select essai('Pia postule chez Lou',
  $q$select public.postuler_equipe('9d0d0000-0000-0000-0000-0000000000e2', 'support', null)$q$,
  'passe');
reset role;
insert into suspensions (profile_id, motif) values ('9d0d0000-0000-0000-0000-000000000004', 'Test suspension');
set role authenticated;
select en_tant_que('9d0d0000-0000-0000-0000-000000000004');
select refus('Lou, suspendu, n''accepte pas de candidature',
  $q$select public.repondre_candidature((select id from candidatures_equipe where team_id = '9d0d0000-0000-0000-0000-0000000000e2'), true)$q$,
  'COMPTE_SUSPENDU');
select en_tant_que('9d0d0000-0000-0000-0000-000000000005');
select refus('Sam ne postule pas chez un capitaine suspendu',
  $q$select public.postuler_equipe('9d0d0000-0000-0000-0000-0000000000e2', 'support', null)$q$,
  'ANNONCE_INTROUVABLE');
reset role;

-- ---------- Blocage dans les deux sens (contrôle de sécurité du 19/11/2026) ----------
-- Équipe de Cap remise à trois places libres, annonce rouverte.
delete from team_members where team_id = '9d0d0000-0000-0000-0000-0000000000e1'
  and profile_id in ('9d0d0000-0000-0000-0000-000000000006', '9d0d0000-0000-0000-0000-000000000007', '9d0d0000-0000-0000-0000-000000000008');
delete from candidatures_equipe where team_id = '9d0d0000-0000-0000-0000-0000000000e1';
insert into annonces_recrutement (team_id, postes, region, expire_le) values
  ('9d0d0000-0000-0000-0000-0000000000e1', array['jungle', 'support'], 'EUW', now() + interval '30 days')
on conflict (team_id) do update set postes = excluded.postes, niveau_min = null, expire_le = excluded.expire_le;
-- Sam bloque le capitaine : il ne postule pas.
insert into blocages (bloqueur_id, bloque_id) values ('9d0d0000-0000-0000-0000-000000000005', '9d0d0000-0000-0000-0000-000000000001');
set role authenticated;
select en_tant_que('9d0d0000-0000-0000-0000-000000000005');
select refus('Sam, qui a bloqué le capitaine, ne postule pas',
  $q$select public.postuler_equipe('9d0d0000-0000-0000-0000-0000000000e1', 'jungle', null)$q$,
  'ANNONCE_INTROUVABLE');
reset role;
-- Candidature de Rio posée, puis le capitaine le bloque : pas d'acceptation.
insert into candidatures_equipe (team_id, profile_id, poste) values
  ('9d0d0000-0000-0000-0000-0000000000e1', '9d0d0000-0000-0000-0000-000000000006', 'jungle');
insert into blocages (bloqueur_id, bloque_id) values ('9d0d0000-0000-0000-0000-000000000001', '9d0d0000-0000-0000-0000-000000000006');
set role authenticated;
select en_tant_que('9d0d0000-0000-0000-0000-000000000001');
select refus('Cap n''accepte pas la candidature d''un joueur qu''il a bloqué',
  $q$select public.repondre_candidature((select id from candidatures_equipe where team_id = '9d0d0000-0000-0000-0000-0000000000e1' and profile_id = '9d0d0000-0000-0000-0000-000000000006'), true)$q$,
  'JOUEUR_INDISPONIBLE');
reset role;

-- ---------- Annonce visible sur la page d'équipe (finitions du 19/11/2026) ----------
-- Lou (équipe e2) est suspendu plus haut : son annonce n'est plus visible.
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select verifie('Annonce d''un capitaine suspendu : invisible ; celle de Cap : visible',
  not public.annonce_recrutement_visible('9d0d0000-0000-0000-0000-0000000000e2')
  and public.annonce_recrutement_visible('9d0d0000-0000-0000-0000-0000000000e1'));
reset role;
