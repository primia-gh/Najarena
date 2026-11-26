import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { arrondir } from "@/lib/classement";
import { formaterDate } from "@/lib/tournois";
import { empreinteCourte, LABEL_MOTIF_REGISTRE } from "@/lib/registre";
import { URL_SITE } from "@/lib/notifications";
import { adresseFichier, depotAncrage } from "@/lib/ancrage-github";
import { classeCarte } from "@/lib/ui";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";
import EnTetePage from "@/components/design/EnTetePage";
import Panneau from "@/components/design/Panneau";
import LibelleSection from "@/components/design/LibelleSection";
import Tableau from "@/components/design/Tableau";

// Registre des points scellé (28/09/2026, audit N8) : la preuve que le
// journal des points « ne se modifie jamais » (CLAUDE.md §4). Page outil :
// dense, sans animation superflue.

export const metadata: Metadata = {
  title: "Registre des points — Najarena",
  description:
    "Chaque variation de points Najarena est scellée dans un registre public et vérifiable : toute modification après coup, même par l'équipe Najarena, serait détectée.",
  alternates: { canonical: "/registre" },
};

const DERNIERES_LIGNES = 30;
/** Au-delà, la vérification gardée est trop ancienne pour annoncer « Intacte » (la tâche passe toutes les 5 minutes). */
const VERIFICATION_PERIMEE_MINUTES = 15;

// Hors du composant (règle de pureté du rendu).
function maintenantMs(): number {
  return Date.now();
}

