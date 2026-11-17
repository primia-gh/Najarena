import Link from "next/link";
import type { Metadata } from "next";
import { cashPrizesActifs } from "@/lib/dotations";

export const metadata: Metadata = {
  title: "Politique de confidentialité — Najarena",
  description: "Politique de confidentialité et protection des données personnelles sur Najarena.",
};

export default function ConfidentialitePage() {
  return (
    <main className="px-grille *:max-w-3xl pt-32 pb-24 font-texte text-text">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center font-texte text-xs tracking-[3px] text-muted uppercase hover:text-text"
      >
        Najarena
      </Link>

      <h1 className="mt-6 font-titre uppercase text-section font-black tracking-[1px] text-text hyphens-auto [overflow-wrap:anywhere]">
        Politique de confidentialité
      </h1>
      <p className="mt-2 text-sm text-muted">Dernière mise à jour&nbsp;: 12&nbsp;octobre 2026.</p>

      <div className="mt-8 flex flex-col gap-8 text-sm leading-relaxed text-text [&_strong]:font-medium [&_strong]:text-text">
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
            <li><strong>Adresse e-mail et mot de passe</strong> (le mot de passe n&apos;est jamais stocké en clair, seul son hachage l&apos;est).</li>
            <li><strong>Connexion via Discord</strong>&nbsp;: si tu l&apos;utilises, ton identifiant Discord, ton nom d&apos;utilisateur et l&apos;e-mail associé à ton compte Discord.</li>
            <li><strong>Profil</strong>&nbsp;: pseudo, identifiant public (slug), pays si renseigné.</li>
            <li>
              <strong>Compte Riot</strong>&nbsp;: Riot ID (nom de jeu, tag, région) et identifiant Riot stable (puuid), une fois lié — y compris les
              comptes secondaires que tu déclares, affichés sur ton profil une fois vérifiés.
            </li>
            <li><strong>Historique</strong>&nbsp;: tournois, matchs et résultats.</li>
            <li>
              <strong>Bio et lien du CV</strong>&nbsp;: avec l&apos;offre Vérifié ou plus, la bio et le lien externe que tu
              ajoutes sont publics sur ton CV (le lien y apparaît par le nom de son site).
            </li>
            <li>
              <strong>Tournois 5v5 et scrims</strong>&nbsp;: les cinq joueurs alignés par chaque équipe, publics comme une inscription&nbsp;;
              les statistiques de partie (champion, KDA, sbires, or) des dix joueurs d&apos;un match vérifié. Une
              proposition de scrim n&apos;est visible que des deux capitaines&nbsp;; un scrim accepté est public. La
              liste des agents libres d&apos;un tournoi (pseudo, rôle choisi) est publique, comme l&apos;échéance
              visée par une annonce «&nbsp;cherche une équipe&nbsp;».
            </li>
            <li>
              <strong>Statistiques des parties vérifiées</strong>&nbsp;: lues chez Riot avec le résultat (champion, poste, KDA, sbires, or,
              dégâts, vision, objets, runes et sorts d&apos;invocateur). Comme chez Riot, celles d&apos;un match sont
              publiques. Elles servent à ton bilan (forces, axes de travail, builds), visible de toi seul, et, sans ton
              nom, aux moyennes de référence calculées sur l&apos;ensemble des parties vérifiées.
            </li>
            <li>
              <strong>Parties classées</strong>&nbsp;: seulement si tu le demandes depuis ton bilan, Najarena lit chez Riot tes parties classées
              (Solo/Duo et Flexible) et ton rang, et garde les chiffres de ta partie (champion, poste, farm, dégâts,
              vision, objets, runes, écart d&apos;or à 15&nbsp;minutes) et le lieu de chacune de tes morts, 100&nbsp;parties au plus.
              Elles ne comptent jamais pour le classement et ne sont visibles que de toi&nbsp;; les autres joueurs n&apos;en
              voient que des moyennes anonymes (5&nbsp;joueurs au moins). Retirer ton accord les efface, avec ton rang.
            </li>
            <li>
              <strong>Bilan de la semaine</strong>&nbsp;: si tu le demandes (offre Elite), un message privé Discord chaque lundi, avec tes
              chiffres de la semaine&nbsp;; Najarena garde la date de chaque envoi.
            </li>
            <li>
              <strong>Défis</strong>&nbsp;: qui a défié qui, quand, et la réponse. Visibles des deux joueurs seulement&nbsp;; un défi
              relevé devient un duel public, comme un match de tournoi. Ta place dans la file de l&apos;arène (heure
              d&apos;entrée, rating et région) n&apos;est visible que de toi et disparaît au plus tard
              après 30&nbsp;minutes.
            </li>
            <li>
              <strong>Widgets et API publique</strong>&nbsp;: ce qui est déjà public sur ton CV et sur les pages de tournoi (pseudo, rating
              une fois classé, palier, matchs vérifiés, brackets) peut aussi être affiché sur d&apos;autres sites ou lu en
              JSON. Rien de plus&nbsp;: ni Riot ID, ni données de compte.
            </li>
            <li>
              <strong>Communautés</strong>&nbsp;: la liste des membres d&apos;une communauté (pseudo, rôle, date d&apos;arrivée) est publique,
              comme son classement interne (rating officiel des membres classés). Pour un serveur Discord lié, seul son
              identifiant technique est conservé, pas la liste de ses membres.
            </li>
            <li>
              <strong>Écoles</strong>&nbsp;: pour être membre vérifié d&apos;une école, tu saisis ton adresse de l&apos;établissement&nbsp;; un
              code y est envoyé. Najarena ne garde que le domaine de l&apos;adresse et une empreinte calculée à partir
              d&apos;elle (qui sert seulement à empêcher qu&apos;une même adresse vérifie deux comptes), jamais
              l&apos;adresse elle-même. Le badge «&nbsp;vérifié&nbsp;» de la liste des membres est public.
            </li>
            <li>
              <strong>Coach</strong>&nbsp;: un joueur classé Diamant ou plus n&apos;apparaît comme coach que s&apos;il a coché «&nbsp;J&apos;accepte des élèves&nbsp;».
              Un suivi accepté est public sur le CV du coach&nbsp;: pseudo de l&apos;élève, dates du suivi, nombre de
              tournois et somme des points pendant le suivi (ces points sont déjà publics dans le registre). Il le
              reste après la fin du suivi, même si le coach décoche sa case. Une demande en attente n&apos;est visible
              que du coach et de l&apos;élève.
            </li>
            <li>
              <strong>Recommandations</strong>&nbsp;: une recommandation est publique sur le CV du joueur recommandé, avec le pseudo de son
              auteur&nbsp;; le joueur recommandé peut la masquer. Najarena garde la liste des joueurs que tu as recommandés,
              même après un retrait, pour limiter les envois répétés.
            </li>
            <li>
              <strong>Divisions</strong>&nbsp;: ton inscription, ta poule, tes rencontres (y compris l&apos;heure où tu as cliqué «&nbsp;Je suis
              là&nbsp;») et ton classement final sont publics.
            </li>
            <li>
              <strong>Tournois à la demande</strong>&nbsp;: les heures que tu indiques ne sont visibles que de toi&nbsp;; seul le nombre de
              joueurs disponibles par heure est public. Elles sont effacées une fois passées.
            </li>
            <li>
              <strong>Bourse aux remplaçants</strong>&nbsp;: ton pseudo et ton rôle sont publics sur la page du tournoi tant que tu y es
              inscrit&nbsp;; un remplacement est public comme un alignement.
            </li>
            <li>
              <strong>Fiabilité</strong>&nbsp;: ton taux de check-in, ton délai pour «&nbsp;Je suis prêt&nbsp;», tes forfaits et tes défaites
              reconnues sont calculés à partir de tes matchs et affichés sur ton CV (à partir de 3&nbsp;tournois
              ou 3&nbsp;matchs).
            </li>
            <li>
              <strong>Certificats et fiches de preuve</strong>&nbsp;: un certificat que tu émets toi-même est un instantané daté de ton
              pseudo, de ton rating, de ton palier et de tes matchs vérifiés, figé et signé numériquement, lisible par
              toute personne qui a son lien. La fiche de preuve d&apos;un match montre le
              verdict, l&apos;identifiant de la partie chez Riot et les Riot ID des comptes liés, déjà publics sur le
              CV.
            </li>
            <li>
              <strong>Pronostics</strong>&nbsp;: ton choix pour chaque match n&apos;est visible que de toi&nbsp;; seule la répartition des
              pronostics d&apos;un match est publique. Si un de tes pronostics est tranché, ton pseudo, tes points
              et ton nombre de pronostics justes apparaissent dans le classement public des pronostiqueurs.
            </li>
            <li>
              <strong>Modération</strong>&nbsp;: les textes que tu saisis (pseudo, noms, annonces, messages, motifs de litige) sont
              analysés automatiquement avant publication. Un message privé ou un motif retenu (insulte, menace, lien)
              est lu par un administrateur avant d&apos;être remis&nbsp;; l&apos;extrait et la décision sont conservés.
            </li>
            <li><strong>Journal des points</strong>&nbsp;: les variations de ton classement (public par nature, cf. CGU).</li>
            <li>
              <strong>Consentement</strong>&nbsp;: date et version des CGU acceptées, et de la confirmation d&apos;âge
              (case cochée à l&apos;inscription).
            </li>
            <li>
              <strong>Visites de profil</strong>&nbsp;: quand tu consultes le profil d&apos;un joueur en étant connecté
              (voir «&nbsp;Visites de profil&nbsp;» ci-dessous).
            </li>
            <li><strong>Messages privés</strong>&nbsp;: ceux que tu échanges avec d&apos;autres membres via la messagerie.</li>
            <li>
              <strong>Liste de suivi des recruteurs</strong> (offre Organisateur)&nbsp;: les profils publics qu&apos;un
              recruteur choisit de suivre.
            </li>
            <li>
              <strong>Notifications</strong>&nbsp;: si tu les actives, l&apos;adresse technique d&apos;abonnement de ton
              navigateur, pour t&apos;envoyer les rappels de tournoi.
            </li>
            <li>
              <strong>Offre payante</strong>&nbsp;: si tu en souscris une, ton identifiant client et l&apos;état de ton
              abonnement chez Stripe (jamais tes coordonnées bancaires).
            </li>
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
            de la liaison. L&apos;enregistrement des visites de profil, la
            liste de suivi des recruteurs et la mesure d&apos;audience reposent
            sur l&apos;intérêt légitime de Najarena (mise en relation entre
            joueurs et équipes, amélioration du site), avec un droit
            d&apos;opposition. Les notifications push reposent sur ton
            consentement, retirable à tout moment.
          </p>
        </section>

        <section>
          <h2 className="font-titre uppercase text-lg font-extrabold tracking-tight text-text">
            Visites de profil
          </h2>
          <p className="mt-2 text-muted">
            Quand tu consultes le profil d&apos;un joueur en étant connecté, ta
            visite (ton pseudo et la date) est enregistrée. Ce joueur la voit
            dans «&nbsp;Qui a vu ton profil&nbsp;» s&apos;il a l&apos;offre Vérifié. Tu
            peux t&apos;y opposer à tout moment depuis{" "}
            <Link href="/moi/profil" className="text-text underline underline-offset-3">
              Modifier mon profil
            </Link>{" "}
            (visites anonymes)&nbsp;: tes visites déjà enregistrées sont alors
            effacées. Un visiteur non connecté n&apos;est jamais enregistré.
          </p>
        </section>

        <section>
          <h2 className="font-titre uppercase text-lg font-extrabold tracking-tight text-text">
            Messagerie et liste de suivi
          </h2>
          <p className="mt-2 text-muted">
            Les messages privés ne sont affichés qu&apos;aux deux participants
            de la conversation. La liste de suivi d&apos;un recruteur
            n&apos;est visible que par lui&nbsp;; elle ne contient que des profils
            déjà publics.
          </p>
        </section>

        <section>
          <h2 className="font-titre uppercase text-lg font-extrabold tracking-tight text-text">
            Destinataires des données
          </h2>
          <p className="mt-2 text-muted">Tes données sont partagées avec&nbsp;:</p>
          <ul className="mt-2 flex flex-col gap-1.5 text-muted">
            <li>
              <strong>Supabase</strong> — hébergement de la base de
              données et de l&apos;authentification, dans l&apos;Union
              européenne (région Paris).
            </li>
            <li>
              <strong>Riot Games, Inc.</strong> (États-Unis) — pour
              résoudre ton Riot ID et lire les données de jeu officielles. Sur les pages de bilan et de
              liaison du Riot ID, les icônes du jeu (champions, objets, runes, sorts, icône de profil) sont
              chargées par ton navigateur directement depuis Data Dragon, le serveur d&apos;images public de
              Riot&nbsp;: il reçoit ton adresse IP, comme tout site dont une page affiche une image.
            </li>
            <li>
              <strong>Vercel Inc.</strong> — hébergement du site (voir
              les mentions légales).
            </li>
            <li>
              <strong>Discord Inc.</strong> (États-Unis) — uniquement si
              tu utilises la connexion via Discord. Par ailleurs, l&apos;annonce d&apos;un
              nouveau tournoi ou de son vainqueur peut être publiée sur un
              serveur Discord communautaire&nbsp;; ce message ne contient que des
              informations déjà publiques sur le site (nom du tournoi,
              pseudo, résultat), jamais ton e-mail ni tes données de compte.
            </li>
            <li>
              <strong>Stripe</strong> — uniquement si tu souscris à un
              palier payant&nbsp;: ton identifiant Najarena et ton e-mail lui sont transmis. Tes
              coordonnées bancaires sont saisies directement chez Stripe et ne passent jamais
              par Najarena.
            </li>
            {/* Cash prizes (audit N32) : seulement une fois activés. */}
            {cashPrizesActifs() && (
              <li>
                <strong>Stripe (versement des cash prizes)</strong> — uniquement si
                tu gagnes une dotation et en demandes le versement&nbsp;: ton identifiant Najarena, ton e-mail et
                ton pays de résidence lui sont transmis, et Stripe vérifie lui-même ton identité et tes
                coordonnées bancaires. Najarena ne garde que l&apos;identifiant de ton compte Stripe et
                l&apos;état de la vérification.
              </li>
            )}
            <li>
              <strong>Resend</strong> — envoi des e-mails de notification
              liés à ton activité (invitation d&apos;équipe, inscription confirmée, résultat,
              litige, message reçu) et du code de vérification d&apos;une adresse d&apos;école&nbsp;:
              l&apos;adresse e-mail et le contenu du message lui sont transmis.
            </li>
            <li>
              <strong>Vercel Web Analytics et Speed Insights</strong> —
              mesure d&apos;audience et de performance des pages, anonymisée et sans cookie.
            </li>
            <li>
              <strong>Sentry</strong> (États-Unis) — suivi des erreurs
              techniques du site&nbsp;: page concernée, navigateur, message d&apos;erreur. Ni ton
              e-mail ni ton mot de passe ne lui sont transmis.
            </li>
            <li>
              <strong>Anthropic</strong> (États-Unis) — uniquement quand une
              fonction d&apos;IA est utilisée&nbsp;: le texte saisi dans l&apos;assistant de création de
              tournoi ou dans la recherche de joueurs&nbsp;; les statistiques Riot d&apos;un match
              (champion, KDA, sbires, or, durée) pour son analyse détaillée, demandée par le joueur
              ou rédigée automatiquement après chaque partie vérifiée d&apos;un abonné Elite&nbsp;; les faits d&apos;un litige (pseudos, Riot ID, horaires, parties Riot
              retrouvées, motif du litige) pour son dossier. Ni e-mail, ni mot de passe, ni moyen
              de paiement ne lui sont envoyés, et l&apos;IA n&apos;écrit aucun résultat.
            </li>
          </ul>
          <p className="mt-2 text-muted">
            Plusieurs de ces prestataires (Riot Games, Vercel, Discord, Stripe,
            Resend, Sentry, Anthropic) sont établis aux États-Unis ou y
            traitent des données. Ces transferts hors de l&apos;Union
            européenne s&apos;appuient sur le cadre de protection des données
            UE–États-Unis (Data Privacy Framework) lorsque le prestataire y
            adhère, et à défaut sur les clauses contractuelles types de la
            Commission européenne prévues dans ses conditions de traitement
            des données.
          </p>
          <p className="mt-2 text-muted">
            Ton pseudo, ton palier, ton historique de matchs et le journal de
            tes points sont publics par nature&nbsp;: c&apos;est le principe même
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
            au fonctionnement du site&nbsp;: ceux qui maintiennent ta session
            connectée, et un cookie temporaire (10&nbsp;minutes) qui garde ta
            confirmation d&apos;âge et d&apos;acceptation des CGU pendant une
            connexion via Discord. Aucun cookie publicitaire ou de mesure
            d&apos;audience n&apos;est déposé&nbsp;: la mesure d&apos;audience de
            Vercel fonctionne sans cookie.
          </p>
        </section>

        <section>
          <h2 className="font-titre uppercase text-lg font-extrabold tracking-tight text-text">
            Durée de conservation
          </h2>
          <p className="mt-2 text-muted">
            Tes données de compte sont conservées tant que ton compte est
            actif. Tu peux le supprimer toi-même depuis{" "}
            <Link href="/moi/profil" className="text-text underline underline-offset-3">
              Modifier mon profil
            </Link>
            &nbsp;: tes données d&apos;identification (pseudo, e-mail, pays,
            Discord, compte Riot) sont alors effacées&nbsp;; le journal public des
            points et les résultats de matchs auxquels tu as participé
            restent conservés sous un pseudo anonyme, conformément au principe
            de classement incontestable et permanent décrit dans les CGU, de
            même que les messages déjà envoyés à d&apos;autres membres.
          </p>
          <ul className="mt-2 flex flex-col gap-1.5 text-muted">
            <li><strong>Visites de profil</strong>&nbsp;: jusqu&apos;à ce que tu passes en visites anonymes, ou jusqu&apos;à la suppression de ton compte.</li>
            <li><strong>Messages privés</strong>&nbsp;: tant que ton compte existe.</li>
            <li><strong>Certificats de niveau</strong>&nbsp;: tant que ton compte existe (effacés avec lui).</li>
            <li><strong>Abonnements aux notifications</strong>&nbsp;: jusqu&apos;à leur désactivation, ou dès que ton navigateur les révoque.</li>
            <li><strong>Tentatives de connexion échouées</strong> (adresse e-mail et adresse IP, protection contre les essais de mots de passe)&nbsp;: 24&nbsp;heures.</li>
            <li><strong>Demandes à l&apos;assistant de création de tournoi</strong>&nbsp;: la date de chaque demande seulement, 7&nbsp;jours (limite de 10&nbsp;demandes par jour).</li>
            <li><strong>Vérification d&apos;une adresse d&apos;école</strong>&nbsp;: la demande en attente (domaine, empreinte de l&apos;adresse et du code) est effacée dès la vérification, ou au plus tard 24&nbsp;heures après l&apos;expiration du code&nbsp;; une fois vérifié, le domaine et l&apos;empreinte restent tant que tu es membre de l&apos;école.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-titre uppercase text-lg font-extrabold tracking-tight text-text">
            Tes droits
          </h2>
          <p className="mt-2 text-muted">
            Conformément au RGPD, tu disposes d&apos;un droit d&apos;accès,
            de rectification, d&apos;effacement, de limitation, de
            portabilité et d&apos;opposition sur tes données personnelles.
            Ton pseudo, ton pays et tes visites anonymes se modifient
            directement depuis{" "}
            <Link href="/moi/profil" className="text-text underline underline-offset-3">
              Modifier mon profil
            </Link>
            . Pour tout le reste, écris à{" "}
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
            au niveau de chaque ligne de la base de données (RLS)&nbsp;: un
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
