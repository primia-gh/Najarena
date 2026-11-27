"use client";

import { useId, useRef, type ReactNode } from "react";
import { brouillerEmpreinte, useMomentFort } from "./useMomentFort";

// Moment fort de la page de preuve : « le verdict qui se scelle » (étape 5,
// validée par le porteur le 27/11/2026, ~2,5 s acceptées pour ce moment).
// SEULEMENT pour un verdict lu chez Riot (niveau 2 ou 3) : un verdict manuel
// s'affiche tel quel, gris, sans sceau (CLAUDE.md §3 et §7).
// Les lignes du verdict s'inscrivent, le sceau s'abat (la fiche tremble,
// trois ondes partent), la coche se trace. La chaîne du registre (plus bas)
// s'accroche à son tour quand elle entre à l'écran (MomentChaine).
// Le HTML du serveur est l'état final (useMomentFort).

const NIVEAU: Record<"historique" | "code_tournoi", number> = { historique: 2, code_tournoi: 3 };

export function SceauVerdict({ niveau, className = "" }: { niveau: "historique" | "code_tournoi"; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <div data-m="sceau" className={`relative aspect-square ${className}`}>
      <span data-m="onde" className="absolute inset-0 rounded-full border-2 border-accent opacity-0" />
      <span data-m="onde" className="absolute inset-0 rounded-full border-2 border-accent opacity-0" />
      <span data-m="onde" className="absolute inset-0 rounded-full border-2 border-accent opacity-0" />
      <svg viewBox="0 0 200 200" className="block size-full overflow-visible text-accent" role="img" aria-label={`Sceau : résultat lu chez Riot, niveau ${NIVEAU[niveau]}`}>
        <defs>
          <path id={`${id}-cercle`} d="M100 100 m-74 0 a74 74 0 1 1 148 0 a74 74 0 1 1 -148 0" />
        </defs>
        <circle cx="100" cy="100" r="94" fill="currentColor" fillOpacity=".06" stroke="currentColor" strokeWidth="3" />
        <circle cx="100" cy="100" r="86" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 4" />
        <circle cx="100" cy="100" r="60" className="fill-bg-alt" stroke="currentColor" strokeWidth="2" />
        <g data-m="anneau-texte" style={{ transformOrigin: "100px 100px" }}>
          <text fill="currentColor" style={{ fontFamily: "var(--font-texte)" }} fontWeight="700" fontSize="12.5" letterSpacing="3.2">
            <textPath href={`#${id}-cercle`}>LU CHEZ RIOT · VÉRIFIÉ · NIVEAU {NIVEAU[niveau]} · NAJARENA ·</textPath>
          </text>
        </g>
        <path
          data-m="coche"
          d="M74 101 l18 18 l36 -38"
          fill="none"
          stroke="currentColor"
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export default function MomentVerdict({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useMomentFort(
    ref,
    (gsap, el) => {
      const q = (nom: string) => el.querySelector<HTMLElement>(`[data-m="${nom}"]`);
      const lignes = el.querySelectorAll("dl > div");
      const coche = el.querySelector<SVGPathElement>('[data-m="coche"]');
      const longueur = coche?.getTotalLength() ?? 80;
      const tl = gsap.timeline();
      tl.from(lignes, { opacity: 0, x: -14, duration: 0.3, stagger: 0.07, ease: "power2.out" }, 0.1)
        .fromTo(
          q("sceau"),
          { scale: 2.6, rotation: -28, opacity: 0, filter: "blur(6px)" },
          { scale: 1, rotation: 0, opacity: 1, filter: "blur(0px)", duration: 0.32, ease: "power4.in" },
          0.7,
        )
        .to(
          el,
          {
            keyframes: [
              { x: -7, y: 4, duration: 0.04 },
              { x: 6, y: -3, duration: 0.04 },
              { x: -4, y: 2, duration: 0.04 },
              { x: 2, y: -1, duration: 0.04 },
              { x: 0, y: 0, duration: 0.05 },
            ],
          },
          1.02,
        )
        .fromTo(el.querySelectorAll('[data-m="onde"]'), { scale: 0.9, opacity: (i: number) => 0.9 - i * 0.28 }, {
          scale: (i: number) => 1.9 + i * 0.6,
          opacity: 0,
          duration: (i: number) => 0.7 + i * 0.2,
          stagger: 0.08,
          ease: "power2.out",
        }, 1.02)
        .fromTo(q("anneau-texte"), { rotation: -40 }, { rotation: 0, duration: 0.9, ease: "power3.out" }, 1.02);
      if (coche) {
        tl.fromTo(coche, { strokeDasharray: longueur, strokeDashoffset: longueur }, { strokeDashoffset: 0, duration: 0.3, ease: "power2.out" }, 1.05);
      }
      // Fin : plus aucun style posé (les ondes agrandies déborderaient de l'écran).
      tl.set([el, ...el.querySelectorAll('[data-m="onde"]')], { clearProps: "transform" });
      return tl;
    },
  );
  return (
    <div ref={ref} data-moment="attente" className={className}>
      {children}
    </div>
  );
}

export interface BlocRegistre {
  numero: number;
  pseudo: string;
  empreinte: string;
  empreinteCourte: string;
}

/** Chaîne du registre : les dernières lignes scellées de ce match. Le maillon
 *  n'est dessiné qu'entre deux lignes qui se suivent vraiment dans le registre. */
export function MomentChaine({ blocs }: { blocs: BlocRegistre[] }) {
  const ref = useRef<HTMLOListElement>(null);
  useMomentFort(
    ref,
    (gsap, el) => {
      const items = el.querySelectorAll('[data-m="bloc"]');
      const maillons = el.querySelectorAll('[data-m="maillon"]');
      const anses = el.querySelectorAll('[data-m="anse"]');
      const tl = gsap.timeline();
      tl.from(items, { x: 50, opacity: 0, duration: 0.35, stagger: 0.15, ease: "power3.out" }, 0)
        .set(maillons, { transformOrigin: "0% 50%" }, 0)
        .from(maillons, { scaleX: 0, duration: 0.25, stagger: 0.15, ease: "back.out(3)" }, 0.25)
        .fromTo(anses, { y: -3 }, { y: 0, duration: 0.15, stagger: 0.15, ease: "power4.in" }, 0.9);
      el.querySelectorAll<HTMLElement>('[data-m="empreinte"]').forEach((c, i) => tl.add(brouillerEmpreinte(gsap, c, 0.5), 0.3 + i * 0.15));
      const dernier = items[items.length - 1];
      if (dernier) tl.fromTo(dernier, { boxShadow: "0 0 0 0 color-mix(in srgb, var(--color-accent) 50%, transparent)" }, { boxShadow: "0 0 0 10px color-mix(in srgb, var(--color-accent) 0%, transparent)", duration: 0.5 }, 1.1);
      tl.set([...items, ...maillons, ...anses], { clearProps: "opacity,transform,boxShadow,transformOrigin" });
      return tl;
    },
  );
  const trou = blocs.some((b, i) => i > 0 && blocs[i - 1].numero + 1 !== b.numero);
  return (
    <div className="flex flex-col gap-2">
    <ol ref={ref} data-moment="attente" aria-label="Chaîne des dernières lignes scellées" className="flex items-center">
      {blocs.map((b, i) => {
        const dernier = i === blocs.length - 1;
        return (
          <li key={b.numero} className={`flex min-w-0 flex-1 items-center ${i < blocs.length - 2 ? "max-sm:hidden" : ""}`}>
            {i > 0 && blocs[i - 1].numero + 1 !== b.numero && (
              // Lignes non consécutives (d'autres joueurs entre les deux) : on
              // ne dessine pas de maillon, la chaîne passe par ces lignes-là.
              <span
                aria-hidden="true"
                data-m="maillon"
                className={`w-11 shrink-0 text-center text-muted ${i === blocs.length - 2 ? "max-sm:hidden" : ""}`}
              >
                ⋯
              </span>
            )}
            {i > 0 && blocs[i - 1].numero + 1 === b.numero && (
              <svg
                aria-hidden="true"
                data-m="maillon"
                viewBox="0 0 46 24"
                className={`h-6 w-11 shrink-0 text-accent ${i === blocs.length - 2 ? "max-sm:hidden" : ""}`}
              >
                <rect x="3" y="7" width="22" height="10" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
                <rect x="21" y="7" width="22" height="10" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
            )}
            <div
              data-m="bloc"
              className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-[3px] border border-line-strong bg-surface px-3.5 py-3"
            >
              <span className="flex items-center justify-between gap-2 text-mini text-muted uppercase">
                <span className="tabular-nums">
                  N° {b.numero}
                  {dernier && <span className="ml-2 text-text-2">· Dernière</span>}
                </span>
                <svg aria-hidden="true" viewBox="0 0 18 18" className="size-4 shrink-0 text-muted">
                  <rect x="3" y="8" width="12" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  <path data-m="anse" d="M6 8V5.5a3 3 0 016 0V8" fill="none" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </span>
              <span className="truncate text-[13px] text-text-2">{b.pseudo}</span>
              <code data-m="empreinte" title={b.empreinte} className="truncate font-texte text-xs text-muted tabular-nums">
                {b.empreinteCourte}
              </code>
            </div>
          </li>
        );
      })}
    </ol>
      {trou && <p className="text-xs text-muted">⋯ : lignes d&apos;autres joueurs entre les deux, dans le registre.</p>}
    </div>
  );
}
