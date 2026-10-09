-- Registre ancré sur GitHub (idée en réserve n°3) : seul le serveur note
-- qu'une empreinte a été déposée.
\set ON_ERROR_STOP 0

insert into empreintes_publiees (jour, numero, empreinte) values ('2026-10-01', 1, repeat('a', 64))
on conflict (jour) do nothing;

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-00000000000a');
select essai('Un joueur marque une empreinte comme déposée sur GitHub',
  $q$update empreintes_publiees set ancree_github_le = now() where jour = '2026-10-01'$q$, 'bloque');
reset role;
set role anon;
select essai('Visiteur : voit si l''empreinte du jour est déposée sur GitHub',
  $q$select ancree_github_le from empreintes_publiees where jour = '2026-10-01'$q$, 'passe');
reset role;
set role service_role;
select essai('Serveur : note le dépôt sur GitHub',
  $q$update empreintes_publiees set ancree_github_le = now() where jour = '2026-10-01'$q$, 'passe');
reset role;
