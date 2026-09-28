# Mise en ligne des correctifs de l'audit du 27/09/2026

Branche : `claude/nice-faraday-nsoe9q`. Ce document dit **dans quel ordre**
mettre en ligne ces changements. L'ordre compte : le code s'appuie sur des
fonctions et des règles de la base qui n'existent pas encore en production.
Mettre le code en ligne avant la base casserait la liaison Riot,
l'inscription aux tournois, le check-in et la reconnaissance de défaite.

## 0. Relancer la base (porteur du projet)

La base Supabase de production est en pause (audit C1). Rien ne peut être
appliqué tant qu'elle n'est pas relancée depuis le tableau de bord
Supabase.

## 1. Vérifications avant migration (lecture seule)

À lancer dans l'éditeur SQL de Supabase. Aucune ne modifie quoi que ce soit.

```sql
-- a) Pseudos ou adresses de profil hors format : la migration ajoute des
--    règles de format, une ligne non conforme ne pourrait plus être
--    modifiée. À corriger à la main avant, s'il y en a.
select id, pseudo, slug from public.profiles
where pseudo !~ '^[a-zA-Z0-9 _-]{3,20}$' or slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$';

-- b) Logos d'équipe venant d'un autre site : ils seront effacés (le
--    capitaine devra redéposer son logo avec le bouton d'envoi).
select id, nom, logo_url from public.teams
where logo_url is not null and logo_url !~ '/storage/v1/object/public/logos/equipe/';

-- c) Joueurs avec plusieurs comptes Riot « principaux » : la migration n'en
--    garde qu'un comme principal (le plus récemment vérifié ; à défaut, le
--    plus récemment synchronisé).
select profile_id, count(*) from public.game_accounts
where est_principal group by profile_id having count(*) > 1;

-- d) Comptes Riot « vérifiés » avant la correction de la faille C2 : ils
--    ont pu être vérifiés sans preuve. Décision du porteur : les garder,
--    ou les repasser en « non vérifié » pour une nouvelle vérification.
select count(*) from public.game_accounts where verifie_le is not null;
```

Vérifier aussi que la production correspond bien à `docs/schema.sql` tel
qu'il était avant ces changements (commit `139eacc`) : fonctions, policies,
tâches pg_cron. Une divergence se traite avant d'appliquer la suite.

## 2. Appliquer la migration

Toute la migration est **la fin de `docs/schema.sql`, à partir de la ligne
« Liaison Riot réservée au serveur (2026-09-28, audit C2) »** (ligne 1448
aujourd'hui) jusqu'à la dernière ligne. Elle s'applique d'un seul bloc, dans
une transaction, et contient 19 sections, dans cet ordre :

1. Liaison Riot réservée au serveur (C2)
2. Règles appliquées par la base (E1, M1 à M4)
3. Compte Riot vérifié exigé pour s'inscrire (E2)
4. Défaite reconnue (N3, M8)
5. Clôture de tournoi à l'abri des exécutions simultanées (M16)
6. Alerte « clé Riot expirée » (E13)
7. Désinscription, brouillons privés (M7, F2)
8. Profil modifiable, visites anonymes (E7, M10)
9. Suspension de compte (M14)
10. Consentement enregistré (M10)
11. Logos : stockage verrouillé (M6)
12. Assistant IA : limite par compte (F2)
13. Abonnement Stripe : portail client
14. Suppression de compte en libre-service (M17)
15. Comptes Riot : délier, Riot ID non vérifiés privés (M9)
16. Tentatives de connexion par adresse IP (F1)
17. Registre des points scellé (N8) — scelle aussi les lignes déjà écrites,
    puis interdit toute modification du journal des points
18. Certificat de niveau vérifiable (N9)
19. Récap de la semaine (N17)

La section 2 a elle-même sept sous-parties (inscriptions et check-in,
tournois, matchs, équipes, messagerie, profils, litiges).

Le même bloc est rejoué à chaque envoi de code sur une base PostgreSQL de
test par `npm run test:base` (183 vérifications, toutes au vert au
28/09/2026) : c'est exactement l'enchaînement « ancien schéma + migration ».

Après application : lancer les conseillers de sécurité et de performance
de Supabase (Advisors) et comparer avec l'état d'avant.

## 3. Réglages Supabase (porteur du projet)

- **Authentication → URL Configuration** : ajouter
  `https://<domaine>/auth/callback` **avec ses paramètres** (par exemple
  `https://<domaine>/**`), utilisé par « mot de passe oublié »
  (`?next=/nouveau-mot-de-passe`) et la connexion Discord.
- **Authentication → Policies / Passwords** : longueur minimale 8 (le site
  l'exige déjà), protection contre les mots de passe compromis.
- **Authentication → SMTP** : un expéditeur à soi (les e-mails de Supabase
  par défaut sont limités à quelques envois par heure).
- **Authentication → Attack protection** : CAPTCHA (clés hCaptcha ou
  Turnstile à créer), qui protège aussi les appels directs à l'API.

## 4. Stripe (porteur du projet, quand la vente sera ouverte)

- **Settings → Billing → Customer portal** : activer et régler le portail
  (résiliation, changement de carte, factures) — c'est lui qu'ouvre
  « Gérer mon abonnement ».
- Webhook : événements `checkout.session.completed`,
  `customer.subscription.updated`, `customer.subscription.deleted`.
- Préalable non technique : cadre légal de la vente (audit E11).

## 5. Mettre le code en ligne

Fusionner la branche seulement **après** l'étape 2. Aucune nouvelle
variable d'environnement n'est nécessaire.

## 6. Vérifications après mise en ligne

- Inscription par e-mail puis par Discord ; « mot de passe oublié ».
- Liaison d'un Riot ID (défi d'icône), puis inscription à un tournoi de la
  bonne région ; refus clair pour un compte non vérifié.
- Check-in, lancement du bracket, salle de match, « J'ai perdu ce match ».
- Modifier son profil (pseudo, visites anonymes), ancienne adresse du CV
  qui redirige.
- Images de partage : coller l'adresse d'un CV et d'un tournoi dans
  Discord, ou dans l'outil de débogage de partage de Facebook ou LinkedIn.
- En-têtes de sécurité : `curl -I https://<domaine>/` doit montrer
  `Content-Security-Policy: frame-ancestors 'none'…`.
- `/admin` : suspendre puis lever la suspension d'un compte de test.
- `/registre` : chaîne « intacte » ; `node scripts/verifier-registre.mjs
  https://<domaine>/registre/export` doit donner la même dernière
  empreinte. Le premier soir avec un tournoi clôturé, l'empreinte doit
  apparaître sur Discord après 23 h 45.
