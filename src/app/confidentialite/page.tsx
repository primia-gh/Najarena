import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de confidentialité — Najarena",
  description: "Politique de confidentialité et protection des données personnelles sur Najarena.",
};

export default function ConfidentialitePage() {
  return (
    <main className="mx-auto max-w-3xl px-gouttiere pt-32 pb-24 font-texte text-text">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center font-texte text-xs tracking-[3px] text-muted uppercase hover:text-text"
      >
        Najarena
      </Link>

      <h1 className="mt-6 font-titre uppercase text-section font-black tracking-[1px] text-text hyphens-auto [overflow-wrap:anywhere]">
        Politique de confidentialité
      </h1>

      <div className="mt-8 flex flex-col gap-8 text-sm leading-relaxed text-text">
        <section>
          <h2 className="font-titre uppercase text-lg font-extrabold tracking-tight text-text">
            Responsable du traitement
          </h2>
          <p className="mt-2 text-muted">
            Robbie Kammerer, éditeur du site (voir les{" "}
            <Link href="/mentions-legales" className="text-text underline underline-offset-3">
              mentions légales
            </Link>
            ), est responsable du traitement des données personnelles
            collectées sur Najarena. Pour toute question ou pour exercer tes
            droits, écris à{" "}
            <a href="mailto:robbie.kammerer@gmail.com" className="text-text underline underline-offset-3">
              robbie.kammerer@gmail.com
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="font-titre uppercase text-lg font-extrabold tracking-tight text-text">
            Données collectées
          </h2>
          <ul className="mt-2 flex flex-col gap-1.5 text-muted">
            <li>Adresse e-mail et mot de passe (le mot de passe n&apos;est jamais stocké en clair, seul son hachage l&apos;est).</li>
            <li>Si tu te connectes via Discord : ton identifiant Discord, ton nom d&apos;utilisateur et l&apos;e-mail associé à ton compte Discord.</li>
            <li>Pseudo, identifiant public (slug), pays si renseigné.</li>
            <li>Riot ID (nom de jeu, tag, région) et identifiant Riot stable (puuid), une fois lié.</li>
            <li>Historique de tournois, de matchs et de résultats.</li>
            <li>Journal des variations de classement (public par nature, cf. CGU).</li>
          </ul>
        </section>

        <section>
          <h2 className="font-titre uppercase text-lg font-extrabold tracking-tight text-text">
            Finalités et base légale
          </h2>
          <p className="mt-2 text-muted">
            Ces données sont utilisées pour créer et gérer ton compte,
            t&apos;inscrire à des tournois, et calculer et afficher ton
            classement. Ce traitement repose sur l&apos;exécution du
            contrat qui te lie à Najarena (les{" "}
            <Link href="/cgu" className="text-text underline underline-offset-3">
              CGU
            </Link>
            ) et, pour le Riot ID, sur ton consentement explicite au moment
            de la liaison.
          </p>
        </section>

        <section>
          <h2 className="font-titre uppercase text-lg font-extrabold tracking-tight text-text">
            Destinataires des données
          </h2>
          <p className="mt-2 text-muted">Tes données sont partagées avec :</p>
          <ul className="mt-2 flex flex-col gap-1.5 text-muted">
            <li>
              <strong className="text-text">Supabase</strong> — hébergement de la base de
              données et de l&apos;authentification, dans l&apos;Union
              européenne (région Paris).
            </li>
            <li>
              <strong className="text-text">Riot Games, Inc.</strong> (États-Unis) — pour
              résoudre ton Riot ID et lire les données de jeu officielles.
            </li>
            <li>
              <strong className="text-text">Vercel Inc.</strong> — hébergement du site (voir
              les mentions légales).
            </li>
            <li>
              <strong className="text-text">Discord Inc.</strong> (États-Unis) — uniquement si
              tu utilises la connexion via Discord. Par ailleurs, l&apos;annonce d&apos;un
              nouveau tournoi ou de son vainqueur peut être publiée sur un
              serveur Discord communautaire ; ce message ne contient que des
              informations déjà publiques sur le site (nom du tournoi,
              pseudo, résultat), jamais ton e-mail ni tes données de compte.
            </li>
            <li>
              <strong className="text-text">Stripe</strong> — uniquement si tu souscris à un
              palier payant : ton identifiant Najarena et ton e-mail lui sont transmis. Tes
              coordonnées bancaires sont saisies directement chez Stripe et ne passent jamais
              par Najarena.
            </li>
            <li>
              <strong className="text-text">Resend</strong> — envoi des e-mails de notification
              liés à ton activité (invitation d&apos;équipe, inscription confirmée, résultat,
              litige, message reçu) : ton adresse e-mail et le contenu de la notification lui
              sont transmis.
            </li>
            <li>
              <strong className="text-text">Anthropic</strong> (États-Unis) — uniquement si tu es
              organisateur et que tu utilises l&apos;assistant de création de tournoi : le texte
              que tu y saisis lui est transmis pour produire la suggestion. Aucun résultat,
              classement ni donnée de compte ne lui est envoyé.
            </li>
          </ul>
          <p className="mt-2 text-muted">
            Ton pseudo, ton palier, ton historique de matchs et le journal de
            tes points sont publics par nature : c&apos;est le principe même
            du profil vérifié Najarena. Ton e-mail et ton mot de passe ne
            sont jamais rendus publics.
          </p>
        </section>

        <section>
          <h2 className="font-titre uppercase text-lg font-extrabold tracking-tight text-text">
            Cookies
          </h2>
          <p className="mt-2 text-muted">
            Najarena utilise uniquement des cookies strictement nécessaires
            au fonctionnement du site : ceux qui maintiennent ta session
            connectée. Aucun cookie publicitaire ou de mesure d&apos;audience
            n&apos;est déposé.
          </p>
        </section>

        <section>
          <h2 className="font-titre uppercase text-lg font-extrabold tracking-tight text-text">
            Durée de conservation
          </h2>
          <p className="mt-2 text-muted">
            Tes données de compte sont conservées tant que ton compte est
            actif. En cas de suppression de compte, tes données
            d&apos;identification sont effacées ; le journal public des
            points et les résultats de matchs auxquels tu as participé
            restent conservés, conformément au principe de classement
            incontestable et permanent décrit dans les CGU.
          </p>
        </section>

        <section>
          <h2 className="font-titre uppercase text-lg font-extrabold tracking-tight text-text">
            Tes droits
          </h2>
          <p className="mt-2 text-muted">
            Conformément au RGPD, tu disposes d&apos;un droit d&apos;accès,
            de rectification, d&apos;effacement, de limitation, de
            portabilité et d&apos;opposition sur tes données personnelles.
            Pour les exercer, écris à{" "}
            <a href="mailto:robbie.kammerer@gmail.com" className="text-text underline underline-offset-3">
              robbie.kammerer@gmail.com
            </a>
            . Tu peux aussi introduire une réclamation auprès de la CNIL
            (cnil.fr).
          </p>
        </section>

        <section>
          <h2 className="font-titre uppercase text-lg font-extrabold tracking-tight text-text">
            Sécurité
          </h2>
          <p className="mt-2 text-muted">
            L&apos;accès aux données est protégé par des règles de sécurité
            au niveau de chaque ligne de la base de données (RLS) : un
            utilisateur ne peut lire ou modifier que ce que ces règles
            autorisent explicitement. Les données de classement les plus
            sensibles ne sont jamais modifiables directement par un client,
            uniquement par des fonctions serveur contrôlées.
          </p>
        </section>
      </div>
    </main>
  );
}
