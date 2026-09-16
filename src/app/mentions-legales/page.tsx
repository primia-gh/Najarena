import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mentions légales — Najarena",
  description: "Mentions légales du site Najarena.",
};

export default function MentionsLegalesPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link
        href="/"
        className="font-mono text-[0.66rem] tracking-[0.18em] text-ardoise uppercase hover:text-encre"
      >
        Najarena
      </Link>

      <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight text-encre">
        Mentions légales
      </h1>

      <div className="mt-8 flex flex-col gap-8 text-sm leading-relaxed text-encre">
        <section>
          <h2 className="font-display text-lg font-extrabold tracking-tight text-encre">
            Éditeur du site
          </h2>
          <p className="mt-2 text-ardoise">
            Le site Najarena est édité par une personne physique :
          </p>
          <p className="mt-2">
            Robbie Kammerer
            <br />
            France
            <br />
            Contact :{" "}
            <a href="mailto:robbie.kammerer@gmail.com" className="text-encre underline underline-offset-3">
              robbie.kammerer@gmail.com
            </a>
          </p>
          <p className="mt-2 text-ardoise">
            Directeur de la publication : Robbie Kammerer.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-extrabold tracking-tight text-encre">
            Hébergement
          </h2>
          <p className="mt-2 text-ardoise">
            Le site est hébergé par Vercel Inc., 440 N Barranca Ave #4133,
            Covina, CA 91723, États-Unis.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-extrabold tracking-tight text-encre">
            Propriété intellectuelle
          </h2>
          <p className="mt-2 text-ardoise">
            L&apos;ensemble des éléments du site Najarena (textes, mise en
            page, identité visuelle, code) est protégé par le droit
            d&apos;auteur. Toute reproduction sans autorisation est interdite.
          </p>
          <p className="mt-2 text-ardoise">
            League of Legends et Riot Games sont des marques déposées de Riot
            Games, Inc. Najarena n&apos;est ni produit, ni approuvé, ni
            sponsorisé par Riot Games.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-extrabold tracking-tight text-encre">
            Données personnelles
          </h2>
          <p className="mt-2 text-ardoise">
            Le traitement des données personnelles est détaillé dans la{" "}
            <Link href="/confidentialite" className="text-encre underline underline-offset-3">
              politique de confidentialité
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
