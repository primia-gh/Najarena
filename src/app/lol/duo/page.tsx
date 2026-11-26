import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { arrondir, trouverPalier, type Palier } from "@/lib/classement";
import { classeBoutonContour, classeChamp } from "@/lib/design";
import { REGIONS } from "@/lib/regions";
import { LABEL_ROLE, ROLES } from "@/lib/roles";
import { typographie } from "@/lib/typographie";
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
import EnTetePage from "@/components/design/EnTetePage";
import AvatarJoueur from "@/components/design/AvatarJoueur";
import BoutonEnvoi from "@/components/design/BoutonEnvoi";
import BoutonLien from "@/components/design/BoutonLien";
import FondEcailles from "@/components/design/FondEcailles";
import { Champ, Choix, GroupeFormulaire, Pastille } from "@/components/design/Formulaire";
import LibelleSection from "@/components/design/LibelleSection";
import Panneau from "@/components/design/Panneau";
import CarteDuo from "@/components/duo/CarteDuo";

// Matching duo (18/11/2026, roadmap phase 3) : annonces « cherche un duo »
// et propositions classées par lib/duo.ts. Toutes les règles sont en base
// (publier_annonce_duo, demander_duo, repondre_demande_duo…) ; la
// conversation ne s'ouvre que si le joueur demandé accepte. Revue design du
// 18/11/2026 : message de retour toujours visible (#retour), action
// principale en tête sur mobile, boutons de 44 px, formulaire de la charte.

export const metadata: Metadata = {
  title: "Trouver un duo — Najarena",
  description:
    "Trouve ton duo League of Legends : un joueur de ton serveur qui joue le poste que tu cherches, sur au moins un de tes créneaux, avec son rating Najarena quand il est classé.",
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

/** Ce qui empêche (ou non) d'envoyer une demande à un joueur. */
type EtatDemande = { type: "en_attente"; id: string } | { type: "plus_tard"; le: string; refusee: boolean };

const JOUR_MS = 24 * 3600 * 1000;

// Hors du composant (règle de pureté du rendu).
function maintenantMs(): number {
  return Date.now();
}

function dateCourte(ms: number): string {
  return new Date(ms).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" });
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
    rating: a.rating === null ? null : arrondir(a.rating),
    palier: a.rating === null ? null : (trouverPalier(a.rating, paliers)?.nom ?? null),
  };
}

