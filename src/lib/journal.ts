// Journal de bord public — reprend l'historique réel de développement
// (voir git log), jamais du contenu inventé. Nouvelle entrée en tête de
// liste à chaque mise à jour notable.
export interface EntreeJournal {
  date: string; // format libre, ex. "13 septembre"
  titre: string;
  texte: string;
  tags: string[];
}

export const JOURNAL: EntreeJournal[] = [
  {
    date: "28 septembre",
    titre: "Le 1v1 classique, lu dans la partie",
    texte:
      "Un organisateur peut choisir la règle du 1v1 classique : premier sang, première tour ou 100 sbires. Le vainqueur est lu dans la chronologie Riot de la partie, minute par minute. Si deux conditions tombent dans la même minute et qu'on ne peut pas dire laquelle est la première, on ne devine pas : l'organisateur tranche.",
    tags: ["Fonctionnalité"],
  },
  {
    date: "28 septembre",
    titre: "« Je suis prêt » et forfait automatique",
    texte:
      "Dans la salle de match, chaque joueur se déclare prêt. Dès que l'un l'est, l'autre est prévenu et a 15 minutes pour faire de même, sinon il perd par forfait — aucun point pour personne. Garde-fou : jamais de forfait contre un joueur déjà en partie chez Riot.",
    tags: ["Fonctionnalité"],
  },
  {
    date: "28 septembre",
    titre: "Tournois classés : des critères publics",
    texte:
      "Une partie vérifiée prouve qui a gagné, pas que la rencontre était loyale. Seuls les tournois classés rapportent donc des points : les tournois officiels, et ceux d'organisateurs qui réunissent au moins 8 joueurs, publiés 24 h à l'avance, sans leur organisateur dans le bracket. Chaque page de tournoi affiche ces critères un par un.",
    tags: ["Fiabilité"],
  },
  {
    date: "28 septembre",
    titre: "Le registre des points, scellé",
    texte:
      "Chaque variation de points porte désormais l'empreinte de la précédente, comme les maillons d'une chaîne : retoucher une seule ligne passée, même depuis l'intérieur de Najarena, se verrait. L'empreinte du jour est publiée chaque soir sur Discord, et n'importe qui peut refaire le calcul depuis la page /registre.",
    tags: ["Fiabilité"],
  },
  {
    date: "28 septembre",
    titre: "Chances, exploits et récits",
    texte:
      "Avant chaque match, les chances estimées de chaque joueur (d'après les ratings Glicko-2). Après, un badge « Exploit » quand le moins probable l'emporte sur un résultat vérifié. Et chaque tournoi terminé se raconte en quelques phrases : vainqueur, parcours, exploit, matchs vérifiés.",
    tags: ["Fonctionnalité"],
  },
  {
    date: "28 septembre",
    titre: "Les saisons, visibles",
    texte:
      "Une page par saison : dates, jours restants, et le classement final archivé une fois la saison terminée. Ton palier de fin de saison s'inscrit au parcours de ton CV.",
    tags: ["Fonctionnalité"],
  },
  {
    date: "28 septembre",
    titre: "La salle de match",
    texte:
      "En haut de la page du tournoi : ton adversaire, son Riot ID à copier, qui crée la partie et les règles du 1v1. Un rappel arrive dès que ton match suivant s'ouvre, et le tournoi s'ajoute à ton agenda en un clic.",
    tags: ["Fonctionnalité"],
  },
  {
    date: "28 septembre",
    titre: "Bo3, Bo5 et défaite reconnue",
    texte:
      "Les séries en plusieurs manches sont lues manche par manche dans l'historique Riot, et la recherche continue 24 heures si l'historique tarde. Un joueur peut aussi reconnaître sa défaite : le tournoi avance sans attendre, sans que sa parole compte jamais au classement.",
    tags: ["Fonctionnalité", "Fiabilité"],
  },
  {
    date: "28 septembre",
    titre: "Des règles tenues par la base elle-même",
    texte:
      "Inscriptions, check-in, compte Riot vérifié, équipes, messagerie : les règles sont désormais appliquées par la base de données, plus seulement par les pages, et rejouées automatiquement à chaque modification du site.",
    tags: ["Sécurité"],
  },
  {
    date: "28 septembre",
    titre: "Ton profil, à ta main",
    texte:
      "Changer de pseudo ou de pays, naviguer en visites anonymes, retrouver son mot de passe, supprimer son compte : tout se fait depuis son espace. Et un CV collé sur Discord ou WhatsApp s'affiche avec sa carte (rating, palier, matchs vérifiés).",
    tags: ["Fonctionnalité"],
  },
  {
    date: "28 septembre",
    titre: "L'heure de Paris, partout",
    texte:
      "Le Daily de 21 h s'affichait parfois « 19:00 » : toutes les heures du site, des e-mails et du bot Discord sont maintenant données à l'heure de Paris.",
    tags: ["Fiabilité"],
  },
  {
    date: "13 septembre",
    titre: "Passe de performance sur tout le site",
    texte:
      "Les pages qui affichent tournois, classement et profils chargent maintenant en un seul aller-retour serveur au lieu de plusieurs, enchaînés inutilement.",
    tags: ["Technique"],
  },
  {
    date: "13 septembre",
    titre: "Design system documenté",
    texte:
      "Boutons, badges, états de chargement — tous les composants réutilisables du site sont maintenant catalogués, avec leurs règles de contraste vérifiées.",
    tags: ["Accessibilité"],
  },
  {
    date: "12 septembre",
    titre: "Équipes et 5v5",
    texte:
      "Créer une équipe, inviter des coéquipiers, chercher un binôme pour compléter un roster — tout le volet 5v5, avancé plus tôt que prévu.",
    tags: ["Fonctionnalité"],
  },
  {
    date: "12 septembre",
    titre: "Suivi en direct du bracket",
    texte:
      "Plus besoin de rafraîchir la page — un résultat ou un check-in apparaît en direct pour tout le monde en train de regarder.",
    tags: ["Technique"],
  },
  {
    date: "12 septembre",
    titre: "Faille de sécurité trouvée et corrigée",
    texte:
      "Un audit de sécurité a révélé que certaines fonctions internes du classement étaient accessibles sans vérification suffisante. Corrigé avant toute mise en ligne publique — aucun joueur concerné.",
    tags: ["Sécurité"],
  },
  {
    date: "11 septembre",
    titre: "Notifications et premiers tests automatisés",
    texte:
      "E-mail et notifications push à chaque étape d'un tournoi. Et une suite de tests automatisés couvre maintenant le moteur de classement et la génération de bracket.",
    tags: ["Fonctionnalité", "Fiabilité"],
  },
];