export default async function RegistrePage() {
  const supabase = await createClient();

  const [{ data: verification, error: erreurVerification }, { data: lignes }, { data: publication }] = await Promise.all([
    // Résultat gardé par la base (vérifié toutes les 5 minutes par la tâche
    // des tournois automatiques, toute la chaîne une fois par jour) : la
    // page ne recalcule plus la chaîne à chaque visite (contrôle M7).
    supabase
      .from("verification_registre")
      .select("lignes, derniere_empreinte, premiere_rupture, verifie_le, verification_complete_le")
      .eq("id", 1)
      .maybeSingle(),
    supabase
      .from("rating_events")
      .select(
        "numero, cree_le, motif, rating_avant, rating_apres, empreinte, joueur:profiles!rating_events_profile_id_fkey(pseudo, slug)",
      )
      .order("numero", { ascending: false })
      .limit(DERNIERES_LIGNES),
    supabase
      .from("empreintes_publiees")
      .select("jour, numero, empreinte, ancree_github_le")
      .order("jour", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // L'empreinte publiée sur Discord doit être celle de la ligne du même numéro.
  const { data: lignePubliee } = publication
    ? await supabase.from("rating_events").select("empreinte").eq("numero", publication.numero).maybeSingle()
    : { data: null };
  const publicationConcorde = publication && lignePubliee ? lignePubliee.empreinte === publication.empreinte : null;

  const intacte = verification?.verifie_le ? verification.premiere_rupture === null : null;
  // Une vérification trop ancienne n'est pas annoncée « Intacte » : la tâche
  // automatique a pu s'arrêter (revue design du 22/11/2026).
  const perimee =
    verification?.verifie_le != null &&
    maintenantMs() - new Date(verification.verifie_le).getTime() > VERIFICATION_PERIMEE_MINUTES * 60_000;
  const adresseExport = `${URL_SITE}/registre/export`;
  // Second témoin (idée en réserve n°3) : le dépôt GitHub public, s'il est configuré.
  const depotGithub = depotAncrage();

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative px-grille">
        <EnTetePage
          surtitre="Preuve"
          titre="Registre des points"
          intro={
            <>
              Chaque variation de points est inscrite dans ce registre, qui ne se modifie jamais. Chaque ligne porte une
              empreinte calculée à partir de son contenu <em>et</em> de l&apos;empreinte de la ligne précédente, comme les
              maillons d&apos;une chaîne : retoucher une seule ligne passée, même depuis l&apos;intérieur de Najarena,
              changerait son empreinte et toutes celles qui suivent. L&apos;empreinte du jour est publiée chaque soir sur
              notre Discord ; n&apos;importe qui peut refaire le calcul.
            </>
          }
        />

        <Apparition delai={0.08}>
          <div className="mt-8 grid max-w-contenu gap-4 lg:grid-cols-2">
            <Panneau as="section" className="flex flex-col gap-3 px-6 py-6">
              <LibelleSection as="h2">État de la chaîne</LibelleSection>
              {erreurVerification || intacte === null ? (
                <p className="text-sm text-muted">Vérification indisponible pour l&apos;instant.</p>
              ) : intacte && perimee ? (
                <p className="text-sm text-muted">
                  <span className="font-semibold uppercase">En attente</span> — dernière vérification le{" "}
                  <span className="tabular-nums">{formaterDate(verification!.verifie_le!)}</span> (heure de Paris)&nbsp;: la
                  vérification automatique est en retard.
                </p>
              ) : intacte ? (
                <>
                  <p className="text-sm text-text-2">
                    <span className="font-semibold text-accent uppercase">Intacte</span> —{" "}
                    <span className="tabular-nums">{verification?.lignes ?? 0}</span> ligne
                    {(verification?.lignes ?? 0) > 1 ? "s" : ""} vérifiée{(verification?.lignes ?? 0) > 1 ? "s" : ""} le{" "}
                    <span className="tabular-nums">{formaterDate(verification!.verifie_le!)}</span> (heure de Paris).
                  </p>
                  <p className="text-sm text-muted">
                    La base vérifie les nouvelles lignes toutes les 5&nbsp;minutes et relit toute la chaîne chaque jour
                    {verification?.verification_complete_le ? (
                      <>
                        {" "}
                        (dernière relecture complète le{" "}
                        <span className="tabular-nums">{formaterDate(verification.verification_complete_le)}</span>)
                      </>
                    ) : null}
                    .
                  </p>
                </>
              ) : (
                <p role="alert" className="text-sm text-danger">
                  Rupture détectée à la ligne <span className="tabular-nums">{verification?.premiere_rupture}</span>.
                </p>
              )}
              {verification?.derniere_empreinte && (
                <div className="flex flex-col gap-1">
                  <span className="text-mini text-muted uppercase">Dernière empreinte</span>
                  <code className="text-xs break-all text-text tabular-nums select-all">{verification.derniere_empreinte}</code>
                </div>
              )}
            </Panneau>

            <Panneau as="section" className="flex flex-col gap-3 px-6 py-6">
              <LibelleSection as="h2">Dernière publication</LibelleSection>
              {publication ? (
                <>
                  <p className="text-sm text-text-2">
                    Publiée sur Discord le <span className="tabular-nums">{publication.jour.split("-").reverse().join("/")}</span>{" "}
                    (ligne <span className="tabular-nums">{publication.numero}</span>) —{" "}
                    {publicationConcorde ? (
                      <span className="font-semibold text-accent uppercase">concorde</span>
                    ) : (
                      <span className="font-semibold text-danger uppercase">ne concorde pas</span>
                    )}{" "}
                    avec le registre.
                  </p>
                  <code className="text-xs break-all text-text tabular-nums select-all">{publication.empreinte}</code>
                  {depotGithub && publication.ancree_github_le && (
                    <p className="text-sm text-text-2">
                      Aussi déposée sur GitHub, qui date chaque dépôt :{" "}
                      <a
                        href={adresseFichier(depotGithub, publication.jour)}
                        className="text-text underline underline-offset-3 hover:text-accent"
                        rel="noopener"
                      >
                        fichier du {publication.jour.split("-").reverse().join("/")}
                      </a>
                      .
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted">
                  Aucune empreinte publiée pour l&apos;instant : la première partira le soir du premier tournoi clôturé.
                </p>
              )}
            </Panneau>
          </div>
        </Apparition>

        <Apparition delai={0.12}>
          <section className="mt-10 max-w-contenu" aria-labelledby="titre-dernieres-lignes">
            <LibelleSection as="h2" id="titre-dernieres-lignes">
              Dernières lignes
            </LibelleSection>
            {!lignes || lignes.length === 0 ? (
              <p className={"mt-3 " + classeCarte("none") + " text-sm text-muted"}>
                Le registre est vide : aucun tournoi n&apos;a encore été clôturé.
              </p>
            ) : (
              <Tableau legende="Dernières lignes du registre des points" className="mt-3">
                <thead>
                  <tr>
                    <th scope="col">N°</th>
                    <th scope="col">Date</th>
                    <th scope="col">Joueur</th>
                    <th scope="col">Motif</th>
                    <th scope="col">Points</th>
                    <th scope="col">Empreinte</th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l) => (
                    <tr key={l.numero}>
                      <td className="tabular-nums">{l.numero}</td>
                      <td className="tabular-nums whitespace-nowrap">{formaterDate(l.cree_le)}</td>
                      <td>
                        {l.joueur ? (
                          <Link href={`/joueur/${l.joueur.slug}`} className="hover:text-accent">
                            {l.joueur.pseudo}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{LABEL_MOTIF_REGISTRE[l.motif] ?? l.motif}</td>
                      <td className="tabular-nums whitespace-nowrap">
                        {arrondir(l.rating_avant)} → {arrondir(l.rating_apres)}
                      </td>
                      <td>
                        <code className="text-xs tabular-nums" title={l.empreinte}>
                          {empreinteCourte(l.empreinte)}
                        </code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Tableau>
            )}
          </section>
        </Apparition>

        <Apparition delai={0.16}>
          <section className="mt-10 max-w-3xl" aria-labelledby="titre-verifier">
            <LibelleSection as="h2" id="titre-verifier">
              Vérifier soi-même
            </LibelleSection>
            <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-sm leading-relaxed text-text-2 marker:text-accent">
              <li>
                Télécharger{" "}
                <a href="/registre/export" className="text-text underline underline-offset-3">
                  le registre complet
                </a>{" "}
                et{" "}
                <a href="/registre/verifier-registre.mjs" className="text-text underline underline-offset-3">
                  le programme de vérification
                </a>{" "}
                (une page de code lisible, sans dépendance).
              </li>
              <li>
                Avec Node.js : <code className="text-xs break-all text-text">node verifier-registre.mjs {adresseExport}</code>
              </li>
              <li>
                Comparer la dernière empreinte obtenue avec celle publiée sur notre Discord le même soir
                {depotGithub ? (
                  <>
                    {" "}
                    ou déposée dans le dépôt public{" "}
                    <a
                      href={`https://github.com/${depotGithub}`}
                      className="text-text underline underline-offset-3 hover:text-accent"
                      rel="noopener"
                    >
                      github.com/{depotGithub}
                    </a>
                  </>
                ) : null}
                .
              </li>
            </ol>
            <p className="mt-4 text-sm leading-relaxed text-text-2">
              La chaîne prouve qu&apos;aucune ligne n&apos;a été retouchée. Pour vérifier que chaque ligne suit bien la
              formule Glicko-2, ouvre le CV d&apos;un joueur : son journal des points mène à « Recalcule toi-même », qui
              refait tout son calcul dans ton navigateur.
            </p>
            <details className="mt-4 text-sm text-text-2">
              <summary className="cursor-pointer font-semibold text-text">Comment l&apos;empreinte est calculée</summary>
              <p className="mt-2 leading-relaxed">
                SHA-256 du texte formé, dans cet ordre et séparés par « | », du numéro de ligne, de l&apos;empreinte de la
                ligne précédente (64 zéros pour la première), du joueur, du jeu, de la saison, du match, du tournoi, du
                motif, des rating et RD avant et après (deux décimales), de l&apos;adversaire et de la date en
                microsecondes depuis le 1<sup>er</sup> janvier 1970 (UTC). Un champ absent compte comme vide.
              </p>
            </details>
          </section>
        </Apparition>
      </div>
    </main>
  );
}
