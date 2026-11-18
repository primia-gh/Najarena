-- Matching duo (18/11/2026) : annonces, demandes, conversation ouverte
-- seulement sur accord.
\set ON_ERROR_STOP 0

-- Ana, Bob, Dan, Eve, Fay, Gus : EUW vérifiés. Cyd : NA. Uma : sans compte Riot.
insert into auth.users (id, email, raw_user_meta_data)
select ('9990d000-0000-0000-0000-00000000000' || n)::uuid, 'duo' || n || '@test',
       json_build_object('pseudo', 'Duo99g' || n, 'slug', 'duo99g' || n)::jsonb
from generate_series(1, 8) n;
insert into game_accounts (profile_id, game_id, puuid, riot_game_name, riot_tag_line, region, est_principal, verifie_le, methode_verification)
select ('9990d000-0000-0000-0000-00000000000' || n)::uuid, 1, 'P-DUO-' || n, 'Duo' || n,
       case when n = 3 then 'NA1' else 'EUW' end, case when n = 3 then 'NA' else 'EUW' end, true, now(), 'icone_profil'
from generate_series(1, 7) n;
-- Ana classée (rating visible), les autres non.
insert into ratings (profile_id, game_id, season_id, rating, rd)
select '9990d000-0000-0000-0000-000000000001', 1, s.id, 1620, 90 from seasons s where s.est_courante;
\set ana '9990d000-0000-0000-0000-000000000001'
\set bob '9990d000-0000-0000-0000-000000000002'
\set cyd '9990d000-0000-0000-0000-000000000003'
\set dan '9990d000-0000-0000-0000-000000000004'
\set eve '9990d000-0000-0000-0000-000000000005'
\set fay '9990d000-0000-0000-0000-000000000006'
\set gus '9990d000-0000-0000-0000-000000000007'
\set uma '9990d000-0000-0000-0000-000000000008'

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select refus('Un visiteur publie une annonce',
  $q$select public.publier_annonce_duo('adc', array['support'], array['semaine_soir'], 'classees')$q$,
  'permission denied for function publier_annonce_duo');
select verifie('Un visiteur lit les annonces (aucune pour l''instant)',
  not exists (select 1 from public.annonces_duo_publiques() where pseudo like 'Duo99g%'));
reset role;

set role authenticated;
select en_tant_que(:'uma');
select refus('Uma, sans compte Riot vérifié, publie',
  $q$select public.publier_annonce_duo('adc', array['support'], array['semaine_soir'], 'classees')$q$, 'COMPTE_RIOT_REQUIS');
select en_tant_que(:'ana');
select refus('Ana choisit un poste inconnu',
  $q$select public.publier_annonce_duo('roamer', array['support'], array['semaine_soir'], 'classees')$q$, 'POSTE_INVALIDE');
select refus('Ana cherche son propre poste',
  $q$select public.publier_annonce_duo('adc', array['adc', 'support'], array['semaine_soir'], 'classees')$q$, 'POSTES_CHERCHES_INVALIDES');
select refus('Ana ne cherche aucun poste',
  $q$select public.publier_annonce_duo('adc', array[]::text[], array['semaine_soir'], 'classees')$q$, 'POSTES_CHERCHES_INVALIDES');
select refus('Ana n''indique aucun créneau',
  $q$select public.publier_annonce_duo('adc', array['support'], array[]::text[], 'classees')$q$, 'CRENEAUX_INVALIDES');
select refus('Ana invente un créneau',
  $q$select public.publier_annonce_duo('adc', array['support'], array['lundi_midi'], 'classees')$q$, 'CRENEAUX_INVALIDES');
select refus('Ana choisit un objectif inconnu',
  $q$select public.publier_annonce_duo('adc', array['support'], array['semaine_soir'], 'argent')$q$, 'OBJECTIF_INVALIDE');
select refus('Ana écrit un message trop long',
  format($q$select public.publier_annonce_duo('adc', array['support'], array['semaine_soir'], 'classees', %L)$q$, repeat('a', 201)), 'MESSAGE_TROP_LONG');
