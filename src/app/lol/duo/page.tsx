import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { arrondir, trouverPalier, type Palier } from "@/lib/classement";
import { classeBoutonContour, classeChamp } from "@/lib/design";
import { REGIONS } from "@/lib/regions";
import { LABEL_ROLE, ROLES, type Role } from "@/lib/roles";
import {
  DELAI_APRES_REFUS_JOURS,
  DEMANDES_DUO_PAR_JOUR,
  DETAIL_OBJECTIF,
  DUREE_ANNONCE_DUO_JOURS,
  DUREE_DEMANDE_DUO_JOURS,
  estCreneau,
  estObjectif,
  estRole,
  HEURES_MOMENT,
  LABEL_OBJECTIF,
  MESSAGE_DUO_MAX,
  OBJECTIFS_DUO,
  propositionsDuo,
  raisonsCompatibilite,
  type AnnonceDuo,
  type CreneauDuo,
  type ObjectifDuo,
} from "@/lib/duo";
import { annulerDemandeDuo, demanderDuo, publierAnnonceDuo, repondreDemandeDuo, retirerAnnonceDuo } from "@/lib/duo-actions";
import Alerte from "@/components/design/Alerte";
import Apparition from "@/components/design/Apparition";
import AvatarJoueur from "@/components/design/AvatarJoueur";
import BoutonEnvoi from "@/components/design/BoutonEnvoi";
import BoutonLien from "@/components/design/BoutonLien";
import FondEcailles from "@/components/design/FondEcailles";
import { Choix } from "@/components/design/Formulaire";
import LibelleSection from "@/components/design/LibelleSection";
import Panneau from "@/components/design/Panneau";
import CarteDuo from "@/components/duo/CarteDuo";

// Matching duo (18/11/2026, roadmap phase 3) : annonces « cherche un duo »
// et propositions classées par lib/duo.ts. Toutes les règles sont en base
// (publier_annonce_duo, demander_duo, repondre_demande_duo…) ; la
// conversation ne s'ouvre que si le joueur demandé accepte.

export const metadata: Metadata = {
  title: "Trouver un duo — Najarena",
  description:
    "Trouve ton duo League of Legends : un joueur de ton serveur qui joue le poste que tu cherches, aux mêmes heures, de niveau vérifié proche du tien.",
  alternates: { canonical: "/lol/duo" },
};

interface PageProps {
  searchParams: Promise<{ region?: string; erreur?: string; message?: string }>;
}

interface AnnonceAffichee extends AnnonceDuo {
  pseudo: string;
  slug: string;
  avatarUrl: string | null;
  message: string | null;
  palier: string | null;
}

// Hors du composant (règle de pureté du rendu).
function limiteDemandes(): string {
  return new Date(Date.now() - DUREE_DEMANDE_DUO_JOURS * 24 * 3600 * 1000).toISOString();
}

function versAnnonce(
  a: {
    profile_id: string;
    pseudo: string;
    slug: string;
    avatar_url: string | null;
    poste: string;
    postes_cherches: string[];
    creneaux: string[];
    objectif: string;
    message: string | null;
    rating: number | null;
  },
  paliers: Palier[],
): AnnonceAffichee | null {
  if (!estRole(a.poste) || !estObjectif(a.objectif)) return null;
  const rating = a.rating === null ? null : arrondir(a.rating);
  return {
    profileId: a.profile_id,
    pseudo: a.pseudo,
    slug: a.slug,
    avatarUrl: a.avatar_url,
    poste: a.poste,
    postesCherches: a.postes_cherches.filter(estRole),
    creneaux: a.creneaux.filter(estCreneau),
    objectif: a.objectif,
    message: a.message,
    rating,
    palier: a.rating === null ? null : (trouverPalier(a.rating, paliers)?.nom ?? null),
  };
}

