# Prompt à coller dans Claude Code

Copie tout le texte ci-dessous dans Claude Code, une fois le dossier `najarena-design` placé à la racine du projet.

---

Je remplace l'identité visuelle actuelle de Najarena par une nouvelle, définie dans le dossier `najarena-design/`.
Lis d'abord `najarena-design/LISEZ-MOI.md`, puis `najarena-design/design-system/najarena/MASTER.md` et les fichiers de `pages/`.

Règles impératives :
- On change UNIQUEMENT l'apparence. Ne supprime et ne modifie aucune logique existante (authentification, Supabase, requêtes, formulaires, routes). Si une modification visuelle risque de toucher la logique, arrête-toi et demande-moi.
- Je ne code pas : explique chaque étape simplement, et attends ma validation avant de passer à la suivante.
- Si le skill ui-ux-pro-max est installé, utilise-le pour les vérifications (accessibilité, responsive), mais MASTER.md prime sur ses recommandations. Ne régénère jamais MASTER.md.

Étapes :
1. Sauvegarde : crée un commit de l'état actuel puis une branche `nouveau-design`. Explique-moi comment revenir en arrière si besoin.
2. État des lieux : dis-moi quelle technologie utilise le projet, liste les pages existantes, et indique pour chacune si elle contient de la logique à préserver.
3. Fondations : copie `najarena-design/design-system/` à la racine et les fichiers de `najarena-design/public/` dans le dossier public du projet. Mets en place les couleurs, polices, espacements et rayons de MASTER.md sous forme de variables réutilisables (adaptées à la technologie du projet), et crée les composants de base de la section 6.
4. Accueil : reconstruis l'accueil d'après `maquettes/accueil.dc.html` et `pages/accueil.md`, y compris l'animation d'ouverture et les 3 boucles.
5. Profil joueur : d'après `maquettes/profil.dc.html` et `pages/profil.md`, branché sur les données existantes s'il y en a.
6. Page tournoi : d'après `maquettes/tournoi.dc.html` et `pages/tournoi.md`.
7. Autres pages existantes (classement, inscription, etc.) : applique MASTER.md en t'inspirant du style des pages déjà faites.
8. Vérification : teste chaque page en 375, 768, 1024 et 1440 px, et passe la checklist d'accessibilité de MASTER.md. Fais-moi un compte rendu simple de ce qui reste à corriger.