select refus('Ana écrit une insulte dans son annonce',
  $q$select public.publier_annonce_duo('adc', array['support'], array['semaine_soir'], 'classees', 'pas de bâtards')$q$, 'TEXTE_INTERDIT');
select essai('Ana publie : ADC, cherche un support, en semaine le soir',
  $q$select public.publier_annonce_duo('adc', array['support', 'support'], array['semaine_soir', 'weekend_soir'], 'classees', 'Je monte en classées')$q$, 'passe');
select essai('Ana écrit elle-même dans les annonces',
  $q$update annonces_duo set expire_le = now() + interval '1 year' where profile_id = '9990d000-0000-0000-0000-000000000001'$q$, 'bloque');
select essai('Ana relit son annonce', $q$select 1 from annonces_duo where postes_cherches = array['support']$q$, 'passe');
select en_tant_que(:'bob');
select essai('Bob ne lit pas la ligne d''Ana dans la table', $q$select 1 from annonces_duo where profile_id = '9990d000-0000-0000-0000-000000000001'$q$, 'bloque');
select refus('Bob, sans annonce, demande Ana en duo', format($q$select public.demander_duo(%L)$q$, :'ana'), 'ANNONCE_REQUISE');
select essai('Bob publie : support, cherche un ADC',
  $q$select public.publier_annonce_duo('support', array['adc'], array['semaine_soir'], 'classees')$q$, 'passe');
reset role;

set role anon;
select verifie('Un visiteur voit les deux annonces d''EUW ; le rating d''Ana (classée) seulement',
  (select count(*) = 2 from public.annonces_duo_publiques('EUW') where pseudo like 'Duo99g%')
  and (select rating = 1620 from public.annonces_duo_publiques('EUW') where pseudo = 'Duo99g1')
  and (select rating is null from public.annonces_duo_publiques('EUW') where pseudo = 'Duo99g2')
  and not exists (select 1 from public.annonces_duo_publiques('NA') where pseudo like 'Duo99g%'));
reset role;

set role authenticated;
select en_tant_que(:'bob');
select refus('Bob se demande lui-même', format($q$select public.demander_duo(%L)$q$, :'bob'), 'DUO_SOI_MEME');
select refus('Bob demande Dan, qui n''a pas d''annonce', format($q$select public.demander_duo(%L)$q$, :'dan'), 'ANNONCE_INTROUVABLE');
select en_tant_que(:'cyd');
select essai('Cyd (NA) publie', $q$select public.publier_annonce_duo('mid', array['jungle'], array['weekend_nuit'], 'loisir')$q$, 'passe');
select en_tant_que(:'bob');
select refus('Bob demande Cyd, qui joue sur NA', format($q$select public.demander_duo(%L)$q$, :'cyd'), 'REGION_DIFFERENTE');
select essai('Bob demande Ana en duo', format($q$select public.demander_duo(%L)$q$, :'ana'), 'passe');
select refus('Bob insiste', format($q$select public.demander_duo(%L)$q$, :'ana'), 'DEMANDE_DEJA_EN_COURS');
select essai('Bob écrit lui-même une demande acceptée',
  $q$insert into demandes_duo (demandeur_id, destinataire_id, statut) values ('9990d000-0000-0000-0000-000000000002', '9990d000-0000-0000-0000-000000000003', 'acceptee')$q$, 'bloque');
select en_tant_que(:'ana');
select refus('Ana demande Bob en retour pendant que la demande attend', format($q$select public.demander_duo(%L)$q$, :'bob'), 'DEMANDE_DEJA_EN_COURS');
select essai('Ana voit la demande de Bob', $q$select 1 from demandes_duo where demandeur_id = '9990d000-0000-0000-0000-000000000002'$q$, 'passe');
select en_tant_que(:'cyd');
select essai('Cyd ne voit pas les demandes des autres', $q$select 1 from demandes_duo$q$, 'bloque');
reset role;
select id as demande_bob from demandes_duo where demandeur_id = :'bob' and destinataire_id = :'ana' \gset

