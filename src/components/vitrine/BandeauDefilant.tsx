import Icone from "@/components/design/Icone";
import ControleAnimations from "@/components/vitrine/ControleAnimations";
import styles from "./vitrine.module.css";

// Bandeau défilant sous l'ouverture (maquette accueil). Textes corrigés par
// rapport à la maquette (décision du 23/09/2026, pas de promesse fausse) :
// « ZÉRO TRICHE » → « ZÉRO CAPTURE D'ÉCRAN », « RATING OFFICIEL » → « RATING
// GLICKO-2 » (« officiel » laisserait croire à un classement Riot),
// « REPÉRÉ PAR LES ÉQUIPES » → « VERDICTS PUBLICS ».
// Contenu écrit deux fois, décalé de moitié : la boucle ne saute jamais.
// Texte décoratif (aria-hidden) ; pause au survol, bouton Pause pour toute
// la page (WCAG 2.2.2), arrêt complet si moins d'animations est demandé.

const MOTS = ["Résultats vérifiés", "Rating Glicko-2", "CV e-sport", "Zéro capture d'écran", "Verdicts publics"];

export default function BandeauDefilant() {
  const serie = [...MOTS, ...MOTS];
  return (
    <div className="relative border-y border-line bg-[#0A0B0A]">
      <div aria-hidden="true" className={`overflow-hidden py-[30px] ${styles.bandeauCadre}`}>
        <div className={`flex w-max gap-12 ${styles.bandeau}`}>
          {serie.map((mot, i) => (
            <span
              key={i}
              className={`flex items-center gap-12 font-titre text-[clamp(2rem,3.1vw,2.75rem)] font-extrabold tracking-[2px] whitespace-nowrap uppercase ${styles.texteEvideBandeau}`}
            >
              {mot}
              <Icone nom="eclat" taille={14} className="text-accent" />
            </span>
          ))}
        </div>
      </div>
      <div className="absolute inset-y-0 right-0 flex items-center bg-[linear-gradient(90deg,rgba(10,11,10,0),#0A0B0A_35%)] pr-[max(0.5rem,calc(var(--spacing-gouttiere)-0.75rem))] pl-10">
        <ControleAnimations />
      </div>
    </div>
  );
}
