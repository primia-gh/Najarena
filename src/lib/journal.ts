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