set role authenticated;
select en_tant_que(:'bob');
select refus('Bob accepte sa propre demande', format($q$select public.repondre_demande_duo(%L, true)$q$, :'demande_bob'), 'NON_DESTINATAIRE');
select en_tant_que(:'ana');
select verifie('Ana refuse', (select public.repondre_demande_duo(:'demande_bob', false) is null));
select refus('Ana répond une deuxième fois', format($q$select public.repondre_demande_duo(%L, true)$q$, :'demande_bob'), 'DEMANDE_DEJA_TRAITEE');
select en_tant_que(:'bob');
select refus('Bob redemande Ana juste après son refus', format($q$select public.demander_duo(%L)$q$, :'ana'), 'DEMANDE_REFUSEE_RECEMMENT');
select en_tant_que(:'ana');
select essai('Ana change d''avis et demande Bob', format($q$select public.demander_duo(%L)$q$, :'bob'), 'passe');
reset role;
select id as demande_ana from demandes_duo where demandeur_id = :'ana' and destinataire_id = :'bob' and statut = 'en_attente' \gset
select verifie('Pas encore de conversation entre eux',
  not exists (select 1 from conversations where least(profile_a, profile_b) = least(:'ana'::uuid, :'bob'::uuid)
                                             and greatest(profile_a, profile_b) = greatest(:'ana'::uuid, :'bob'::uuid)));

set role authenticated;
select en_tant_que(:'bob');
select verifie('Bob accepte : la conversation s''ouvre', (select public.repondre_demande_duo(:'demande_ana', true) is not null));
reset role;
select id as conv from conversations where least(profile_a, profile_b) = least(:'ana'::uuid, :'bob'::uuid)
                                     and greatest(profile_a, profile_b) = greatest(:'ana'::uuid, :'bob'::uuid) \gset
select verifie('Demande acceptée et reliée à la conversation',
  (select statut = 'acceptee' and conversation_id = :'conv' from demandes_duo where id = :'demande_ana'));
set role authenticated;
select en_tant_que(:'ana');
select essai('Ana lit la conversation', format($q$select 1 from conversations where id = %L$q$, :'conv'), 'passe');
select essai('Ana écrit à Bob', format($q$insert into messages (conversation_id, expediteur_id, contenu) values (%L, '9990d000-0000-0000-0000-000000000001', 'Salut, ce soir ?')$q$, :'conv'), 'passe');
select en_tant_que(:'bob');
select refus('Bob redemande Ana : déjà en contact', format($q$select public.demander_duo(%L)$q$, :'ana'), 'DEJA_EN_CONTACT');
select en_tant_que(:'cyd');
select essai('Cyd ne lit pas leur conversation', format($q$select 1 from conversations where id = %L$q$, :'conv'), 'bloque');
reset role;

-- Retirer une demande.
set role authenticated;
select en_tant_que(:'gus');
select essai('Gus publie', $q$select public.publier_annonce_duo('jungle', array['mid', 'top'], array['weekend_journee'], 'equipe')$q$, 'passe');
select en_tant_que(:'ana');
select essai('Ana demande Gus', format($q$select public.demander_duo(%L)$q$, :'gus'), 'passe');
reset role;
select id as demande_gus from demandes_duo where demandeur_id = :'ana' and destinataire_id = :'gus' \gset
set role authenticated;
select en_tant_que(:'gus');
select verifie('Gus ne retire pas la demande d''Ana', not public.annuler_demande_duo(:'demande_gus'));
select en_tant_que(:'ana');
select verifie('Ana retire sa demande', public.annuler_demande_duo(:'demande_gus'));
select en_tant_que(:'gus');
select refus('Gus accepte une demande retirée', format($q$select public.repondre_demande_duo(%L, true)$q$, :'demande_gus'), 'DEMANDE_DEJA_TRAITEE');
reset role;

