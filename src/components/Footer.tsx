import Link from "next/link";
import Logo from "@/components/design/Logo";

// Pied de page partagé par tout le site. Refonte « Venin » du 23/09/2026
// (maquette accueil.dc.html) : liens existants conservés — la maquette
// prévoit « Contact » et « Discord », qui n'ont pas encore d'adresse.
// La mention légale Riot est exigée pour l'usage de l'API : texte inchangé.

const LIENS = [
  { href: "/comment-ca-marche", label: "Comment ça marche" },
  { href: "/faq", label: "FAQ" },
  { href: "/journal", label: "Journal de bord" },
  { href: "/note-du-fondateur", label: "Le fondateur" },
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/cgu", label: "CGU" },
  { href: "/confidentialite", label: "Confidentialité" },
];

export default function Footer() {
  return (
    <footer className="print:hidden mt-auto border-t border-line bg-bg px-gouttiere py-14 font-texte">
      <div className="mx-auto flex max-w-contenu flex-col gap-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <Link
            href="/"
            aria-label="Najarena — accueil"
            className="self-start rounded-bouton focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            <Logo hauteur={36} />
          </Link>
          <nav aria-label="Liens du pied de page">
            <ul className="flex flex-wrap gap-x-8 gap-y-1">
              {LIENS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="inline-flex min-h-11 items-center text-[13px] tracking-[2px] text-muted uppercase transition-colors duration-200 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <p className="max-w-[900px] text-xs leading-[1.6] text-faint">
          League of Legends et Riot Games sont des marques déposées de Riot Games, Inc. Najarena
          n&apos;est ni produit, ni approuvé, ni sponsorisé par Riot Games.
        </p>
      </div>
    </footer>
  );
}
