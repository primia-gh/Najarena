import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mentions légales — Najarena",
  description: "Mentions légales du site Najarena.",
};

export default function MentionsLegalesPage() {
  return (
    <main className="mx-auto max-w-3xl px-gouttiere pt-32 pb-24 font-texte text-text">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center font-texte text-xs tracking-[3px] text-muted uppercase hover:text-text"
      >
        Najarena
      </Link>

      <h1 className="mt-6 font-titre uppercase text-section font-black tracking-[1px] text-text hyphens-auto [overflow-wrap:anywhere]">
        Mentions légales
      </h1>

      <div className="mt-8 flex flex-col gap-8 text-sm leading-relaxed text-text">
        <section>
          <h2 className="font-titre uppercase text-lg font-extrabold tracking-tight text-text">
            Éditeur du site
          </h2>
          <p className="mt-2 text-muted">
            Le site Najarena est édité par une personne physique :
          </p>
          <p className="mt-2">
            Robbie Kammerer
            <br />
            France
            <br />
            Contact :{" "}
            <a href="mailto:robbie.kammerer@gmail.com" className="text-text underline underline-offset-3">
              robbie.kammerer@gmail.com
            </a>
          </p>
          <p className="mt-2 text-muted">
            Directeur de la publication : Robbie Kammerer.
          </p>
        </section>

        <section>
          <h2 className="font-titre uppercase text-lg font-extrabold tracking-tight text-text">
            Hébergement
          </h2>
          <p className="mt-2 text-muted">
            Le site est hébergé par Vercel Inc., 440 N Barranca Ave #4133,
            Covina, CA 91723, États-Unis.
          </p>
        </section>

        <section>
          <h2 className="font-titre uppercase text-lg font-extrabold tracking-tight text-text">
            Propriété intellectuelle
          </h2>
          <p className="mt-2 text-muted">
            L&apos;ensemble des éléments du site Najarena (textes, mise en
            page, identité visuelle, code) est protégé par le droit
            d&apos;auteur. Toute reproduction sans autorisation est interdite.
          </p>
          <p className="mt-2 text-muted">
            League of Legends et Riot Games sont des marques déposées de Riot
            Games, Inc. Najarena n&apos;est ni produit, ni approuvé, ni
            sponsorisé par Riot Games.
          </p>
        </section>

        <section>
          <h2 className="font-titre uppercase text-lg font-extrabold tracking-tight text-text">
            Données personnelles
          </h2>
          <p className="mt-2 text-muted">
            Le traitement des données personnelles est détaillé dans la{" "}
            <Link href="/confidentialite" className="text-text underline underline-offset-3">
              politique de confidentialité
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
