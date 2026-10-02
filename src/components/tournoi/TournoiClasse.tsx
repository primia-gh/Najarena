import Link from "next/link";
import Panneau from "@/components/design/Panneau";
import Icone from "@/components/design/Icone";
import type { EvaluationClassement, StatutClassement } from "@/lib/tournoi-classe";

// Label « tournoi classé » (28/09/2026, audit E12 et N12) : la page du
// tournoi dit, critère par critère, s'il compte au classement. Le vert est
// réservé au tournoi classé (il rapporte des points vérifiés) ; tout le
// reste est gris, jamais rouge : un tournoi amical n'est pas une faute.

const STYLE_BADGE: Record<StatutClassement, string> = {
  classe: "border-accent/50 text-accent",
  a_confirmer: "border-line-strong text-text-2",
  non_classe: "border-line-strong text-muted",
};

const LIBELLE_BADGE: Record<StatutClassement, string> = {
  classe: "Classé",
  a_confirmer: "Classement à confirmer",
  non_classe: "Non classé",
};

/** Étiquette de l'en-tête du tournoi. */
export function BadgeClassement({ statut }: { statut: StatutClassement }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-bouton border px-2.5 py-[5px] ${STYLE_BADGE[statut]}`}>
      {statut === "classe" && <Icone nom="coche" taille={12} epaisseur={3} />}
      {LIBELLE_BADGE[statut]}
    </span>
  );
}

const SYMBOLE: Record<"ok" | "ko" | "attente", { texte: string; lecteur: string; classe: string }> = {
  ok: { texte: "✓", lecteur: "rempli", classe: "text-accent" },
  ko: { texte: "✕", lecteur: "non rempli", classe: "text-muted" },
  attente: { texte: "…", lecteur: "à venir", classe: "text-text-2" },
};

/** Encart détaillé : critères publics, un par ligne. */
export function CriteresClassement({ evaluation }: { evaluation: EvaluationClassement }) {
  return (
    <section aria-labelledby="titre-classement">
      <Panneau className="flex flex-col gap-4 p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2
            id="titre-classement"
            className="scroll-mt-28 font-texte text-libelle font-medium text-muted uppercase"
          >
            Compte au classement ?
          </h2>
          <span className="text-mini font-semibold uppercase">
            <BadgeClassement statut={evaluation.statut} />
          </span>
        </div>
        <p className="text-[15px] leading-normal text-text-2">{evaluation.explication}</p>
        <ul className="flex flex-col gap-2.5">
          {evaluation.criteres.map((c) => {
            const s = SYMBOLE[c.etat];
            return (
              <li key={c.libelle} className="flex gap-3 text-sm leading-normal">
                <span aria-hidden="true" className={`w-4 shrink-0 text-center font-bold ${s.classe}`}>
                  {s.texte}
                </span>
                <span className={c.etat === "ko" ? "text-muted" : "text-text"}>
                  {c.libelle}
                  <span className="sr-only"> : {s.lecteur}</span>
                  {c.detail && <span className="text-muted tabular-nums"> — {c.detail}</span>}
                </span>
              </li>
            );
          })}
        </ul>
        <Link
          href="/comment-ca-marche#tournois-classes"
          className="inline-flex min-h-11 items-center self-start text-[13px] text-muted underline underline-offset-3 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Pourquoi ces critères
        </Link>
      </Panneau>
    </section>
  );
}
