import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LABEL_ROLE, ROLES, type Role } from "@/lib/roles";
import { classeChamp } from "@/lib/design";
import { REMPLACANTS_MAX_PAR_EQUIPE } from "@/lib/bourse-remplacants";
import { proposerRemplacement, quitterRemplacants, remplacerAligne } from "@/lib/bourse-actions";
import BoutonEnvoi from "@/components/design/BoutonEnvoi";
import Alerte from "@/components/design/Alerte";

// Bourse aux remplaçants (09/10/2026, idée en réserve n°15) : tournoi 5v5.
// Un joueur vérifié se déclare disponible ; jusqu'au lancement du bracket,
// un capitaine remplace un de ses alignés (jamais lui-même) par l'un d'eux.
// Après le lancement, seuls les remplacements faits restent affichés.

interface Props {
  tournoi: { id: string; slug: string; region: string; statut: string };
  utilisateurId: string | null;
  message?: string;
  erreur?: string;
}

const lien = "text-text underline underline-offset-3 hover:text-accent";

export default async function BourseRemplacants({ tournoi, utilisateurId, message, erreur }: Props) {
  const supabase = await createClient();
  const ouverte = tournoi.statut === "ouvert" || tournoi.statut === "checkin";

  const [{ data: bourseData }, { data: remplacesData }, monAlignement, monCompte, monEquipe] = await Promise.all([
    supabase
      .from("remplacants_disponibles")
      .select("profile_id, role, profile:profiles(pseudo, slug)")
      .eq("tournament_id", tournoi.id)
      .order("inscrit_le", { ascending: true }),
    supabase
      .from("alignements")
      .select("profile_id, remplace_profile_id, registration:registrations(equipe_nom, equipe_tag)")
      .eq("tournament_id", tournoi.id)
      .not("remplace_profile_id", "is", null),
    utilisateurId
      ? supabase
          .from("alignements")
          .select("profile_id")
          .eq("tournament_id", tournoi.id)
          .eq("profile_id", utilisateurId)
          .maybeSingle()
          .then((r) => r.data)
      : Promise.resolve(null),
    utilisateurId
      ? supabase
          .from("game_accounts")
          .select("region")
          .eq("profile_id", utilisateurId)
          .eq("game_id", 1)
          .eq("est_principal", true)
          .not("verifie_le", "is", null)
          .maybeSingle()
          .then((r) => r.data)
      : Promise.resolve(null),
    utilisateurId
      ? supabase
          .from("registrations")
          .select("id, alignements(profile_id, remplace_profile_id)")
          .eq("tournament_id", tournoi.id)
          .eq("profile_id", utilisateurId)
          .not("team_id", "is", null)
          .in("statut", ["inscrit", "confirme"])
          .maybeSingle()
          .then((r) => r.data)
      : Promise.resolve(null),
  ]);

  const bourse = bourseData ?? [];
  const remplaces = remplacesData ?? [];
  if (!ouverte && remplaces.length === 0) return null;

  // Pseudos des joueurs remplacés et de l'alignement du capitaine.
  const ids = [
    ...new Set([
      ...remplaces.flatMap((r) => [r.profile_id, r.remplace_profile_id!]),
      ...(monEquipe?.alignements ?? []).map((a) => a.profile_id),
    ]),
  ];
  const { data: profils } = ids.length
    ? await supabase.from("profiles").select("id, pseudo, slug").in("id", ids)
    : { data: [] };
  const pseudo = new Map((profils ?? []).map((p) => [p.id, p]));
  const nom = (id: string) => pseudo.get(id)?.pseudo ?? "Joueur";

  const dansLaBourse = utilisateurId ? bourse.find((b) => b.profile_id === utilisateurId) : undefined;
  const remplacablesDeMonEquipe = (monEquipe?.alignements ?? []).filter((a) => a.profile_id !== utilisateurId);
  const remplacantsPris = (monEquipe?.alignements ?? []).filter((a) => a.remplace_profile_id).length;

  return (
    <div id="bourse" className="flex scroll-mt-28 flex-col gap-3 border-t border-line pt-6">
      <h3 className="text-mini text-muted uppercase tabular-nums">
        Bourse aux remplaçants{ouverte ? ` · ${bourse.length}` : ""}
      </h3>
      {ouverte && (
        <p className="max-w-2xl text-xs text-muted">
          Un joueur manque à l&apos;appel ? Jusqu&apos;au lancement du bracket, le capitaine le remplace par un joueur
          de cette liste, au compte Riot vérifié sur {tournoi.region} : il joue ce tournoi pour l&apos;équipe sans en
          devenir membre ({REMPLACANTS_MAX_PAR_EQUIPE} au plus par équipe). Le résultat se lit chez Riot comme
          d&apos;habitude, remplaçant compris.
        </p>
      )}

      {message && <Alerte type="succes">{message}</Alerte>}
      {erreur && <Alerte type="erreur">{erreur}</Alerte>}

      {ouverte &&
        (bourse.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {bourse.map((b) => (
              <li key={b.profile_id} className="panneau px-3 py-2 text-sm">
                {b.profile ? (
                  <Link href={`/joueur/${b.profile.slug}`} className="font-semibold hover:text-accent">
                    {b.profile.pseudo}
                  </Link>
                ) : (
                  "Joueur"
                )}
                {b.role && ROLES.includes(b.role as Role) && (
                  <span className="text-muted"> · {LABEL_ROLE[b.role as Role]}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Personne dans la bourse pour l&apos;instant.</p>
        ))}

      {remplaces.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm text-text-2">
          {remplaces.map((r) => (
            <li key={r.profile_id}>
              <span className="font-semibold text-text">{nom(r.profile_id)}</span> remplace {nom(r.remplace_profile_id!)}
              {r.registration?.equipe_nom ? ` (${r.registration.equipe_nom})` : ""}
            </li>
          ))}
        </ul>
      )}

      {/* Capitaine d'une équipe inscrite : remplacer un aligné. */}
      {ouverte && monEquipe && remplacablesDeMonEquipe.length > 0 && bourse.length > 0 && (
        <form action={remplacerAligne} className="flex max-w-xl flex-col gap-3 panneau p-4">
          <input type="hidden" name="tournament_id" value={tournoi.id} />
          <input type="hidden" name="slug" value={tournoi.slug} />
          <p className="text-sm font-semibold text-text">Remplacer un joueur de ton équipe</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-mini text-muted uppercase">Joueur absent</span>
              <select name="sortant" required className={classeChamp()} defaultValue="">
                <option value="" disabled>
                  Choisir
                </option>
                {remplacablesDeMonEquipe.map((a) => (
                  <option key={a.profile_id} value={a.profile_id}>
                    {nom(a.profile_id)}
                    {a.remplace_profile_id ? " (remplaçant)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-mini text-muted uppercase">Remplaçant</span>
              <select name="entrant" required className={classeChamp()} defaultValue="">
                <option value="" disabled>
                  Choisir
                </option>
                {bourse.map((b) => (
                  <option key={b.profile_id} value={b.profile_id}>
                    {b.profile?.pseudo ?? "Joueur"}
                    {b.role && ROLES.includes(b.role as Role) ? ` · ${LABEL_ROLE[b.role as Role]}` : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-xs text-muted">
            {remplacantsPris} remplaçant{remplacantsPris > 1 ? "s" : ""} sur {REMPLACANTS_MAX_PAR_EQUIPE} dans ton
            alignement. Les deux joueurs sont prévenus.
          </p>
          <BoutonEnvoi variante="contour" libelleEnCours="Remplacement…" className="self-start">
            Remplacer
          </BoutonEnvoi>
        </form>
      )}

      {/* Joueur sans place dans ce tournoi : se proposer, ou se retirer. */}
      {ouverte &&
        utilisateurId &&
        !monAlignement &&
        (dansLaBourse ? (
          <form action={quitterRemplacants} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="tournament_id" value={tournoi.id} />
            <input type="hidden" name="slug" value={tournoi.slug} />
            <span className="text-sm text-text-2">Tu es dans la bourse : un capitaine peut te prendre.</span>
            <BoutonEnvoi variante="contour" libelleEnCours="Retrait…">
              Me retirer
            </BoutonEnvoi>
          </form>
        ) : monCompte?.region === tournoi.region ? (
          <form action={proposerRemplacement} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="tournament_id" value={tournoi.id} />
            <input type="hidden" name="slug" value={tournoi.slug} />
            <label className="flex flex-col gap-1">
              <span className="text-mini text-muted uppercase">Ton rôle</span>
              <select name="role" defaultValue="" className={classeChamp()}>
                <option value="">Peu importe</option>
                {ROLES.map((r: Role) => (
                  <option key={r} value={r}>
                    {LABEL_ROLE[r]}
                  </option>
                ))}
              </select>
            </label>
            <BoutonEnvoi variante="contour" libelleEnCours="Envoi…">
              Je peux remplacer
            </BoutonEnvoi>
          </form>
        ) : (
          <p className="text-xs text-muted">
            Pour dépanner une équipe, il faut un compte Riot vérifié sur {tournoi.region}.{" "}
            <Link href="/lier-riot" className={lien}>
              Lier mon compte Riot
            </Link>
          </p>
        ))}
    </div>
  );
}
