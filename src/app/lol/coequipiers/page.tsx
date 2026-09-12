import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { publierRechercheCoequipier, retirerRechercheCoequipier } from "@/lib/coequipier-actions";
import { inviterMembre } from "@/lib/equipe-actions";
import { TAILLE_MAX_EQUIPE } from "@/lib/equipe";
import { classeCarte, classeBoutonPrimaire } from "@/lib/ui";
import SectionTitre from "@/components/ui/SectionTitre";

export const metadata: Metadata = {
  title: "Trouver un coéquipier — Najarena",
  description:
    "Recherche de coéquipiers pour jouer en 5v5 sur Najarena — publie une annonce ou invite un joueur disponible dans ton équipe.",
};

interface CoequipiersPageProps {
  searchParams: Promise<{ erreur?: string; message?: string }>;
}

async function chargerCoequipiers() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  const { data: annoncesData } = await supabase
    .from("recherches_coequipiers")
    .select("profile_id, message, cree_le, profile:profiles(pseudo, slug)")
    .order("cree_le", { ascending: false });

  const annonces = annoncesData ?? [];
  const monAnnonce = userData.user
    ? annonces.find((a) => a.profile_id === userData.user!.id)
    : undefined;

  let mesEquipesAvecPlace: Array<{ id: string; slug: string; nom: string; tag: string }> = [];
  if (userData.user) {
    const { data: equipesData } = await supabase
      .from("teams")
      .select("id, slug, nom, tag, team_members(accepte_le)")
      .eq("capitaine_id", userData.user.id);

    mesEquipesAvecPlace = (equipesData ?? [])
      .filter((e) => e.team_members.filter((m) => m.accepte_le !== null).length < TAILLE_MAX_EQUIPE)
      .map((e) => ({ id: e.id, slug: e.slug, nom: e.nom, tag: e.tag }));
  }

  return { annonces, monAnnonce, mesEquipesAvecPlace, utilisateur: userData.user };
}

export default async function CoequipiersPage({ searchParams }: CoequipiersPageProps) {
  const { erreur, message } = await searchParams;
  const { annonces, monAnnonce, mesEquipesAvecPlace, utilisateur } = await chargerCoequipiers();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link
        href="/lol"
        className="font-mono text-[0.66rem] tracking-[0.18em] text-ardoise uppercase hover:text-encre"
      >
        ← League of Legends
      </Link>

      <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight text-encre">
        Trouver un coéquipier
      </h1>
      <p className="mt-2 text-sm text-ardoise">
        Pour jouer en 5v5.{" "}
        <Link href="/equipe/nouvelle" className="text-encre underline underline-offset-3">
          Créer une équipe
        </Link>
        .
      </p>

      {erreur && (
        <p className={"mt-6 " + classeCarte("sceau") + " text-sm text-sceau"}>{erreur}</p>
      )}
      {message && (
        <p className={"mt-6 " + classeCarte("atteste") + " text-sm text-atteste"}>{message}</p>
      )}

      {utilisateur ? (
        <form action={publierRechercheCoequipier} className={"mt-6 flex flex-col gap-2 " + classeCarte("none")}>
          <span className="font-mono text-[0.62rem] tracking-[0.14em] text-ardoise uppercase">
            {monAnnonce ? "Modifier mon annonce" : "Se déclarer disponible"}
          </span>
          <textarea
            name="message"
            rows={2}
            maxLength={200}
            defaultValue={monAnnonce?.message ?? ""}
            placeholder="Ex. « Support, dispo le soir, cherche une équipe régulière »"
            className="resize-none rounded-[3px] border border-trait bg-papier px-3 py-2 text-sm text-encre outline-none focus:border-encre focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sceau"
          />
          <div className="flex items-center gap-3">
            <button type="submit" className={classeBoutonPrimaire()}>
              {monAnnonce ? "Mettre à jour" : "Publier mon annonce"}
            </button>
            {monAnnonce && (
              <button
                type="submit"
                formAction={retirerRechercheCoequipier}
                className="font-mono text-[0.66rem] text-sceau underline underline-offset-3"
              >
                Retirer mon annonce
              </button>
            )}
          </div>
        </form>
      ) : (
        <p className={"mt-6 " + classeCarte("none") + " text-sm text-ardoise"}>
          <Link href="/connexion" className="text-encre underline underline-offset-3">
            Connecte-toi
          </Link>{" "}
          pour publier une annonce ou inviter un joueur dans ton équipe.
        </p>
      )}

      <section className="mt-10">
        <SectionTitre>Joueurs disponibles</SectionTitre>
        {annonces.length === 0 ? (
          <p className={"mt-3 " + classeCarte("none") + " text-sm text-ardoise"}>
            Personne ne s&apos;est encore déclaré disponible.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {annonces.map((a) => (
              <li key={a.profile_id} className={classeCarte("none")}>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-semibold text-encre">
                    {a.profile ? (
                      <Link href={`/joueur/${a.profile.slug}`} className="hover:underline">
                        {a.profile.pseudo}
                      </Link>
                    ) : (
                      "Joueur inconnu"
                    )}
                  </span>
                </div>
                {a.message && <p className="mt-1 text-sm text-ardoise">{a.message}</p>}

                {utilisateur?.id !== a.profile_id && mesEquipesAvecPlace.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-trait pt-3">
                    {mesEquipesAvecPlace.map((e) => (
                      <form action={inviterMembre} key={e.id}>
                        <input type="hidden" name="team_id" value={e.id} />
                        <input type="hidden" name="slug" value={e.slug} />
                        <input type="hidden" name="pseudo" value={a.profile?.pseudo ?? ""} />
                        <button
                          type="submit"
                          aria-label={`Inviter ${a.profile?.pseudo ?? "ce joueur"} dans ${e.nom}`}
                          className="rounded-[3px] border border-trait px-3 py-1.5 font-mono text-[0.64rem] text-encre transition hover:border-encre"
                        >
                          Inviter dans {e.tag} {e.nom}
                        </button>
                      </form>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
