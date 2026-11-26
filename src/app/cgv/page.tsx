import type { ReactNode } from "react";
import Link from "next/link";
import EnTetePage from "@/components/design/EnTetePage";
import type { Metadata } from "next";
import { DATE_CGV_LISIBLE, DELAI_RETRACTATION_JOURS, MEDIATEUR, paiementActif } from "@/lib/cgv";

// Conditions générales de vente (19/11/2026, audit E11) : prix, durée,
// renouvellement, résiliation en ligne, rétractation de 14 jours (et ce
// qu'il advient quand l'accès commence tout de suite), factures, médiation.
// Texte à faire relire par un juriste avant d'allumer les paiements.

export const metadata: Metadata = {
  title: "Conditions générales de vente — Najarena",
  description:
    "Conditions générales de vente des offres payantes de Najarena : prix, abonnement mensuel, résiliation en ligne, droit de rétractation de 14 jours.",
  alternates: { canonical: "/cgv" },
};

const lien = "text-text underline underline-offset-3";

function Section({ numero, titre, children }: { numero: number; titre: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-titre text-lg font-extrabold tracking-tight text-text uppercase">
        {numero}. {titre}
      </h2>
      {children}
    </section>
  );
}

export default function CgvPage() {
  const ouvert = paiementActif();
  return (
    <main className="px-grille *:max-w-3xl pt-32 pb-24 font-texte text-text">
      <EnTetePage sansApparition retour={{ href: "/", libelle: "Najarena" }} surtitre={`Document légal · version du ${DATE_CGV_LISIBLE}`} titre="Conditions générales de vente" />
      {!ouvert && (
        <p className="mt-6 border-l-2 border-line-strong pl-4 text-courant text-text">
          Les offres payantes ne sont pas encore en vente&nbsp;: ces conditions s&apos;appliqueront à leur ouverture.
        </p>
      )}

      <div className="mt-8 flex flex-col gap-8 text-courant text-text">
        <Section numero={1} titre="Objet et vendeur">
          <p className="mt-2 text-muted">
            Ces conditions s&apos;appliquent aux abonnements payants de Najarena&nbsp;: Plus, Pro et Organisateur. Le
            vendeur est l&apos;éditeur du site, identifié dans les{" "}
            <Link href="/mentions-legales" className={lien}>
              mentions légales
            </Link>
            . Le classement, les verdicts et le profil public restent gratuits&nbsp;: un abonnement ne donne aucun
            droit sur les résultats, les verdicts ni le classement.
          </p>
        </Section>

        <Section numero={2} titre="Offres et prix">
          <p className="mt-2 text-muted">
            Le contenu de chaque offre est décrit sur la page{" "}
            <Link href="/tarifs" className={lien}>
              Tarifs
            </Link>
            . Les fonctions marquées «&nbsp;Bientôt&nbsp;» ne sont pas encore livrées&nbsp;: le prix payé correspond aux
            fonctions disponibles au jour de la souscription, et les suivantes s&apos;ajoutent sans supplément dès leur
            mise en ligne.
          </p>
          <p className="mt-2 text-muted">
            Les prix sont indiqués en euros, toutes taxes comprises. Le prix qui s&apos;applique est celui affiché sur
            la page de paiement au moment de la souscription. Un changement de prix est annoncé au moins 30&nbsp;jours
            avant de s&apos;appliquer à un abonnement en cours&nbsp;; tu peux résilier avant cette date.
          </p>
        </Section>

        <Section numero={3} titre="Durée et renouvellement">
          <p className="mt-2 text-muted">
            L&apos;abonnement est mensuel et sans engagement. Il se renouvelle automatiquement chaque mois, à la date
            anniversaire de la souscription, jusqu&apos;à ce que tu le résilies.
          </p>
        </Section>

        <Section numero={4} titre="Paiement">
          <p className="mt-2 text-muted">
            Le paiement se fait par carte, chez Stripe, au début de chaque période. Najarena ne voit ni ne conserve
            tes coordonnées bancaires. Si un prélèvement échoue, Stripe le retente&nbsp;; sans paiement, l&apos;offre
            s&apos;arrête à la fin de la période payée.
          </p>
        </Section>

        <Section numero={5} titre="Résiliation en ligne">
          <p className="mt-2 text-muted">
            Tu résilies à tout moment, en ligne, en quelques clics&nbsp;: sur ton{" "}
            <Link href="/moi" className={lien}>
              tableau de bord
            </Link>
            , «&nbsp;Gérer ou résilier mon abonnement&nbsp;» ouvre ton espace d&apos;abonnement Stripe, où se trouve le bouton de
            résiliation. Elle prend effet à la fin de la période déjà payée, sans frais&nbsp;; ton offre reste active
            jusque-là.
          </p>
        </Section>

        <Section numero={6} titre="Droit de rétractation">
          <p className="mt-2 text-muted">
            Tu disposes de {DELAI_RETRACTATION_JOURS}&nbsp;jours à compter de la souscription pour te rétracter, sans
            avoir à te justifier (Code de la consommation, article L221-18).
          </p>
          <p className="mt-2 text-muted">
            En t&apos;abonnant, tu demandes expressément que ton offre commence tout de suite, avant la fin de ce délai
            (case à cocher avant le paiement). Si tu te rétractes ensuite, tu es remboursé du prix payé, moins la part
            correspondant aux jours déjà écoulés de ta période (article L221-25). Le remboursement est fait dans les
            14&nbsp;jours qui suivent ta demande, sur le moyen de paiement utilisé.
          </p>
          <p className="mt-2 text-muted">
            Pour te rétracter, écris à l&apos;adresse indiquée dans les{" "}
            <Link href="/mentions-legales" className={lien}>
              mentions légales
            </Link>{" "}
            une déclaration claire, ou recopie le modèle ci-dessous&nbsp;:
          </p>
          <blockquote className="mt-3 border-l-2 border-line-strong pl-4 text-text-2">
            À l&apos;attention de l&apos;éditeur de Najarena (adresse des mentions légales)&nbsp;: je vous notifie par la
            présente ma rétractation du contrat portant sur l&apos;abonnement [Plus, Pro ou Organisateur], souscrit le
            [date], au nom de [nom], pseudo Najarena [pseudo], adresse e-mail du compte [adresse]. Date.
          </blockquote>
        </Section>

        <Section numero={7} titre="Factures">
          <p className="mt-2 text-muted">
            Tes factures sont envoyées par Stripe à chaque paiement et restent disponibles dans ton espace
            d&apos;abonnement («&nbsp;Gérer ou résilier mon abonnement&nbsp;» sur ton tableau de bord).
          </p>
        </Section>

        <Section numero={8} titre="Réclamations et médiation">
          <p className="mt-2 text-muted">
            Pour toute réclamation, écris d&apos;abord à l&apos;adresse indiquée dans les{" "}
            <Link href="/mentions-legales" className={lien}>
              mentions légales
            </Link>
            . Si la réponse ne te satisfait pas, tu peux saisir gratuitement un médiateur de la consommation
            {MEDIATEUR ? (
              <>
                &nbsp;:{" "}
                <a href={MEDIATEUR.site} className={lien} rel="noopener noreferrer">
                  {MEDIATEUR.nom}
                </a>
                .
              </>
            ) : (
              <>&nbsp;; le médiateur de Najarena sera indiqué ici avant l&apos;ouverture des paiements.</>
            )}
          </p>
        </Section>

        <Section numero={9} titre="Droit applicable">
          <p className="mt-2 text-muted">
            Ces conditions sont soumises au droit français. En cas de litige, tu peux saisir le tribunal du lieu de
            ton domicile.
          </p>
        </Section>
      </div>
    </main>
  );
}
