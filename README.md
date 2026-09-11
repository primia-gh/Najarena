# Najarena

Plateforme de tournois League of Legends en 1v1 quotidien. Les résultats
sont lus dans la donnée officielle Riot plutôt que déclarés par les
joueurs — voir `CLAUDE.md` à la racine pour le contexte complet du produit.

## Lancer en local

```bash
npm install
npm run dev
```

```bash
npm test
```

Lance la suite de tests automatisés (logique pure : Glicko-2, placement
de bracket, classement) — à faire passer avant tout déploiement.

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

## Déployer sur Vercel

1. Renseigner toutes les variables ci-dessus dans Project Settings → Environment Variables.
2. Mettre à jour, côté tableau de bord Supabase (Authentication → URL Configuration), le **Site URL** et les **Redirect URLs** avec le vrai domaine — sans ça, les e-mails de confirmation et de réinitialisation de mot de passe Supabase continuent de pointer vers `localhost`.
3. **Tâches planifiées (`vercel.json`)** : le plan Hobby (gratuit) refuse de déployer toute tâche planifiée plus fréquente qu'une fois par jour — c'est pour ça que la recherche automatique de résultats (`/api/cron/recherche-resultats`) est réglée sur une fois par jour par défaut. Ça reste fiable (aucun résultat n'est jamais inventé, voir le commentaire dans le fichier), juste plus lent. Passer au plan Pro pour retrouver une cadence proche de la cible du produit (`docs/moteur-resultats.md` §6) et resserrer le réglage dans `vercel.json`.
4. `npm run build` en local doit passer sans erreur avant de déployer — c'est exactement ce que Vercel exécute.

## Documentation du projet

- `CLAUDE.md` — contexte produit complet (à lire avant toute intervention)
- `docs/schema.sql` — schéma de base de données
- `docs/moteur-resultats.md` — logique des verdicts et du rapprochement niveau 2
- `docs/direction-artistique.html` — référence visuelle jouable
