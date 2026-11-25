# Najarena — arborescence des pages

Extrait du brief CLAUDE.md le 25/11/2026, sans modification du texte. Liste de toutes les pages du site.

---

```
/                          accueil (animation d'ouverture du logo, boucles « comment ça marche »)
/lol                       hub du jeu
/lol/tournois              liste + filtres
/lol/tournois/[slug]       page tournoi (salle de match `#ton-match`, fichier agenda `/agenda`)
/lol/tournois/demo         tournoi d'exemple (données statiques, jamais en base)
/lol/classement            leaderboard
/lol/saisons               saisons : dates, jours restants, classements finaux archivés
/lol/semaine/[lundi]       récap de la semaine (publié aussi sur Discord le lundi)
/registre                  registre des points scellé (preuve publique, export, vérification)
/lol/coequipiers           recherche de coéquipiers (5v5)
/lol/recrutement           équipes qui recrutent : annonces des capitaines (postes, niveau), candidatures depuis la page d'équipe
/lol/duo                   matching duo : annonce (poste, postes cherchés, créneaux, objectif), propositions, demandes
/lol/arene                 arène 1v1 : file d'attente, duel contre un joueur de son niveau (en pause depuis le 24/11/2026)
/lol/a-la-demande          tournois à la demande : chacun indique ses heures libres, 8 joueurs = un tournoi
/lol/divisions             divisions mensuelles : poules de 4 par niveau, un match par semaine, montée et descente
/lol/meteo                 météo du classement : précision du classement, matchs par joueur, part lue chez Riot
/lol/match/[id]            fiche de preuve d'un match : verdict et source, partie Riot, registre (non indexée)
/lol/face-a-face/[a]/[b]   face-à-face de deux joueurs : leurs matchs 1v1, bilan des seuls verdicts lus chez Riot (indexée s'il y en a un)
/lol/pronostics            pronostics gratuits : matchs ouverts, classement des pronostiqueurs
/lol/ecoles                ligue des écoles : écoles classées par la moyenne des 5 meilleurs membres vérifiés
/lol/bilan                 bilan du joueur d'exemple (joueur fictif, données statiques, jamais en base)
/joueur/[pseudo]           CV e-sport public — transverse, jamais sous /lol ; /recalcul : le calcul de ses points refait dans le navigateur
/certificat/[code]         certificat de niveau daté et figé, émis depuis le CV (non indexé)
/defi/[code]               lien « Invite ton rival » : un ami s'inscrit, lie son Riot ID et relève le défi (non indexé)
/equipe/[slug]             page publique d'équipe
/equipe/nouvelle           création d'équipe
/communautes               espaces communauté (serveur Discord, association, école) ; /communaute/[slug], /communaute/nouvelle
/organiser/nouveau         création de tournoi
/moi                       tableau de bord joueur (bandeau « ton match », gérer mon abonnement, alertes « tournoi pour toi », adresse de son overlay de stream)
/moi/bilan                 bilan du joueur : forces, axes de travail ; plan, progression, champions, builds (Pro) ; onglet Classées (sur accord) et réglages
/moi/profil                pseudo, pays, visites anonymes, suppression du compte
/moi/organisation/[id]     cockpit de tournoi
/connexion /inscription /lier-riot /mot-de-passe-oublie /nouveau-mot-de-passe
/cgu /cgv /confidentialite /mentions-legales   pages légales (CGV : offres payantes)
/admin                     modération, litiges
/comment-ca-marche         guide éditorial (verdict, Glicko-2, indice de confiance)
/faq                       questions de confiance, dépliées par défaut (gratuité, affiliation Riot, délais, IA)
/journal                   journal de bord public (docs/journal réel, voir src/lib/journal.ts)
/note-du-fondateur         positionnement produit, en 1ère personne
/charte                    charte graphique vivante (interne, absente du site en ligne)
/developpeurs              widgets intégrables (/widget/...) et API publique en lecture seule (/api/public/v1/...)
```

Le segment de jeu (`/lol/...`) est obligatoire dès maintenant : sans lui, l'ajout d'un second jeu imposerait une migration d'URL et une perte de référencement.

Le profil joueur reste **hors** du segment de jeu, avec des onglets par jeu — c'est un CV unique qui accumule les jeux.

*Mise à jour du 13/09/2026 : trois pages de contenu ajoutées pour donner de la substance au site indépendamment du trafic réel (`/comment-ca-marche`, `/journal`, `/note-du-fondateur`), plus un tournoi d'exemple aux données statiques, jamais écrites en base (`/lol/tournois/demo`) pour montrer un bracket complet avant le premier vrai tournoi public — ses matchs ne comptent jamais dans les statistiques du site (accueil, admin), contrairement à un vrai tournoi. Décision issue du dossier d'audit du 12/09 (§20) et d'un brainstorm complémentaire non couvert par l'audit.*
