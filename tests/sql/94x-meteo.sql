-- Météo du classement (idée en réserve n°5) : des nombres publics, jamais
-- de noms ; les verdicts manuels comptés à part.
\set ON_ERROR_STOP 0

set role anon;
select essai('Visiteur : lit la météo du classement', $q$select 1 from public.meteo_classement()$q$, 'passe');
select essai('Visiteur : lit la météo semaine par semaine', $q$select 1 from public.meteo_semaines(8)$q$, 'passe');
reset role;

select verifie('Huit semaines, de la plus récente à la plus ancienne',
  (select count(*) = 8 and min(semaine) < max(semaine) from public.meteo_semaines(8)));
select verifie('Jamais plus de 26 semaines', (select count(*) = 26 from public.meteo_semaines(500)));
select verifie('Matchs vérifiés ≤ matchs, chaque semaine',
  not exists (select 1 from public.meteo_semaines(8) where matchs_verifies > matchs));
select verifie('Sur 30 jours : vérifiés ≤ matchs, classés ≤ joueurs notés',
  (select matchs_verifies_30j <= matchs_30j and joueurs_classes <= joueurs_avec_rating from public.meteo_classement()));
-- Le match manuel du scénario « forfait » (Paul contre Pia) compte, mais pas comme vérifié.
select verifie('Un verdict manuel des 30 derniers jours compte dans les matchs, pas dans les vérifiés',
  (select matchs_30j > matchs_verifies_30j from public.meteo_classement()));
