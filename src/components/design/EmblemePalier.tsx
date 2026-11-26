import type { ReactNode } from "react";
import { COULEUR_PALIER } from "@/lib/paliers";

// Emblèmes des paliers (26/11/2026, version 5 validée par le porteur) :
// un serpent qui monte en puissance — Mue (il quitte sa peau), Écaille,
// Crochet (vipère, langue fourchue), Venin (la frappe), Cobra (dressé sur
// ses anneaux), Basilic (cobra couronné). Le bouclier s'arme aussi à chaque
// palier (pointillé, plein, pointes, double bord, lames, pointes basses) :
// le rang se lit à la forme, pas seulement à la couleur.
// « Non classé » (RD > 150) : bouclier gris en pointillé, jamais un palier
// deviné. Couleurs : lib/paliers.ts (seule exception tolérée au « vert
// rare »). Dessin vectoriel maison, aucun visuel Riot.
//
// Rendu par le serveur, sans JavaScript. Apparition : sous un Apparition,
// l'emblème grandit légèrement en fondu à l'entrée à l'écran (globals.css,
// .embleme-palier) ; sinon il est affiché d'emblée.

const NOIR = "#080908";
const BOUCLIER = "32,3 54,11 56,30 46,50 32,61 18,50 8,30 10,11";
const BOUCLIER_INTERIEUR = "32,9 49.4,15.4 50.8,30 42,46.5 32,54.5 22,46.5 13.2,30 14.6,15.4";

type ClePalier = "mue" | "ecaille" | "crochet" | "venin" | "cobra" | "basilic";

const RANG: Record<ClePalier, number> = { mue: 1, ecaille: 2, crochet: 3, venin: 4, cobra: 5, basilic: 6 };

/** « Écaille » → « ecaille » ; nom inconnu → null (traité comme non classé). */
export function clePalier(nom: string | null | undefined): ClePalier | null {
  if (!nom) return null;
  const cle = nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  return cle in RANG ? (cle as ClePalier) : null;
}

function Cadre({ rang, c }: { rang: number; c: string }) {
  return (
    <>
      <polygon points={BOUCLIER} fill={c} fillOpacity={0.07} />
      {rang === 0 && <polygon points={BOUCLIER} fill="none" stroke={c} strokeWidth={1.6} strokeDasharray="3 4" />}
      {rang === 1 && (
        <polygon points={BOUCLIER} fill="none" stroke={c} strokeWidth={1.8} strokeLinejoin="miter" strokeDasharray="12 4" />
      )}
      {rang >= 2 && <polygon points={BOUCLIER} fill="none" stroke={c} strokeWidth={2.2} strokeLinejoin="miter" />}
      {rang >= 3 && (
        <g fill={c}>
          <path d="M10 11L3 5l9 3z" />
          <path d="M54 11l7-6-9 3z" />
        </g>
      )}
      {rang >= 4 && (
        <polygon
          points={BOUCLIER_INTERIEUR}
          fill="none"
          stroke={c}
          strokeWidth={1}
          strokeOpacity={0.5}
          strokeLinejoin="miter"
        />
      )}
      {rang >= 5 && (
        <g fill={c}>
          <path d="M8 30l-7-2 8 7z" />
          <path d="M56 30l7-2-8 7z" />
        </g>
      )}
      {rang >= 6 && (
        <g fill={c}>
          <path d="M32 61l-3.5 3h7z" />
          <path d="M18 50l-5 5 7-3z" />
          <path d="M46 50l5 5-7-3z" />
        </g>
      )}
    </>
  );
}

/** Vipère de profil, corps en S (Crochet, Venin). Repère 0-100 ramené dans le bouclier. */
function CorpsProfil({ c }: { c: string }) {
  return (
    <>
      <path
        fill={c}
        d="M8 106C-2 84 34 76 40 62c6-14-22-20-14-38 5-11 20-15 32-10l2 13c-9-3-19-1-21 6-4 12 26 18 20 38-6 22-34 20-36 37z"
      />
      <path
        fill={NOIR}
        opacity={0.28}
        d="M8 106C-2 84 34 76 40 62c6-14-22-20-14-38 5-11 20-15 32-10l.6 4c-11-3-23 0-26 8-5 14 23 20 18 37-5 18-36 20-40 43z"
      />
      <path
        fill="none"
        stroke={NOIR}
        strokeOpacity={0.55}
        strokeWidth={1.6}
        strokeLinecap="round"
        d="M43 33l5-2M41 44l6 1M47 54l6-2M50 64l6 1M48 75l6 2M40 85l5 4M30 92l3 5M21 98l2 6"
      />
    </>
  );
}

