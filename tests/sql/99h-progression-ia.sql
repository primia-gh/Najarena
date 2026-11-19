-- Analyse de progression rédigée par l'IA (18/11/2026) : écrite par le
-- serveur seul, lue par le joueur seul, effacée avec l'accord des classées
-- ou le compte.
\set ON_ERROR_STOP 0

insert into auth.users (id, email, raw_user_meta_data)
select ('9990e000-0000-0000-0000-00000000000' || n)::uuid, 'prog' || n || '@test',
       json_build_object('pseudo', 'Prog99h' || n, 'slug', 'prog99h' || n)::jsonb
from generate_series(1, 2) n;
\set ana '9990e000-0000-0000-0000-000000000001'
\set bob '9990e000-0000-0000-0000-000000000002'
insert into analyse_reglages (profile_id, classees, classees_depuis) values (:'ana', true, now());

set role service_role;
select essai('Le serveur enregistre l''analyse 1v1 d''Ana',
  $q$insert into analyses_progression_ia (profile_id, format, resume, progres, reculs, priorites, parties, derniere_partie, modele)
     values ('9990e000-0000-0000-0000-000000000001', '1v1', 'Tu progresses aux sbires.', array['Sbires : 6,1 puis 7,0'], '{}', array['Garde ce rythme'], 12, now(), 'essai')$q$, 'passe');
select essai('Le serveur enregistre l''analyse des classées d''Ana',
  $q$insert into analyses_progression_ia (profile_id, format, resume, priorites, parties, modele)
     values ('9990e000-0000-0000-0000-000000000001', 'classees', 'Résumé.', array['Priorité'], 20, 'essai')$q$, 'passe');
select refus('Le serveur écrit une analyse des classées pour Bob, qui n''a pas donné son accord',
  $q$insert into analyses_progression_ia (profile_id, format, resume, priorites, parties, modele)
     values ('9990e000-0000-0000-0000-000000000002', 'classees', 'Résumé.', array['P'], 20, 'essai')$q$, 'ANALYSE_NON_ACTIVEE');
select refus('Une analyse sans priorité',
  $q$insert into analyses_progression_ia (profile_id, format, resume, priorites, parties, modele)
     values ('9990e000-0000-0000-0000-000000000002', '1v1', 'Résumé.', '{}', 12, 'essai')$q$,
  'new row for relation "analyses_progression_ia" violates check constraint "analyses_progression_ia_priorites_check"');
select refus('Un format inconnu',
  $q$insert into analyses_progression_ia (profile_id, format, resume, priorites, parties, modele)
     values ('9990e000-0000-0000-0000-000000000002', 'aram', 'Résumé.', array['P'], 12, 'essai')$q$,
  'new row for relation "analyses_progression_ia" violates check constraint "analyses_progression_ia_format_check"');
reset role;

set role authenticated;
select en_tant_que(:'ana');
select essai('Ana lit ses analyses', $q$select 1 from analyses_progression_ia having count(*) = 2$q$, 'passe');
select essai('Ana écrit elle-même une analyse',
  $q$insert into analyses_progression_ia (profile_id, format, resume, priorites, parties, modele)
     values ('9990e000-0000-0000-0000-000000000001', '5v5', 'Je suis le meilleur.', array['Rien'], 99, 'moi')$q$, 'bloque');
select essai('Ana retouche son analyse',
  $q$update analyses_progression_ia set resume = 'Parfait.' where profile_id = '9990e000-0000-0000-0000-000000000001'$q$, 'bloque');
select en_tant_que(:'bob');
select essai('Bob ne lit pas les analyses d''Ana', $q$select 1 from analyses_progression_ia where profile_id = '9990e000-0000-0000-0000-000000000001'$q$, 'bloque');
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select essai('Un visiteur ne lit aucune analyse', $q$select 1 from analyses_progression_ia$q$, 'bloque');
reset role;

set role authenticated;
select en_tant_que(:'ana');
select essai('Ana retire son accord pour les classées', $q$select public.regler_analyse(false, false)$q$, 'passe');
reset role;
select verifie('Accord retiré : l''analyse des classées est effacée, celle du 1v1 reste',
  not exists (select 1 from analyses_progression_ia where profile_id = :'ana' and format = 'classees')
  and exists (select 1 from analyses_progression_ia where profile_id = :'ana' and format = '1v1'));

update profiles set supprime_le = now() where id = :'ana';
select verifie('Compte supprimé : plus aucune analyse',
  not exists (select 1 from analyses_progression_ia where profile_id = :'ana'));
set role service_role;
select refus('Le serveur écrit une analyse pour un compte supprimé',
  $q$insert into analyses_progression_ia (profile_id, format, resume, priorites, parties, modele)
     values ('9990e000-0000-0000-0000-000000000001', '1v1', 'Résumé.', array['P'], 12, 'essai')$q$, 'COMPTE_SUPPRIME');
reset role;
