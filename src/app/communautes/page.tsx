import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import FondEcailles from "@/components/design/FondEcailles";
import EtatVide from "@/components/design/EtatVide";
import EnTetePage from "@/components/design/EnTetePage";
import BoutonLien from "@/components/design/BoutonLien";

// Liste des espaces communauté (03/10/2026, audit N30), les plus grands
// d'abord.

export const metadata: Metadata = {
  title: "Communautés — Najarena",
  description:
    "Serveurs Discord, associations, écoles : leurs tournois League of Legends, leur classement interne vérifié et leurs membres.",
  alternates: { canonical: "/communautes" },
};

export default async function CommunautesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("communautes")
    .select("slug, nom, description, couleur, type, ecole_validee_le, membres_communaute(count)")
    .order("cree_le", { ascending: true })
    .limit(200);

  const communautes = (data ?? [])
    .map((c) => ({ ...c, membres: c.membres_communaute[0]?.count ?? 0 }))
    .sort((a, b) => b.membres - a.membres);

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative flex flex-col gap-10 px-grille">
        <EnTetePage
          surtitre="Discord · associations · écoles"
          titre="Communautés"
          intro="Un serveur Discord, une association, une école : sa page réunit ses tournois, le classement interne de ses membres — leur rating Najarena, calculé à partir de résultats lus chez Riot — et ses membres."
          actions={
            <>
              <BoutonLien href="/communaute/nouvelle" variante="contour">
                Créer une communauté
              </BoutonLien>
              <Link
                href="/lol/ecoles"
                className="inline-flex min-h-11 items-center text-sm text-muted underline underline-offset-3 hover:text-text"
              >
                Ligue des écoles
              </Link>
            </>
          }
        />

        {communautes.length === 0 ? (
          <EtatVide
            titre="Aucune communauté pour l'instant."
            actions={
              <BoutonLien href="/communaute/nouvelle" variante="secondaire">
                Créer une communauté
              </BoutonLien>
            }
          >
            Crée la première pour ton serveur Discord, ton association ou ton école.
          </EtatVide>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {communautes.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/communaute/${c.slug}`}
                  className="panneau flex h-full flex-col gap-2 border-l-4 p-5 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-accent/40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                  style={{ borderLeftColor: c.couleur }}
                >
                  <span className="font-titre text-2xl font-extrabold uppercase">{c.nom}</span>
                  {c.description && <span className="line-clamp-2 text-sm text-muted">{c.description}</span>}
                  <span className="mt-auto text-mini text-muted uppercase tabular-nums">
                    {c.type === "ecole" ? (c.ecole_validee_le ? "École · " : "École non validée · ") : ""}
                    {c.membres} membre{c.membres > 1 ? "s" : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
