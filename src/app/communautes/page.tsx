import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";
import BoutonLien from "@/components/design/BoutonLien";
import Panneau from "@/components/design/Panneau";

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
    .select("slug, nom, description, couleur, membres_communaute(count)")
    .order("cree_le", { ascending: true })
    .limit(200);

  const communautes = (data ?? [])
    .map((c) => ({ ...c, membres: c.membres_communaute[0]?.count ?? 0 }))
    .sort((a, b) => b.membres - a.membres);

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative flex flex-col gap-10 px-grille">
        <Apparition>
          <h1 className="font-titre text-section font-black tracking-[1px] uppercase">Communautés</h1>
          <p className="mt-3 max-w-2xl text-courant text-text-2">
            Un serveur Discord, une association, une école : sa page réunit ses tournois, le classement interne de ses
            membres — leur rating officiel, vérifié chez Riot — et ses membres.
          </p>
          <div className="mt-6">
            <BoutonLien href="/communaute/nouvelle" variante="contour">
              Créer une communauté
            </BoutonLien>
          </div>
        </Apparition>

        {communautes.length === 0 ? (
          <Panneau className="p-6">
            <p className="text-sm text-muted">
              Aucune communauté pour l&apos;instant. Crée la première pour ton serveur Discord ou ton association.
            </p>
          </Panneau>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {communautes.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/communaute/${c.slug}`}
                  className="panneau flex h-full flex-col gap-2 border-l-4 p-5 transition-colors hover:border-accent/40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                  style={{ borderLeftColor: c.couleur }}
                >
                  <span className="font-titre text-2xl font-extrabold uppercase">{c.nom}</span>
                  {c.description && <span className="line-clamp-2 text-sm text-muted">{c.description}</span>}
                  <span className="mt-auto text-mini text-muted uppercase tabular-nums">
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
