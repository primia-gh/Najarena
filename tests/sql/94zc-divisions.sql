-- Divisions mensuelles (idée en réserve n°13) : inscription, poules formées
-- par le serveur, « Je suis là » des deux joueurs = duel lancé.
\set ON_ERROR_STOP 0

-- Joueurs 0 à 5 vérifiés sur EUW, 6 sans compte Riot, 7 suspendu.
insert into auth.users (id, email, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000003f' || n)::uuid, 'd94zc' || n || '@test',
       json_build_object('pseudo', 'Div94zc' || n, 'slug', 'div94zc' || n)::jsonb
from generate_series(0, 7) n;
insert into game_accounts (profile_id, game_id, puuid, riot_game_name, riot_tag_line, region, est_principal, verifie_le, methode_verification)
select ('00000000-0000-0000-0000-0000000003f' || n)::uuid, 1, 'P-94zc-' || n, 'D' || n, 'EUW', 'EUW', true, now(), 'icone_profil'
from unnest(array[0, 1, 2, 3, 4, 5, 7]) n;
insert into suspensions (profile_id, motif) values ('00000000-0000-0000-0000-0000000003f7', 'Test de suspension');
insert into admins (profile_id) values ('00000000-0000-0000-0000-00000000000d') on conflict do nothing;

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000003f0');
select essai('Joueur 0 s''inscrit à la prochaine ligue', $q$select public.s_inscrire_division()$q$, 'passe');
select en_tant_que('00000000-0000-0000-0000-0000000003f6');
select refus('Joueur 6, sans compte Riot, s''inscrit', $q$select public.s_inscrire_division()$q$, 'COMPTE_RIOT_REQUIS');
select en_tant_que('00000000-0000-0000-0000-0000000003f7');
select refus('Joueur 7 (suspendu) s''inscrit', $q$select public.s_inscrire_division()$q$, 'COMPTE_SUSPENDU');
select essai('Joueur 7 écrit directement une inscription',
  $q$insert into inscriptions_division (ligue_id, profile_id) select id, '00000000-0000-0000-0000-0000000003f7' from ligues_division limit 1$q$, 'bloque');
select en_tant_que('00000000-0000-0000-0000-0000000003f1');
select essai('Joueur 1 s''inscrit', $q$select public.s_inscrire_division()$q$, 'passe');
select verifie('Joueur 1 se désinscrit', public.quitter_division());
select essai('Joueur 1 se réinscrit', $q$select public.s_inscrire_division()$q$, 'passe');
select en_tant_que('00000000-0000-0000-0000-0000000003f2');
select public.s_inscrire_division();
select en_tant_que('00000000-0000-0000-0000-0000000003f3');
select public.s_inscrire_division();
select en_tant_que('00000000-0000-0000-0000-0000000003f4');
select public.s_inscrire_division();
select en_tant_que('00000000-0000-0000-0000-0000000003f5');
select public.s_inscrire_division();
reset role;

select verifie('Une seule ligue EUW, six inscrits, début un lundi à 00 h (Paris), quatre semaines',
  (select count(*) = 1 from ligues_division where region = 'EUW' and statut = 'inscriptions')
  and (select count(*) = 6 from inscriptions_division i join ligues_division l on l.id = i.ligue_id where l.region = 'EUW')
  and (select extract(isodow from debut_le at time zone 'Europe/Paris') = 1
              and (debut_le at time zone 'Europe/Paris')::time = '00:00'
              and fin_le = debut_le + interval '28 days' from ligues_division where region = 'EUW'));

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000003f0');
select refus('Un joueur forme lui-même les poules',
  $q$select public.former_poules_division((select id from ligues_division where region = 'EUW'), '[]'::jsonb)$q$,
  'permission denied for function former_poules_division');
reset role;

set role service_role;
select refus('Serveur : poule de deux joueurs',
  $q$select public.former_poules_division((select id from ligues_division where region = 'EUW'),
     '[["00000000-0000-0000-0000-0000000003f0","00000000-0000-0000-0000-0000000003f1"]]'::jsonb)$q$, 'TAILLE_POULE');
select refus('Serveur : un joueur non inscrit dans une poule',
  $q$select public.former_poules_division((select id from ligues_division where region = 'EUW'),
     '[["00000000-0000-0000-0000-0000000003f0","00000000-0000-0000-0000-0000000003f1","00000000-0000-0000-0000-0000000003f6"]]'::jsonb)$q$, 'JOUEUR_NON_INSCRIT');
select verifie('Serveur : deux poules de trois',
  public.former_poules_division((select id from ligues_division where region = 'EUW'),
    '[["00000000-0000-0000-0000-0000000003f0","00000000-0000-0000-0000-0000000003f1","00000000-0000-0000-0000-0000000003f2"],
      ["00000000-0000-0000-0000-0000000003f3","00000000-0000-0000-0000-0000000003f4","00000000-0000-0000-0000-0000000003f5"]]'::jsonb) = 2);
reset role;
select verifie('Ligue en cours, 6 rencontres (une par semaine et par paire), poule 1 = joueurs 0 à 2',
  (select statut = 'en_cours' from ligues_division where region = 'EUW')
  and (select count(*) = 6 from rencontres_division r join poules_division p on p.id = r.poule_id
       join ligues_division l on l.id = p.ligue_id where l.region = 'EUW')
  and (select count(*) = 3 from membres_poule_division m join poules_division p on p.id = m.poule_id
       where p.niveau = 1 and m.profile_id::text like '00000000-0000-0000-0000-0000000003f_'
         and right(m.profile_id::text, 1) in ('0', '1', '2')));

-- La ligue a commencé hier.
update ligues_division set debut_le = now() - interval '1 day', fin_le = now() + interval '27 days' where region = 'EUW';

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000000003f3');
select refus('Joueur 3 dit « Je suis là » pour une rencontre de l''autre poule',
  $q$select public.je_suis_la_division((select r.id from rencontres_division r join poules_division p on p.id = r.poule_id where p.niveau = 1 and r.semaine = 1))$q$,
  'RENCONTRE_INTROUVABLE');
select en_tant_que('00000000-0000-0000-0000-0000000003f0');
select refus('Joueur 0 veut jouer dès maintenant la rencontre de la semaine 2',
  $q$select public.je_suis_la_division((select r.id from rencontres_division r join poules_division p on p.id = r.poule_id where p.niveau = 1 and r.semaine = 2))$q$,
  'RENCONTRE_HORS_DELAI');
select verifie('Joueur 0 est là (semaine 1, contre joueur 2) : on attend son adversaire',
  public.je_suis_la_division((select r.id from rencontres_division r join poules_division p on p.id = r.poule_id where p.niveau = 1 and r.semaine = 1)) is null);
select en_tant_que('00000000-0000-0000-0000-0000000003f2');
select verifie('Joueur 2 est là aussi : le duel est lancé',
  public.je_suis_la_division((select r.id from rencontres_division r join poules_division p on p.id = r.poule_id where p.niveau = 1 and r.semaine = 1)) like 'division-%');
select refus('Joueur 2 relance la même rencontre',
  $q$select public.je_suis_la_division((select r.id from rencontres_division r join poules_division p on p.id = r.poule_id where p.niveau = 1 and r.semaine = 1))$q$,
  'MATCH_DEJA_LANCE');
reset role;
select verifie('Duel ordinaire : nature défi, en cours, deux joueurs confirmés, un match lancé',
  (select t.nature = 'defi' and t.statut = 'en_cours' and t.nom like 'Division %'
          and (select count(*) = 2 from registrations where tournament_id = t.id and statut = 'confirme')
          and (select count(*) = 1 from matches where tournament_id = t.id and statut = 'en_cours')
   from rencontres_division r join tournaments t on t.id = r.tournament_id
   join poules_division p on p.id = r.poule_id where p.niveau = 1 and r.semaine = 1));

-- Verdict lu chez Riot : joueur 2 gagne.
insert into match_verdicts (match_id, niveau, gagnant_id, est_definitif)
select m.id, 'historique', '00000000-0000-0000-0000-0000000003f2', true
from rencontres_division r join matches m on m.tournament_id = r.tournament_id
join poules_division p on p.id = r.poule_id where p.niveau = 1 and r.semaine = 1;
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select verifie('Visiteur : les rencontres de la ligue, avec le vainqueur lu chez Riot',
  (select count(*) = 6 from public.rencontres_ligue((select id from ligues_division where region = 'EUW')))
  and (select gagnant_id = '00000000-0000-0000-0000-0000000003f2' and niveau_verdict = 'historique'
       from public.rencontres_ligue((select id from ligues_division where region = 'EUW')) where tournoi_slug is not null));
reset role;

set role service_role;
select verifie('Serveur : classement final écrit pour les six joueurs',
  public.cloturer_ligue_division((select id from ligues_division where region = 'EUW'),
    (select jsonb_agg(jsonb_build_object('joueur', m.profile_id, 'poule', m.poule_id, 'rang', m.ordre, 'mouvement', 'reste'))
     from membres_poule_division m join poules_division p on p.id = m.poule_id
     join ligues_division l on l.id = p.ligue_id where l.region = 'EUW')) = 6);
reset role;
select verifie('La ligue est terminée', (select statut = 'terminee' from ligues_division where region = 'EUW'));
