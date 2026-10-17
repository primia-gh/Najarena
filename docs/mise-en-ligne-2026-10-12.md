# Mise en ligne de la branche (sections 37 à 57, 04 au 17/10/2026)

> **Statut au 17/10/2026** : rien de ces sections n'est encore en
> production. La production correspond à la branche `master` : sections 1
> à 36 du guide du 28/09 (`docs/mise-en-ligne-2026-09-28.md`), plus la
> section de l'audit de sécurité du 10/10/2026 (fusionnée dans `master`
> le 10/10).
>
> **Essayé avant d'écrire ce guide** : une base vierge reçoit le schéma de
> `master`, puis la migration ci-dessous en un seul bloc ; la migration
> passe, elle se rejoue une seconde fois sans erreur, et les 1022
> vérifications de `tests/sql/` passent ensuite (comme sur une base
> construite d'un coup).

Branche : `claude/nice-faraday-nsoe9q`. Comme la dernière fois, **la base
d'abord, le code ensuite** : le code appelle des fonctions et lit des
tables que ces sections créent. Mis en ligne avant la base, il casserait
les pages concernées (écoles, bilan, divisions, coach, certificats…).

## 0. La production est-elle bien au niveau de `master` ? (lecture seule)

À lancer dans l'éditeur SQL de Supabase :

```sql
select f as fonction,
       exists (select 1 from pg_proc where proname = f and pronamespace = 'public'::regnamespace) as presente
from unnest(array[
  'imposer_saison_courante', 'consommer_limite',   -- audit du 10/10 : doivent être présentes
  'definir_ecole', 'regler_analyse', 'verdict_lien_externe'  -- cette migration : absentes avant
]) as f;
```

- Les deux premières doivent être **présentes**. Sinon, appliquer d'abord
  la section « Audit sécurité du 10/10/2026 » de `docs/schema.sql` (celle
  de `master`), puis revenir ici.
- Les trois dernières sont **absentes** avant la migration. Si certaines
  sont déjà là (migration commencée), ce n'est pas grave : la migration
  se rejoue sans erreur.

## 1. Vérifications avant migration (lecture seule)

```sql
-- a) Adresses de tournoi déjà prises en « najarena-… » par un joueur
--    (réservées au serveur depuis le 11/10 ; le quotidien du jour en a besoin).
select slug, organisateur_id, statut from public.tournaments
where slug like 'najarena-%' and creneau_auto is null;

-- b) Adresses de tournoi ou d'équipe hors format (minuscules, chiffres,
--    tirets). Rien n'est bloqué, mais une adresse avec « ? », « # », « / »
--    ou des majuscules produit des liens internes faux : à renommer.
select 'tournoi' as quoi, slug from public.tournaments where slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
union all
select 'equipe', slug from public.teams where slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$';

-- c) Parties Riot déjà retenues par deux matchs différents (la faille
--    corrigée par la section 57). Une ligne = deux résultats tirés de la
--    même partie : à examiner (le registre, lui, ne se modifie pas).
select btrim(p.id) as partie, array_agg(distinct v.match_id) as matchs
from public.match_verdicts v
cross join lateral unnest(string_to_array(v.riot_match_id, ',')) as p(id)
where v.riot_match_id is not null and btrim(p.id) <> ''
group by btrim(p.id) having count(distinct v.match_id) > 1;
```

Une ligne renvoyée par a) ou b) se corrige à la main avant la migration
(changer l'adresse, ou supprimer un brouillon). Pour c), noter les matchs
concernés et me les transmettre : la migration passe quand même (le plus
ancien garde la partie).

## 2. Appliquer la migration

Toute la migration est **la fin de `docs/schema.sql`, à partir de la ligne
« Ligues écoles et universités, tournois réservés aux membres
(2026-10-04… »** (ligne 7455 aujourd'hui) jusqu'à la dernière ligne, en un
seul bloc, entre `begin;` et `commit;`. Si une erreur apparaît, rien n'est
appliqué : la lire, corriger, recommencer.

Coller le texte depuis Windows ajoute un caractère invisible en fin de
ligne : le retirer ensuite comme indiqué au § 2 du guide du 28/09 (requête
`replace(pg_get_functiondef(oid), chr(13), '')`).

Les sections, dans l'ordre (la numérotation suit celle du guide du 28/09) :

37. **Ligues écoles et tournois réservés aux membres** (04/10) — le code de
    vérification d'une adresse d'école part par e-mail : `RESEND_API_KEY` et
    `RESEND_FROM_EMAIL` (domaine vérifié chez Resend) sur Vercel.
38. **Analyse de match rédigée automatiquement** pour l'offre Elite (04/10)
    — utilise `ANTHROPIC_API_KEY`, déjà présente.
39. **Versement des cash prizes par Stripe Connect** (04/10) — éteint tant
    que `CASH_PRIZES_ACTIFS` n'est pas à `1` (ne pas le définir).
40. **Scrims calés sur une échéance** (04/10) — remplace `proposer_scrim`
    par sa nouvelle signature.
41. **Bilan du joueur, étape 1** (05/10) — nouvelles colonnes de
    statistiques (vides pour les parties déjà enregistrées).
42. **Bilan du joueur, étape 2 : parties classées sur accord** (05/10) —
    ajoute une troisième tâche planifiée, « najarena-analyse-classees »
    (même secret du coffre-fort que les deux autres). Son adresse est
    `https://najarena.vercel.app/…` comme les deux autres : à changer dans
    le texte avant de coller si le site a un autre domaine. Facultatif :
    `ANALYSE_APPELS_PAR_PASSAGE` sur Vercel (20 par défaut).
43. **Boutons des messages privés Discord** (09/10) — passent par la même
    adresse d'interactions que la commande `/lier` (`DISCORD_PUBLIC_KEY`,
    déjà en place si `/lier` fonctionne).
44. **Tournois à la demande** (09/10).
45. **Bloc « Fiabilité » du CV** (09/10).
46. **Certificats signés** (09/10) — sans `CERTIFICATS_CLE_PRIVEE`, les
    certificats sont émis sans signature (ils restent valables, leur
    preuve est le registre). Pour signer : voir § 3.
47. **Registre ancré sur GitHub** (09/10) — éteint sans
    `GITHUB_ANCRAGE_DEPOT` et `GITHUB_ANCRAGE_JETON`.
48. **Coupe des nouveaux** (09/10) — tournoi quotidien de 20 h réservé aux
    joueurs non classés de la saison, officiel donc classé.
49. **Météo du classement** (09/10).
50. **Recommandations vérifiées** (09/10).
51. **Chimie d'équipe** (09/10).
52. **Bourse aux remplaçants** (09/10).
53. **Coach vérifié** (09/10, case « J'accepte des élèves » du 11/10) —
    décochée pour tout le monde au départ (voir § 5).
54. **Divisions mensuelles** (09/10, règles de montée du 11/10).
55. **Adresses réservées aux tournois automatiques** (11/10).
56. **Lien externe du CV et adresses d'équipes et de tournois** (12/10).
57. **Une partie Riot ne compte qu'une fois** (17/10) — recopie les parties
    déjà retenues dans la nouvelle table `parties_utilisees` ; si deux
    anciens matchs avaient retenu la même partie, le plus ancien la garde
    (rien n'est changé à leurs verdicts ni au registre).

Après application : lancer les conseillers de sécurité et de performance
de Supabase (Advisors) et comparer avec l'état d'avant.

## 3. Réglages Vercel (porteur du projet)

Variables d'environnement, jamais dans le dépôt :

| Variable | Pour quoi | Sans elle |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | adresse publique du site (`https://…`), utilisée dans les liens envoyés (Discord, e-mails, programme de vérification des certificats) | les liens pointent vers `localhost` |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | code de vérification d'une adresse d'école | pas de vérification d'école |
| `CERTIFICATS_CLE_PRIVEE` | signature des certificats | certificats non signés |
| `GITHUB_ANCRAGE_DEPOT`, `GITHUB_ANCRAGE_JETON` | dépôt de l'empreinte du soir sur GitHub | pas d'ancrage (Discord seulement) |
| `ANALYSE_APPELS_PAR_PASSAGE` (facultatif) | appels Riot par passage pour les parties classées | 20 |

**Clé des certificats** : elle se fabrique une fois, sur un ordinateur avec
Node, par `node scripts/generer-cle-certificats.mjs`, qui affiche la ligne
`CERTIFICATS_CLE_PRIVEE=…` à copier dans Vercel. Elle ne doit être ni
envoyée par message, ni enregistrée ailleurs que dans Vercel. Le jour où on
la change, l'ancienne clé **publique** va dans `CERTIFICATS_CLES_ANCIENNES`
pour que les anciens certificats restent vérifiables.

**Jeton GitHub** : créer un dépôt public dédié (par exemple
`najarena-registre`), puis un jeton « fine-grained » limité à ce seul
dépôt, avec le droit « Contents » en écriture. `GITHUB_ANCRAGE_DEPOT` vaut
`propriétaire/najarena-registre`.

## 4. Mettre le code en ligne

Fusionner la branche dans `master` seulement **après** l'étape 2.

## 5. Après la mise en ligne

```sql
-- a) Liens externes de CV qui ne passent plus le contrôle (forme, faux
--    site officiel, terme refusé) : les effacer (le CV ne les affiche
--    déjà plus, mais ils restent en base).
select profile_id, lien_externe, public.verdict_lien_externe(lien_externe) as refus
from public.comptes_offres where public.verdict_lien_externe(lien_externe) is not null;
-- puis, pour chacun : update public.comptes_offres set lien_externe = null where profile_id = '…';

-- b) Joueurs qui peuvent devenir coach (Diamant ou plus) : les prévenir
--    qu'ils doivent cocher « J'accepte des élèves » sur leur CV.
select p.pseudo from public.profiles p where public.est_coach_eligible(p.id);

-- c) Parties retenues pendant la migration et pas encore recopiées dans
--    parties_utilisees (doit renvoyer 0 ; sinon relancer le dernier bloc
--    de la section 57, « Recopie des parties déjà retenues »). Relancer
--    aussi la requête c) du § 1 : elle doit renvoyer la même liste
--    qu'avant la migration (une ligne de plus = une partie prise deux fois
--    pendant la migration, à me transmettre).
select count(*) from public.match_verdicts v
cross join lateral unnest(string_to_array(v.riot_match_id, ',')) as p(id)
where v.riot_match_id is not null and btrim(p.id) <> ''
  and not exists (select 1 from public.parties_utilisees u where u.riot_match_id = btrim(p.id));
```

Parcours à vérifier sur le site :

- Message privé Discord d'un rappel de check-in : le bouton « Je confirme
  ma présence » répond.
- `/lol/a-la-demande` : choisir une heure, la voir comptée.
- CV : bloc Fiabilité (à partir de 3 tournois), « Recommander » entre deux
  joueurs ayant une partie commune, lien externe affiché par le nom de son
  site, case « J'accepte des élèves » d'un joueur Diamant.
- Certificat : émettre depuis son CV, la page indique « Signé par
  Najarena » (si la clé est réglée), et
  `node verifier-certificat.mjs <code>` (programme téléchargé depuis la
  page) répond « valide ».
- `/lol/divisions`, `/lol/meteo`, `/lol/match/<id>` (lien depuis le badge
  d'un verdict), `/joueur/<pseudo>/recalcul`.
- `/registre` : après 23 h 45, l'empreinte du soir sur Discord (et sur
  GitHub si l'ancrage est réglé).
- Un tournoi 1v1 créé avec un nom fait de symboles : adresse
  « tournoi-… », page qui s'ouvre.
