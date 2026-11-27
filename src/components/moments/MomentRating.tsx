"use client";

import Image from "next/image";
import { useId, useRef } from "react";
import { BadgeVerifie } from "@/components/design/Badges";
import EmblemePalier, { couleurPalier } from "@/components/design/EmblemePalier";
import EtiquetteExemple from "@/components/vitrine/EtiquetteExemple";
import styles from "@/components/vitrine/vitrine.module.css";
import { useMomentFort } from "./useMomentFort";

// Moment fort de l'accueil : « le rating qui monte » (étape 5, validée par
// le porteur le 27/11/2026). Carte CV d'EXEMPLE (pseudo TON_PSEUDO, étiquette
// « Exemple ») : le rating grimpe de 1730 à 1842, la courbe se trace, et au
// passage du seuil de Cobra (1750) l'emblème Venin éclate et laisse place à
// Cobra. Une seule fois, ~2,5 s, puis immobile (hors flottement lent de la
// carte, déjà en place et figé par le bouton Pause de l'accueil).
// Le HTML du serveur est l'état final (useMomentFort).

// Mêmes chiffres que la carte d'exemple de la section 02 (CartesCvExemple).
const DEPART = 1730;
const ARRIVEE = 1842;
const SEUIL_COBRA = 1750;
const RANG_DEPART = 397;
const RANG_ARRIVEE = 128;
const VENIN = couleurPalier("venin");
const COBRA = couleurPalier("cobra");

// Courbe sur 7 jours (exemple) : x de 0 à 300, y = position du rating.
const POINTS: [number, number][] = [
  [0, 80], [27, 75], [55, 77], [82, 67], [109, 64], [136, 56], [164, 52], [191, 41], [218, 32], [245, 27], [273, 20], [300, 13],
];
// 1750 sur l'échelle de la courbe (1730 en bas à y=80, 1842 en haut à y=13).
const Y_SEUIL = 68;
const TRACE = POINTS.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");

