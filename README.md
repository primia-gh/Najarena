# Najarena

Plateforme de tournois League of Legends : tournois 1v1 quotidiens, équipes
et recherche de coéquipiers pour le 5v5. Les résultats sont lus dans la
donnée officielle Riot plutôt que déclarés par les joueurs — voir
`CLAUDE.md` à la racine pour le contexte complet du produit.

## Lancer en local

```bash
npm install
npm run dev
```

```bash
npm test
```

Lance la suite de tests automatisés (logique pure : Glicko-2, placement
de bracket, classement, séries Bo3/Bo5, règles de pseudo, échappement des
e-mails, images de partage…) — à faire passer avant tout déploiement.
`APERCU_IMAGES=<dossier> npm test` enregistre en plus les images de
partage générées, pour les regarder.

```bash
npm run test:base
```

Rejoue `docs/schema.sql` sur une base PostgreSQL de test (serveur
PostgreSQL 15+ et `psql` nécessaires, connexion par `PGHOST`/`PGPORT`/
`PGUSER`/`PGPASSWORD`), puis essaie chaque règle d'accès et chaque fonction
de la base comme le ferait un visiteur, un organisateur ou le serveur
(`tests/sql/`). Les deux suites tournent aussi automatiquement sur GitHub à
chaque envoi de code (`.github/workflows/verifications.yml`).

Nécessite un fichier `.env.local` (non committé, voir `.gitignore`) —
demander les valeurs à qui a déployé le projet, ou suivre la liste
ci-dessous pour les créer soi-même.

## Variables d'environnement

**Obligatoires** — le site ne fonctionne pas sans elles :

| Variable | Où l'obtenir |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (secret — vérification Riot, calcul du classement, admin, notifications) |
| `RIOT_API_KEY` | developer.riotgames.com — **clé de développement : expire toutes les 24h tant qu'aucune clé production n'est obtenue** (CLAUDE.md §2) |
| `CRON_SECRET` | une valeur générée localement (pas de compte externe) — protège les tâches planifiées |

**Recommandée avant une vraie mise en ligne** :

| Variable | Rôle |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | domaine réel du site — sans elle, le sitemap, le `robots.txt`, les balises Open Graph et les liens dans les e-mails pointent vers `localhost` |

**Optionnelles** — absentes, elles désactivent proprement la fonctionnalité concernée sans casser le reste du site :

| Variable | Active |
|---|---|
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | notifications e-mail (inscription, résultat, litige) |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | suivi d'erreurs Sentry |
| `DISCORD_WEBHOOK_URL` | annonces sur un serveur Discord (nouveau tournoi, vainqueur) |
| `DISCORD_PUBLIC_KEY`, `DISCORD_APPLICATION_ID`, `DISCORD_BOT_TOKEN` | bot Discord interactif (`/classement`, `/tournois`) — lancer `npm run discord:commandes` une fois configurées |
| `ANTHROPIC_API_KEY` | assistant IA de configuration de tournoi sur `/organiser/nouveau` (console.anthropic.com — compte payant à l'usage) |

La **connexion via Discord (OAuth)** ne se configure pas ici : Client ID/Secret se renseignent directement dans le tableau de bord Supabase (Authentication → Providers → Discord). Détails des trois volets dans les commentaires de `.env.local`.

## Déployer sur Vercel

1. Renseigner toutes les variables ci-dessus dans Project Settings → Environment Variables.
2. Mettre à jour, côté tableau de bord Supabase (Authentication → URL Configuration), le **Site URL** et les **Redirect URLs** avec le vrai domaine — sans ça, les e-mails de confirmation et de réinitialisation de mot de passe Supabase continuent de pointer vers `localhost`.
3. **Tâches planifiées** : les tournois automatiques et la recherche de résultats sont appelés **toutes les 5 minutes par la base** (pg_cron, bloc `[supabase-uniquement]` de `docs/schema.sql`), car le plan Hobby de Vercel refuse toute tâche plus fréquente qu'une fois par jour. `vercel.json` ne garde que les tâches mensuelles (inactivité, changement de saison) et un passage quotidien de secours de la recherche de résultats.
4. `npm run build` en local doit passer sans erreur avant de déployer — c'est exactement ce que Vercel exécute.

## Documentation du projet

- `CLAUDE.md` — contexte produit complet (à lire avant toute intervention)
- `docs/schema.sql` — schéma de base de données ; chaque évolution y est ajoutée à la fin, en section datée « À appliquer sur la base AVANT la mise en ligne du code du même commit »
- `docs/mise-en-ligne-2026-09-28.md` — ordre de mise en ligne des correctifs de l'audit du 27/09/2026 (base d'abord, code ensuite)
- `tests/sql/` — scénarios d'accès et de fonctions de la base (`npm run test:base`)
- `docs/moteur-resultats.md` — logique des verdicts et du rapprochement niveau 2
- `design-system/najarena/MASTER.md` — direction artistique en vigueur (`docs/direction-artistique.html` décrit l'ancienne, obsolète)
