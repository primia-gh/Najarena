-- Certificats signés (idée en réserve n°2) : texte signé produit par la
-- base, signature posée une fois par le serveur, certificat toujours figé.
\set ON_ERROR_STOP 0

-- Mona (…2f0), Diamant, émet deux certificats.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000002f0', 'mona@test', '{"pseudo":"Mona","slug":"mona"}');
insert into ratings (profile_id, game_id, season_id, rating, rd, volatilite, matchs_joues)
values ('00000000-0000-0000-0000-0000000002f0', 1, (select id from seasons where est_courante), 1780, 90, 0.06, 14);
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000002f0');
select public.emettre_certificat() as code_a \gset
select public.emettre_certificat() as code_b \gset
reset role;

-- Signature et clé de forme valable (base64 de 64 et 32 octets).
select repeat('A', 86) || '==' as fausse_signature, repeat('B', 43) || '=' as fausse_cle \gset

set role anon;
select verifie('Visiteur : lit le texte signé d''un certificat (format v1, champs figés)',
  (select public.contenu_certificat(:'code_a') like E'najarena-certificat-v1\ncode: ' || :'code_a' || E'\njoueur: 00000000-0000-0000-0000-0000000002f0\njeu: lol\nemis_le: %'
      and public.contenu_certificat(:'code_a') like '%rating: 1780.00%palier: Diamant%'));
select verifie('Un certificat inconnu n''a pas de texte', public.contenu_certificat('inconnu') is null);
reset role;

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000002f0');
select essai('Mona signe elle-même son certificat',
  format($q$select public.signer_certificat(%L, %L, %L)$q$, :'code_a', :'fausse_signature', :'fausse_cle'), 'bloque');
reset role;

set role service_role;
select refus('Serveur : signature mal formée refusée',
  format($q$select public.signer_certificat(%L, 'pas-une-signature', %L)$q$, :'code_a', :'fausse_cle'), 'SIGNATURE_INVALIDE');
select essai('Serveur : signe le certificat',
  format($q$select 1 where public.signer_certificat(%L, %L, %L)$q$, :'code_a', :'fausse_signature', :'fausse_cle'), 'passe');
select essai('Serveur : une deuxième signature ne remplace pas la première',
  format($q$select 1 where not public.signer_certificat(%L, %L, %L)$q$, :'code_a', repeat('C', 86) || '==', :'fausse_cle'), 'passe');
select refus('Serveur : change la signature directement',
  format($q$update certificats set signature = %L where code = %L$q$, repeat('D', 86) || '==', :'code_a'), 'CERTIFICAT_IMMUABLE');
select refus('Serveur : glisse un autre rating en posant la signature',
  format($q$update certificats set signature = %L, cle_publique = %L, rating = 2400 where code = %L$q$, :'fausse_signature', :'fausse_cle', :'code_b'), 'CERTIFICAT_IMMUABLE');
reset role;

set role anon;
select verifie('Visiteur : lit la signature et la clé avec le certificat',
  (select signature = :'fausse_signature' and cle_publique = :'fausse_cle' from public.lire_certificat(:'code_a')));
select verifie('Le certificat non signé le reste', (select signature is null from public.lire_certificat(:'code_b')));
reset role;
