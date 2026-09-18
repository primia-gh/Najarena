import Link from "next/link";

export default function Footer() {
  return (
    <footer className="print:hidden mt-auto border-t border-trait bg-papier px-6 py-6">
      <nav className="mx-auto flex max-w-3xl flex-wrap justify-center gap-x-6 gap-y-2 font-mono text-[0.68rem] tracking-[0.1em] text-ardoise uppercase">
        <Link href="/comment-ca-marche" className="hover:text-encre">
          Comment ça marche
        </Link>
        <Link href="/faq" className="hover:text-encre">
          FAQ
        </Link>
        <Link href="/journal" className="hover:text-encre">
          Journal de bord
        </Link>
        <Link href="/note-du-fondateur" className="hover:text-encre">
          Le fondateur
        </Link>
        <Link href="/mentions-legales" className="hover:text-encre">
          Mentions légales
        </Link>
        <Link href="/cgu" className="hover:text-encre">
          CGU
        </Link>
        <Link href="/confidentialite" className="hover:text-encre">
          Confidentialité
        </Link>
      </nav>
      <p className="mx-auto mt-4 max-w-3xl text-center text-[0.72rem] text-ardoise">
        League of Legends et Riot Games sont des marques déposées de Riot Games, Inc. Najarena
        n&apos;est ni produit, ni approuvé, ni sponsorisé par Riot Games.
      </p>
    </footer>
  );
}
