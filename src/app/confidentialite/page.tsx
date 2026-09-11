import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de confidentialité — Najarena",
  description: "Politique de confidentialité et protection des données personnelles sur Najarena.",
};

export default function ConfidentialitePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link
        href="/"
        className="font-mono text-[0.66rem] tracking-[0.18em] text-ardoise uppercase hover:text-encre"
      >
        Najarena
      </Link>

      <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight text-encre">
        Politique de confidentialité
      </h1>

      <div className="mt-8 flex flex-col gap-8 text-sm leading-relaxed text-encre">
        <section>
          <h2 className="font-display text-lg font-extrabold tracking-tight text-encre">
            Responsable du traitement
          </h2>
          <p className="mt-2 text-ardoise">
            Robbie Kammerer, éditeur du site (voir les{" "}
            <Link href="/mentions-legales" className="text-encre underline underline-offset-3">
              mentions légales
            </Link>
            ), est responsable du traitement des données personnelles
            collectées sur Najarena. Pour toute question ou pour exercer tes
            droits, écris à{" "}
            <a href="mailto:robbie.kammerer@gmail.com" className="text-encre underline underline-offset-3">
              robbie.kammerer@gmail.com
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-extrabold tracking-tight text-encre">
            Données collectées
          </h2>
          <ul className="mt-2 flex flex-col gap-1.5 text-ardoise">
            <li>Adresse e-mail et mot de passe (le mot de passe n&apos;est jamais stocké en clair, seul son hachage l&apos;est).</li>
            <li>Pseudo, identifiant public (slug), pays si renseigné.</li>
            <li>Identifiant Discord, si renseigné.</li>
            <li>Riot ID (nom de jeu, tag, région) et identifiant Riot stable (puuid), une fois lié.</li>
            <li>Historique de tournois, de matchs et de résultats.</li>
            <li>Journal des variations de classement (public par nature, cf. CGU).</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-lg font-extrabold tracking-tight text-encre">
            Finalités et base légale
          </h2>
          <p className="mt-2 text-ardoise">
            Ces données sont utilisées pour créer et gérer ton compte,
            t&apos;inscrire à des tournois, calculer et afficher ton
            classement, et t&apos;envoyer des notifications liées aux
            tournois (Discord). Ce traitement repose sur l&apos;exécution du
            contrat qui te lie à Najarena (les{" "}
            <Link href="/cgu" className="text-encre underline underline-offset-3">
              CGU
            </Link>
            ) et, pour le Riot ID, sur ton consentement explicite au moment
            de la liaison.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-extrabold tracking-tight text-encre">
            Destinataires des données
          </h2>
          <p className="mt-2 text-ardoise">Tes données sont partagées avec :</p>
          <ul className="mt-2 flex flex-col gap-1.5 text-ardoise">
            <li>
              <strong className="text-encre">Supabase</strong> — hébergement de la base de
              données et de l&apos;authentification, dans l&apos;Union
              européenne (région Paris).
            </li>
            <li>
              <strong className="text-encre">Riot Games, Inc.</strong> (États-Unis) — pour
              résoudre ton Riot ID et lire les données de jeu officielles.
            </li>
            <li>
              <strong className="text-encre">Discord Inc.</strong> — pour les notifications de
              tournoi, si tu as lié ton identifiant Discord.
            </li>
            <li>
              <strong className="text-encre">Vercel Inc.</strong> — hébergement du site (voir
              les mentions légales).
            </li>
          </ul>
          <p className="mt-2 text-ardoise">
            Ton pseudo, ton palier, ton historique de matchs et le journal de
            tes points sont publics par nature : c&apos;est le principe même
            du profil vérifié Najarena. Ton e-mail et ton mot de passe ne
            sont jamais rendus publics.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-extrabold tracking-tight text-encre">
            Cookies
          </h2>
          <p className="mt-2 text-ardoise">
            Najarena utilise uniquement des cookies strictement nécessaires
            au fonctionnement du site : ceux qui maintiennent ta session
            connectée. Aucun cookie publicitaire ou de mesure d&apos;audience
            n&apos;est déposé.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-extrabold tracking-tight text-encre">
            Durée de conservation
          </h2>
          <p className="mt-2 text-ardoise">
            Tes données de compte sont conservées tant que ton compte est
            actif. En cas de suppression de compte, tes données
            d&apos;identification sont effacées ; le journal public des
            points et les résultats de matchs auxquels tu as participé
            restent conservés, conformément au principe de classement
            incontestable et permanent décrit dans les CGU.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-extrabold tracking-tight text-encre">
            Tes droits
          </h2>
          <p className="mt-2 text-ardoise">
            Conformément au RGPD, tu disposes d&apos;un droit d&apos;accès,
            de rectification, d&apos;effacement, de limitation, de
            portabilité et d&apos;opposition sur tes données personnelles.
            Pour les exercer, écris à{" "}
            <a href="mailto:robbie.kammerer@gmail.com" className="text-encre underline underline-offset-3">
              robbie.kammerer@gmail.com
            </a>
            . Tu peux aussi introduire une réclamation auprès de la CNIL
            (cnil.fr).
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-extrabold tracking-tight text-encre">
            Sécurité
          </h2>
          <p className="mt-2 text-ardoise">
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
