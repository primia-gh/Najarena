"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { recalculer, type LigneRecalculee } from "@/lib/recalcul";
import type { DonneesRecalculPubliques } from "@/lib/recalcul-donnees";
import { LABEL_MOTIF_REGISTRE } from "@/lib/registre";
import Panneau from "@/components/design/Panneau";
import LibelleSection from "@/components/design/LibelleSection";
import Tableau from "@/components/design/Tableau";
import Alerte from "@/components/design/Alerte";

// « Recalcule toi-même » (09/10/2026, idée en réserve n°4) : le calcul se
// fait ici, dans le navigateur du visiteur, à partir des données publiques
// de l'API (/api/public/v1/joueurs/<adresse>/recalcul). Rien n'est envoyé.

type Etat =
  | { phase: "chargement" }
  | { phase: "erreur" }
  | { phase: "pret"; donnees: DonneesRecalculPubliques; lignes: LigneRecalculee[] };

function Verdict({ ligne }: { ligne: LigneRecalculee }) {
  return (
    <>
      {ligne.etat === "ecart" ? (
        <span className="font-semibold text-danger uppercase">Écart</span>
      ) : ligne.etat === "concorde" ? (
        <span className="font-semibold text-accent uppercase">✓ Concorde</span>
      ) : (
        <span className="text-muted">Non recalculable</span>
      )}
      {!ligne.continue && <span className="block text-xs text-danger">Ne suit pas la ligne précédente</span>}
    </>
  );
}

const fmt = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function RecalculJoueur({ slug }: { slug: string }) {
  const [etat, setEtat] = useState<Etat>({ phase: "chargement" });

  useEffect(() => {
    let actif = true;
    fetch(`/api/public/v1/joueurs/${encodeURIComponent(slug)}/recalcul`)
      .then((r) => (r.ok ? (r.json() as Promise<DonneesRecalculPubliques>) : Promise.reject(new Error(String(r.status)))))
      .then((donnees) => {
        if (actif) setEtat({ phase: "pret", donnees, lignes: recalculer(donnees) });
      })
      .catch(() => {
        if (actif) setEtat({ phase: "erreur" });
      });
    return () => {
      actif = false;
    };
  }, [slug]);

  if (etat.phase === "chargement") {
    return (
      <p className="mt-8 text-sm text-muted" role="status">
        Calcul en cours dans ton navigateur…
      </p>
    );
  }
  if (etat.phase === "erreur") {
    return (
      <Alerte type="erreur" className="mt-8">
        Données indisponibles pour l&apos;instant. Réessaie dans quelques minutes.
      </Alerte>
    );
  }

  const { donnees, lignes } = etat;
  const concordes = lignes.filter((l) => l.etat === "concorde").length;
  const ecarts = lignes.filter((l) => l.etat === "ecart" || !l.continue).length;
  const nonVerifiables = lignes.filter((l) => l.etat === "non_verifiable").length;

  if (lignes.length === 0) {
    return (
      <p className="mt-8 text-sm text-muted">
        Aucune ligne au registre pour {donnees.joueur.pseudo} : rien à recalculer pour l&apos;instant.
      </p>
    );
  }

  return (
    <>
      <Panneau as="section" className="mt-8 flex max-w-3xl flex-col gap-3 px-6 py-6" aria-labelledby="titre-verdict-recalcul">
        <LibelleSection as="h2" id="titre-verdict-recalcul">
          Résultat
        </LibelleSection>
        {ecarts === 0 ? (
          <p className="text-sm text-text-2" role="status">
            <span className="font-semibold text-accent uppercase">Concorde</span> —{" "}
            <span className="tabular-nums">{concordes}</span> ligne{concordes > 1 ? "s" : ""} sur{" "}
            <span className="tabular-nums">{lignes.length}</span> recalculée{concordes > 1 ? "s" : ""} à l&apos;identique
            dans ton navigateur
            {nonVerifiables > 0 ? (
              <>
                {" "}
                (<span className="tabular-nums">{nonVerifiables}</span> sans formule à refaire, voir le tableau)
              </>
            ) : null}
            .
          </p>
        ) : (
          <p className="text-sm text-danger" role="alert">
            <span className="tabular-nums">{ecarts}</span> ligne{ecarts > 1 ? "s" : ""} ne concorde
            {ecarts > 1 ? "nt" : ""} pas avec le calcul refait ici. Signale-le-nous sur Discord : un écart n&apos;a pas
            d&apos;explication normale.
          </p>
        )}
      </Panneau>

      <section className="mt-10 max-w-contenu" aria-labelledby="titre-lignes-recalcul">
        <LibelleSection as="h2" id="titre-lignes-recalcul">
          Ligne par ligne
        </LibelleSection>
        <Tableau legende={`Recalcul du registre de ${donnees.joueur.pseudo}`} className="mt-3">
          <thead>
            <tr>
              <th scope="col">N°</th>
              <th scope="col">Motif</th>
              <th scope="col" className="hidden sm:table-cell">
                Détail
              </th>
              <th scope="col" className="text-right">
                Registre
              </th>
              <th scope="col" className="text-right">
                Recalculé
              </th>
              <th scope="col" className="hidden sm:table-cell">
                Verdict
              </th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => {
              const tournoi = l.tournamentId ? donnees.tournois[l.tournamentId] : undefined;
              return (
                <tr key={l.numero}>
                  <td className="tabular-nums">{l.numero}</td>
                  <td>
                    {LABEL_MOTIF_REGISTRE[l.motif] ?? l.motif}
                    {tournoi && (
                      <>
                        {" — "}
                        {tournoi.nature === "tournoi" ? (
                          <Link href={`/lol/tournois/${tournoi.slug}`} className="hover:text-accent">
                            {tournoi.nom}
                          </Link>
                        ) : (
                          tournoi.nom
                        )}
                      </>
                    )}
                    <span className="block text-xs text-muted sm:hidden">{l.detail}</span>
                  </td>
                  <td className="hidden text-text-2 sm:table-cell">{l.detail}</td>
                  <td className="text-right whitespace-nowrap tabular-nums">
                    {fmt(l.publie.rating)}
                    <span className="block text-xs text-muted">RD {fmt(l.publie.rd)}</span>
                  </td>
                  <td className="text-right whitespace-nowrap tabular-nums">
                    {l.calcule ? (
                      <>
                        {fmt(l.calcule.rating)}
                        <span className="block text-xs text-muted">RD {fmt(l.calcule.rd)}</span>
                      </>
                    ) : (
                      "—"
                    )}
                    <span className="mt-1 block text-xs whitespace-normal sm:hidden">
                      <Verdict ligne={l} />
                    </span>
                  </td>
                  <td className="hidden whitespace-nowrap sm:table-cell">
                    <Verdict ligne={l} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Tableau>
      </section>
    </>
  );
}
