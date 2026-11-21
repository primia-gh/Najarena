# Mise en ligne du 21/11/2026 — contrôle complet du site

Le code de cette mise en ligne lit une nouvelle colonne (`game_accounts.defi_cree_le`) :
**la base se met à jour d'abord, le code ensuite.**

## Ce que contient la migration

Dernière section de `docs/schema.sql`, à partir de la ligne
`-- ---------- Comptes Riot : re-liaison et liaisons en attente (2026-11-21) ----------`
jusqu'à la fin du fichier :

- colonne `game_accounts.defi_cree_le` (heure du défi d'icône) ;
- `lier_compte_riot` redéfinie : un compte déjà vérifié du même joueur le reste,
  une liaison jamais vérifiée d'un autre profil est remplacée ;
- déclencheurs `moderation_motif_verdict` (sur `match_verdicts`) et
  `moderation_resolution_litige` (sur `disputes`), avec leurs fonctions.

Aucune donnée existante n'est modifiée. Une liaison en attente créée avant la
migration n'a pas d'heure de défi : sa vérification sera refusée (« la
vérification a expiré ») et le joueur relancera la liaison.

## 1. Avant (lecture seule)

```sql
select count(*) from public.game_accounts where verifie_le is null;          -- liaisons en attente
select column_name from information_schema.columns
 where table_name = 'game_accounts' and column_name = 'defi_cree_le';        -- vide avant
```

## 2. Migration

Appliquer la section, d'un seul tenant. Elle est rejouable (`if not exists`,
`create or replace`, `drop trigger if exists`).

## 3. Après (lecture seule)

```sql
select column_name from information_schema.columns
 where table_name = 'game_accounts' and column_name = 'defi_cree_le';        -- 1 ligne
select tgname from pg_trigger
 where tgname in ('moderation_motif_verdict', 'moderation_resolution_litige');  -- 2 lignes
select has_function_privilege('authenticated',
  'public.lier_compte_riot(uuid, smallint, text, text, text, text, smallint, boolean)', 'execute');  -- false
```

## 4. Fusion du code, puis contrôles sur le site

- Une page qui n'existe pas (`/joueur/zzzz`) affiche « Page introuvable », en français.
- L'accueil : cartes CV marquées « Exemple », « Compte vérifié ».
- `/tarifs` : l'offre Organisateur liste recherche de joueurs, communautés,
  écrire en premier, séries Bo3/Bo5.
- `/lier-riot` (compte connecté) : relier son propre Riot ID déjà vérifié le
  laisse « vérifié ».
- Erreurs d'exécution Vercel sur 24 h : aucune nouvelle.
