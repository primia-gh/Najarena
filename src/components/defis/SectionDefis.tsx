import Link from "next/link";
import SectionTitre from "@/components/ui/SectionTitre";
import BoutonCopier from "@/components/design/BoutonCopier";
import BoutonEnvoi from "@/components/design/BoutonEnvoi";
import { classeCarte } from "@/lib/ui";
import { annulerDefi, creerInvitationDefi, repondreDefi } from "@/lib/defi-actions";
import { CONDITIONS_VICTOIRE } from "@/lib/conditions-1v1";
import { DUREE_DEFI_HEURES, DUREE_INVITATION_JOURS } from "@/lib/defis";
import type { DefiAffiche, MesDefis } from "@/lib/defis-serveur";
import { formaterDate, LABEL_STATUT, type StatutPublic } from "@/lib/tournois";
import { URL_SITE } from "@/lib/notifications";

// Défis du tableau de bord (28/09/2026, audit N16 et N18) : défis reçus à
// accepter ou refuser, défis envoyés, liens « Invite ton rival », duels.

const LIEN = "inline-flex min-h-11 items-center font-texte text-mini underline underline-offset-3";

function regle(condition: string): string {
  return condition === "classique" ? "1v1 classique" : "jusqu'au Nexus";
}

function Retirer({ defi }: { defi: DefiAffiche }) {
  return (
    <form action={annulerDefi}>
      <input type="hidden" name="defi_id" value={defi.id} />
      <button type="submit" className={`${LIEN} text-muted hover:text-text`}>
        Retirer
      </button>
    </form>
  );
}

export default function SectionDefis({ defis }: { defis: MesDefis }) {
  const { recus, envoyes, invitations, duels } = defis;

  return (
    <section id="defis" className="mt-10 scroll-mt-28">
      <SectionTitre>Défis</SectionTitre>
      <p className="mt-1 text-sm text-muted">
        Défie un joueur depuis son profil (bouton « Défier »), ou envoie un lien à un ami pas encore inscrit. Une
        partie, résultat lu chez Riot : un défi classé par jour entre deux joueurs, les suivants en amical. Pas
        d&apos;adversaire en tête ?{" "}
        <Link href="/lol/arene" className="text-accent underline underline-offset-3">
          L&apos;arène t&apos;en trouve un de ton niveau
        </Link>
        .
      </p>

      {recus.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {recus.map((d) => (
            <li key={d.id} className={"flex flex-wrap items-center justify-between gap-3 " + classeCarte("atteste")}>
              <span className="text-sm text-text">
                {d.autre ? (
                  <Link href={`/joueur/${d.autre.slug}`} className="font-semibold hover:text-accent">
                    {d.autre.pseudo}
                  </Link>
                ) : (
                  "Un joueur"
                )}{" "}
                te défie <span className="text-muted">· {regle(d.condition)} · jusqu&apos;au {formaterDate(d.expireLe)}</span>
              </span>
              <div className="flex items-center gap-4">
                <form action={repondreDefi}>
                  <input type="hidden" name="defi_id" value={d.id} />
                  <input type="hidden" name="reponse" value="accepter" />
                  <BoutonEnvoi libelleEnCours="Ouverture…">Relever le défi</BoutonEnvoi>
                </form>
                <form action={repondreDefi}>
                  <input type="hidden" name="defi_id" value={d.id} />
                  <input type="hidden" name="reponse" value="refuser" />
                  <button type="submit" className={`${LIEN} text-danger`}>
                    Refuser
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      {envoyes.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {envoyes.map((d) => (
            <li key={d.id} className={"flex flex-wrap items-center justify-between gap-3 " + classeCarte("none")}>
              <span className="text-sm text-text">
                Défi envoyé à {d.autre?.pseudo ?? "un joueur"}{" "}
                <span className="text-muted">· en attente de réponse jusqu&apos;au {formaterDate(d.expireLe)}</span>
              </span>
              <Retirer defi={d} />
            </li>
          ))}
        </ul>
      )}

      {invitations.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {invitations.map((d) => {
            const lien = `${URL_SITE}/defi/${d.code}`;
            return (
              <li key={d.id} className={"flex flex-col gap-2 " + classeCarte("laiton")}>
                <span className="text-sm text-text">
                  Lien de défi <span className="text-muted">· {regle(d.condition)} · valable jusqu&apos;au {formaterDate(d.expireLe)}</span>
                </span>
                <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="font-texte text-sm text-text-2 tabular-nums select-all [overflow-wrap:anywhere]">{lien}</span>
                  <BoutonCopier texte={lien} libelle="Copier le lien" className={`${LIEN} text-accent`} />
                  <Retirer defi={d} />
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {duels.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {duels.map((d) => (
            <li key={d.id}>
              <Link
                href={`/lol/tournois/${d.tournoi!.slug}${d.tournoi!.statut === "en_cours" ? "#ton-match" : ""}`}
                className={"flex flex-wrap items-center justify-between gap-3 " + classeCarte("none", true)}
              >
                <span className="text-sm text-text">
                  Duel contre {d.autre?.pseudo ?? "un joueur"} <span className="text-muted">· {regle(d.condition)}</span>
                </span>
                <span className="text-mini text-muted uppercase">
                  {LABEL_STATUT[d.tournoi!.statut as StatutPublic] ?? d.tournoi!.statut}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <form action={creerInvitationDefi} className={"mt-3 flex flex-wrap items-end gap-3 " + classeCarte("none")}>
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-texte text-mini font-medium text-muted uppercase">
            Inviter un ami à me défier (lien valable {DUREE_INVITATION_JOURS} jours)
          </span>
          <select
            name="condition_victoire"
            defaultValue="nexus"
            className="min-h-11 rounded-bouton border border-line-strong bg-bg px-3 py-2.5 text-sm text-text outline-none focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {CONDITIONS_VICTOIRE.map((c) => (
              <option key={c.valeur} value={c.valeur}>
                {c.libelle}
              </option>
            ))}
          </select>
        </label>
        <BoutonEnvoi variante="contour" libelleEnCours="Création…">
          Créer un lien de défi
        </BoutonEnvoi>
      </form>
      <p className="mt-2 text-xs text-muted">
        Un défi reçu expire au bout de {DUREE_DEFI_HEURES} h sans réponse.
      </p>
    </section>
  );
}
