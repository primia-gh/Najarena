import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { chimieEquipe, pourcentageVictoires, type Bilan } from "@/lib/chimie-equipe";
import SectionTitre from "@/components/ui/SectionTitre";
import Tableau from "@/components/design/Tableau";

// Chimie d'équipe (09/10/2026, idée en réserve n°16) : résultats des matchs
// 5v5 lus chez Riot (tournois et scrims) selon les joueurs alignés
// ensemble. Absent sous 3 matchs vérifiés : jamais de bloc vide.

function BilanCourt({ bilan, enLigne = false }: { bilan: Bilan; enLigne?: boolean }) {
  return (
    <span className="tabular-nums">
      {bilan.victoires} V – {bilan.matchs - bilan.victoires} D{" "}
      <span className={enLigne ? "text-muted" : "block text-muted sm:inline"}>({pourcentageVictoires(bilan)} %)</span>
    </span>
  );
}

export default async function ChimieEquipe({ teamId }: { teamId: string }) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("chimie_equipe", { p_team_id: teamId });
  const chimie = chimieEquipe((data ?? []).map((m) => ({ gagne: m.gagne, joueurs: m.joueurs })));
  if (!chimie) return null;

  const ids = chimie.joueurs.map((j) => j.id);
  const { data: profils } = await supabase.from("profiles").select("id, pseudo, slug").in("id", ids);
  const parId = new Map((profils ?? []).map((p) => [p.id, p]));
  const nom = (id: string) => {
    const p = parId.get(id);
    return p ? (
      <Link href={`/joueur/${p.slug}`} className="hover:text-accent">
        {p.pseudo}
      </Link>
    ) : (
      "Joueur"
    );
  };
  const liste = (joueurs: string[]) =>
    joueurs.map((id, i) => (
      <span key={id}>
        {i > 0 && <span className="text-muted"> · </span>}
        {nom(id)}
      </span>
    ));

  return (
    <section id="chimie" className="mt-10 scroll-mt-28">
      <SectionTitre>Chimie d&apos;équipe</SectionTitre>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Résultats de l&apos;équipe selon les joueurs alignés ensemble, sur ses{" "}
        <span className="tabular-nums">{chimie.total.matchs}</span> matchs 5v5 lus chez Riot (tournois et scrims) :{" "}
        <BilanCourt bilan={chimie.total} enLigne />. Sur peu de matchs, un pourcentage varie beaucoup : il se lit avec son nombre
        de matchs.
      </p>

      <div className="mt-6 grid gap-8 xl:grid-cols-2">
        {chimie.compositions.length > 0 && (
          <Tableau legende="Résultats par composition de cinq joueurs">
            <thead>
              <tr>
                <th scope="col">Composition</th>
                <th scope="col" className="hidden text-right sm:table-cell">
                  Matchs
                </th>
                <th scope="col" className="text-right">
                  Bilan
                </th>
              </tr>
            </thead>
            <tbody>
              {chimie.compositions.map((c) => (
                <tr key={c.joueurs.join("|")}>
                  <td className="text-sm">{liste(c.joueurs)}</td>
                  <td className="hidden text-right tabular-nums sm:table-cell">{c.matchs}</td>
                  <td className="text-right whitespace-nowrap">
                    <BilanCourt bilan={c} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Tableau>
        )}

        {chimie.duos.length > 0 && (
          <Tableau legende="Résultats par duo de joueurs alignés ensemble">
            <thead>
              <tr>
                <th scope="col">Duo</th>
                <th scope="col" className="hidden text-right sm:table-cell">
                  Matchs
                </th>
                <th scope="col" className="text-right">
                  Bilan
                </th>
              </tr>
            </thead>
            <tbody>
              {chimie.duos.map((d) => (
                <tr key={d.joueurs.join("|")}>
                  <td className="text-sm">{liste(d.joueurs)}</td>
                  <td className="hidden text-right tabular-nums sm:table-cell">{d.matchs}</td>
                  <td className="text-right whitespace-nowrap">
                    <BilanCourt bilan={d} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Tableau>
        )}
      </div>

      <Tableau legende="Bilan de l'équipe avec et sans chaque joueur" className="mt-8">
        <thead>
          <tr>
            <th scope="col">Joueur</th>
            <th scope="col" className="text-right">
              Avec lui
            </th>
            <th scope="col" className="text-right">
              Sans lui
            </th>
          </tr>
        </thead>
        <tbody>
          {chimie.joueurs.map((j) => (
            <tr key={j.id}>
              <td className="text-sm">{nom(j.id)}</td>
              <td className="text-right whitespace-nowrap">
                <BilanCourt bilan={j.avec} />
              </td>
              <td className="text-right whitespace-nowrap">
                {j.sans ? <BilanCourt bilan={j.sans} /> : <span className="text-muted">Toujours aligné</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </Tableau>
    </section>
  );
}
