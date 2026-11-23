# Mise en ligne du 23/11/2026 — comptes jetables sur le CV, niveau Riot obligatoire, abonnements

Le code de cette mise en ligne lit une nouvelle colonne et un nouveau champ de fonction :
**la base se met à jour d'abord, le code ensuite.**

## Ce que contient la migration

Deux sections datées du 23/11/2026 à la fin de `docs/schema.sql`, à partir de la ligne
`-- ---------- Comptes jetables sur le CV (2026-11-23) ----------`
jusqu'à la fin du fichier :

1. **Comptes jetables sur le CV** :
   - colonne `stats_match_joueur.niveau_compte` (niveau Riot du compte qui a joué chaque partie,
     entre 0 et 100000) ;
   - `matchs_communs` redéfinie : une partie compte pour une recommandation seulement si les deux
     comptes avaient le niveau 30, si le verdict 1v1 n'est pas sous 30, et si le compte Riot qui
     l'a jouée est toujours lié et vérifié sur le même profil ;
   - `face_a_face` supprimée puis recréée avec un champ de plus (`niveau_compte_min`), mêmes
     droits (`anon`, `authenticated`) ;
   - en fin de section, `notify pgrst, 'reload schema'`.
2. **Niveau Riot obligatoire** : fonction `controler_niveau_compte_verdict` et déclencheur
   `niveau_compte_verdict` sur `match_verdicts`. Tout nouveau verdict 1v1 de niveau 2 ou 3 sans
   niveau de compte est refusé (`NIVEAU_COMPTE_REQUIS`). Fonction `refuser_modification_verdict`
   et déclencheur `verdict_immuable` : un verdict écrit ne se modifie plus (`VERDICT_IMMUABLE`,
   aucun code ne le faisait ; la suppression en cascade reste possible). À n'appliquer que si les
   deux contrôles de l'étape 1 sont bons.

Aucune donnée existante n'est modifiée. Les recommandations sont recomptées à chaque affichage :
celles qui ne reposent que sur des parties contre un compte sous le niveau 30, ou jouées avec un
compte Riot délié depuis, disparaissent du CV (elles restent en base et reviennent si le compte est
relié).

**Entre la migration et la fusion du code** : l'ancien code (22/11) transmet déjà le niveau des
deux comptes avec chaque verdict 1v1. Le déclencheur ne le gêne donc pas. Il écrit seulement les
fiches de partie sans niveau, et le niveau gardé avec le verdict suffit alors à écarter une partie
contre un compte jetable. Aucune page ne casse.

`vercel.json` : nouvelle tâche quotidienne `/api/cron/abonnements-stripe` (2 h 40, heure UTC). Elle
utilise `CRON_SECRET`, déjà réglé. Tant que la clé Stripe n'est pas posée, elle répond
`{ actif: false }` sans rien faire.

Administration : offrir ou retirer une offre à un joueur abonné chez Stripe est refusé (son offre
suit son abonnement) ; le site interroge Stripe en direct pour le savoir.

## 1. Avant (lecture seule)

Dans Vercel : le déploiement de production contient la fusion de la PR #9 (commit `26aef5d`) ou
plus récent. Sinon le code en ligne n'envoie pas le niveau des comptes et la règle refuserait tous
les résultats 1v1 lus chez Riot : ne pas appliquer la section 2.

```sql
-- Doit rendre 0 : aucun verdict 1v1 lu chez Riot récent sans niveau de compte. Sinon, ne pas
-- appliquer la section 2 (« Niveau Riot obligatoire ») et me prévenir.
select count(*) from public.match_verdicts v
join public.matches m on m.id = v.match_id
join public.tournaments t on t.id = m.tournament_id and t.format = '1v1'
where v.niveau in ('historique', 'code_tournoi') and v.niveau_compte_min is null
  and v.cree_le > '2026-11-22 18:00+00';
select column_name from information_schema.columns
 where table_name = 'stats_match_joueur' and column_name = 'niveau_compte';   -- vide avant
```

## 2. Migration

Appliquer les deux sections **d'un seul tenant, dans une transaction** (`begin; … commit;`) :
`face_a_face` est supprimée puis recréée, et une page lue entre les deux verrait zéro match.
Elles sont rejouables (`if not exists`, `create or replace`, `drop … if exists`).

## 3. Après (lecture seule)

```sql
select column_name from information_schema.columns
 where table_name = 'stats_match_joueur' and column_name = 'niveau_compte';   -- 1 ligne
select string_agg(tgname, ', ' order by tgname) from pg_trigger
 where tgname in ('niveau_compte_verdict', 'verdict_immuable');               -- les 2
select pg_get_functiondef('public.matchs_communs(uuid,uuid)'::regprocedure) like '%game_accounts%'; -- true
select has_function_privilege('anon', 'public.face_a_face(uuid,uuid)', 'execute'),
       has_function_privilege('authenticated', 'public.face_a_face(uuid,uuid)', 'execute');      -- true, true
select has_function_privilege('anon', 'public.controler_niveau_compte_verdict()', 'execute'),
       has_function_privilege('authenticated', 'public.controler_niveau_compte_verdict()', 'execute'); -- false, false
select count(*) from public.face_a_face('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001'); -- 0, sans erreur
```

## 4. Fusion du code, puis contrôles sur le site

- Un CV avec des recommandations : la présentation du bloc parle des comptes Riot de niveau 30
  « encore liés au profil ».
- Une page face-à-face entre deux joueurs qui ont joué : elle s'affiche, et un match contre un
  compte sous le niveau 30 porte « Sans points : compte Riot sous le niveau 30 ».
- Une page de tournoi terminé : la ligne « Compte au classement ? » apparaît, avec le nombre de
  matchs hors classement s'il y en a.
- `/confidentialite` : « niveau du compte Riot » dans les statistiques gardées.
- Tâches planifiées de Vercel (onglet Cron Jobs du projet) : `/api/cron/abonnements-stripe` est
  listée. Un appel manuel répond `{"actif":false,"raison":"Stripe pas encore activé."}`.
- Erreurs d'exécution Vercel sur 24 h : aucune nouvelle.
