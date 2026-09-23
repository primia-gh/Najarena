import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import BoutonLien from "@/components/design/BoutonLien";
import BoutonEnvoi from "@/components/design/BoutonEnvoi";
import { BadgeChercheEquipe, BadgeEnDirect, BadgeVerdict, BadgeVerifie } from "@/components/design/Badges";
import PastilleResultat from "@/components/design/PastilleResultat";
import ChiffreRating from "@/components/design/ChiffreRating";
import IndicateurConfiance from "@/components/design/IndicateurConfiance";
import Panneau from "@/components/design/Panneau";
import LibelleSection from "@/components/design/LibelleSection";
import NumeroFiligrane from "@/components/design/NumeroFiligrane";
import Tableau from "@/components/design/Tableau";
import Icone, { type NomIcone } from "@/components/design/Icone";
import Logo from "@/components/design/Logo";
import AfficheTournoi from "@/components/vitrine/AfficheTournoi";
import ApercuClassement, { type LigneClassement } from "@/components/vitrine/ApercuClassement";

// Charte vivante de la nouvelle identité : chaque composant de
// components/design/ rendu tel qu'il sortira sur le site, pour valider la
// refonte sans ouvrir le code. Page interne — jamais indexée, et absente
// du site en ligne (VERCEL_ENV=production) : visible en local et sur les
// déploiements de prévisualisation uniquement. Les valeurs affichées sont
// des exemples, jamais des données réelles.

export const metadata: Metadata = {
  title: "Charte graphique — Najarena",
  robots: { index: false, follow: false },
};

const COULEURS = [
  { jeton: "bg", valeur: "#080908", role: "Fond de page" },
  { jeton: "bg-alt", valeur: "#0C0D0C", role: "Sections alternées" },
  { jeton: "surface", valeur: "#131513 → #0D0F0D", role: "Panneaux" },
  { jeton: "text", valeur: "#F5F5F4", role: "Texte principal" },
  { jeton: "text-2", valeur: "#B9BEB9", role: "Paragraphes" },
  { jeton: "muted", valeur: "#9CA39C", role: "Libellés" },
  { jeton: "faint", valeur: "#798079", role: "En-têtes de tableaux" },
  { jeton: "accent", valeur: "#B6FF3B", role: "Vert Venin — rare" },
  { jeton: "danger", valeur: "#FF4D4F", role: "Défaites, erreurs" },
];

const ECHANTILLON: Record<string, string> = {
  bg: "bg-bg",
  "bg-alt": "bg-bg-alt",
  surface: "panneau",
  text: "bg-text",
  "text-2": "bg-text-2",
  muted: "bg-muted",
  faint: "bg-faint",
  accent: "bg-accent",
  danger: "bg-danger",
};

const ICONES: NomIcone[] = [
  "coche",
  "fleche-droite",
  "fleche-gauche",
  "bouclier",
  "joueur",
  "partager",
  "message",
  "crayon",
  "lecture",
  "cadenas",
  "oeil",
  "horloge",
  "eclat",
];

const AVATARS = ["01", "02", "03", "04", "05", "p1", "p2", "p3"];

const EXEMPLE_MATCHS: { res: "V" | "D"; date: string; tournoi: string; delta: string }[] = [
  { res: "V", date: "21/09", tournoi: "Coupe Venin", delta: "+18" },
  { res: "D", date: "20/09", tournoi: "Quotidienne du soir", delta: "−11" },
  { res: "V", date: "19/09", tournoi: "Quotidienne du soir", delta: "+14" },
];

const EXEMPLE_TOP: LigneClassement[] = [
  { pseudo: "Vipere", slug: null, avatarUrl: null, palier: "Champion", rating: 2214, tendance: "monte" },
  { pseudo: "Crochet", slug: null, avatarUrl: null, palier: "Champion", rating: 2187, tendance: "baisse" },
  { pseudo: "Mue", slug: null, avatarUrl: null, palier: "Diamant", rating: 1842, tendance: "stable" },
  { pseudo: "Ecaille", slug: null, avatarUrl: null, palier: "Platine", rating: 1655, tendance: "monte" },
];

