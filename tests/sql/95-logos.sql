-- Logos : stockage verrouillé (audit M6).
\set ON_ERROR_STOP 0

insert into storage.buckets (id, name, public) values ('logos', 'logos', true) on conflict do nothing;

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-00000000000d');
select essai('Dave (capitaine) dépose le logo de son équipe',
  $q$insert into storage.objects (bucket_id, name, owner) values ('logos', 'equipe/20000000-0000-0000-0000-000000000002.png', '00000000-0000-0000-0000-00000000000d')$q$, 'passe');
select essai('Dave dépose un fichier à l''emplacement du logo de l''équipe d''Alice',
  $q$insert into storage.objects (bucket_id, name, owner) values ('logos', 'equipe/20000000-0000-0000-0000-000000000001.png', '00000000-0000-0000-0000-00000000000d')$q$, 'bloque');
select essai('Dave dépose une page HTML dans l''espace des logos',
  $q$insert into storage.objects (bucket_id, name, owner) values ('logos', 'equipe/20000000-0000-0000-0000-000000000002.html', '00000000-0000-0000-0000-00000000000d')$q$, 'bloque');
select essai('Dave dépose un fichier ailleurs dans l''espace des logos',
  $q$insert into storage.objects (bucket_id, name, owner) values ('logos', 'divers/pub.png', '00000000-0000-0000-0000-00000000000d')$q$, 'bloque');
select essai('Dave (offre Organisateur) met un logo venant d''un autre site',
  $q$update teams set logo_url = 'https://pisteur.example/pixel.png' where id = '20000000-0000-0000-0000-000000000002'$q$, 'bloque');
select essai('Dave met le logo déposé dans l''espace de son équipe',
  $q$update teams set logo_url = 'https://abcd1234.supabase.co/storage/v1/object/public/logos/equipe/20000000-0000-0000-0000-000000000002.png?v=1727500000000' where id = '20000000-0000-0000-0000-000000000002'$q$, 'passe');
select essai('Dave met une couleur d''accent qui n''en est pas une',
  $q$update teams set couleur_accent = 'red; background:url(x)' where id = '20000000-0000-0000-0000-000000000002'$q$, 'bloque');
select essai('Dave met une couleur d''accent #RRGGBB',
  $q$update teams set couleur_accent = '#B6FF3B' where id = '20000000-0000-0000-0000-000000000002'$q$, 'passe');
reset role;

select verifie('Espace des logos : 2 Mo et images seulement, appliqué par le stockage',
  (select file_size_limit = 2097152 and allowed_mime_types @> array['image/png'] and not allowed_mime_types @> array['text/html']
     from storage.buckets where id = 'logos'));
