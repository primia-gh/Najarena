import Link from "next/link";
import type { ReactNode } from "react";
import { BadgeEnDirect, BadgeVerdict } from "@/components/design/Badges";
import type { NiveauVerdict } from "@/lib/tournois";

// Bracket de la page tournoi (maquette tournoi.dc.html, pages/tournoi.md).
// Une colonne par tour ; chaque match occupe une « case » de même hauteur
// dans sa colonne, si bien que le centre d'un match tombe toujours entre
// ses deux matchs d'origine. Les connecteurs sont dessinés en bordures :
// sortie à droite (moitié haute ou basse vers le point de jonction),
// entrée à gauche. Vert sur le chemin déjà joué (match avec verdict).
// Défile horizontalement DANS son cadre sur mobile, jamais la page.

const DEMI_ECART = "41px"; // maquette : 82 px entre deux colonnes

export interface TourBracket {
  numero: number;
  libelle: string;
  matchs: { id: string; joue: boolean; atteint: boolean; contenu: ReactNode }[];
}

export function ColonnesBracket({ tours, legende }: { tours: TourBracket[]; legende: string }) {
  const matchsPremierTour = tours[0]?.matchs.length ?? 1;
  return (
    <div
      role="region"
      aria-label={legende}
      tabIndex={0}
      className="overflow-x-auto pb-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
    >
      <div className="flex w-max gap-[82px]">
        {tours.map((t, indexTour) => {
          const dernier = indexTour === tours.length - 1;
          return (
            <div key={t.numero} className="flex w-[250px] flex-col gap-[22px]">
              <h3 className="text-mini text-muted uppercase">{t.libelle}</h3>
              <ol className="flex flex-col" style={{ minHeight: `${matchsPremierTour * 112}px` }}>
                {t.matchs.map((m, i) => {
                  const haut = i % 2 === 0;
                  return (
                    <li key={m.id} className="relative flex flex-1 items-center py-3">
                      {indexTour > 0 && (
                        <span
                          aria-hidden="true"
                          className={`absolute top-1/2 right-full border-t ${m.atteint ? "border-accent" : "border-line-strong"}`}
                          style={{ width: DEMI_ECART }}
                        />
                      )}
                      {!dernier && (
                        <span
                          aria-hidden="true"
                          className={`absolute left-full border-r ${haut ? "top-1/2 h-1/2 border-t" : "top-0 h-1/2 border-b"} ${
                            m.joue ? "border-accent" : "border-line-strong"
                          }`}
                          style={{ width: DEMI_ECART }}
                        />
                      )}
                      <div className="w-full">{m.contenu}</div>
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export interface ParticipantCase {
  cle: string;
  pseudo: string | null;
  slug: string | null;
  /** null : pas de score (forfait, décision sans partie jouée). */
  score: number | null;
  estGagnant: boolean | null;
}

export type EtatMatch = "direct" | "verdict" | "litige" | "attente" | "a_venir";

interface CaseMatchProps {
  participants: ParticipantCase[];
  etat: EtatMatch;
  niveau?: NiveauVerdict;
  motif?: string | null;
  /** Le visiteur connecté joue ce match : liseré vert (pages/tournoi.md). */
  monMatch: boolean;
  /** Messages et formulaire sous la case (litige, attente d'organisateur). */
  children?: ReactNode;
}

export function CaseMatch({ participants, etat, niveau, motif, monMatch, children }: CaseMatchProps) {
  const bordure =
    etat === "litige"
      ? "border-danger/60"
      : etat === "direct"
        ? "border-accent animate-lueur"
        : monMatch
          ? "border-accent/55"
          : "border-[rgba(245,245,244,0.1)]";

  const lignes: (ParticipantCase | null)[] =
    participants.length >= 2 ? participants.slice(0, 2) : participants.length === 1 ? [participants[0], null] : [null, null];

  return (
    <div className="relative flex flex-col gap-1.5">
      <div className={`relative flex flex-col rounded-[3px] border bg-[#111311] ${bordure} ${monMatch ? "border-l-[3px]" : ""}`}>
        {lignes.map((p, i) => (
          <div
            key={p?.cle ?? `vide-${i}`}
            className={`flex min-h-[37px] items-center justify-between gap-3 px-3.5 ${i === 0 ? "border-b border-[rgba(245,245,244,0.06)]" : ""}`}
          >
            {p ? (
              <>
                <span
                  className={`min-w-0 truncate text-[13px] tracking-[1px] ${
                    p.estGagnant ? "font-semibold text-text" : p.estGagnant === false ? "text-faint" : "text-text-2"
                  }`}
                >
                  {p.slug ? (
                    <Link
                      href={`/joueur/${p.slug}`}
                      className="hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      {p.pseudo}
                    </Link>
                  ) : (
                    (p.pseudo ?? "Joueur inconnu")
                  )}
                  {p.estGagnant && <span className="sr-only"> (vainqueur)</span>}
                </span>
                <span
                  className={`text-sm font-bold tabular-nums ${p.estGagnant ? "text-accent" : "text-faint"}`}
                >
                  {p.score ?? "—"}
                </span>
              </>
            ) : (
              <span className="text-[13px] tracking-[1px] text-faint">
                {participants.length === 1 && i === 1 ? "En attente d'adversaire" : "À déterminer"}
              </span>
            )}
          </div>
        ))}

        {/* Étiquette posée sur le bord haut de la case (maquette). */}
        <span className="absolute -top-2.5 right-2 bg-bg px-1.5 leading-none">
          {etat === "direct" ? (
            <BadgeEnDirect className="text-[9px]!" />
          ) : etat === "verdict" && niveau ? (
            <BadgeVerdict niveau={niveau} compact className="text-[9px]! tracking-[2px]!" />
          ) : etat === "litige" ? (
            <span className="text-[9px] font-semibold tracking-[2px] text-danger uppercase">Litige</span>
          ) : etat === "attente" ? (
            <span className="text-[9px] font-semibold tracking-[2px] text-danger uppercase">À trancher</span>
          ) : (
            <span className="text-[9px] font-semibold tracking-[2px] text-muted uppercase">À venir</span>
          )}
        </span>
      </div>
      {/* Motif sous la case, hors du flux : le connecteur reste centré sur la case. */}
      {niveau === "manuel" && motif && (
        <p className="absolute top-full left-0 mt-1 w-full text-xs leading-snug text-muted">
          Motif : {motif}
        </p>
      )}
      {children}
    </div>
  );
}