function Bloc({ numero, titre, children }: { numero: string; titre: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-8 border-t border-line py-section-outil">
      <LibelleSection numero={numero} as="h2">
        {titre}
      </LibelleSection>
      {children}
    </section>
  );
}

export default function PageCharte() {
  if (process.env.VERCEL_ENV === "production") notFound();

  return (
    <main className="flex-1 bg-bg font-texte text-text">
      {/* pt-28 : la barre de navigation est fixe par-dessus le haut de page. */}
      <header className="relative isolate overflow-hidden px-gouttiere pt-28 pb-16">
        <div aria-hidden="true" className="fond-ecailles absolute inset-0 -z-10" />
        <div className="mx-auto flex max-w-contenu flex-col gap-6">
          <LibelleSection>Page interne · valeurs d&apos;exemple</LibelleSection>
          <h1 className="font-titre text-ouverture font-black uppercase">
            Charte <span className="text-accent">Venin.</span>
          </h1>
          <p className="max-w-[560px] text-courant text-text-2">
            Les briques de la nouvelle identité, telles qu&apos;elles s&apos;affichent sur le site. Source de vérité :
            design-system/najarena/MASTER.md.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-contenu px-gouttiere">
        <Bloc numero="01" titre="Couleurs">
          <ul className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
            {COULEURS.map((c) => (
              <li key={c.jeton} className="flex flex-col gap-3">
                <span className={`h-20 rounded-carte border border-line ${ECHANTILLON[c.jeton]}`} />
                <span className="text-sm font-semibold">{c.jeton}</span>
                <span className="text-xs text-muted tabular-nums">{c.valeur}</span>
                <span className="text-xs text-faint">{c.role}</span>
              </li>
            ))}
          </ul>
        </Bloc>

        <Bloc numero="02" titre="Typographie">
          <div className="flex flex-col gap-6">
            <p className="font-titre text-section font-black uppercase">Titre de section</p>
            <p className="font-titre text-sous-titre font-extrabold uppercase">Sous-titre de carte</p>
            <p className="max-w-[640px] text-courant text-text-2">
              Texte courant en Chakra Petch : joue des tournois, grimpe au classement et construis un CV e-sport
              vérifié.
            </p>
            <LibelleSection numero="03">Libellé de section</LibelleSection>
          </div>
        </Bloc>

        <Bloc numero="03" titre="Boutons">
          <div className="flex flex-wrap items-center gap-9">
            <BoutonLien href="/charte" taille="grande">
              Rejoindre Najarena
            </BoutonLien>
            <BoutonLien href="/charte">S&apos;inscrire</BoutonLien>
            <BoutonLien href="/charte" variante="secondaire">
              Tous les tournois
            </BoutonLien>
            <BoutonEnvoi type="button">Bouton de formulaire</BoutonEnvoi>
            <BoutonEnvoi type="button" disabled>
              Désactivé
            </BoutonEnvoi>
          </div>
        </Bloc>

        <Bloc numero="04" titre="Badges">
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-8">
              <BadgeVerifie>Profil vérifié</BadgeVerifie>
              <BadgeEnDirect />
              <BadgeChercheEquipe />
            </div>
            <p className="text-sm text-muted">Niveau de fiabilité des verdicts — version complète :</p>
            <div className="flex flex-wrap items-center gap-8">
              <BadgeVerdict niveau="code_tournoi" />
              <BadgeVerdict niveau="historique" />
              <BadgeVerdict niveau="manuel" />
            </div>
            <p className="text-sm text-muted">Version compacte (bracket) :</p>
            <div className="flex flex-wrap items-center gap-8">
              <BadgeVerdict niveau="code_tournoi" compact />
              <BadgeVerdict niveau="manuel" compact />
            </div>
          </div>
        </Bloc>

        <Bloc numero="05" titre="Rating et résultats">
          <div className="flex flex-wrap items-end gap-12">
            <div className="flex flex-col gap-2">
              <span className="text-mini uppercase text-muted">Rating</span>
              <ChiffreRating valeur={1842} />
            </div>
            <IndicateurConfiance estClasse pct={100} />
            <IndicateurConfiance estClasse={false} pct={45} />
            <div className="flex gap-2">
              <PastilleResultat resultat="V" />
              <PastilleResultat resultat="D" />
            </div>
          </div>
        </Bloc>

        <Bloc numero="06" titre="Tableau">
          <Tableau legende="Exemple d'historique de matchs">
            <thead>
              <tr>
                <th scope="col">Rés.</th>
                <th scope="col">Date</th>
                <th scope="col">Tournoi</th>
                <th scope="col">Verdict</th>
                <th scope="col" className="text-right">
                  Rating
                </th>
              </tr>
            </thead>
            <tbody>
              {EXEMPLE_MATCHS.map((m, i) => (
                <tr key={i}>
                  <td>
                    <PastilleResultat resultat={m.res} />
                  </td>
                  <td className="text-muted">{m.date}</td>
                  <td>{m.tournoi}</td>
                  <td>
                    <BadgeVerdict niveau={i === 1 ? "manuel" : "historique"} compact />
                  </td>
                  <td className={`text-right font-semibold ${m.res === "V" ? "text-accent" : "text-danger"}`}>
                    {m.delta}
                  </td>
                </tr>
              ))}
            </tbody>
          </Tableau>
        </Bloc>

        <Bloc numero="07" titre="Matières">
          <div className="grid gap-10 md:grid-cols-2">
            <Panneau className="flex flex-col gap-3 p-8">
              <span className="text-mini uppercase text-muted">Panneau</span>
              <p className="text-text-2">Dégradé, bordure fine, reflet en haut.</p>
            </Panneau>
            <Panneau reperes className="flex h-48 items-center justify-center p-8">
              <span className="text-xs text-faint">Visuel avec repères de visée</span>
            </Panneau>
            <div className="relative isolate flex h-56 items-end overflow-hidden rounded-carte border border-line p-8 md:col-span-2">
              <NumeroFiligrane numero="02" className="-top-6 right-6" />
              <p className="text-sm text-muted">Numéro de section en filigrane</p>
            </div>
          </div>
        </Bloc>

        <Bloc numero="08" titre="Icônes, logo, avatars">
          <div className="flex flex-col gap-10">
            <ul className="flex flex-wrap gap-6 text-text">
              {ICONES.map((nom) => (
                <li key={nom} className="flex flex-col items-center gap-2">
                  <Icone nom={nom} taille={22} />
                  <span className="text-[10px] text-faint">{nom}</span>
                </li>
              ))}
            </ul>
            <Logo />
            <ul className="flex flex-wrap gap-4">
              {AVATARS.map((a) => (
                <li key={a} className="flex flex-col items-center gap-2">
                  <Image
                    src={`/avatars/avatar-${a}.svg`}
                    alt={`Avatar ${a}`}
                    width={64}
                    height={64}
                    unoptimized
                    className="rounded-avatar"
                  />
                  <span className="text-[10px] text-faint">{a.startsWith("p") ? "premium" : "gratuit"}</span>
                </li>
              ))}
            </ul>
          </div>
        </Bloc>

        <Bloc numero="09" titre="Accueil : affiches et classement">
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3">
            <AfficheTournoi nom="Coupe Venin" format="5v5" date="SAM. 27/09 · 21:00" variante={1} />
            <AfficheTournoi nom="Nuit de l'Arène" format="5v5" date="VEN. 03/10 · 20:30" variante={2} />
            <AfficheTournoi nom="Duel des Mids" format="1v1" date="DIM. 05/10 · 18:00" variante={3} />
          </div>
          <ApercuClassement lignes={EXEMPLE_TOP} legende="Exemple de top du classement" />
        </Bloc>
      </div>
    </main>
  );
}
