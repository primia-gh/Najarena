import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { arrondir } from "@/lib/classement";
import { classementEcoles, ETUDIANTS_CLASSEMENT_ECOLES } from "@/lib/ecoles";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";
import BoutonLien from "@/components/design/BoutonLien";
import LibelleSection from "@/components/design/LibelleSection";
import Panneau from "@/components/design/Panneau";
import Tableau from "@/components/design/Tableau";

// Ligue des écoles (04/10/2026, analyse concurrentielle de l'audit :
// Battlefy). Les écoles sont des communautés dont les membres prouvent
// leur adresse d'établissement ; elles sont classées par la moyenne des 5
// meilleurs ratings officiels de leurs membres vérifiés (classement_ecoles,
// docs/schema.sql) — jamais un rating à part.

export const metadata: Metadata = {
  title: "Ligue des écoles — League of Legends — Najarena",
  description:
    "Écoles et universités classées par le niveau vérifié de leurs joueurs League of Legends : moyenne des 5 meilleurs ratings officiels de leurs membres à l'adresse d'établissement vérifiée.",
  alternates: { canonical: "/lol/ecoles" },
};

export default async function EcolesPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("classement_ecoles");
  const { classees, enConstitution } = classementEcoles(data ?? []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative flex flex-col gap-12 px-grille">
        <Apparition>
          <Link
            href="/lol"
            className="inline-flex min-h-11 items-center font-texte text-xs tracking-[3px] text-muted uppercase hover:text-text"
          >
            ← League of Legends
          </Link>
          <h1 className="mt-6 font-titre text-section font-black tracking-[1px] uppercase">Ligue des écoles</h1>
          <p className="mt-3 max-w-2xl text-courant text-text-2">
            Les écoles et universités, classées par la moyenne des {ETUDIANTS_CLASSEMENT_ECOLES} meilleurs ratings
            officiels de leurs membres vérifiés — des joueurs qui ont prouvé leur adresse de l&apos;établissement.
            Aucun point à part : chacun gagne son rating dans les tournois classés, résultats lus chez Riot.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
            <BoutonLien href="/communaute/nouvelle" variante="contour">
              Inscrire mon école
            </BoutonLien>
            <Link href="/communautes" className="text-sm text-muted underline underline-offset-3 hover:text-text">
              Toutes les communautés
            </Link>
          </div>
          <p className="mt-3 max-w-2xl text-xs text-muted">
            Une association étudiante crée la communauté de son école (offre Organisateur), puis indique le domaine
            des adresses de l&apos;établissement ; ses membres vérifient la leur depuis la page de l&apos;école.
          </p>
        </Apparition>

        <section className="flex flex-col gap-4">
          <LibelleSection as="h2">Classement — saison en cours</LibelleSection>
          {classees.length === 0 ? (
            <Panneau className="p-6">
              <p className="text-sm text-muted">
                Aucune école classée pour l&apos;instant : il faut {ETUDIANTS_CLASSEMENT_ECOLES} membres vérifiés
                entrés au classement (une dizaine de matchs vérifiés chacun) pour y figurer.
              </p>
            </Panneau>
          ) : (
            <Tableau legende="Classement des écoles, saison en cours">
              <thead>
                <tr>
                  <th scope="col">Rang</th>
                  <th scope="col">École</th>
                  <th scope="col">Moyenne des {ETUDIANTS_CLASSEMENT_ECOLES} meilleurs</th>
                  <th scope="col">Classés</th>
                  <th scope="col">Vérifiés</th>
                </tr>
              </thead>
              <tbody>
                {classees.map((e) => (
                  <tr key={e.slug}>
                    <td className="tabular-nums">#{e.rang}</td>
                    <td>
                      <Link
                        href={`/communaute/${e.slug}`}
                        className="border-l-4 pl-2 hover:text-accent"
                        style={{ borderColor: e.couleur }}
                      >
                        {e.nom}
                      </Link>
                    </td>
                    <td className="tabular-nums">{arrondir(e.moyenne ?? 0)}</td>
                    <td className="tabular-nums">{e.classes}</td>
                    <td className="tabular-nums">{e.verifies}</td>
                  </tr>
                ))}
              </tbody>
            </Tableau>
          )}
        </section>

        {enConstitution.length > 0 && (
          <section className="flex flex-col gap-4">
            <LibelleSection as="h2">En constitution</LibelleSection>
            <p className="max-w-2xl text-sm text-muted">
              Ces écoles entreront au classement avec {ETUDIANTS_CLASSEMENT_ECOLES} membres vérifiés et classés.
            </p>
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {enConstitution.map((e) => (
                <li key={e.slug}>
                  <Link
                    href={`/communaute/${e.slug}`}
                    className="panneau flex h-full flex-col gap-2 border-l-4 p-5 transition-colors hover:border-accent/40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                    style={{ borderLeftColor: e.couleur }}
                  >
                    <span className="font-titre text-2xl font-extrabold uppercase">{e.nom}</span>
                    <span className="mt-auto text-mini text-muted uppercase tabular-nums">
                      {e.verifies} vérifié{e.verifies > 1 ? "s" : ""} · {e.classes}/{ETUDIANTS_CLASSEMENT_ECOLES}{" "}
                      classé{e.classes > 1 ? "s" : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
