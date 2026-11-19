import Link from "next/link";
import type { LigneClassementSuisse } from "@/lib/suisse";
import { typographie } from "@/lib/typographie";
import LibelleSection from "@/components/design/LibelleSection";
import Tableau from "@/components/design/Tableau";

// Classement d'un tournoi au format suisse (19/11/2026) : victoires, puis
// Buchholz (victoires cumulées des adversaires affrontés), calculés par la
// base (classement_suisse). Provisoire tant que des rondes restent à jouer.

export default function ClassementSuisse({
  lignes,
  rondes,
  termine,
}: {
  lignes: LigneClassementSuisse[];
  rondes: number | null;
  termine: boolean;
}) {
  return (
    <section aria-labelledby="titre-classement-suisse" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <LibelleSection as="h2" id="titre-classement-suisse">
          Classement
        </LibelleSection>
        <span className="text-xs text-muted uppercase">{termine ? "Final" : "Provisoire"}</span>
      </div>
      <p className="max-w-3xl text-sm text-muted">
        {typographie(
          `Format suisse${rondes ? ` en ${rondes} ronde${rondes > 1 ? "s" : ""}` : ""} : chaque joueur joue toutes les rondes, contre un adversaire au même bilan. Égalités départagées par le Buchholz, la somme des victoires de ses adversaires.`,
        )}
      </p>
      <Tableau legende="Classement du tournoi au format suisse">
        <thead>
          <tr>
            <th scope="col" className="w-12">
              Rang
            </th>
            <th scope="col">Joueur</th>
            <th scope="col" className="text-right!">
              Victoires
            </th>
            <th scope="col" className="text-right!">
              Défaites
            </th>
            <th scope="col" className="text-right!">
              Buchholz
            </th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l) => (
            <tr key={l.profile_id}>
              <td className="tabular-nums">{l.rang}</td>
              <td>
                <Link href={`/joueur/${l.slug}`} className="font-semibold hover:text-accent">
                  {l.pseudo}
                </Link>
              </td>
              <td className="text-right tabular-nums">{l.victoires}</td>
              <td className="text-right tabular-nums">{l.defaites}</td>
              <td className="text-right text-muted tabular-nums">{l.buchholz}</td>
            </tr>
          ))}
        </tbody>
      </Tableau>
    </section>
  );
}
