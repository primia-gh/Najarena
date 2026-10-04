# Idées en réserve

Idées de fonctionnalités proposées le 04/10/2026, mises de côté à la demande
du porteur du projet. Aucune n'est construite. Critère de tri : rendre le
classement plus crédible, ou faire jouer plus de matchs par joueur (CLAUDE.md
§1 et §10). Toutes respectent les règles du projet : pas d'argent, pas de
donnée inventée, pas de visuel Riot.

Effort : S = moins de 3 jours · M = 1 à 2 semaines · L = plus.
« Invention » = absent chez les concurrents étudiés par l'audit.

## Rendre la preuve encore plus solide

1. **Fiche de preuve d'un match** (S, invention) — une adresse par match :
   identifiant de la partie Riot, Riot ID des deux joueurs, heure de
   lecture, niveau du verdict, lignes du registre produites.
2. **Certificats signés** (S, invention) — signature numérique de chaque
   certificat, vérifiable hors de Najarena avec une clé publique publiée
   (bibliothèque `tweetnacl` déjà présente).
3. **Registre ancré hors de Najarena** (S, invention) — l'empreinte du
   soir publiée aussi dans un dépôt GitHub public, en plus de Discord.
4. **« Recalcule toi-même »** (M, invention) — le calcul Glicko-2 d'un
   joueur refait dans le navigateur à partir du registre public.
5. **Météo du classement** (S, invention) — page publique : matchs par
   joueur actif, part des résultats lus chez Riot, incertitude moyenne.

## Un CV qui intéresse une équipe

6. **Bloc « Fiabilité »** (S, invention) — présence aux check-ins, délai
   pour se déclarer prêt, forfaits, défaites reconnues.
7. **Recommandations vérifiées** (M, invention) — seulement entre joueurs
   qui ont réellement joué ensemble, avec le nombre de matchs communs.
8. **Coach vérifié** (M, invention) — progression mesurée des élèves d'un
   joueur Diamant ou plus, affichée sur son CV.
9. **Fiche de l'adversaire** (S) — champions joués dans ses parties
   vérifiées et résultats, noms seulement.

## Faire jouer plus de matchs

10. **Check-in et défis depuis Discord** (M) — boutons dans les messages
    privés du bot : « Je confirme », « Je suis prêt », « Défier ».
11. **Créneaux à la demande** (M, invention) — un tournoi automatique
    s'ouvre quand assez de joueurs ont déclaré être disponibles au même
    moment.
12. **Coupe des nouveaux** (S) — créneau quotidien réservé aux joueurs pas
    encore classés.
13. **Divisions hebdomadaires** (L) — poules par palier, un match par
    semaine contre chacun, montée et descente en fin de mois.
14. **Chances de titre** (S) — probabilité de chaque joueur de gagner le
    tournoi, avant et pendant celui-ci.

## Équipes 5v5

15. **Bourse aux remplaçants** (M) — un joueur vérifié disponible remplace
    un absent pour un tournoi (nouvelle règle en base : aligné temporaire).
16. **Chimie d'équipe** (M, invention) — résultats vérifiés selon les
    joueurs alignés ensemble.

## Ordre conseillé le 04/10/2026

10 et 11 (font le plus jouer), puis 6, puis 1 et 2.
