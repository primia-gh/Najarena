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
          `Format suisse${rondes ? ` en ${rondes} ronde${rondes > 1 ? "s" : ""}` : ""} : chaque joueur joue toutes les rondes, contre un adversaire au même bilan. À égalité de victoires, la force des adversaires départage (méthode Buchholz : la somme des victoires des adversaires affrontés). Deux victoires contre des joueurs qui gagnent valent plus que deux victoires contre des joueurs qui perdent.`,
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
              Force des adversaires
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
                {l.abandon && <span className="ml-2 text-xs text-muted">a abandonné</span>}
              </td>
              <td className="text-right tabular-nums">{l.victoires}</td>
              <td className="text-right tabular-nums">{l.defaites}</td>
              <td className="text-right text-muted tabular-nums">{l.buchholz}</td>
            </tr>
          ))}
        </tbody>
      </Tableau>
      {lignes.some((l) => l.abandon) && (
        <p className="max-w-3xl text-sm text-muted">
          {typographie(
            "Un joueur qui a abandonné a quitté le tournoi en cours de route : son match en cours, s'il en avait un, a été donné à son adversaire (décision manuelle, jamais comptée au classement Najarena), et il n'est plus apparié. Il reste au classement du tournoi avec ses résultats, après les joueurs allés au bout.",
          )}
        </p>
      )}
      {lignes.length % 2 === 1 && (
        <p className="max-w-3xl text-sm text-muted">
          {typographie(
            "Nombre impair de joueurs : à chaque ronde, le moins bien placé qui n'a pas encore été exempté ne joue pas. Son exemption compte comme une victoire au classement du tournoi, jamais au classement Najarena.",
          )}
        </p>
      )}
    </section>
  );
}
