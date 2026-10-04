-- Tournoi classé : critères publics, décision figée à la clôture (audit E12, N12).
\set ON_ERROR_STOP 0

-- Olga organise (…040) ; Classe1 à Classe8 jouent (…041 à …048).
insert into auth.users (id, email, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000000' || to_hex(64 + i))::uuid, 'classe' || i || '@test',
       jsonb_build_object('pseudo', case when i = 0 then 'Olga' else 'Classe' || i end,
                          'slug', case when i = 0 then 'olga' else 'classe' || i end)
from generate_series(0, 8) as i;

-- Un tournoi d'essai : p_joueurs placés au premier tour, une finale à jouer.
create function pg_temp.tournoi_essai(
  p_id uuid, p_joueurs int, p_debut interval,
  p_orga_joue boolean default false, p_creneau text default null, p_amical boolean default false
) returns void language plpgsql as $$
declare
  v_finale uuid := gen_random_uuid();
  v_joueur uuid;
begin
  insert into tournaments (id, game_id, season_id, organisateur_id, slug, nom, format, capacite, region,
                           debute_le, checkin_ouvre_le, statut, creneau_auto, compte_pour_classement)
  values (p_id, 1, (select id from seasons where est_courante), '00000000-0000-0000-0000-000000000040',
          'classe-' || left(p_id::text, 8) || right(p_id::text, 4), 'Essai classe', '1v1', 8, 'EUW',
          now() + p_debut, now() + p_debut, 'en_cours', p_creneau, not p_amical);
  insert into matches (id, tournament_id, tour, position, statut) values (v_finale, p_id, 2, 1, 'en_attente');
  for i in 1..ceil(p_joueurs / 2.0)::int loop
    insert into matches (tournament_id, tour, position, statut, match_suivant_id) values (p_id, 1, i, 'en_cours', v_finale);
  end loop;
  for i in 1..p_joueurs loop
    v_joueur := case when p_orga_joue and i = 1 then '00000000-0000-0000-0000-000000000040'::uuid
                     else ('00000000-0000-0000-0000-0000000000' || to_hex(64 + i))::uuid end;
    insert into match_participants (match_id, profile_id, slot)
    select m.id, v_joueur, 2 - (i % 2)
    from matches m where m.tournament_id = p_id and m.tour = 1 and m.position = ceil(i / 2.0)::int;
  end loop;
end $$;

select pg_temp.tournoi_essai('91000000-0000-0000-0000-000000000001', 8, interval '2 days');
select pg_temp.tournoi_essai('91000000-0000-0000-0000-000000000002', 8, interval '5 hours');
select pg_temp.tournoi_essai('91000000-0000-0000-0000-000000000003', 8, interval '2 days', p_orga_joue => true);
select pg_temp.tournoi_essai('91000000-0000-0000-0000-000000000004', 4, interval '2 days');
select pg_temp.tournoi_essai('91000000-0000-0000-0000-000000000005', 4, interval '1 hour', p_creneau => 'essai-classe');
select pg_temp.tournoi_essai('91000000-0000-0000-0000-000000000006', 8, interval '2 days', p_amical => true);

set role anon;
select verifie('Visiteur : 8 joueurs, publié 2 jours avant, organisatrice hors bracket → classé',
  (select classe and joueurs_au_depart = 8 and publie_a_temps and not organisateur_joue
     from public.criteres_tournoi_classe('91000000-0000-0000-0000-000000000001')));
select verifie('Publié 5 h avant le début → non classé',
  (select not classe and not publie_a_temps from public.criteres_tournoi_classe('91000000-0000-0000-0000-000000000002')));
select verifie('L''organisatrice joue dans son tournoi → non classé',
  (select not classe and organisateur_joue from public.criteres_tournoi_classe('91000000-0000-0000-0000-000000000003')));
select verifie('4 joueurs au départ → non classé',
  (select not classe and joueurs_au_depart = 4 from public.criteres_tournoi_classe('91000000-0000-0000-0000-000000000004')));
select verifie('Tournoi officiel à 4 joueurs, publié 1 h avant → classé',
  (select classe and officiel from public.criteres_tournoi_classe('91000000-0000-0000-0000-000000000005')));
select verifie('Tournoi amical à 8 joueurs → non classé',
  (select not classe and amical from public.criteres_tournoi_classe('91000000-0000-0000-0000-000000000006')));
reset role;

-- Heure de publication : posée par la base, jamais par l'organisateur.
set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000040');
select essai('Olga crée un brouillon avec une fausse date de publication',
  $q$insert into tournaments (id, game_id, organisateur_id, slug, nom, format, capacite, region, debute_le, checkin_ouvre_le, statut, publie_le) values ('91000000-0000-0000-0000-000000000007', 1, '00000000-0000-0000-0000-000000000040', 'brouillon-olga', 'Brouillon Olga', '1v1', 8, 'EUW', now() + interval '3 days', now() + interval '3 days', 'brouillon', now() - interval '30 days')$q$, 'passe');
reset role;
select verifie('Brouillon : aucune date de publication enregistrée',
  (select publie_le is null from tournaments where id = '91000000-0000-0000-0000-000000000007'));
-- Un visiteur anonyme n'a pas d'identité : on efface celle d'Olga.
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select verifie('Visiteur : les critères d''un brouillon restent invisibles',
  (select count(*) = 0 from public.criteres_tournoi_classe('91000000-0000-0000-0000-000000000007')));
reset role;

set role authenticated;
select en_tant_que('00000000-0000-0000-0000-000000000040');
select essai('Olga publie son brouillon',
  $q$update tournaments set statut = 'ouvert' where id = '91000000-0000-0000-0000-000000000007'$q$, 'passe');
select essai('Olga antidate la publication (ignoré par la base)',
  $q$update tournaments set publie_le = now() - interval '30 days' where id = '91000000-0000-0000-0000-000000000007'$q$, 'passe');
select refus('Olga déclare elle-même son tournoi classé',
  $q$update tournaments set classe = true where id = '91000000-0000-0000-0000-000000000007'$q$, 'CHAMP_NON_MODIFIABLE');
select essai('Olga appelle la fonction qui fige le classement (réservée au serveur)',
  $q$select public.figer_classement_tournoi('91000000-0000-0000-0000-000000000001')$q$, 'bloque');
reset role;
select verifie('Publication datée de maintenant, pas de la date antidatée',
  (select publie_le > now() - interval '1 minute' from tournaments where id = '91000000-0000-0000-0000-000000000007'));

-- Décision figée à la clôture.
set role service_role;
select refus('Serveur : figer le classement avant la finale',
  $q$select public.figer_classement_tournoi('91000000-0000-0000-0000-000000000001')$q$, 'FINALE_NON_JOUEE');
reset role;
update matches set statut = 'termine'
where match_suivant_id is null and tournament_id in ('91000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000004');
set role service_role;
select essai('Serveur : finale jouée, le tournoi à 8 joueurs est déclaré classé',
  $q$select 1 where public.figer_classement_tournoi('91000000-0000-0000-0000-000000000001')$q$, 'passe');
select essai('Serveur : le tournoi à 4 joueurs est déclaré non classé',
  $q$select 1 where not public.figer_classement_tournoi('91000000-0000-0000-0000-000000000004')$q$, 'passe');
select refus('Serveur : retourner une décision déjà figée',
  $q$update tournaments set classe = true where id = '91000000-0000-0000-0000-000000000004'$q$, 'CLASSEMENT_FIGE');
select refus('Serveur : écrire des points pour le tournoi non classé',
  $q$select public.cloturer_rating_joueur('00000000-0000-0000-0000-000000000041', 1::smallint, (select id from seasons where est_courante), '91000000-0000-0000-0000-000000000004', 1500, 350, 0.06, 1600, 300, 0.06, 1, 'tournoi')$q$, 'TOURNOI_NON_CLASSE');
select essai('Serveur : écrire des points pour le tournoi classé',
  $q$select public.cloturer_rating_joueur('00000000-0000-0000-0000-000000000041', 1::smallint, (select id from seasons where est_courante), '91000000-0000-0000-0000-000000000001', 1500, 350, 0.06, 1600, 300, 0.06, 1, 'tournoi')$q$, 'passe');
reset role;
select verifie('Relancer la décision ne la change pas',
  (select public.figer_classement_tournoi('91000000-0000-0000-0000-000000000001')
          and not public.figer_classement_tournoi('91000000-0000-0000-0000-000000000004')));