function TeteProfil({ c, ouverte }: { c: string; ouverte: boolean }) {
  return (
    <>
      <path fill={c} d="M52 12c9-8 27-8 40 2l5 6-6 4H74l-12 7-6-2z" />
      <path fill={NOIR} d="M68 15.5l10-1.5-2.6 3.6z" />
      {ouverte ? (
        <>
          <path fill={c} d="M60 31l13 1 21 12-4 4-20-8-10-3z" />
          <path fill={c} stroke={NOIR} strokeWidth={1} d="M80 24h4.5l-3.2 13zM88 24h4l-2.8 11z" />
          <path fill={c} d="M81.4 40c2 2.6 3.2 4.4 3.2 5.8a3.2 3.2 0 0 1-6.4 0c0-1.4 1.2-3.2 3.2-5.8z" />
          <path fill={c} d="M89.6 37.5c1.6 2 2.6 3.5 2.6 4.6a2.6 2.6 0 0 1-5.2 0c0-1.1 1-2.6 2.6-4.6z" />
        </>
      ) : (
        <>
          <path fill={c} d="M60 30l12-4h19l-3 4-16 3z" />
          <path fill={c} stroke={NOIR} strokeWidth={1} d="M83 24h4l-2.6 10z" />
          <path
            fill="none"
            stroke={c}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M90 29h8l3-4M98 29l3 4"
          />
        </>
      )}
    </>
  );
}

/** Cobra dressé de face sur ses anneaux (Cobra, Basilic). */
function Cobra({ c, ouverte }: { c: string; ouverte: boolean }) {
  return (
    <>
      <path
        fill={c}
        d="M41 70C34 84 8 82 8 95c0 12 30 15 48 14 20-1 38-6 38-14 0-7-10-9-18-7l1 6c5-1 8 0 8 2 0 4-14 7-29 7-16 0-36-2-36-8 0-7 25-6 32-24z"
      />
      <path fill={NOIR} opacity={0.3} d="M8 95c0 12 30 15 48 14 20-1 38-6 38-14-3 5-20 9-38 9-20 0-44-3-48-9z" />
      <path fill={c} d="M40 64h20l-2 14c-4 6-14 6-18 0z" />
      <path
        fill={c}
        d="M50 9c17 0 33 14 35 33 1.6 14-8 25-21 29l-6 5H42l-6-5C23 67 13.4 56 15 42 17 23 33 9 50 9z"
      />
      <path
        fill={NOIR}
        opacity={0.32}
        d="M50 16c-13 0-26 11-28 26-1.3 10 5 19 15 23l6 4h14l6-4c10-4 16.3-13 15-23-2-15-15-26-28-26z"
      />
      <path fill={NOIR} opacity={0.85} d="M27 46c4-7 12-8 16-2-3 7-11 9-16 2zM73 46c-4-7-12-8-16-2 3 7 11 9 16 2z" />
      <path fill={c} d="M31 46c2-3 6-3.5 8-.8-1.5 3-5.5 3.8-8 .8zM69 46c-2-3-6-3.5-8-.8 1.5 3 5.5 3.8 8 .8z" />
      <path
        fill="none"
        stroke={NOIR}
        strokeOpacity={0.6}
        strokeWidth={1.8}
        strokeLinecap="round"
        d="M44 52h12M43.5 58h13M43 64h14M44 70h12"
      />
      {ouverte ? (
        <>
          <path fill={c} stroke={NOIR} strokeWidth={1.5} d="M50 1c9 0 16 6 16 13l-2.5 7h-27L34 14c0-7 7-13 16-13z" />
          <path fill={NOIR} d="M38.5 10l9.5 3.4-2.4 2.6zM61.5 10L52 13.4l2.4 2.6z" />
          <path fill={c} stroke={NOIR} strokeWidth={1.5} d="M39 26h22l-4 7-7 3-7-3z" />
          <path fill={c} stroke={NOIR} strokeWidth={1} d="M38 21h4.5l-2.2 11zM57.5 21H62l-2.2 11z" />
        </>
      ) : (
        <>
          <path
            fill={c}
            stroke={NOIR}
            strokeWidth={1.5}
            d="M50 1c9 0 16 6 16 14 0 9-8 15-16 17-8-2-16-8-16-17 0-8 7-14 16-14z"
          />
          <path fill={NOIR} d="M38.5 12l9.5 3.4-2.4 2.6zM61.5 12L52 15.4l2.4 2.6z" />
          <path
            fill="none"
            stroke={c}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M50 32v6l-3.5 4M50 38l3.5 4"
          />
        </>
      )}
    </>
  );
}

