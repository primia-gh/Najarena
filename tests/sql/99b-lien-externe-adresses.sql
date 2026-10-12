-- Lien externe du CV et forme des adresses (contrôle de sécurité du 12/10/2026).
\set ON_ERROR_STOP 0

\echo '===== Lien externe du CV ====='
-- Écrit par le serveur seul (aucune policy client) : essais sous son rôle.
select essai('Dave met un lien vers son réseau',
  $q$update comptes_offres set lien_externe = 'https://twitter.com/dave_lol?ref=cv#top' where profile_id = '00000000-0000-0000-0000-00000000000d'$q$, 'passe');
select refus('Lien « javascript: » refusé',
  $q$update comptes_offres set lien_externe = 'javascript:alert(1)' where profile_id = '00000000-0000-0000-0000-00000000000d'$q$, 'LIEN_INVALIDE');
select refus('Chemin du site sans adresse complète refusé',
  $q$update comptes_offres set lien_externe = '/moi?message=Gain' where profile_id = '00000000-0000-0000-0000-00000000000d'$q$, 'LIEN_INVALIDE');
select refus('Identifiant devant le nom du site refusé (najarena.fr@piege.example)',
  $q$update comptes_offres set lien_externe = 'https://najarena.fr@piege.example/' where profile_id = '00000000-0000-0000-0000-00000000000d'$q$, 'LIEN_INVALIDE');
select refus('Espace dans le lien refusé (texte ajouté après le lien)',
  $q$update comptes_offres set lien_externe = 'https://site.example/a gagne 1000 euros' where profile_id = '00000000-0000-0000-0000-00000000000d'$q$, 'LIEN_INVALIDE');
select refus('Caractère invisible refusé',
  $q$update comptes_offres set lien_externe = E'https://site.example/‮abc' where profile_id = '00000000-0000-0000-0000-00000000000d'$q$, 'LIEN_INVALIDE');
select refus('Lien de plus de 300 caractères refusé',
  format($q$update comptes_offres set lien_externe = %L where profile_id = '00000000-0000-0000-0000-00000000000d'$q$, 'https://site.example/' || repeat('a', 300)), 'LIEN_INVALIDE');
select refus('Insulte dans le chemin refusée',
  $q$update comptes_offres set lien_externe = 'https://site.example/gros-connard' where profile_id = '00000000-0000-0000-0000-00000000000d'$q$, 'LIEN_INTERDIT');
select refus('Propos haineux dans l''ancre refusé',
  $q$update comptes_offres set lien_externe = 'https://site.example/#tue-toi' where profile_id = '00000000-0000-0000-0000-00000000000d'$q$, 'LIEN_INTERDIT');
select refus('Arnaque dans les paramètres refusée',
  $q$update comptes_offres set lien_externe = 'https://site.example/?offre=free-nitro' where profile_id = '00000000-0000-0000-0000-00000000000d'$q$, 'LIEN_INTERDIT');
select essai('Insulte déguisée en identifiant dans les paramètres : passe (suites de lettres au hasard)',
  $q$update comptes_offres set lien_externe = 'https://video.example/watch?v=c0nn4rd' where profile_id = '00000000-0000-0000-0000-00000000000d'$q$, 'passe');
select refus('Faux site Najarena refusé',
  $q$update comptes_offres set lien_externe = 'https://najarena-connexion.example/connexion' where profile_id = '00000000-0000-0000-0000-00000000000d'$q$, 'LIEN_INTERDIT');
select refus('Faux site Najarena en sous-domaine refusé',
  $q$update comptes_offres set lien_externe = 'https://najarena.fr.verif-compte.example/' where profile_id = '00000000-0000-0000-0000-00000000000d'$q$, 'LIEN_INTERDIT');
select refus('Faux support Riot refusé',
  $q$update comptes_offres set lien_externe = 'https://riot-support.example/' where profile_id = '00000000-0000-0000-0000-00000000000d'$q$, 'LIEN_INTERDIT');
select refus('Adresse IP refusée',
  $q$update comptes_offres set lien_externe = 'https://192.168.1.1/admin' where profile_id = '00000000-0000-0000-0000-00000000000d'$q$, 'LIEN_INVALIDE');
select refus('Nom de site en chiffres refusé (0x7f.1)',
  $q$update comptes_offres set lien_externe = 'https://0x7f.1/' where profile_id = '00000000-0000-0000-0000-00000000000d'$q$, 'LIEN_INVALIDE');
select refus('Nom de site sans lettres finales refusé',
  $q$update comptes_offres set lien_externe = 'https://-.-/' where profile_id = '00000000-0000-0000-0000-00000000000d'$q$, 'LIEN_INVALIDE');
select essai('Nom de site accentué converti (punycode) : passe',
  $q$update comptes_offres set lien_externe = 'https://xn--caf-dma.fr/' where profile_id = '00000000-0000-0000-0000-00000000000d'$q$, 'passe');
select essai('Lien ordinaire : passe',
  $q$update comptes_offres set lien_externe = 'https://www.twitch.tv/dave_lol' where profile_id = '00000000-0000-0000-0000-00000000000d'$q$, 'passe');
select essai('Lien retiré',
  $q$update comptes_offres set lien_externe = null where profile_id = '00000000-0000-0000-0000-00000000000d'$q$, 'passe');

\echo '===== Forme des adresses de tournois et d''équipes ====='
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-00000000000a');
select refus('Alice crée un tournoi à une adresse hors format',
  $q$insert into tournaments (game_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut) values (1, '00000000-0000-0000-0000-00000000000a', 'Piege/../moi?message=x', 'Piège', '1v1', 8, 'EUW', now() + interval '2 days', now() + interval '2 days', 'brouillon')$q$, 'ADRESSE_INVALIDE');
select refus('Alice crée une équipe à une adresse hors format',
  $q$insert into teams (game_id, slug, nom, tag, capitaine_id) values (1, 'equipe_alice', 'Equipe Alice B', 'EAB', '00000000-0000-0000-0000-00000000000a')$q$, 'ADRESSE_INVALIDE');
reset role;
select refus('Même le serveur : adresse de plus de 120 caractères refusée',
  format($q$insert into teams (game_id, slug, nom, tag, capitaine_id) values (1, %L, 'Equipe longue', 'LNG', '00000000-0000-0000-0000-00000000000a')$q$, repeat('a', 121)), 'ADRESSE_INVALIDE');
-- Une ligne ancienne hors format reste modifiable (le contrôle ne lit que
-- les adresses nouvelles ou changées).
alter table public.teams disable trigger controle_forme_adresse;
insert into teams (id, game_id, slug, nom, tag, capitaine_id)
values ('20000000-0000-0000-0000-0000000000ff', 1, 'Ancienne_Adresse', 'Ancienne equipe', 'ANC', '00000000-0000-0000-0000-00000000000a');
alter table public.teams enable trigger controle_forme_adresse;
select essai('Une équipe ancienne hors format reste modifiable',
  $q$update teams set nom = 'Ancienne equipe 2' where id = '20000000-0000-0000-0000-0000000000ff'$q$, 'passe');
select refus('… mais sa nouvelle adresse doit être au format',
  $q$update teams set slug = 'Encore_Mauvaise' where id = '20000000-0000-0000-0000-0000000000ff'$q$, 'ADRESSE_INVALIDE');
delete from teams where id = '20000000-0000-0000-0000-0000000000ff';
