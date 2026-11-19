# Mise en ligne de la branche (sections du 18/11/2026)

**Statut** : rien de ces sections n'est encore en production. La production
correspond à `master` (fusion de la PR #4, sections 37 à 58 appliquées le
17/11/2026 — voir `docs/mise-en-ligne-2026-10-12.md`).

**Essayé avant d'écrire ce guide** : une base vierge reçoit le schéma de
`master`, puis la migration ci-dessous en un seul bloc ; la migration passe,
elle se rejoue une seconde fois sans erreur, et les 1176 vérifications de
`tests/sql/` passent ensuite.

Branche : `claude/nice-faraday-nsoe9q`. Comme les fois précédentes, **la base
d'abord, le code ensuite** : le code appelle des fonctions et lit des tables
que ces sections créent (duo, analyse IA, recherche, blocage). Mis en ligne
avant la base, il casserait `/lol/duo`, `/lol/recherche`, `/moi/bilan` et les
conversations.

## Ce que contient la migration

Quatre sections datées du 18/11/2026, à la fin de `docs/schema.sql` :

1. **Défis et arène : pas de duel pendant un match ouvert ; noms d'équipe
   uniques.** `match_ouvert_entre`, `creer_duel` et `apparier_joueur_arene`
   redéfinies ; index `teams_nom_unique` ; création d'équipes limitée
   (3 par 24 h, `consommer_limite` redéfinie), 5 équipes au plus comme
   capitaine, nom contrôlé (`controler_nom_equipe`).
2. **Matching duo.** Tables `annonces_duo`, `demandes_duo`, `blocages` ;
   fonctions du duo et du blocage ; **règle d'envoi des messages recréée**
   (« participants repondent ») pour tenir compte du blocage.
3. **Analyse de progression rédigée par l'IA.** Table
   `analyses_progression_ia` et deux déclencheurs d'effacement.
4. **Recherche recruteurs.** Fonction `rechercher_joueurs`.

## 1. Vérifications avant migration (lecture seule)

À lancer dans l'éditeur SQL de Supabase :

```sql
-- a) Des noms d'équipe « presque identiques » empêcheraient la création de
--    l'index d'unicité. Doit renvoyer 0 ligne (0 équipe au 18/11/2026).
select game_id,
       nullif(regexp_replace(translate(lower(nom), 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿœæ', 'aaaaaaceeeeiiiinooooouuuuyyoa'),
                             '[^a-z0-9]', '', 'g'), '') as cle,
       count(*)
from public.teams group by 1, 2 having count(*) > 1;

-- b) Noms d'équipe existants que la nouvelle règle refuserait (seulement
--    à leur prochaine modification : rien n'est cassé, mais à savoir).
select nom from public.teams
where char_length(btrim(nom)) not between 3 and 40
   or nom !~ '^[A-Za-zÀ-ÖØ-öø-ÿŒœ0-9 ''’.&!?#+:()_-]+$';

-- c) Réglage de langue de la base (la mise en minuscules des lettres
--    accentuées doit fonctionner) : doit renvoyer « lesloups ».
select regexp_replace(translate(lower('LÈS LOUPS'), 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿœæ', 'aaaaaaceeeeiiiinooooouuuuyyoa'), '[^a-z0-9]', '', 'g');
```

## 2. Migration de la base

Le bloc à exécuter est tout ce qui suit, dans `docs/schema.sql`, la dernière
ligne du fichier de `master` (commit `47c5688`). Il commence par
« -- ---------- Défis et arène : pas de duel pendant un match ouvert ».

Comme le 17/11, le plus sûr est de l'appliquer **en une transaction** depuis
l'éditeur SQL (ou par l'outil Supabase de cette session), puis de vérifier :

```sql
select f as fonction,
       exists (select 1 from pg_proc where proname = f and pronamespace = 'public'::regnamespace) as presente
from unnest(array[
  'match_ouvert_entre', 'cle_nom_equipe', 'controler_nom_equipe',
  'publier_annonce_duo', 'demander_duo', 'repondre_demande_duo', 'annuler_demande_duo',
  'annonces_duo_publiques', 'bloquer_joueur', 'debloquer_joueur', 'blocage_avec_moi',
  'rechercher_joueurs'
]) as f;  -- toutes « true »

select indexname from pg_indexes where indexname = 'teams_nom_unique';  -- 1 ligne
select polname from pg_policy where polrelid = 'public.messages'::regclass;  -- dont « participants repondent »
```

Puis lancer les conseillers Supabase (sécurité et performances) : aucune
nouvelle alerte n'est attendue (toutes les fonctions fixent leur
`search_path`).

## 3. Réglages Vercel

**Aucune nouvelle variable.** L'analyse de progression utilise
`ANTHROPIC_API_KEY`, comme les autres textes d'IA : tant qu'elle est absente
(c'est le cas au 17/11/2026), la section s'affiche avec « L'analyse par l'IA
n'est pas disponible pour l'instant » au clic, sans rien casser. Les
notifications du duo utilisent le bot Discord et les notifications du
navigateur déjà prévus (clés Discord et VAPID, absentes pour l'instant : la
demande part quand même, seul le message n'est pas envoyé).

## 4. Fusion du code

Après la migration de la base : fusionner la PR de la branche dans `master`.
Vercel déploie la production.

## 5. Contrôles sur le site

- `/lol/duo` : la page s'affiche (visiteur : choix du serveur ; connecté sans
  compte Riot : « Lier mon Riot ID ») ; publier une annonce avec un compte
  vérifié, la voir dans la liste, la retirer.
- Une conversation : le lien « Bloquer ce joueur » apparaît sous le
  formulaire ; bloquer, vérifier que l'envoi est refusé, débloquer.
- `/lol/recherche` (compte Organisateur) : la liste se remplit, les filtres
  « Actif », « En progression », « Fiables » changent le résultat.
- `/moi/bilan` (compte Elite avec 10 parties dans un format) : la section
  « Analyse de ta progression » apparaît sous le bilan.
- `/equipe/nouvelle` : un nom avec une lettre d'un autre alphabet est refusé
  avec un message clair.
- Erreurs d'exécution Vercel sur 24 h : aucune nouvelle.
