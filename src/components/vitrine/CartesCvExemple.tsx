import Image from "next/image";
import ChiffreRating from "@/components/design/ChiffreRating";
import { BadgeChercheEquipe, BadgeVerdict, BadgeVerifie } from "@/components/design/Badges";
import styles from "./vitrine.module.css";

// Cartes « CV e-sport » de l'accueil (maquette accueil, ouverture et
// section 02) : illustrations du produit, comme une capture d'écran de
// vitrine, avec le badge « VÉRIFIÉ » de la maquette (décision du porteur du
// 23/09/2026 : la vitrine sert d'abord à attirer). Le pseudo reste
// « TON_PSEUDO » : on montre le CV que le visiteur peut avoir, jamais un faux
// joueur. Chaque bloc existe vraiment sur un profil ; le « rating par rôle »
// de la maquette, qui n'existe pas, est remplacé par le journal des points.

const DERNIERS_RESULTATS: ("V" | "D")[] = ["V", "V", "D", "V", "V"];

/** Carte flottante de l'ouverture. */
export function CarteCvFlottante({ className = "" }: { className?: string }) {
  return (
    <figure
      className={`relative flex flex-col gap-[26px] rounded-panneau border border-line bg-[linear-gradient(160deg,#171917_0%,#0D0F0D_100%)] p-8 shadow-[inset_0_1px_0_rgba(255,255,255,.07),0_50px_100px_rgba(0,0,0,.7),0_0_120px_rgba(182,255,59,.06)] ${styles.flotte} ${className}`}
    >
      <figcaption className="sr-only">
        Aperçu d&apos;un CV e-sport Najarena : rating, progression sur 7 jours et cinq derniers résultats.
      </figcaption>
      <div aria-hidden="true" className="flex flex-col gap-[26px]">
        <div className="flex items-center justify-between text-mini text-muted uppercase">
          <span>CV e-sport</span>
          <BadgeVerifie />
        </div>
        <div className="flex items-center gap-4">
          <Image src="/avatars/avatar-p1.svg" alt="" width={56} height={56} unoptimized className="rounded-panneau" />
          <div className="flex flex-col gap-1">
            <span className="font-titre text-[26px] font-extrabold tracking-[1px]">TON_PSEUDO</span>
            <span className="text-sm text-muted">Mid · Ton équipe</span>
          </div>
        </div>
        <div className="h-px bg-line" />
        <div className="flex items-end justify-between">
          <div className="flex flex-col gap-1.5">
            <span className="text-mini text-muted uppercase">Rating</span>
            <ChiffreRating valeur={1842} taille="carte" />
          </div>
          <span className="text-sm font-semibold text-accent">▲ +64 / 7 j</span>
        </div>
        <svg className="h-auto w-full" viewBox="0 0 336 56" fill="none">
          <polyline
            points="0,48 35,44 70,46 105,35 140,38 175,27 210,30 245,19 280,16 336,6"
            stroke="#B6FF3B"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className="flex gap-1.5">
          {DERNIERS_RESULTATS.map((r, i) => (
            <span
              key={i}
              className={`flex h-9 flex-1 items-center justify-center rounded-bouton text-[13px] font-bold tracking-[1px] ${
                r === "V" ? "bg-accent/14 text-accent" : "bg-danger/12 text-danger"
              }`}
            >
              {r}
            </span>
          ))}
        </div>
      </div>
    </figure>
  );
}

const STATS = [
  { libelle: "Rating", valeur: "1842", accent: true },
  { libelle: "Classement", valeur: "#128", accent: false },
  { libelle: "Victoires", valeur: "62%", accent: false },
  { libelle: "Matchs", valeur: "147", accent: false },
];

const JOURNAL: {
  tournoi: string;
  niveau: "historique" | "manuel";
  delta: string | null;
  avant: number;
  apres: number;
}[] = [
  { tournoi: "Quotidienne du soir", niveau: "historique", delta: "+18", avant: 1824, apres: 1842 },
  { tournoi: "Quotidienne du midi", niveau: "historique", delta: "−9", avant: 1833, apres: 1824 },
  { tournoi: "Coupe du week-end", niveau: "manuel", delta: null, avant: 1833, apres: 1833 },
];

/** Carte détaillée de la section 02 « Le CV e-sport ». */
export function CarteCvDetail({ className = "" }: { className?: string }) {
  return (
    <figure
      className={`relative flex min-w-0 flex-col gap-9 rounded-panneau border border-[rgba(245,245,244,0.07)] bg-[linear-gradient(160deg,#161816_0%,#0E100E_100%)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,.07),0_40px_90px_rgba(0,0,0,.5)] sm:p-11 ${className}`}
    >
      <figcaption className="sr-only">
        Aperçu d&apos;un CV e-sport Najarena : rating, rang au classement, taux de victoires, nombre de matchs et
        journal des points, où chaque variation indique le niveau de preuve du résultat.
      </figcaption>
      <div aria-hidden="true" className="flex flex-col gap-9">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between text-mini text-muted uppercase">
            <span>CV e-sport</span>
            <BadgeVerifie>Profil vérifié</BadgeVerifie>
          </div>
          <div className="flex items-center gap-4 sm:gap-[22px]">
            <Image
              src="/avatars/avatar-p1.svg"
              alt=""
              width={80}
              height={80}
              unoptimized
              className="h-14 w-14 shrink-0 rounded-avatar sm:h-20 sm:w-20"
            />
            <div className="flex min-w-0 flex-col gap-2">
              <span className="font-titre text-[clamp(1.75rem,2.6vw,2.375rem)] leading-none font-black tracking-[1px]">
                TON_PSEUDO
              </span>
              <span className="text-[15px] text-muted">Mid principal · Jungle secondaire</span>
              <BadgeChercheEquipe className="self-start" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 border-y border-line sm:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.libelle} className="flex flex-col gap-2.5 py-6">
              <span className="text-mini text-muted uppercase">{s.libelle}</span>
              <span
                className={`font-titre text-[clamp(2rem,3vw,2.75rem)] leading-none font-black uppercase tabular-nums ${
                  s.accent ? "text-accent" : "text-text"
                }`}
              >
                {s.valeur}
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          <span className="text-mini text-muted uppercase">Journal des points</span>
          <ul className="flex flex-col">
            {JOURNAL.map((l) => (
              <li
                key={l.tournoi}
                className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-[rgba(245,245,244,0.06)] py-3 last:border-b-0"
              >
                {/* Téléphone : nom seul sur sa ligne, badge et points dessous. */}
                <span className="min-w-0 basis-full text-[15px] sm:basis-0 sm:flex-1">{l.tournoi}</span>
                <BadgeVerdict niveau={l.niveau} compact />
                <span className="ml-auto shrink-0 text-right text-sm whitespace-nowrap tabular-nums">
                  {l.delta ? (
                    <>
                      <span className={l.delta.startsWith("+") ? "font-semibold text-accent" : "font-semibold text-danger"}>
                        {l.delta}
                      </span>
                      <span className="text-muted">
                        {" "}
                        · {l.avant} → {l.apres}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted">Hors classement</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </figure>
  );
}
