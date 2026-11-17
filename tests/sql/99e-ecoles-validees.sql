-- Écoles validées par un administrateur (décision du porteur du projet du
-- 17/11/2026) : seule une école validée entre dans la ligue des écoles, et
-- changer ses domaines la remet en attente.
\set ON_ERROR_STOP 0

insert into auth.users (id, email, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000099e' || lpad(i::text, 4, '0'))::uuid, 'p99e' || i || '@test',
       json_build_object('pseudo', 'Ecole99e' || i, 'slug', 'ecole99e' || i)::jsonb
from generate_series(1, 2) i;
insert into comptes_offres (profile_id, offre) values ('00000000-0000-0000-0000-0000099e0001', 'organisateur');
insert into admins (profile_id) values ('00000000-0000-0000-0000-00000000000d') on conflict do nothing;

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000099e0001');
select essai('La fondatrice crée « Univ 99e »', $q$select public.creer_communaute('Univ 99e', 'univ-99e')$q$, 'passe');
reset role;
select id as ecole from communautes where slug = 'univ-99e' \gset
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000099e0001');
select essai('Elle en fait une école', format($q$select public.definir_ecole(%L, array['univ-99e.fr'])$q$, :'ecole'), 'passe');
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select verifie('Pas encore validée : absente de la ligue',
  not exists (select 1 from public.classement_ecoles() where slug = 'univ-99e'));
select verifie('Un visiteur voit qu''elle est en attente',
  (select ecole_validee_le is null from communautes where slug = 'univ-99e'));

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000099e0001');
select refus('La fondatrice valide elle-même son école', format($q$select public.valider_ecole(%L, true)$q$, :'ecole'), 'NON_AUTORISE');
select essai('La fondatrice écrit la date de validation', format($q$update communautes set ecole_validee_le = now() where id = %L$q$, :'ecole'), 'bloque');
select en_tant_que('00000000-0000-0000-0000-0000099e0002');
select refus('Un joueur valide l''école', format($q$select public.valider_ecole(%L, true)$q$, :'ecole'), 'NON_AUTORISE');
select en_tant_que('00000000-0000-0000-0000-00000000000d');
select verifie('Un administrateur valide l''école', (select public.valider_ecole(:'ecole', true)));
set role anon;
select verifie('Validée : elle entre dans la ligue (en constitution)',
  exists (select 1 from public.classement_ecoles() where slug = 'univ-99e'));

-- La fondatrice change ses domaines : retour en attente.
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000099e0001');
select essai('Elle ajoute un domaine', format($q$select public.definir_ecole(%L, array['univ-99e.fr', 'etu.univ-99e.fr'])$q$, :'ecole'), 'passe');
set role anon;
select verifie('Domaines changés : de nouveau en attente, hors de la ligue',
  (select ecole_validee_le is null from communautes where slug = 'univ-99e')
  and not exists (select 1 from public.classement_ecoles() where slug = 'univ-99e'));
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000099e0001');
select essai('Mêmes domaines saisis à nouveau', format($q$select public.definir_ecole(%L, array['etu.univ-99e.fr', 'univ-99e.fr'])$q$, :'ecole'), 'passe');
select en_tant_que('00000000-0000-0000-0000-00000000000d');
select verifie('L''administrateur valide de nouveau', (select public.valider_ecole(:'ecole', true)));
select en_tant_que('00000000-0000-0000-0000-0000099e0001');
select essai('Elle ressaisit les mêmes domaines', format($q$select public.definir_ecole(%L, array['univ-99e.fr', 'etu.univ-99e.fr'])$q$, :'ecole'), 'passe');
select verifie('Mêmes domaines : la validation reste',
  (select ecole_validee_le is not null from communautes where slug = 'univ-99e'));
select en_tant_que('00000000-0000-0000-0000-00000000000d');
select verifie('L''administrateur retire la validation', (select not public.valider_ecole(:'ecole', false)));
select verifie('Hors de la ligue', not exists (select 1 from public.classement_ecoles() where slug = 'univ-99e'));
select refus('Valider une communauté qui n''est pas une école',
  $q$select public.valider_ecole('00000000-0000-0000-0000-000000000000', true)$q$, 'PAS_UNE_ECOLE');
reset role;
