import Link from "next/link";
import { LIBELLE_MOUVEMENT, type LigneClassement, type Mouvement } from "@/lib/divisions";
import Tableau from "@/components/design/Tableau";

// Une poule de division (09/10/2026, idée en réserve n°13) : classement et
// rencontres. Les victoires « vérifiées » sont celles lues chez Riot ; une
// victoire par forfait de l'adversaire compte, mais n'est pas vérifiée.

export interface JoueurPoule {
  id: string;
  pseudo: string;
  slug: string;
  mouvement: Mouvement | null;
}

export interface RencontrePoule {
  id: string;
  semaine: number;
  joueurA: string;
  joueurB: string;
  gagnantId: string | null;
  verifie: boolean;
  tournoiSlug: string | null;
  enCours: boolean;
}

const COULEUR_MOUVEMENT: Record<Mouvement, string> = {
  monte: "text-accent",
  descend: "text-danger",
  reste: "text-muted",
};

export default function PouleDivision({
  niveau,
  classement,
  joueurs,
  rencontres,
  finale,
}: {
  niveau: number;
  classement: LigneClassement[];
  joueurs: Map<string, JoueurPoule>;
  rencontres: RencontrePoule[];
  /** Ligue terminée : on montre les montées et descentes. */
  finale: boolean;
}) {
  const nom = (id: string) => joueurs.get(id)?.pseudo ?? "Joueur";
  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-titre text-2xl leading-none font-extrabold uppercase">Poule {niveau}</h3>
      <Tableau legende={`Classement de la poule ${niveau}`}>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Joueur</th>
            <th scope="col" className="text-right">
              V – D
            </th>
            <th scope="col" className="hidden text-right sm:table-cell">
              Vérifiées
            </th>
            {finale && <th scope="col">Fin</th>}
          </tr>
        </thead>
        <tbody>
          {classement.map((l, i) => {
            const j = joueurs.get(l.id);
            return (
              <tr key={l.id}>
                <td className="tabular-nums">{i + 1}</td>
                <td>
                  {j ? (
                    <Link href={`/joueur/${j.slug}`} className="hover:text-accent">
                      {j.pseudo}
                    </Link>
                  ) : (
                    "Joueur"
                  )}
                </td>
                <td className="text-right tabular-nums whitespace-nowrap">
                  {l.victoires} – {l.defaites}
                </td>
                <td className="hidden text-right tabular-nums sm:table-cell">{l.victoiresVerifiees}</td>
                {finale && (
                  <td className={`text-xs uppercase ${j?.mouvement ? COULEUR_MOUVEMENT[j.mouvement] : "text-muted"}`}>
                    {j?.mouvement ? LIBELLE_MOUVEMENT[j.mouvement] : "—"}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </Tableau>
      <ul className="flex flex-col gap-1 text-sm text-text-2">
        {rencontres.map((r) => (
          <li key={r.id} className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-xs text-muted tabular-nums">S{r.semaine}</span>
            <span className={r.gagnantId === r.joueurA ? "font-semibold text-text" : ""}>{nom(r.joueurA)}</span>
            <span className="text-muted">contre</span>
            <span className={r.gagnantId === r.joueurB ? "font-semibold text-text" : ""}>{nom(r.joueurB)}</span>
            <span className="text-xs text-muted">
              {r.gagnantId ? (
                r.tournoiSlug ? (
                  <Link href={`/lol/tournois/${r.tournoiSlug}`} className="hover:text-text">
                    {r.verifie ? "✓ vérifié" : "forfait"}
                  </Link>
                ) : r.verifie ? (
                  "✓ vérifié"
                ) : (
                  "forfait"
                )
              ) : r.enCours && r.tournoiSlug ? (
                <Link href={`/lol/tournois/${r.tournoiSlug}`} className="hover:text-text">
                  en cours
                </Link>
              ) : finale ? (
                "non joué"
              ) : (
                "à jouer"
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