async function chargerDuo(regionDemandee: string | undefined) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const moi = userData.user?.id ?? null;

  const [{ data: compte }, { data: monAnnonceBrute }] = await Promise.all([
    moi
      ? supabase
          .from("game_accounts")
          .select("region, verifie_le")
          .eq("profile_id", moi)
          .eq("game_id", 1)
          .eq("est_principal", true)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    moi ? supabase.from("annonces_duo").select("*").eq("profile_id", moi).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const compteVerifie = Boolean(compte?.verifie_le);
  // Un joueur vérifié voit son serveur ; un visiteur choisit celui qu'il regarde.
  const region = compteVerifie && compte ? compte.region : REGIONS.some((r) => r.code === regionDemandee) ? regionDemandee! : "EUW";

  const [{ data: annoncesData }, { data: paliersData }, { data: demandesData }, { data: conversationsData }] =
    await Promise.all([
      supabase.rpc("annonces_duo_publiques", { p_region: region }),
      supabase.from("tiers").select("nom, rating_min").eq("game_id", 1),
      moi
        ? supabase
            .from("demandes_duo")
            .select(
              "id, demandeur_id, destinataire_id, cree_le, demandeur:profiles!demandes_duo_demandeur_id_fkey(pseudo, slug, avatar_url), destinataire:profiles!demandes_duo_destinataire_id_fkey(pseudo, slug, avatar_url)",
            )
            .eq("statut", "en_attente")
            .gt("cree_le", limiteDemandes())
            .order("cree_le", { ascending: false })
        : Promise.resolve({ data: [] }),
      moi ? supabase.from("conversations").select("id, profile_a, profile_b") : Promise.resolve({ data: [] }),
    ]);

  const paliers: Palier[] = (paliersData ?? []).map((p) => ({ nom: p.nom, ratingMin: p.rating_min }));
  const annonces = (annoncesData ?? []).flatMap((a) => {
    const annonce = versAnnonce(a, paliers);
    return annonce ? [annonce] : [];
  });
  const moiPublic = annonces.find((a) => a.profileId === moi) ?? null;
  // Mon annonce en cours, avec mon rating tel que les autres le voient.
  const enCours = Boolean(monAnnonceBrute && new Date(monAnnonceBrute.expire_le).getTime() > Date.now());
  const monAnnonce: AnnonceDuo | null =
    monAnnonceBrute && enCours && estRole(monAnnonceBrute.poste) && estObjectif(monAnnonceBrute.objectif)
      ? {
          profileId: monAnnonceBrute.profile_id,
          poste: monAnnonceBrute.poste,
          postesCherches: monAnnonceBrute.postes_cherches.filter(estRole),
          creneaux: monAnnonceBrute.creneaux.filter(estCreneau),
          objectif: monAnnonceBrute.objectif,
          rating: moiPublic?.rating ?? null,
        }
      : null;

  const demandes = demandesData ?? [];
  const contacts = new Map(
    (conversationsData ?? []).map((c) => [c.profile_a === moi ? c.profile_b : c.profile_a, c.id] as const),
  );

  return {
    moi,
    compteVerifie,
    region,
    annonces: annonces.filter((a) => a.profileId !== moi),
    monAnnonce,
    monAnnonceBrute: monAnnonceBrute && enCours ? monAnnonceBrute : null,
    recues: demandes.filter((d) => d.destinataire_id === moi),
    envoyees: demandes.filter((d) => d.demandeur_id === moi),
    contacts,
  };
}

/** Case à cocher ou bouton radio en pastille (formulaire de l'annonce). */
function Pastille({
  type,
  name,
  value,
  defaultChecked,
  children,
}: {
  type: "radio" | "checkbox";
  name: string;
  value: string;
  defaultChecked: boolean;
  children: ReactNode;
}) {
  return (
    <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-bouton border border-line-strong px-3 text-sm text-text-2 transition-colors duration-200 hover:border-[rgba(245,245,244,0.25)] has-[:checked]:border-text has-[:checked]:text-text has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent">
      <input type={type} name={name} value={value} defaultChecked={defaultChecked} className="h-4 w-4 shrink-0 cursor-pointer accent-accent" />
      {children}
    </label>
  );
}

const MOMENTS = [
  { cle: "journee", libelle: "Journée" },
  { cle: "soir", libelle: "Soir" },
  { cle: "nuit", libelle: "Nuit" },
] as const;

export default async function DuoPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { moi, compteVerifie, region, annonces, monAnnonce, monAnnonceBrute, recues, envoyees, contacts } =
    await chargerDuo(params.region);

  const propositions = monAnnonce ? propositionsDuo(monAnnonce, annonces) : [];
  const proposes = new Set(propositions.map((p) => p.annonce.profileId));
  const autres = annonces.filter((a) => !proposes.has(a.profileId));
  const envoyeeA = new Map(envoyees.map((d) => [d.destinataire_id, d.id]));
  const recueDe = new Map(recues.map((d) => [d.demandeur_id, d.id]));

  // Ce qu'on peut faire avec un joueur : écrire, attendre, répondre, demander.
  function actions(a: AnnonceAffichee) {
    if (!moi) return null;
    const conversation = contacts.get(a.profileId);
    if (conversation) {
      return (
        <Link href={`/moi/messages/${conversation}`} className={`${classeBoutonContour()} min-h-10! px-4! py-2! text-xs!`}>
          Lui écrire
        </Link>
      );
    }
    const envoyee = envoyeeA.get(a.profileId);
    if (envoyee) {
      return (
        <form action={annulerDemandeDuo} className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <input type="hidden" name="demande_id" value={envoyee} />
          <span className="text-sm text-text">Demande envoyée</span>
          <button type="submit" className="inline-flex min-h-11 cursor-pointer items-center text-sm text-muted underline underline-offset-3 hover:text-danger">
            Retirer
          </button>
        </form>
      );
    }
    const recue = recueDe.get(a.profileId);
    if (recue) {
      return (
        <a href="#demandes" className="inline-flex min-h-11 items-center text-sm text-text underline underline-offset-3 hover:text-accent">
          T&apos;a proposé un duo : répondre
        </a>
      );
    }
    if (!monAnnonce) return null;
    return (
      <form action={demanderDuo}>
        <input type="hidden" name="destinataire_id" value={a.profileId} />
        <BoutonEnvoi variante="contour" libelleEnCours="Envoi…" className="min-h-10! px-4! py-2! text-xs!" aria-label={`Proposer un duo à ${a.pseudo}`}>
          Proposer un duo
        </BoutonEnvoi>
      </form>
    );
  }

  const carte = (a: AnnonceAffichee, raisons?: string[], creneauxCommuns?: CreneauDuo[]) => (
    <CarteDuo
      pseudo={a.pseudo}
      slug={a.slug}
      avatarUrl={a.avatarUrl}
      poste={a.poste}
      postesCherches={a.postesCherches}
      rating={a.rating}
      palier={a.palier}
      creneaux={a.creneaux}
      creneauxCommuns={creneauxCommuns}
      objectif={a.objectif}
      message={a.message}
      raisons={raisons}
    >
      {actions(a)}
    </CarteDuo>
  );

  const posteActuel = monAnnonceBrute && estRole(monAnnonceBrute.poste) ? monAnnonceBrute.poste : null;
  const objectifActuel: ObjectifDuo =
    monAnnonceBrute && estObjectif(monAnnonceBrute.objectif) ? monAnnonceBrute.objectif : "classees";

  const formulaire = (
    <form action={publierAnnonceDuo} className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2.5 font-texte text-mini font-medium text-muted uppercase">Mon poste</legend>
        <div className="flex flex-wrap gap-2">
          {ROLES.map((r) => (
            <Pastille key={r} type="radio" name="poste" value={r} defaultChecked={posteActuel === r}>
              {LABEL_ROLE[r]}
            </Pastille>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2.5" aria-describedby="aide-postes">
        <legend className="mb-2.5 font-texte text-mini font-medium text-muted uppercase">Je cherche un duo qui joue</legend>
        <div className="flex flex-wrap gap-2">
          {ROLES.map((r: Role) => (
            <Pastille
              key={r}
              type="checkbox"
              name="postes_cherches"
              value={r}
              defaultChecked={Boolean(monAnnonceBrute?.postes_cherches.includes(r))}
            >
              {LABEL_ROLE[r]}
            </Pastille>
          ))}
        </div>
        <span id="aide-postes" className="text-xs text-muted">
          1 à 4 postes, autres que le tien.
        </span>
      </fieldset>
      <fieldset className="flex flex-col gap-2.5" aria-describedby="aide-creneaux">
        <legend className="mb-2.5 font-texte text-mini font-medium text-muted uppercase">Quand je joue</legend>
        {(["semaine", "weekend"] as const).map((jours) => (
          <div key={jours} className="flex flex-col gap-2">
            <span className="text-sm text-text-2">{jours === "semaine" ? "En semaine" : "Le week-end"}</span>
            <div className="flex flex-wrap gap-2">
              {MOMENTS.map((m) => {
                const valeur = `${jours}_${m.cle}` as CreneauDuo;
                return (
                  <Pastille
                    key={valeur}
                    type="checkbox"
                    name="creneaux"
                    value={valeur}
                    defaultChecked={Boolean(monAnnonceBrute?.creneaux.includes(valeur))}
                  >
                    {m.libelle}
                  </Pastille>
                );
              })}
            </div>
          </div>
        ))}
        <span id="aide-creneaux" className="text-xs text-muted">
          Heure de Paris : journée {HEURES_MOMENT.journee}, soir {HEURES_MOMENT.soir}, nuit {HEURES_MOMENT.nuit}.
        </span>
      </fieldset>
      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2.5 font-texte text-mini font-medium text-muted uppercase">Mon objectif</legend>
        {OBJECTIFS_DUO.map((o) => (
          <Choix
            key={o}
            name="objectif"
            value={o}
            defaultChecked={objectifActuel === o}
            titre={LABEL_OBJECTIF[o]}
            detail={DETAIL_OBJECTIF[o]}
          />
        ))}
      </fieldset>
      <label className="flex flex-col gap-1.5">
        <span className="font-texte text-mini font-medium text-muted uppercase">
          Un mot sur toi · {MESSAGE_DUO_MAX} caractères, facultatif
        </span>
        <textarea
          name="message"
          rows={3}
          maxLength={MESSAGE_DUO_MAX}
          defaultValue={monAnnonceBrute?.message ?? ""}
          placeholder="Ex. « Support calme, je joue surtout Nautilus, micro le soir »"
          className={`${classeChamp()} resize-none`}
        />
      </label>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <BoutonEnvoi libelleEnCours="Envoi…" className="w-full sm:w-auto">
          {monAnnonceBrute ? "Mettre à jour" : "Publier mon annonce"}
        </BoutonEnvoi>
        {monAnnonceBrute && (
          <button
            type="submit"
            formAction={retirerAnnonceDuo}
            className="inline-flex min-h-11 cursor-pointer items-center text-sm text-muted underline underline-offset-3 hover:text-danger"
          >
            Retirer mon annonce
          </button>
        )}
      </div>
      {monAnnonceBrute && (
        <p className="text-xs text-muted">
          En ligne jusqu&apos;au{" "}
          {new Date(monAnnonceBrute.expire_le).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" })}{" "}
          : la mettre à jour la prolonge de {DUREE_ANNONCE_DUO_JOURS} jours.
        </p>
      )}
    </form>
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative flex flex-col gap-12 px-grille">
        <Apparition className="flex flex-wrap items-end justify-between gap-8">
          <div>
            <LibelleSection>League of Legends · Duo</LibelleSection>
            <h1 className="mt-4 font-titre text-section font-black tracking-[1px] uppercase">Trouver un duo</h1>
            <p className="mt-5 max-w-2xl text-courant text-text-2">
              Publie ton poste, celui que tu cherches et tes horaires. On te montre d&apos;abord les joueurs de ton serveur qui
              jouent ce poste aux mêmes heures, de niveau proche quand vous êtes classés tous les deux. Pour contacter un
              joueur, envoie-lui une demande : s&apos;il accepte, une conversation s&apos;ouvre dans ta messagerie.
            </p>
          </div>
          <BoutonLien href="/lol/coequipiers" variante="contour">
            Chercher une équipe
          </BoutonLien>
        </Apparition>

        <Apparition delai={0.06}>
          <ul className="grid max-w-5xl gap-6 border-y border-line py-6 md:grid-cols-3">
            <li className="flex flex-col gap-1.5">
              <span className="font-texte text-mini font-medium text-muted uppercase">Appariement</span>
              <span className="text-sm text-text-2">
                Le poste que tu cherches, des créneaux en commun, le même objectif, et l&apos;écart de rating Najarena quand vous
                êtes classés tous les deux : lu dans des parties vérifiées, jamais déclaré.
              </span>
            </li>
            <li className="flex flex-col gap-1.5">
              <span className="font-texte text-mini font-medium text-muted uppercase">Contact</span>
              <span className="text-sm text-text-2">
                Une demande, une réponse. La conversation s&apos;ouvre seulement si l&apos;autre accepte ; après un refus, pas de
                nouvelle demande avant {DELAI_APRES_REFUS_JOURS} jours. {DEMANDES_DUO_PAR_JOUR} demandes par jour au plus.
              </span>
            </li>
            <li className="flex flex-col gap-1.5">
              <span className="font-texte text-mini font-medium text-muted uppercase">Durée</span>
              <span className="text-sm text-text-2">
                Ton annonce reste en ligne {DUREE_ANNONCE_DUO_JOURS} jours ; mets-la à jour pour la prolonger. Une demande sans
                réponse expire au bout de {DUREE_DEMANDE_DUO_JOURS} jours.
              </span>
            </li>
          </ul>
        </Apparition>

        {(params.erreur || params.message) && (
          <div className="flex max-w-2xl flex-col gap-3">
            {params.erreur && <Alerte type="erreur">{params.erreur}</Alerte>}
            {params.message && <Alerte type="succes">{params.message}</Alerte>}
          </div>
        )}

        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="flex min-w-0 flex-col gap-12">
            {(recues.length > 0 || envoyees.length > 0) && (
              <section id="demandes" aria-labelledby="titre-demandes" className="flex scroll-mt-28 flex-col gap-5">
                <LibelleSection as="h2" id="titre-demandes" className="border-b border-line-strong pb-4">
                  Demandes en attente
                </LibelleSection>
                <ul className="flex flex-col">
                  {recues.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center justify-between gap-4 border-b border-line py-4">
                      <span className="flex min-w-0 items-center gap-3">
                        <AvatarJoueur pseudo={d.demandeur?.pseudo ?? "?"} src={d.demandeur?.avatar_url ?? null} taille={36} />
                        <span className="min-w-0">
                          <Link href={`/joueur/${d.demandeur?.slug ?? ""}`} className="font-semibold text-text hover:text-accent">
                            {d.demandeur?.pseudo ?? "Joueur"}
                          </Link>{" "}
                          <span className="text-text-2">te propose de jouer en duo</span>
                        </span>
                      </span>
                      <form action={repondreDemandeDuo} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="demande_id" value={d.id} />
                        <BoutonEnvoi name="reponse" value="accepter" libelleEnCours="Envoi…" className="min-h-10! px-4! py-2! text-xs!">
                          Accepter
                        </BoutonEnvoi>
                        <BoutonEnvoi name="reponse" value="refuser" variante="contour" className="min-h-10! px-4! py-2! text-xs!">
                          Décliner
                        </BoutonEnvoi>
                      </form>
                    </li>
                  ))}
                  {envoyees.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center justify-between gap-4 border-b border-line py-4">
                      <span className="flex min-w-0 items-center gap-3">
                        <AvatarJoueur pseudo={d.destinataire?.pseudo ?? "?"} src={d.destinataire?.avatar_url ?? null} taille={36} />
                        <span className="min-w-0 text-text-2">
                          Ta demande à{" "}
                          <Link href={`/joueur/${d.destinataire?.slug ?? ""}`} className="font-semibold text-text hover:text-accent">
                            {d.destinataire?.pseudo ?? "Joueur"}
                          </Link>{" "}
                          attend sa réponse
                        </span>
                      </span>
                      <form action={annulerDemandeDuo}>
                        <input type="hidden" name="demande_id" value={d.id} />
                        <button
                          type="submit"
                          className="inline-flex min-h-11 cursor-pointer items-center text-sm text-muted underline underline-offset-3 hover:text-danger"
                        >
                          Retirer
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {monAnnonce && (
              <section id="pour-toi" aria-labelledby="titre-pour-toi" className="flex scroll-mt-28 flex-col gap-6">
                <LibelleSection as="h2" id="titre-pour-toi" className="border-b border-line-strong pb-4">
                  Pour toi <span className="text-faint tabular-nums">· {propositions.length}</span>
                </LibelleSection>
                {propositions.length === 0 ? (
                  <Panneau reperes className="flex flex-col items-start gap-3 p-8">
                    <p className="font-titre text-3xl font-black uppercase">Pas encore de duo pour toi.</p>
                    <p className="max-w-md text-text-2">
                      Aucun joueur de {region} ne joue pour l&apos;instant le poste que tu cherches à tes horaires. Ton annonce
                      reste visible : les prochains te trouveront. Ajouter un créneau ou un poste élargit la recherche.
                    </p>
                  </Panneau>
                ) : (
                  <ul className="grid gap-4 xl:grid-cols-2">
                    {propositions.map(({ annonce, compatibilite }) => (
                      <li key={annonce.profileId}>
                        {carte(annonce, raisonsCompatibilite(monAnnonce, annonce, compatibilite), compatibilite.creneauxCommuns)}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            <section id="annonces" aria-labelledby="titre-annonces" className="flex scroll-mt-28 flex-col gap-6">
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line-strong pb-4">
                <LibelleSection as="h2" id="titre-annonces">
                  {monAnnonce ? "Autres annonces" : "Annonces"} · {region}{" "}
                  <span className="text-faint tabular-nums">· {autres.length}</span>
                </LibelleSection>
                {!compteVerifie && (
                  <nav aria-label="Choisir le serveur" className="flex flex-wrap gap-x-3 text-sm">
                    {REGIONS.map((r) => (
                      <Link
                        key={r.code}
                        href={`/lol/duo?region=${r.code}#annonces`}
                        aria-current={r.code === region ? "true" : undefined}
                        className={`inline-flex min-h-11 min-w-11 items-center justify-center px-1 ${r.code === region ? "font-semibold text-text" : "text-muted hover:text-text"}`}
                      >
                        {r.code}
                      </Link>
                    ))}
                  </nav>
                )}
              </div>
              {autres.length === 0 ? (
                <Panneau reperes className="flex flex-col items-start gap-3 p-8">
                  <p className="font-titre text-3xl font-black uppercase">
                    {monAnnonce && propositions.length > 0 ? "Rien d'autre." : "Personne pour l'instant."}
                  </p>
                  <p className="max-w-md text-text-2">
                    {monAnnonce && propositions.length > 0
                      ? "Toutes les annonces de ton serveur sont dans tes propositions."
                      : `Aucun joueur de ${region} ne cherche de duo en ce moment. Publie la première annonce.`}
                  </p>
                </Panneau>
              ) : (
                <ul className="grid gap-4 xl:grid-cols-2">
                  {autres.map((a) => (
                    <li key={a.profileId}>{carte(a)}</li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <Panneau id="mon-annonce" className="flex scroll-mt-28 flex-col gap-5 p-6">
            <LibelleSection as="h2">{monAnnonceBrute ? "Mon annonce" : "Je cherche un duo"}</LibelleSection>
            {!moi ? (
              <div className="flex flex-col items-start gap-4">
                <p className="text-sm text-text-2">Connecte-toi pour publier ton annonce et proposer un duo.</p>
                <BoutonLien href={`/connexion?suite=${encodeURIComponent("/lol/duo")}`} variante="contour">
                  Se connecter
                </BoutonLien>
              </div>
            ) : !compteVerifie ? (
              <div className="flex flex-col items-start gap-4">
                <p className="text-sm text-text-2">
                  Il faut un compte Riot vérifié : il fixe ton serveur, et ton rating vient de parties lues chez Riot.
                </p>
                <BoutonLien href={`/lier-riot?suite=${encodeURIComponent("/lol/duo")}`}>Lier mon Riot ID</BoutonLien>
              </div>
            ) : (
              formulaire
            )}
          </Panneau>
        </div>
      </div>
    </main>
  );
}
