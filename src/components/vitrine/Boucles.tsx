import Image from "next/image";
import Icone from "@/components/design/Icone";
import CompteurRating from "@/components/vitrine/CompteurRating";
import styles from "./vitrine.module.css";

// Les 3 boucles « comment ça marche » de l'accueil (maquettes Boucle-*) :
// animations d'interface codées, pas de vidéo (MASTER §7). Illustrations
// pures — le texte de chaque étape, à côté, porte le sens : masquées des
// lecteurs d'écran.

const CADRE =
  "relative h-[300px] w-full overflow-hidden rounded-carte bg-[linear-gradient(160deg,#141614,#0C0E0C)] font-texte text-text";

const BADGE_CONFIRMATION =
  "flex items-center gap-2.5 whitespace-nowrap rounded-bouton border border-accent/40 bg-accent/8 px-4 py-2.5 text-xs font-semibold tracking-[3px] text-accent";

/**
 * 01 — Lier son compte. Le badge dit « COMPTE VÉRIFIÉ » et pas « RANG
 * VÉRIFIÉ » (maquette) : en V1, Najarena prouve que le Riot ID t'appartient
 * (changement d'icône de profil), il ne lit pas ton rang (CLAUDE.md §2).
 */
export function BoucleCompte() {
  return (
    <div aria-hidden="true" className={`${CADRE} flex flex-col items-center justify-center gap-9`}>
      <div className="flex items-center">
        <div className="flex h-[84px] w-[84px] items-center justify-center rounded-panneau border border-[rgba(245,245,244,0.15)] bg-[#0B0C0B]">
          <Image src="/brand/najarena-logo-blanc.svg" alt="" width={39} height={52} unoptimized />
        </div>
        {/* 110 px comme la maquette, sauf de 1024 à 1279 px où la colonne ne fait que ~270 px. */}
        <div className="relative h-0.5 w-[110px] bg-[rgba(245,245,244,0.08)] lg:w-[80px] xl:w-[110px]">
          <div className={`absolute inset-0 bg-accent ${styles.b1Ligne}`} />
          <div className={`absolute inset-0 ${styles.b1Point}`}>
            <div className="absolute -top-[3px] -ml-1 h-2 w-2 rounded-full bg-text" />
          </div>
        </div>
        <div
          className={`flex h-[84px] w-[84px] flex-col items-center justify-center gap-1.5 rounded-panneau border border-[rgba(245,245,244,0.15)] bg-[#0B0C0B] ${styles.b1Noeud}`}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F5F5F4" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="6" width="20" height="12" rx="3" />
            <path d="M6 12h4M8 10v4M15 11h.01M18 13h.01" />
          </svg>
          <span className="text-[9px] tracking-[2px] text-muted">COMPTE</span>
        </div>
      </div>
      <div className={`${BADGE_CONFIRMATION} ${styles.b1Badge}`}>
        <Icone nom="coche" taille={14} epaisseur={3} />
        COMPTE VÉRIFIÉ
      </div>
    </div>
  );
}

function Ligne({ equipe, score, gagnant, classeScore = "", classeNom = "" }: {
  equipe: string;
  score: number;
  gagnant: boolean;
  classeScore?: string;
  classeNom?: string;
}) {
  return (
    <div
      className={`flex w-[118px] justify-between rounded-bouton border border-[rgba(245,245,244,0.1)] bg-[#0B0C0B] px-2.5 py-2 text-xs ${
        gagnant ? "font-semibold" : "text-faint"
      }`}
    >
      <span className={classeNom}>{equipe}</span>
      <span className={`${gagnant ? "text-accent" : ""} ${classeScore}`}>{score}</span>
    </div>
  );
}

/** 02 — Jouer ses matchs : le bracket avance, le résultat est confirmé. */
export function BoucleBracket() {
  return (
    <div aria-hidden="true" className={`${CADRE} flex items-center justify-center pb-[30px]`}>
      <div className="flex flex-col gap-11">
        <div className="flex flex-col gap-1.5">
          <Ligne equipe="ÉQUIPE A" score={1} gagnant classeScore={styles.b2A} />
          <Ligne equipe="ÉQUIPE B" score={0} gagnant={false} classeScore={styles.b2A} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Ligne equipe="ÉQUIPE C" score={0} gagnant={false} classeScore={styles.b2A} />
          <Ligne equipe="ÉQUIPE D" score={1} gagnant classeScore={styles.b2A} />
        </div>
      </div>
      <div className="relative h-[150px] w-[30px]">
        <div className={`absolute top-9 left-0 h-0.5 w-4 ${styles.b2L1}`} />
        <div className={`absolute bottom-9 left-0 h-0.5 w-4 ${styles.b2L1}`} />
        <div className={`absolute top-9 bottom-9 left-[15px] w-0.5 ${styles.b2L1}`} />
        <div className={`absolute top-[74px] right-0 left-[15px] h-0.5 ${styles.b2L2}`} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Ligne equipe="ÉQUIPE A" score={1} gagnant classeNom={styles.b2A} classeScore={styles.b2B} />
        <Ligne equipe="ÉQUIPE D" score={0} gagnant={false} classeNom={styles.b2A} classeScore={styles.b2B} />
      </div>
      <div className={`absolute inset-x-0 bottom-[26px] flex justify-center ${styles.b2C}`}>
        <div className={BADGE_CONFIRMATION}>
          <Icone nom="coche" taille={14} epaisseur={3} />
          RÉSULTAT CONFIRMÉ
        </div>
      </div>
    </div>
  );
}

/** 03 — Le rating monte : le chiffre compte, la courbe se trace. */
export function BoucleRating() {
  return (
    <div aria-hidden="true" className={`${CADRE} flex flex-col justify-center gap-[18px] px-9`}>
      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] tracking-[3px] text-muted">RATING</span>
          <CompteurRating depart={1778} arrivee={1842} />
        </div>
        <span className={`pb-2 text-base font-bold text-accent ${styles.b3Apparait}`}>▲ +64</span>
      </div>
      <svg className="h-auto w-full" viewBox="0 0 317 90" fill="none">
        <line x1="0" y1="89" x2="317" y2="89" stroke="rgba(245,245,244,.1)" strokeWidth="1" />
        <polyline
          className={styles.b3Trace}
          points="0,78 32,72 64,75 96,60 128,64 160,48 192,52 224,34 256,30 317,10"
          stroke="#B6FF3B"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