function Repere({ x, y, k, children }: { x: number; y: number; k: number; children: ReactNode }) {
  return <g transform={`translate(${x} ${y}) scale(${k})`}>{children}</g>;
}

function Symbole({ cle, c }: { cle: ClePalier | null; c: string }) {
  switch (cle) {
    case "mue":
      return (
        <>
          <path
            fill="none"
            stroke={c}
            strokeOpacity={0.55}
            strokeWidth={1.4}
            strokeDasharray="2.5 3"
            d="M44 21c-8-6-22-2-20 7 2 7 15 5 16 12 1 6-8 9-15 7"
          />
          <path
            fill={c}
            d="M41 18c-8-5-21-2-20 7 1 7 14 6 15 12 1 6-7 9-14 8 7 3 18 0 18-7-1-8-14-7-15-13-1-6 9-9 16-7z"
          />
          <path fill={c} d="M21 25l-4-3 5 0z" />
        </>
      );
    case "ecaille":
      return (
        <g fill={c} stroke={NOIR} strokeWidth={1.6} strokeLinejoin="miter">
          <path d="M32 15l7 11-7 13-7-13z" />
          <path d="M24 27l7 11-7 12-7-12z" />
          <path d="M40 27l7 11-7 12-7-12z" />
        </g>
      );
    case "crochet":
      return (
        <Repere x={13} y={12} k={0.36}>
          <CorpsProfil c={c} />
          <TeteProfil c={c} ouverte={false} />
        </Repere>
      );
    case "venin":
      return (
        <Repere x={13} y={12} k={0.36}>
          <CorpsProfil c={c} />
          <TeteProfil c={c} ouverte />
        </Repere>
      );
    case "cobra":
      return (
        <Repere x={12.5} y={11} k={0.39}>
          <Cobra c={c} ouverte={false} />
        </Repere>
      );
    case "basilic":
      return (
        <Repere x={14} y={16.5} k={0.36}>
          <path fill={c} stroke={NOIR} strokeWidth={1.5} d="M33 6l2-17 7 9 8-15 8 15 7-9 2 17-17-6z" />
          <Cobra c={c} ouverte />
        </Repere>
      );
    default:
      return (
        <>
          <path
            fill="none"
            stroke={c}
            strokeWidth={2}
            strokeLinecap="round"
            d="M27.5 27.5a4.5 4.5 0 1 1 6.5 4c-1.3.7-2 1.6-2 3"
          />
          <circle cx={32} cy={39.5} r={1.4} fill={c} />
        </>
      );
  }
}

interface EmblemePalierProps {
  /** Nom du palier (« Écaille », « Cobra »…) ; null ou inconnu = non classé. */
  palier: string | null | undefined;
  /** Côté en pixels (20 à 112 ; lisible jusqu'à 24). */
  taille?: number;
  /** Décoratif (aria-hidden) quand le nom du palier est écrit à côté. */
  decoratif?: boolean;
  className?: string;
}

export default function EmblemePalier({ palier, taille = 32, decoratif = true, className = "" }: EmblemePalierProps) {
  const cle = clePalier(palier);
  const rang = cle ? RANG[cle] : 0;
  const c = cle ? (COULEUR_PALIER[palier!.toLowerCase()] ?? "var(--color-muted)") : "#798079";
  const libelle = cle ? `Palier ${palier}` : "Non classé";
  return (
    <svg
      viewBox="0 0 64 64"
      width={taille}
      height={taille}
      className={`embleme-palier shrink-0 ${className}`}
      {...(decoratif ? { "aria-hidden": true } : { role: "img", "aria-label": libelle })}
    >
      <Cadre rang={rang} c={c} />
      <Symbole cle={cle} c={c} />
    </svg>
  );
}
