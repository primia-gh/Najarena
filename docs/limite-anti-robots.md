# Limite anti-robots sur les widgets et l'API publique

*Préparé le 21/11/2026. À appliquer dans le tableau de bord Vercel (pas dans le code).*

## Pourquoi

Les widgets (`/widget/…`, dont l'overlay de stream) et l'API publique
(`/api/public/…`) sont ouverts à tous, sans compte. Aujourd'hui, seul le
cache d'une minute les protège : un robot qui varie ses demandes peut quand
même faire travailler le serveur et la base à chaque appel (coût de
l'hébergement, charge de Supabase).

Une **limite de débit** (en anglais *rate limit* : un nombre maximal d'appels
par minute pour une même adresse IP) bloque ce robot sans gêner personne
d'autre.

## La règle

| Réglage | Valeur |
|---|---|
| Nom | `Widgets et API publique : limite par adresse IP` |
| Condition 1 | *Request Path* — *Starts with* — `/widget/` |
| Condition 2 (reliée par **OR**) | *Request Path* — *Starts with* — `/api/public/` |
| Action | *Rate Limit* |
| Fenêtre | *Fixed Window*, 60 secondes |
| Nombre d'appels | 120 |
| Compté par | *IP Address* |
| Au-delà | *Deny* (réponse 429 « trop de demandes ») |

**Pourquoi 120 par minute :** un overlay dans OBS demande sa page une fois par
minute ; un widget dans une page d'équipe, une fois par visite ; le mode
d'emploi de l'API demande de ne pas interroger plus d'une fois par minute.
120 laisse une large marge, même pour un réseau partagé (école, salle LAN).
Un robot qui dépasse deux appels par seconde est bloqué jusqu'à la fin de la
minute.

**Ne pas utiliser l'action *Challenge*** (vérification « êtes-vous un
humain ») sur ces adresses : OBS, les iframes et les programmes qui lisent
l'API ne peuvent pas y répondre, l'overlay disparaîtrait des streams.

## Étapes

1. Ouvre [vercel.com](https://vercel.com), le projet **najarena**, puis
   l'onglet **Firewall**.
2. Clique sur **Configure** (ou **Add New…** → **Rule**).
3. Remplis la règle avec les valeurs du tableau ci-dessus.
4. **Save Rule**, puis **Review Changes** et **Publish** : la règle s'applique
   en quelques secondes, sans nouvelle mise en ligne du site.
5. Vérifie : ouvre `https://najarena.vercel.app/widget/top10` — il s'affiche
   comme avant.

Si l'action *Rate Limit* n'est pas proposée, elle dépend de l'offre Vercel du
compte : dis-le à Claude, qui proposera une autre solution.

## Pour que Claude puisse le faire à ta place

La connexion Vercel utilisée par Claude n'a pas accès au pare-feu (« Vercel
denied access to this project's firewall configuration »). Reconnecter
l'intégration Vercel dans Claude, avec un compte propriétaire de l'équipe,
lui donnerait cet accès ; il te montrerait alors la règle avant de la
publier.
