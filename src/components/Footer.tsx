import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-trait bg-papier px-6 py-6">
      <nav className="mx-auto flex max-w-3xl flex-wrap justify-center gap-x-6 gap-y-2 font-mono text-[0.68rem] tracking-[0.1em] text-ardoise uppercase">
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
    </footer>
  );
}