async function chargerDuo(regionDemandee: string | undefined, maintenant: number) {
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
  const region =
    compteVerifie && compte ? compte.region : REGIONS.some((r) => r.code === regionDemandee) ? regionDemandee! : "EUW";

  // Demandes des 37 derniers jours : une demande se refuse au plus 7 jours
  // après son envoi, et un refus bloque 30 jours.
  const depuis = new Date(maintenant - (DUREE_DEMANDE_DUO_JOURS + DELAI_APRES_REFUS_JOURS) * JOUR_MS).toISOString();
  const [{ data: annoncesData }, { data: paliersData }, { data: demandesData }, { data: conversationsData }] =
    await Promise.all([
      supabase.rpc("annonces_duo_publiques", { p_region: region }),
      supabase.from("tiers").select("nom, rating_min").eq("game_id", 1),
      moi
        ? supabase
            .from("demandes_duo")
            .select(
              "id, demandeur_id, destinataire_id, statut, cree_le, repondu_le, demandeur:profiles!demandes_duo_demandeur_id_fkey(pseudo, slug, avatar_url), destinataire:profiles!demandes_duo_destinataire_id_fkey(pseudo, slug, avatar_url)",
            )
            .gt("cree_le", depuis)
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
  const enCours = Boolean(monAnnonceBrute && new Date(monAnnonceBrute.expire_le).getTime() > maintenant);
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
  const enAttente = (d: (typeof demandes)[number]) =>
    d.statut === "en_attente" && new Date(d.cree_le).getTime() > maintenant - DUREE_DEMANDE_DUO_JOURS * JOUR_MS;

  // Mêmes règles que demander_duo : une demande par joueur et par 7 jours,
  // pas de nouvelle demande 30 jours après un refus.
  const etats = new Map<string, EtatDemande>();
  for (const d of demandes.filter((x) => x.demandeur_id === moi)) {
    if (etats.has(d.destinataire_id)) continue; // la plus récente d'abord
    if (enAttente(d)) {
      etats.set(d.destinataire_id, { type: "en_attente", id: d.id });
      continue;
    }
    const apresEnvoi = new Date(d.cree_le).getTime() + DUREE_DEMANDE_DUO_JOURS * JOUR_MS;
    const refusee = d.statut === "refusee" && d.repondu_le !== null;
    const apresRefus = refusee && d.repondu_le ? new Date(d.repondu_le).getTime() + DELAI_APRES_REFUS_JOURS * JOUR_MS : 0;
    const le = Math.max(apresEnvoi, apresRefus);
    if (le > maintenant) etats.set(d.destinataire_id, { type: "plus_tard", le: dateCourte(le), refusee });
  }

  return {
    moi,
    compteVerifie,
    region,
    annonces: annonces.filter((a) => a.profileId !== moi),
    monAnnonce,
    monAnnonceBrute: monAnnonceBrute && enCours ? monAnnonceBrute : null,
    recues: demandes.filter((d) => d.destinataire_id === moi && enAttente(d)),
    envoyees: demandes.filter((d) => d.demandeur_id === moi && enAttente(d)),
    etats,
    contacts: new Map(
      (conversationsData ?? []).map((c) => [c.profile_a === moi ? c.profile_b : c.profile_a, c.id] as const),
    ),
  };
}

const MOMENTS = [
  { cle: "journee", libelle: "Journée" },
  { cle: "soir", libelle: "Soir" },
  { cle: "nuit", libelle: "Nuit" },
] as const;

const lienDiscret =
  "inline-flex min-h-11 cursor-pointer items-center text-sm text-muted underline underline-offset-3 hover:text-danger";
const lienAction = "inline-flex min-h-11 items-center text-sm text-text underline underline-offset-3 hover:text-accent";

export default async function DuoPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const maintenant = maintenantMs();
  const { moi, compteVerifie, region, annonces, monAnnonce, monAnnonceBrute, recues, envoyees, etats, contacts } =
    await chargerDuo(params.region, maintenant);

  const propositions = monAnnonce ? propositionsDuo(monAnnonce, annonces) : [];
  const proposes = new Set(propositions.map((p) => p.annonce.profileId));
  const autres = annonces.filter((a) => !proposes.has(a.profileId));
  const recueDe = new Set(recues.map((d) => d.demandeur_id));
  const annonceDe = new Map(annonces.map((a) => [a.profileId, a]));
  const peutPublier = Boolean(moi && compteVerifie);

  // Ce qu'on peut faire avec un joueur : écrire, attendre, répondre, demander.
  function actions(a: AnnonceAffichee) {
    if (!moi) return null;
    const conversation = contacts.get(a.profileId);
    if (conversation) {
      return (
        <Link href={`/moi/messages/${conversation}`} className={classeBoutonContour()}>
          Lui écrire
        </Link>
      );
    }
    const etat = etats.get(a.profileId);
    if (etat?.type === "en_attente") {
      return (
        <form action={annulerDemandeDuo} className="flex flex-wrap items-center gap-x-4">
          <input type="hidden" name="demande_id" value={etat.id} />
          <span className="text-sm text-text">Demande envoyée</span>
          <button type="submit" aria-label={`Retirer ta demande à ${a.pseudo}`} className={lienDiscret}>
            Retirer
          </button>
        </form>
      );
    }
    if (recueDe.has(a.profileId)) {
      return (
        <a href="#demandes" className={lienAction}>
          {typographie("T'a proposé un duo : répondre")}
        </a>
      );
    }
    if (etat?.type === "plus_tard") {
      return (
        <span className="text-sm text-muted">
          {typographie(`${etat.refusee ? "A décliné ta demande. " : ""}Nouvelle demande possible le ${etat.le}`)}
        </span>
      );
    }
    if (!monAnnonce) {
      return peutPublier ? (
        <a href="#mon-annonce" className={lienAction}>
          Publie ton annonce pour lui proposer un duo
        </a>
      ) : null;
    }
    return (
      <form action={demanderDuo}>
        <input type="hidden" name="destinataire_id" value={a.profileId} />
        <BoutonEnvoi variante="contour" libelleEnCours="Envoi…" aria-label={`Proposer un duo à ${a.pseudo}`}>
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
    <form action={publierAnnonceDuo} className="flex flex-col gap-8">
      <GroupeFormulaire numero="01" titre="Mon poste" id="duo-poste" niveau="h3">
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">Mon poste</legend>
          {ROLES.map((r) => (
            <Pastille key={r} type="radio" name="poste" value={r} defaultChecked={posteActuel === r}>
              {LABEL_ROLE[r]}
            </Pastille>
          ))}
        </fieldset>
      </GroupeFormulaire>
      <GroupeFormulaire numero="02" titre="Le poste de mon duo" id="duo-postes-cherches" niveau="h3">
        <fieldset className="flex flex-col gap-2" aria-describedby="aide-postes">
          <legend className="sr-only">Je cherche un duo qui joue</legend>
          <div className="flex flex-wrap gap-2">
            {ROLES.map((r) => (
              <Pastille
                key={r}
                name="postes_cherches"
                value={r}
                defaultChecked={Boolean(monAnnonceBrute?.postes_cherches.includes(r))}
              >
                {LABEL_ROLE[r]}
              </Pastille>
            ))}
          </div>
          <span id="aide-postes" className="text-xs text-muted">
            {typographie("1 à 4 postes, autres que le tien.")}
          </span>
        </fieldset>
      </GroupeFormulaire>
      <GroupeFormulaire numero="03" titre="Quand je joue" id="duo-creneaux" niveau="h3">
        <fieldset className="flex flex-col gap-3" aria-describedby="aide-creneaux">
          <legend className="sr-only">Mes créneaux</legend>
          {(["semaine", "weekend"] as const).map((jours) => (
            <div key={jours} className="flex flex-col gap-2">
              <span className="text-sm text-text-2">{jours === "semaine" ? "En semaine" : "Le week-end"}</span>
              <div className="flex flex-wrap gap-2">
                {MOMENTS.map((m) => {
                  const valeur = `${jours}_${m.cle}` as CreneauDuo;
                  return (
                    <Pastille
                      key={valeur}
                      name="creneaux"
                      value={valeur}
                      defaultChecked={Boolean(monAnnonceBrute?.creneaux.includes(valeur))}
                    >
                      <span className="sr-only">{jours === "semaine" ? "En semaine, " : "Le week-end, "}</span>
                      {m.libelle}
                    </Pastille>
                  );
                })}
              </div>
            </div>
          ))}
          <span id="aide-creneaux" className="text-xs text-muted">
            {typographie(
              `Heure de Paris : journée ${HEURES_MOMENT.journee}, soir ${HEURES_MOMENT.soir}, nuit ${HEURES_MOMENT.nuit}.`,
            )}
          </span>
        </fieldset>
      </GroupeFormulaire>
      <GroupeFormulaire numero="04" titre="Mon objectif" id="duo-objectif" niveau="h3">
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Mon objectif</legend>
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
      </GroupeFormulaire>
      <GroupeFormulaire numero="05" titre="Un mot sur toi" id="duo-message" niveau="h3">
        <Champ
          libelle={`Message · facultatif, ${MESSAGE_DUO_MAX} caractères`}
          aide="Public, comme ton annonce. Pas de lien ni de contact : la conversation s'ouvre sur le site si l'autre accepte."
          idAide="aide-message-duo"
        >
          <textarea
            name="message"
            rows={3}
            maxLength={MESSAGE_DUO_MAX}
            defaultValue={monAnnonceBrute?.message ?? ""}
            aria-describedby="aide-message-duo"
            placeholder={typographie("Ex. « Support calme, je joue surtout Nautilus, micro le soir »")}
            className={`${classeChamp()} resize-none`}
          />
        </Champ>
      </GroupeFormulaire>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <BoutonEnvoi libelleEnCours="Envoi…" className="w-full sm:w-auto">
          {monAnnonceBrute ? "Mettre à jour" : "Publier mon annonce"}
        </BoutonEnvoi>
        {monAnnonceBrute && (
          <button type="submit" formAction={retirerAnnonceDuo} className={lienDiscret}>
            Retirer mon annonce
          </button>
        )}
      </div>
      {monAnnonceBrute && (
        <p className="text-xs text-muted">
          {typographie(
            `En ligne jusqu'au ${dateCourte(new Date(monAnnonceBrute.expire_le).getTime())} ; mise à jour, elle repart pour ${DUREE_ANNONCE_DUO_JOURS} jours.`,
          )}
        </p>
      )}
    </form>
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative flex flex-col gap-12 px-grille">
        <EnTetePage
          surtitre="League of Legends · Duo"
          titre="Trouver un duo"
          intro={typographie(
            "Publie ton poste, celui que tu cherches et tes horaires. On te montre d'abord les joueurs de ton serveur qui jouent ce poste sur au moins un de tes créneaux ; quand vous êtes classés tous les deux, les niveaux proches passent devant. Pour contacter un joueur, envoie-lui une demande : s'il accepte, une conversation s'ouvre dans ta messagerie.",
          )}
          actions={
            <>
            {/* Sur mobile, le formulaire est loin : un raccourci vers lui. */}
            {!moi ? (
              <BoutonLien href={`/connexion?suite=${encodeURIComponent("/lol/duo")}`}>Se connecter</BoutonLien>
            ) : (
              compteVerifie && (
                <BoutonLien href="#mon-annonce" className="lg:hidden">
                  {monAnnonceBrute ? "Modifier mon annonce" : "Publier mon annonce"}
                </BoutonLien>
              )
            )}
            <BoutonLien href="/lol/coequipiers" variante="contour">
              Chercher une équipe
            </BoutonLien>
            </>
          }
        />

        <Apparition delai={0.06}>
          <ul className="grid max-w-5xl gap-6 border-y border-line py-6 md:grid-cols-3">
            <li className="flex flex-col gap-1.5">
              <span className="font-texte text-mini font-medium text-muted uppercase">Appariement</span>
              <span className="text-sm text-text-2">
                {typographie(
                  "Le poste que tu cherches, au moins un créneau en commun, puis les postes réciproques et le même objectif. Le rating Najarena, lu dans des parties vérifiées et jamais déclaré, départage quand vous êtes classés tous les deux.",
                )}
              </span>
            </li>
            <li className="flex flex-col gap-1.5">
              <span className="font-texte text-mini font-medium text-muted uppercase">Contact</span>
              <span className="text-sm text-text-2">
                {typographie(
                  `Une demande, une réponse. La conversation s'ouvre seulement si l'autre accepte. Une demande au même joueur par ${DUREE_DEMANDE_DUO_JOURS} jours, ${DEMANDES_DUO_PAR_JOUR} par 24 h au plus ; après un refus, pas de nouvelle demande avant ${DELAI_APRES_REFUS_JOURS} jours. Tu peux bloquer un joueur depuis la conversation.`,
                )}
              </span>
            </li>
            <li className="flex flex-col gap-1.5">
              <span className="font-texte text-mini font-medium text-muted uppercase">Durée</span>
              <span className="text-sm text-text-2">
                {typographie(
                  `Ton annonce reste en ligne ${DUREE_ANNONCE_DUO_JOURS} jours ; mise à jour, elle repart pour ${DUREE_ANNONCE_DUO_JOURS} jours. Une demande sans réponse expire au bout de ${DUREE_DEMANDE_DUO_JOURS} jours.`,
                )}
              </span>
            </li>
          </ul>
        </Apparition>

        {(params.erreur || params.message) && (
          <div id="retour" className="flex max-w-2xl scroll-mt-28 flex-col gap-3">
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
                  {recues.map((d) => {
                    const pseudo = d.demandeur?.pseudo ?? "Joueur";
                    const annonce = annonceDe.get(d.demandeur_id);
                    const expire = dateCourte(new Date(d.cree_le).getTime() + DUREE_DEMANDE_DUO_JOURS * JOUR_MS);
                    return (
                      <li key={d.id} className="flex flex-wrap items-center justify-between gap-4 border-b border-line py-4">
                        <span className="flex min-w-0 items-center gap-3">
                          <AvatarJoueur pseudo={pseudo} src={d.demandeur?.avatar_url ?? null} taille={36} />
                          <span className="flex min-w-0 flex-col gap-0.5">
                            <span>
                              <Link href={`/joueur/${d.demandeur?.slug ?? ""}`} className="font-semibold text-text hover:text-accent">
                                {pseudo}
                              </Link>{" "}
                              <span className="text-text-2">te propose de jouer en duo</span>
                            </span>
                            <span className="text-xs text-muted tabular-nums">
                              {typographie(
                                [
                                  annonce ? LABEL_ROLE[annonce.poste] : null,
                                  annonce ? (annonce.rating !== null ? `rating ${annonce.rating}` : "non classé") : null,
                                  `expire le ${expire}`,
                                ]
                                  .filter(Boolean)
                                  .join(" · "),
                              )}
                            </span>
                          </span>
                        </span>
                        <form action={repondreDemandeDuo} className="flex flex-wrap items-center gap-2">
                          <input type="hidden" name="demande_id" value={d.id} />
                          <BoutonEnvoi
                            name="reponse"
                            value="accepter"
                            libelleEnCours="Envoi…"
                            aria-label={`Accepter la demande de ${pseudo}`}
                          >
                            Accepter
                          </BoutonEnvoi>
                          <BoutonEnvoi
                            name="reponse"
                            value="refuser"
                            variante="contour"
                            aria-label={`Décliner la demande de ${pseudo}`}
                          >
                            Décliner
                          </BoutonEnvoi>
                        </form>
                      </li>
                    );
                  })}
                  {envoyees.map((d) => {
                    const pseudo = d.destinataire?.pseudo ?? "Joueur";
                    return (
                      <li key={d.id} className="flex flex-wrap items-center justify-between gap-4 border-b border-line py-4">
                        <span className="flex min-w-0 items-center gap-3">
                          <AvatarJoueur pseudo={pseudo} src={d.destinataire?.avatar_url ?? null} taille={36} />
                          <span className="min-w-0 text-text-2">
                            Ta demande à{" "}
                            <Link href={`/joueur/${d.destinataire?.slug ?? ""}`} className="font-semibold text-text hover:text-accent">
                              {pseudo}
                            </Link>{" "}
                            attend sa réponse
                          </span>
                        </span>
                        <form action={annulerDemandeDuo}>
                          <input type="hidden" name="demande_id" value={d.id} />
                          <button type="submit" aria-label={`Retirer ta demande à ${pseudo}`} className={lienDiscret}>
                            Retirer
                          </button>
                        </form>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {monAnnonce && (
              <section id="pour-toi" aria-labelledby="titre-pour-toi" className="flex scroll-mt-28 flex-col gap-6">
                <LibelleSection as="h2" id="titre-pour-toi" className="border-b border-line-strong pb-4">
                  Pour toi <span className="text-faint tabular-nums">· {propositions.length}</span>
                </LibelleSection>
                {propositions.length === 0 ? (
                  <Panneau reperes className="flex flex-col items-start gap-4 p-8">
                    <p className="font-titre text-3xl font-black uppercase">Pas encore de duo pour toi.</p>
                    <p className="max-w-md text-text-2">
                      {typographie(
                        `Aucun joueur de ${region} ne joue pour l'instant le poste que tu cherches à tes horaires. Ton annonce reste visible : les prochains te trouveront. Ajouter un créneau ou un poste élargit la recherche.`,
                      )}
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <BoutonLien href="#mon-annonce" variante="contour">
                        Modifier mon annonce
                      </BoutonLien>
                      <BoutonLien href="/lol/coequipiers" variante="secondaire">
                        Chercher une équipe
                      </BoutonLien>
                    </div>
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
                <Panneau reperes className="flex flex-col items-start gap-4 p-8">
                  <p className="font-titre text-3xl font-black uppercase">
                    {monAnnonce && propositions.length > 0 ? "Rien d'autre." : "Personne pour l'instant."}
                  </p>
                  <p className="max-w-md text-text-2">
                    {monAnnonce && propositions.length > 0
                      ? "Toutes les annonces de ton serveur sont dans tes propositions."
                      : `Aucun joueur de ${region} ne cherche de duo en ce moment.`}
                  </p>
                  {!monAnnonce && peutPublier && <BoutonLien href="#mon-annonce">Publier la première annonce</BoutonLien>}
                </Panneau>
              ) : (
                <ul className="grid gap-4 xl:grid-cols-2">
                  {autres.map((a) => (
                    <li key={a.profileId}>{carte(a)}</li>
                  ))}
                </ul>
              )}
              {!moi && autres.length > 0 && (
                <p className="text-sm text-text-2">
                  <Link
                    href={`/connexion?suite=${encodeURIComponent("/lol/duo")}`}
                    className="text-text underline underline-offset-3 hover:text-accent"
                  >
                    Connecte-toi
                  </Link>{" "}
                  pour publier ton annonce et proposer un duo.
                </p>
              )}
            </section>
          </div>

          {/* Sans annonce, le formulaire passe en tête sur mobile : c'est l'action principale. */}
          <Panneau
            id="mon-annonce"
            className={`flex scroll-mt-28 flex-col gap-6 p-6 ${monAnnonceBrute ? "" : "order-first lg:order-none"}`}
          >
            <h2 className="font-titre text-sous-titre font-black uppercase">
              {monAnnonceBrute ? "Mon annonce" : "Je cherche un duo"}
            </h2>
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
                  {typographie(
                    "Il faut un compte Riot vérifié : il fixe ton serveur, et ton rating vient de parties lues chez Riot.",
                  )}
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
