# Mise en ligne des correctifs de l'audit du 27/09/2026

> **Statut au 04/10/2026** : base de production relancée et mise à jour
> (sections 1 à 36), puis vérifiée élément par élément contre ce dépôt —
> fonctions, colonnes, contraintes, index, règles d'accès, droits,
> déclencheurs, stockage des logos : identiques. Reste à faire côté
> porteur du projet : le secret des tâches planifiées (§ 2 bis) et les
> réglages des §§ 3 et 4.

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

-- e) Formats de tournoi : la section 25 n'accepte que « 1v1 » et « 5v5 »,
--    et un 5v5 hors classement individuel. Toute ligne renvoyée ici ferait
--    échouer la migration : à corriger à la main avant.
select id, nom, format, compte_pour_classement from public.tournaments
where format not in ('1v1', '5v5') or (format = '5v5' and compte_pour_classement);
```

Après la migration (section 24), les textes déjà en base que la modération
refuserait aujourd'hui (à renommer à la main si besoin) :

```sql
select 'pseudo' as champ, pseudo as texte from public.profiles
where public.analyser_texte(pseudo, 'nom') like 'refus:%'
union all
select 'equipe', nom from public.teams where public.analyser_texte(nom, 'nom') like 'refus:%'
union all
select 'tournoi', nom from public.tournaments
where creneau_auto is null and nature = 'tournoi' and public.analyser_texte(nom, 'nom') like 'refus:%';
```

Vérifier aussi que la production correspond bien à `docs/schema.sql` tel
qu'il était avant ces changements (commit `139eacc`) : fonctions, policies,
tâches pg_cron. Une divergence se traite avant d'appliquer la suite.

## 2. Appliquer la migration

Toute la migration est **la fin de `docs/schema.sql`, à partir de la ligne
« Liaison Riot réservée au serveur (2026-09-28, audit C2) »** (ligne 1448
aujourd'hui) jusqu'à la dernière ligne. Elle s'applique d'un seul bloc, dans
une transaction, et contient 36 sections, dans cet ordre :

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
20. Tournoi classé : critères publics (E12, N12) — un tournoi en cours au
    moment de la migration sera jugé sur ces critères à sa clôture (un
    tournoi à moins de 8 joueurs, par exemple, ne rapportera pas de points)
21. Forfait automatique (N4)
22. Conditions de victoire du 1v1 (N5)
23. Défis entre joueurs et « Invite ton rival » (N16, N18) — un défi a
    besoin d'un arbitre : au moins un compte dans la table `admins`
24. Modération automatique (N27) — avant de l'appliquer, chercher les
    pseudos, noms d'équipe et de tournoi déjà en base qui seraient refusés
    (requête ci-dessous) : ils restent tels quels, mais ne pourront plus
    être réenregistrés sans changement
25. Tournois 5v5 (N21) — vérification e) ci-dessus avant de l'appliquer
26. Scrims vérifiés entre équipes (N22) — arbitrés, comme les défis, par
    le premier compte de la table `admins`
27. Agents libres en 5v5 (N23)
28. Objectif Nexus Tour et Clash (N24) — le calendrier Clash se remplit
    seul (clé Riot valide nécessaire) ; les étapes du Nexus Tour sont à
    saisir dans `/admin#echeances`, avec leur lien officiel
29. Revue de match et dossier de litige rédigés par l'IA (N25, N28) — sans
    `ANTHROPIC_API_KEY`, ces boutons n'apparaissent pas et le dossier de
    litige garde les faits seuls
30. Fiche publique de l'organisateur (N13)
31. Comptes Riot secondaires déclarés (N15) — remplace `lier_compte_riot`
    (nouveau paramètre `p_principal`) : base et code doivent passer
    ensemble, la base d'abord comme toujours
32. Arène 1v1 à la demande (N19) — l'appariement périodique passe par la
    tâche des tournois automatiques (toutes les 5 minutes), rien à ajouter
    dans pg_cron
33. Pronostics gratuits (N20)
34. Espaces communauté (N30) — après la mise en ligne du code, relancer
    `npm run discord:commandes` pour ajouter `/communaute`, `/lier` et
    `/organiser` au bot

35. Cash prizes sponsorisés (N32) — tables créées mais fonction éteinte :
    ne pas définir `CASH_PRIZES_ACTIFS` sur l'hébergeur
36. Durcissement : chemin de recherche des deux fonctions de calcul
    (signalé par le conseiller de sécurité après la section 35)

Les widgets et l'API publique (N31) n'ajoutent rien à la base : ils lisent
avec la clé publique, comme un visiteur déconnecté.

La section 2 a elle-même sept sous-parties (inscriptions et check-in,
tournois, matchs, équipes, messagerie, profils, litiges).

Le même bloc est rejoué à chaque envoi de code sur une base PostgreSQL de
test par `npm run test:base` (528 vérifications, toutes au vert au
03/10/2026) : c'est exactement l'enchaînement « ancien schéma + migration ».

Après application : lancer les conseillers de sécurité et de performance
de Supabase (Advisors) et comparer avec l'état d'avant.

Coller le fichier dans l'éditeur SQL depuis Windows ajoute un retour
chariot (caractère invisible) à chaque fin de ligne, y compris dans le
texte des fonctions. Le 04/10/2026, ils ont été retirés après coup,
chaque fonction concernée étant réécrite à partir de sa propre
définition :
`execute replace(pg_get_functiondef(oid), chr(13), '')` pour chaque
fonction de `public` dont le texte contient `chr(13)`. À refaire après
toute migration collée de la même façon.

## 2 bis. Secret des tâches planifiées (porteur du projet)

Les deux tâches pg_cron (toutes les 5 minutes) appellent le site avec le
secret rangé dans le coffre-fort Supabase. Il manquait au 04/10/2026 :
sans lui, les tournois automatiques et la recherche de résultats ne
tournent pas. Dans l'éditeur SQL de Supabase, avec la valeur de
`CRON_SECRET` définie sur Vercel :

```sql
select vault.create_secret('<valeur de CRON_SECRET sur Vercel>', 'najarena_cron_secret');
```

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
