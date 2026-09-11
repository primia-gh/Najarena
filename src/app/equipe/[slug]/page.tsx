import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

interface EquipePageProps {
  params: Promise<{ slug: string }>;
}

async function chargerEquipe(slug: string) {
  const supabase = await createClient();

  const { data: equipe, error } = await supabase
    .from("teams")
    .select("id, slug, nom, tag, capitaine_id, cree_le, game_id")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    return { statut: "erreur" as const };
  }
  if (!equipe) {
    return { statut: "introuvable" as const };
  }

  const { data: jeu } = await supabase
    .from("games")
    .select("nom")
    .eq("id", equipe.game_id)
    .maybeSingle();

  const { data: capitaine } = await supabase
    .from("profiles")
    .select("pseudo, slug")
    .eq("id", equipe.capitaine_id)
    .maybeSingle();

  // Un membre invité mais pas encore accepté n'apparaît pas publiquement —
  // on n'affiche jamais une affiliation qu'un joueur n'a pas confirmée.
  const { data: membresData } = await supabase
    .from("team_members")
    .select("profile_id, role, profile:profiles(pseudo, slug)")
    .eq("team_id", equipe.id)
    .not("accepte_le", "is", null);

  const membres = (membresData ?? []).filter((m) => m.profile_id !== equipe.capitaine_id);

  return { statut: "ok" as const, equipe, jeu, capitaine, membres };
}

export async function generateMetadata({ params }: EquipePageProps): Promise<Metadata> {
  const { slug } = await params;
  const donnees = await chargerEquipe(slug);

  if (donnees.statut !== "ok") {
    return { title: "Équipe introuvable — Najarena" };
  }

  return {
    title: `${donnees.equipe.tag} ${donnees.equipe.nom} — Najarena`,
    description: `Page publique de l'équipe ${donnees.equipe.nom} sur Najarena.`,
  };
}

export default async function EquipePage({ params }: EquipePageProps) {
  const { slug } = await params;
  const donnees = await chargerEquipe(slug);

  if (donnees.statut === "introuvable") {
    notFound();
  }

  if (donnees.statut === "erreur") {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="rounded-[3px] border border-sceau/30 bg-sceau/10 p-6 text-sm text-sceau">
          Impossible de charger cette équipe pour l&apos;instant. Réessaie
          dans un instant.
        </p>
      </main>
    );
  }

  const { equipe, jeu, capitaine, membres } = donnees;

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link
        href="/"
        className="font-mono text-[0.66rem] tracking-[0.18em] text-ardoise uppercase hover:text-encre"
      >
        Najarena
      </Link>

      <div className="mt-6 flex items-center gap-3">
        <span className="rounded-[3px] bg-laiton px-2 py-1 font-mono text-sm font-bold text-papier">
          {equipe.tag}
        </span>
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-encre">
          {equipe.nom}
        </h1>
      </div>

      {jeu?.nom && (
        <div className="mt-1 font-mono text-[0.72rem] tracking-[0.14em] text-ardoise uppercase">
          {jeu.nom}
        </div>
      )}

      {capitaine && (
        <div className="mt-3 font-mono text-[0.78rem] text-ardoise">
          Capitaine :{" "}
          <Link href={`/joueur/${capitaine.slug}`} className="text-encre hover:underline">
            {capitaine.pseudo}
          </Link>
        </div>
      )}

      <section className="mt-10">
        <h2 className="font-display text-xl font-extrabold tracking-tight text-encre">
          Membres
        </h2>
        {membres.length === 0 ? (
          <p className="mt-3 rounded-[3px] border border-trait bg-carte p-4 text-sm text-ardoise">
            Aucun autre membre pour l&apos;instant.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {membres.map((m) => (
              <li
                key={m.profile_id}
                className="flex items-center justify-between rounded-[3px] border border-trait bg-carte px-4 py-2"
              >
                <span className="text-sm font-medium text-encre">
                  {m.profile ? (
                    <Link href={`/joueur/${m.profile.slug}`} className="hover:underline">
                      {m.profile.pseudo}
                    </Link>
                  ) : (
                    "Joueur inconnu"
                  )}
                </span>
                {m.role && (
                  <span className="font-mono text-[0.66rem] text-ardoise uppercase">
                    {m.role}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
