-- Tournoi réservé aux membres : l'éligibilité est revérifiée au check-in,
-- par tous les chemins (contrôle du 17/10/2026). Et une école ne fait
-- jamais vérifier une adresse de messagerie.
\set ON_ERROR_STOP 0

-- 1 : fondateur et organisateur ; 2 à 9 : joueurs.
insert into auth.users (id, email, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000099d' || lpad(i::text, 4, '0'))::uuid, 'p99d' || i || '@test',
       json_build_object('pseudo', 'Reserve99d' || i, 'slug', 'reserve99d' || i)::jsonb
from generate_series(1, 9) i;
insert into comptes_offres (profile_id, offre) values ('00000000-0000-0000-0000-0000099d0001', 'organisateur');
insert into game_accounts (profile_id, game_id, puuid, riot_game_name, riot_tag_line, region, est_principal, verifie_le, methode_verification)
select ('00000000-0000-0000-0000-0000099d' || lpad(i::text, 4, '0'))::uuid, 1, 'P99D-' || i, 'R99d' || i, 'EUW', 'EUW', true, now(), 'icone_profil'
from generate_series(1, 9) i;

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000099d0001');
select essai('Le fondateur crée « Club 99d »', $q$select public.creer_communaute('Club 99d', 'club-99d')$q$, 'passe');
reset role;
select id as club from communautes where slug = 'club-99d' \gset
insert into membres_communaute (communaute_id, profile_id)
select :'club', ('00000000-0000-0000-0000-0000099d' || lpad(i::text, 4, '0'))::uuid from generate_series(2, 9) i;
select id as saison from seasons where est_courante \gset
insert into tournaments (id, game_id, season_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, communaute_id, reserve_membres, compte_pour_classement) values
  ('99d00000-0000-0000-0000-000000000001', 1, :'saison', '00000000-0000-0000-0000-0000099d0001', 'club-99d-1v1', 'Coupe 99d', '1v1', 8, 'EUW', now() + interval '3 days', now() + interval '3 days', 'ouvert', :'club', true, true),
  ('99d00000-0000-0000-0000-000000000002', 1, :'saison', '00000000-0000-0000-0000-0000099d0001', 'club-99d-5v5', 'Coupe 5v5 99d', '5v5', 8, 'EUW', now() + interval '3 days', now() + interval '3 days', 'ouvert', :'club', true, false);
insert into teams (id, game_id, slug, nom, tag, capitaine_id) values
  ('99d00000-0000-0000-0000-0000000000e1', 1, 'equipe-99d', 'Equipe 99d', 'E99D', '00000000-0000-0000-0000-0000099d0002');
insert into team_members (team_id, profile_id, accepte_le)
select '99d00000-0000-0000-0000-0000000000e1', ('00000000-0000-0000-0000-0000099d' || lpad(i::text, 4, '0'))::uuid, now()
from generate_series(2, 6) i
on conflict do nothing;

-- Inscriptions quand tout le monde est membre.
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000099d0008');
select essai('Joueur 8 s''inscrit au 1v1 réservé', $q$select public.s_inscrire_tournoi('99d00000-0000-0000-0000-000000000001')$q$, 'passe');
select en_tant_que('00000000-0000-0000-0000-0000099d0002');
select essai('Le capitaine inscrit son équipe de cinq membres',
  $q$select public.s_inscrire_equipe('99d00000-0000-0000-0000-000000000002', '99d00000-0000-0000-0000-0000000000e1', array['00000000-0000-0000-0000-0000099d0002','00000000-0000-0000-0000-0000099d0003','00000000-0000-0000-0000-0000099d0004','00000000-0000-0000-0000-0000099d0005','00000000-0000-0000-0000-0000099d0006']::uuid[])$q$,
  'passe');
select en_tant_que('00000000-0000-0000-0000-0000099d0007');
select essai('Joueur 7 se propose comme remplaçant', $q$select public.proposer_remplacement('99d00000-0000-0000-0000-000000000002', null)$q$, 'passe');
select en_tant_que('00000000-0000-0000-0000-0000099d0009');
select essai('Joueur 9 s''inscrit comme agent libre', $q$select public.s_inscrire_agent_libre('99d00000-0000-0000-0000-000000000002', null)$q$, 'passe');

-- Les joueurs 8, 6 et 9 quittent le club ; le check-in ouvre.
select en_tant_que('00000000-0000-0000-0000-0000099d0008');
select verifie('Joueur 8 quitte le club', (select public.quitter_communaute(:'club') is not false));
select en_tant_que('00000000-0000-0000-0000-0000099d0006');
select verifie('Joueur 6 (aligné) quitte le club', (select public.quitter_communaute(:'club') is not false));
select en_tant_que('00000000-0000-0000-0000-0000099d0009');
select verifie('Joueur 9 (agent libre) quitte le club', (select public.quitter_communaute(:'club') is not false));
reset role;
update tournaments set checkin_ouvre_le = now() - interval '1 minute'
where id in ('99d00000-0000-0000-0000-000000000001', '99d00000-0000-0000-0000-000000000002');

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000099d0008');
select refus('Joueur 8, sorti du club, confirme sa présence', $q$select public.confirmer_presence('99d00000-0000-0000-0000-000000000001')$q$, 'RESERVE_MEMBRES');
select en_tant_que('00000000-0000-0000-0000-0000099d0001');
select refus('L''organisateur confirme joueur 8',
  $q$update registrations set statut = 'confirme' where tournament_id = '99d00000-0000-0000-0000-000000000001' and profile_id = '00000000-0000-0000-0000-0000099d0008'$q$,
  'RESERVE_MEMBRES');
select essai('L''organisateur marque joueur 8 absent',
  $q$update registrations set statut = 'absent' where tournament_id = '99d00000-0000-0000-0000-000000000001' and profile_id = '00000000-0000-0000-0000-0000099d0008'$q$,
  'passe');
select refus('Puis le confirme depuis « absent »',
  $q$update registrations set statut = 'confirme' where tournament_id = '99d00000-0000-0000-0000-000000000001' and profile_id = '00000000-0000-0000-0000-0000099d0008'$q$,
  'RESERVE_MEMBRES');
select en_tant_que('00000000-0000-0000-0000-0000099d0002');
select refus('Le capitaine confirme l''équipe, un aligné est sorti du club', $q$select public.confirmer_presence('99d00000-0000-0000-0000-000000000002')$q$, 'RESERVE_MEMBRES');
select essai('Il remplace l''aligné sorti par joueur 7, membre',
  $q$select public.remplacer_aligne('99d00000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000099d0006', '00000000-0000-0000-0000-0000099d0007')$q$,
  'passe');
select verifie('Le capitaine confirme l''équipe', (select public.confirmer_presence('99d00000-0000-0000-0000-000000000002')));
select en_tant_que('00000000-0000-0000-0000-0000099d0009');
select refus('L''agent libre sorti du club confirme sa présence', $q$select public.confirmer_agent_libre('99d00000-0000-0000-0000-000000000002')$q$, 'RESERVE_MEMBRES');

-- Une école ne déclare pas un suffixe de pays, et la vraie adresse n'est
-- jamais une messagerie, même sous un domaine déclaré trop large.
select en_tant_que('00000000-0000-0000-0000-0000099d0001');
select essai('Le fondateur crée « Ecole 99d »', $q$select public.creer_communaute('Ecole 99d', 'ecole-99d')$q$, 'passe');
reset role;
select id as ecole from communautes where slug = 'ecole-99d' \gset
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-0000099d0001');
select refus('Domaine « co.uk » (suffixe de pays)', format($q$select public.definir_ecole(%L, array['co.uk'])$q$, :'ecole'), 'DOMAINE_INVALIDE');
select refus('Domaine « ac.uk »', format($q$select public.definir_ecole(%L, array['ac.uk'])$q$, :'ecole'), 'DOMAINE_INVALIDE');
select refus('Domaine « jetable.fr.nf » (messagerie jetable)', format($q$select public.definir_ecole(%L, array['jetable.fr.nf'])$q$, :'ecole'), 'DOMAINE_GRAND_PUBLIC');
reset role;
update communautes set type = 'ecole', domaines_email = array['co.uk'] where id = :'ecole';
insert into membres_communaute (communaute_id, profile_id) values (:'ecole', '00000000-0000-0000-0000-0000099d0003');
set role service_role;
select refus('Serveur : adresse Hotmail sous un domaine déclaré trop large',
  format($q$select public.preparer_verification_ecole('00000000-0000-0000-0000-0000099d0003', %L, 'quidam@hotmail.co.uk', '123456')$q$, :'ecole'),
  'DOMAINE_NON_ACCEPTE');
reset role;
