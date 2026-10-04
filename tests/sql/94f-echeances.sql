-- Objectif Nexus Tour et Clash : calendrier des échéances (audit N24).
\set ON_ERROR_STOP 0

insert into admins (profile_id) values ('00000000-0000-0000-0000-00000000000d') on conflict do nothing;
insert into echeances (id, type, nom, debut_le, source)
values ('94f00000-0000-0000-0000-000000000001', 'clash', 'Clash passé', now() - interval '2 days', 'riot');

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-00000000000d');
select essai('Dave, administrateur, ajoute une étape du Nexus Tour avec son lien officiel',
  $q$insert into echeances (id, type, nom, debut_le, lien_officiel, cree_par) values ('94f00000-0000-0000-0000-000000000002', 'nexus_tour', 'Nexus Tour — étape 3', now() + interval '20 days', 'https://example.org/nexus', '00000000-0000-0000-0000-00000000000d')$q$, 'passe');
select essai('Dave se fait passer pour l''API Riot',
  $q$insert into echeances (type, nom, debut_le, source) values ('clash', 'Faux Clash', now() + interval '3 days', 'riot')$q$, 'bloque');
select essai('Dave met un lien qui n''est pas une adresse web',
  $q$insert into echeances (type, nom, debut_le, lien_officiel) values ('autre', 'Lien piégé', now() + interval '3 days', 'javascript:alert(1)')$q$, 'bloque');
select en_tant_que('00000000-0000-0000-0000-00000000000b');
select essai('Bob, simple joueur, ajoute une échéance',
  $q$insert into echeances (type, nom, debut_le) values ('autre', 'Mon tournoi', now() + interval '3 days')$q$, 'bloque');
select essai('Bob retire une échéance', $q$delete from echeances where id = '94f00000-0000-0000-0000-000000000002'$q$, 'bloque');
select essai('Bob modifie une échéance', $q$update echeances set nom = 'Modifié' where id = '94f00000-0000-0000-0000-000000000002'$q$, 'bloque');
select essai('Bob cherche une équipe pour la prochaine étape du Nexus Tour',
  $q$insert into recherches_coequipiers (profile_id, message, objectif_id) values ('00000000-0000-0000-0000-00000000000b', 'Mid cherche équipe', '94f00000-0000-0000-0000-000000000002')$q$, 'passe');
select refus('Bob vise une échéance déjà passée',
  $q$update recherches_coequipiers set objectif_id = '94f00000-0000-0000-0000-000000000001' where profile_id = '00000000-0000-0000-0000-00000000000b'$q$, 'OBJECTIF_PASSE');
reset role;

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select essai('Un visiteur lit le calendrier', $q$select 1 from echeances where id = '94f00000-0000-0000-0000-000000000002'$q$, 'passe');
reset role;

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-00000000000d');
select essai('Dave retire l''échéance', $q$delete from echeances where id = '94f00000-0000-0000-0000-000000000002'$q$, 'passe');
reset role;
select verifie('Échéance retirée : l''annonce de Bob reste, sans objectif',
  (select objectif_id is null from recherches_coequipiers where profile_id = '00000000-0000-0000-0000-00000000000b'));