function yCourbe(x: number): number {
  for (let i = 1; i < POINTS.length; i++) {
    const [x1, y1] = POINTS[i];
    if (x <= x1) {
      const [x0, y0] = POINTS[i - 1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return POINTS[POINTS.length - 1][1];
}

const ECLATS = 12;

export default function MomentRating({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId().replace(/:/g, "");

  useMomentFort(
    ref,
    (gsap, el) => {
      const q = (nom: string) => el.querySelector<HTMLElement>(`[data-m="${nom}"]`);
      const qq = (nom: string) => el.querySelectorAll<HTMLElement>(`[data-m="${nom}"]`);
      const rating = q("rating")!;
      const delta = q("delta-n")!;
      const rang = q("rang")!;
      const sept = q("sept")!;
      const nom = q("nom")!;
      const revele = el.querySelector<SVGRectElement>("[data-m='revele']")!;
      const tete = el.querySelectorAll<SVGCircleElement>("[data-m='tete']");
      const etat = { v: DEPART, d: 0, r: RANG_DEPART, x: 0 };
      let passe = false;

      const placerTete = () => {
        const y = yCourbe(etat.x);
        tete.forEach((c) => {
          c.setAttribute("cx", String(etat.x));
          c.setAttribute("cy", String(y));
        });
      };
      const ecrire = () => {
        rating.textContent = String(Math.round(etat.v));
        delta.textContent = String(Math.round(etat.d));
        sept.textContent = `+${Math.round(etat.d)}`;
        rang.textContent = String(Math.round(etat.r));
      };
      // Point de départ : palier Venin.
      nom.textContent = "Venin";
      nom.style.color = VENIN;
      gsap.set(q("venin"), { opacity: 1, scale: 1 });
      gsap.set(q("cobra"), { opacity: 0 });
      gsap.set(revele, { attr: { width: 0 } });
      ecrire();
      placerTete();

      // Construite au passage du seuil seulement : ses fromTo posent leur
      // état de départ dès leur création (lueur, anneaux visibles trop tôt).
      let bascule: ReturnType<typeof gsap.timeline> | null = null;
      const construireBascule = () =>
        gsap
        .timeline()
        .to(q("venin"), { scale: 1.35, opacity: 0, duration: 0.18, ease: "power2.in" })
        .fromTo(q("flash"), { opacity: 1 }, { opacity: 0, duration: 0.6, ease: "power2.out" }, 0.1)
        .fromTo(q("cobra"), { opacity: 0, scale: 1.8 }, { opacity: 1, scale: 1, duration: 0.45, ease: "back.out(2.2)" }, 0.12)
        .fromTo(qq("anneau")[0], { opacity: 0.9, scale: 0.7 }, { opacity: 0, scale: 1.9, duration: 0.7, ease: "power2.out" }, 0.12)
        .fromTo(qq("anneau")[1], { opacity: 0.6, scale: 0.7 }, { opacity: 0, scale: 2.5, duration: 0.9, ease: "power2.out" }, 0.22)
        .fromTo(
          qq("eclat"),
          { opacity: 1, x: 0, y: 0 },
          {
            opacity: 0,
            duration: 0.7,
            ease: "power3.out",
            x: (i: number) => Math.sin((i * 2 * Math.PI) / ECLATS) * 70,
            y: (i: number) => -Math.cos((i * 2 * Math.PI) / ECLATS) * 70,
          },
          0.12,
        )
        .call(
          () => {
            nom.textContent = "Cobra";
            nom.style.color = COBRA;
          },
          undefined,
          0.15,
        )
        .fromTo(nom, { scale: 1.5 }, { scale: 1, duration: 0.4, ease: "back.out(3)" }, 0.15)
        .fromTo(q("bandeau"), { opacity: 0, scaleX: 0.2 }, { opacity: 1, scaleX: 1, duration: 0.3, ease: "power3.out" }, 0.2)
        .to(q("bandeau"), { opacity: 0, y: -8, duration: 0.35, ease: "power2.in" }, 1.2);

      return gsap
        .timeline()
        .from(q("carte"), { y: 50, opacity: 0, rotateX: 12, transformPerspective: 900, duration: 0.6, ease: "power3.out" })
        .from(q("venin"), { scale: 0.5, opacity: 0, duration: 0.45, ease: "back.out(2)" }, 0.15)
        .to(revele, { attr: { width: 310 }, duration: 1.6, ease: "power2.inOut" }, 0.3)
        .to(
          etat,
          {
            v: ARRIVEE,
            d: ARRIVEE - DEPART,
            r: RANG_ARRIVEE,
            x: 300,
            duration: 1.6,
            ease: "power2.inOut",
            onUpdate: () => {
              ecrire();
              placerTete();
              if (!passe && etat.v >= SEUIL_COBRA) {
                passe = true;
                bascule = construireBascule();
              }
            },
          },
          0.3,
        )
        .fromTo(q("delta"), { scale: 1.5 }, { scale: 1, duration: 0.4, ease: "back.out(3)" }, 1.9)
        .add(() => {
          // Fin : si la bascule n'a pas fini (onglet en arrière-plan), on la termine.
          bascule?.progress(1);
          // Plus aucun style posé par l'animation (Venin reste caché par sa classe).
          gsap.set(el.querySelectorAll("[data-m]"), { clearProps: "opacity,transform,scale" });
          nom.style.color = COBRA;
        }, 3);
    },
  );

  return (
    <figure className={`relative ${styles.flotte} ${className}`}>
      <figcaption className="sr-only">
        Exemple fictif d&apos;un CV e-sport Najarena, au nom de TON_PSEUDO : rating {ARRIVEE}, palier Cobra, +{ARRIVEE - DEPART} points
        sur 7 jours, 128e au classement, 147 matchs.
      </figcaption>
      <div ref={ref} data-moment="attente" aria-hidden="true" className="relative">
        {/* Bandeau et lueur de la bascule de palier (invisibles au repos). */}
        <div
          data-m="flash"
          className="pointer-events-none absolute -inset-10 z-10 opacity-0"
          style={{ background: `radial-gradient(circle at 75% 42%, ${COBRA}66, transparent 55%)` }}
        />
        <div data-m="bandeau" className="pointer-events-none absolute inset-x-0 top-[44%] z-20 flex justify-center opacity-0">
          <span
            className="bg-[linear-gradient(90deg,transparent,var(--color-bg)_18%,var(--color-bg)_82%,transparent)] px-4 py-1.5 font-titre text-[clamp(20px,7vw,34px)] font-black tracking-[2px] sm:px-7 sm:tracking-[4px] whitespace-nowrap uppercase"
            style={{ color: COBRA, textShadow: `0 0 22px ${COBRA}99` }}
          >
            Palier Cobra atteint
          </span>
        </div>

        <div
          data-m="carte"
          className="relative flex flex-col gap-6 rounded-panneau border border-line bg-[linear-gradient(160deg,var(--color-surface)_0%,var(--color-surface-fin)_100%)] p-7 sm:p-8"
          style={{ boxShadow: `inset 0 1px 0 rgba(255,255,255,.07), 0 50px 100px rgba(0,0,0,.7), 0 0 120px ${COBRA}1f` }}
        >
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-mini text-muted uppercase">
            <span className="flex items-center gap-2 whitespace-nowrap">
              CV e-sport <EtiquetteExemple />
            </span>
            <BadgeVerifie>Compte vérifié</BadgeVerifie>
          </div>
          <div className="flex items-center gap-4">
            <Image src="/avatars/avatar-p1.svg" alt="" width={52} height={52} unoptimized className="rounded-panneau" />
            <div className="flex flex-col gap-1">
              <span className="font-titre text-[26px] leading-none font-extrabold tracking-[1px]">TON_PSEUDO</span>
              <span className="text-sm text-muted">Mid · Ton équipe</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-mini text-muted uppercase">Rating Najarena</span>
              <span data-m="rating" className="font-titre text-[clamp(4.5rem,18vw,6rem)] leading-[.82] font-black tabular-nums">
                {ARRIVEE}
              </span>
              <span data-m="delta" className="origin-left self-start font-titre text-[22px] font-extrabold text-accent tabular-nums">
                ▲ +<span data-m="delta-n">{ARRIVEE - DEPART}</span> / 7 j
              </span>
            </div>
            <div className="flex shrink-0 flex-col items-center gap-1.5">
              <div className="relative size-[92px] sm:size-[104px]">
                <span data-m="anneau" className="absolute -inset-2 rounded-full border-2 opacity-0" style={{ borderColor: COBRA }} />
                <span data-m="anneau" className="absolute -inset-2 rounded-full border-2 opacity-0" style={{ borderColor: COBRA }} />
                <div data-m="venin" className="absolute inset-0 opacity-0">
                  <EmblemePalier palier="Venin" taille={104} className="size-full" />
                </div>
                <div data-m="cobra" className="absolute inset-0">
                  <EmblemePalier palier="Cobra" taille={104} className="size-full" />
                </div>
                <span className="absolute top-1/2 left-1/2">
                  {Array.from({ length: ECLATS }, (_, i) => (
                    <i
                      key={i}
                      data-m="eclat"
                      className="absolute -mt-1.5 -ml-0.5 block h-3 w-1 rounded-sm opacity-0"
                      style={{ background: COBRA, rotate: `${(i * 360) / ECLATS}deg` }}
                    />
                  ))}
                </span>
              </div>
              <span data-m="nom" className="font-titre text-xl font-black tracking-[3px] uppercase" style={{ color: COBRA }}>
                Cobra
              </span>
            </div>
          </div>

          <svg viewBox="0 0 300 92" className="h-auto w-full overflow-visible">
            <defs>
              <linearGradient id={`${id}-aire`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={COBRA} stopOpacity=".3" />
                <stop offset="1" stopColor={COBRA} stopOpacity="0" />
              </linearGradient>
              <linearGradient id={`${id}-trait`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor={VENIN} />
                <stop offset=".6" stopColor={VENIN} />
                <stop offset=".72" stopColor={COBRA} />
                <stop offset="1" stopColor={COBRA} />
              </linearGradient>
              <clipPath id={`${id}-revele`}>
                <rect data-m="revele" x="-5" y="-10" width="310" height="112" />
              </clipPath>
            </defs>
            <line x1="0" y1={Y_SEUIL} x2="300" y2={Y_SEUIL} className="stroke-line-strong" strokeDasharray="4 5" />
            <text x="0" y={Y_SEUIL - 7} className="fill-muted" fontSize="9" letterSpacing="2" style={{ fontFamily: "var(--font-texte)" }}>
              {SEUIL_COBRA} · SEUIL COBRA
            </text>
            <g clipPath={`url(#${id}-revele)`}>
              <path d={`${TRACE} V92 H0Z`} fill={`url(#${id}-aire)`} />
              <path d={TRACE} fill="none" stroke={`url(#${id}-trait)`} strokeWidth="6" opacity=".25" />
              <path d={TRACE} fill="none" stroke={`url(#${id}-trait)`} strokeWidth="2.5" strokeLinejoin="round" />
            </g>
            <circle data-m="tete" cx="300" cy={POINTS[POINTS.length - 1][1]} r="11" fill={COBRA} opacity=".28" />
            <circle data-m="tete" cx="300" cy={POINTS[POINTS.length - 1][1]} r="4.5" className="fill-text" />
          </svg>

          <div className="grid grid-cols-3 border-t border-line pt-4">
            <div className="flex flex-col gap-1">
              <span className="text-mini text-muted uppercase">Rang</span>
              <span className="font-titre text-[26px] leading-none font-extrabold tabular-nums">
                #<span data-m="rang">{RANG_ARRIVEE}</span>
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-mini text-muted uppercase">Matchs</span>
              <span className="font-titre text-[26px] leading-none font-extrabold tabular-nums">147</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-mini text-muted uppercase">Sur 7 jours</span>
              <span data-m="sept" className="font-titre text-[26px] leading-none font-extrabold tabular-nums">
                +{ARRIVEE - DEPART}
              </span>
            </div>
          </div>
        </div>
      </div>
    </figure>
  );
}
