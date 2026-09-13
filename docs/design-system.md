# Design system Najarena

Référence des composants réutilisables — la direction artistique (couleurs, typographie, mouvement) est documentée dans `CLAUDE.md` §7 et `docs/direction-artistique.html` ; ce fichier catalogue les **composants concrets** qui la traduisent en code, pour éviter qu'une page réinvente son propre bouton ou sa propre carte.

Principe directeur : un composant par rôle, jamais deux variantes légèrement différentes du même. Quand un nouveau besoin ressemble à un composant existant, l'étendre plutôt qu'en créer un nouveau.

---

## Jetons de couleur

Définis dans `src/app/globals.css` (`@theme`), documentés dans `CLAUDE.md` §7.

| Jeton | Rôle | Contraste texte vérifié (13/09/2026) |
|---|---|---|
| `encre` / `papier` | texte / fond de page | 15.46:1 |
| `carte` / `fond-2` | surfaces élevées / fond secondaire | — |
| `ardoise` | texte secondaire, libellés | 6.28:1 sur papier |
| `laiton` | paliers, palmarès | 8.32:1 sur papier |
| `atteste` | verdict fiable, succès | 5.69:1 sur papier |
| `sceau` | accent principal, décoratif **uniquement** (bordures, fonds, focus ring, `accent-color`) | 4.07:1 — **sous le seuil texte**, ne jamais utiliser pour du texte lu |
| `sceau-texte` | `sceau` en texte (erreurs, liens, litiges) | 4.58-5.18:1 |

**Règle** : si une couleur habille du texte réellement lu (pas un point, une bordure, un fond à faible opacité), vérifier qu'un jeton `-texte` existe avant d'utiliser la version décorative.

---

## Composants

### `Bouton` — `src/components/ui/Bouton.tsx`
Bouton de formulaire. **Toujours utiliser celui-ci pour un `<button type="submit">`**, jamais `classeBoutonPrimaire()`/`classeBoutonSecondaire()` directement sur un `<button>` brut — celles-ci restent réservées aux `<Link>` stylés en bouton (navigation, pas de statut d'envoi à suivre).

```tsx
<form action={maServerAction}>
  <Bouton variante="primaire" libelleEnCours="Envoi…">Valider</Bouton>
</form>
```

États gérés automatiquement via `useFormStatus()` — rien à câbler depuis la page :
- **default** — `bg-sceau` (primaire) / `border-trait bg-carte` (secondaire)
- **hover** — translation + éclaircissement (primaire) / bordure `encre` (secondaire)
- **focus** — anneau `outline-sceau`, 2px
- **disabled** (prop explicite, ex. `disabled={nbConfirmes < 2}`) — opacité 50%, hover neutralisé
- **loading** (automatique pendant l'envoi du `<form>` ancêtre) — spinner + `libelleEnCours`, désactivé, `aria-busy`. Spinner masqué si `prefers-reduced-motion` (le reste de l'état loading — désactivation, opacité — reste visible).

Props : `variante?: "primaire" | "secondaire"`, `libelleEnCours?: string`, plus toutes les props natives d'un `<button>`.

### `BoutonConfirmation` — `src/components/ui/BoutonConfirmation.tsx`
Enveloppe n'importe quel bouton (généralement un lien-texte, pas un `Bouton`) dans une confirmation navigateur avant de laisser partir l'action. Réservé aux actions difficiles à rattraper (retirer un membre, quitter une équipe) — voir `CLAUDE.md`/l'audit du 13/09/2026 pour la liste des endroits où il est volontairement absent (fatigue de confirmation).

```tsx
<BoutonConfirmation confirmation="Quitter cette équipe ?" className="...">
  Quitter l'équipe
</BoutonConfirmation>
```

### `Squelette` — `src/components/ui/Squelette.tsx`
Bloc de chargement générique (`animate-pulse`, respecte `prefers-reduced-motion` via une règle globale dans `globals.css`). Composé dans chaque `loading.tsx` pour dessiner une silhouette proche de la vraie page — jamais un spinner plein écran générique.

```tsx
<Squelette className="h-9 w-48" />
```

### `Badge` — `src/components/ui/Badge.tsx`
Pastille de statut colorée. `couleur` reçoit **exactement** une classe `text-*` de `COULEUR_NIVEAU`/`COULEUR_STATUT` (`lib/tournois.ts`) — ne jamais inventer une nouvelle couleur ici, la sémantique métier vit dans ces maps, pas dans le composant.

```tsx
<Badge couleur={COULEUR_STATUT[statut]}>{LABEL_STATUT[statut]}</Badge>
```

### `SectionTitre` — `src/components/ui/SectionTitre.tsx`
`<h2>` avec liseré `laiton` — toujours ce composant pour un titre de section sur une page preuve, jamais un `<h2>` nu.

### `CrestPalier` — `src/components/ui/CrestPalier.tsx`
Anneau de progression animé vers le palier suivant (petit frère du sceau de fiabilité). Toujours alimenté par `progressionPalier()` (`lib/classement.ts`) sur une vraie note — jamais une progression inventée.

```tsx
const { palier, progression } = progressionPalier(rating.rating, paliers);
<CrestPalier nom={palier.nom} couleur={COULEUR_PALIER[palier.nom.toLowerCase()]} progression={progression} />
```

### `classeCarte(accent, interactive)` — `src/lib/ui.ts`
Fonction (pas un composant — pas d'état à gérer) qui retourne les classes d'une carte standard : liseré gauche coloré selon `AccentCarte` (`"sceau" | "atteste" | "ardoise" | "laiton" | "none"`), ombre légère. `accentDepuisCouleur()` traduit directement une classe `text-*` de `COULEUR_NIVEAU`/`COULEUR_STATUT` en accent, pour ne jamais dupliquer la logique de couleur des verdicts.

### Registre nuit partagé — `src/components/accueil/`
`Reveal` (apparition au défilement), `CompteurAnime` (compteur qui monte), `FondArene` (grille + lueurs de fond), `NavbarArene` (navbar globale, rendue une fois dans `layout.tsx`), `SceauVitrine`/`CarteMatch` (mises en scène spécifiques à l'accueil). `BracketBackground` (`src/components/BracketBackground.tsx`) est l'effet canvas "nœuds qui se relient" — utilisé sur l'accueil en pleine intensité, et en toile de fond confinée à l'en-tête sur les pages preuve.

---

## Ce qui n'est volontairement pas un composant

- Les liens-texte type `text-sceau-texte underline underline-offset-3` (Retirer, Annuler, Signaler un litige) — trop variés en contexte pour un composant unique, et leur simplicité ne justifie pas l'indirection.
- Les champs de formulaire (`input`/`select`/`textarea`) — la classe partagée est déjà assez courte et stable pour rester recopiée ; à revisiter si elle change souvent.