-- Demande de plus de 7 jours : expirée.
set role authenticated;
select en_tant_que(:'fay');
select essai('Fay publie', $q$select public.publier_annonce_duo('top', array['jungle'], array['semaine_journee'], 'loisir')$q$, 'passe');
reset role;
insert into demandes_duo (demandeur_id, destinataire_id, cree_le) values (:'fay', :'gus', now() - interval '8 days');
select id as demande_fay from demandes_duo where demandeur_id = :'fay' and destinataire_id = :'gus' \gset
set role authenticated;
select en_tant_que(:'gus');
select refus('Gus accepte une demande de 8 jours', format($q$select public.repondre_demande_duo(%L, true)$q$, :'demande_fay'), 'DEMANDE_EXPIREE');
select en_tant_que(:'fay');
select essai('Fay redemande Gus : l''ancienne demande a expiré', format($q$select public.demander_duo(%L)$q$, :'gus'), 'passe');
reset role;
select verifie('L''ancienne demande est marquée expirée', (select statut = 'expiree' from demandes_duo where id = :'demande_fay'));

-- Plafond : 10 demandes par 24 h.
set role authenticated;
select en_tant_que(:'eve');
select essai('Eve publie', $q$select public.publier_annonce_duo('mid', array['jungle'], array['semaine_soir'], 'classees')$q$, 'passe');
reset role;
insert into demandes_duo (demandeur_id, destinataire_id, statut, cree_le)
select :'eve', :'dan', 'annulee', now() - interval '1 hour' from generate_series(1, 10);
set role authenticated;
select en_tant_que(:'eve');
select refus('Eve envoie une onzième demande en 24 h', format($q$select public.demander_duo(%L)$q$, :'gus'), 'LIMITE_DEMANDES_DUO');
reset role;

-- Suspension : l'annonce disparaît, plus de demande possible.
insert into suspensions (profile_id, motif) values (:'fay', 'Essai duo');
set role anon;
select verifie('Fay suspendue : son annonce n''est plus visible',
  not exists (select 1 from public.annonces_duo_publiques() where pseudo = 'Duo99g6'));
reset role;
set role authenticated;
select en_tant_que(:'gus');
select refus('Gus accepte la demande de Fay suspendue',
  format($q$select public.repondre_demande_duo((select id from demandes_duo where demandeur_id = %L and statut = 'en_attente'), true)$q$, :'fay'),
  'DEMANDEUR_INDISPONIBLE');
select en_tant_que(:'fay');
select refus('Fay suspendue publie', $q$select public.publier_annonce_duo('top', array['jungle'], array['semaine_journee'], 'loisir')$q$, 'COMPTE_SUSPENDU');
reset role;
update suspensions set levee_le = now() where profile_id = :'fay';

-- Retirer son annonce : ses demandes en attente sont annulées.
set role authenticated;
select en_tant_que(:'fay');
select verifie('Fay retire son annonce', public.retirer_annonce_duo());
reset role;
select verifie('Annonce retirée, demande de Fay annulée',
  not exists (select 1 from annonces_duo where profile_id = :'fay')
  and not exists (select 1 from demandes_duo where demandeur_id = :'fay' and statut = 'en_attente'));

-- Annonce de plus de 14 jours : plus visible, plus demandable.
update annonces_duo set expire_le = now() - interval '1 minute' where profile_id = :'cyd';
set role anon;
select verifie('Annonce expirée : plus visible', not exists (select 1 from public.annonces_duo_publiques() where pseudo = 'Duo99g3'));
reset role;

-- Compte supprimé : annonce et demandes effacées.
update profiles set supprime_le = now() where id = :'eve';
select verifie('Compte d''Eve supprimé : son annonce et ses demandes ont disparu',
  not exists (select 1 from annonces_duo where profile_id = :'eve')
  and not exists (select 1 from demandes_duo where demandeur_id = :'eve' or destinataire_id = :'eve'));
