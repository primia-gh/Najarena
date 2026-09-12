"use client";

// Navbar du registre nuit, désormais partagée par tout le site (voir
// CLAUDE.md §7, abandon du split clair/sombre du 12/09/2026) — rendue une
// seule fois dans le layout racine. Sticky, s'assombrit et se resserre au
// défilement ; menu tactile en dessous sur mobile.

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";

const LIENS = [
  { href: "/lol/tournois", label: "Tournois" },
  { href: "/lol/classement", label: "Classement" },
  { href: "/lol/coequipiers", label: "Coéquipiers" },
  { href: "/organiser/nouveau", label: "Organiser" },
];

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sceau rounded-[2px]";

export default function NavbarArene() {
  const pathname = usePathname();
  const surPageConnexion = pathname === "/connexion";
  const [defile, setDefile] = useState(false);
  const [menuOuvert, setMenuOuvert] = useState(false);

  useEffect(() => {
    const onScroll = () => setDefile(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-40 flex items-center justify-between px-6 transition-[padding,background-color,border-color] duration-300 ${
        defile
          ? "border-b border-trait bg-papier/80 py-3.5 backdrop-blur-md"
          : "border-b border-transparent py-5"
      }`}
    >
      <Link href="/" className={`flex items-center gap-2 ${FOCUS}`}>
        <Image
          src="/logo-najarena-marque.png"
          alt=""
          width={32}
          height={41}
          className="h-8 w-auto shrink-0"
          priority
        />
        <span className="font-mono text-[0.78rem] tracking-[0.18em] text-encre uppercase">Najarena</span>
      </Link>

      <div className="hidden items-center gap-7 sm:flex">
        {LIENS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`group relative py-1 text-[0.85rem] text-ardoise transition hover:text-encre ${FOCUS}`}
          >
            {l.label}
            <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-sceau transition-all duration-300 group-hover:w-full" />
          </Link>
        ))}
      </div>

      {!surPageConnexion && (
        <Link
          href="/connexion"
          className={`hidden rounded-[2px] bg-encre px-4 py-2 text-[0.8rem] font-semibold text-papier transition hover:brightness-95 sm:inline-block ${FOCUS}`}
        >
          Se connecter
        </Link>
      )}

      <button
        type="button"
        onClick={() => setMenuOuvert((v) => !v)}
        aria-expanded={menuOuvert}
        aria-label={menuOuvert ? "Fermer le menu" : "Ouvrir le menu"}
        className={`flex h-9 w-9 flex-col items-center justify-center gap-1.5 sm:hidden ${FOCUS}`}
      >
        <span className={`h-px w-5 bg-encre transition-transform duration-200 ${menuOuvert ? "translate-y-[3.5px] rotate-45" : ""}`} />
        <span className={`h-px w-5 bg-encre transition-opacity duration-200 ${menuOuvert ? "opacity-0" : ""}`} />
        <span className={`h-px w-5 bg-encre transition-transform duration-200 ${menuOuvert ? "-translate-y-[3.5px] -rotate-45" : ""}`} />
      </button>

      <AnimatePresence>
        {menuOuvert && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-x-0 top-full flex flex-col gap-1 overflow-hidden border-b border-trait bg-papier px-6 py-4 sm:hidden"
          >
            {LIENS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuOuvert(false)}
                className={`py-2 text-sm text-encre ${FOCUS}`}
              >
                {l.label}
              </Link>
            ))}
            {!surPageConnexion && (
              <Link
                href="/connexion"
                onClick={() => setMenuOuvert(false)}
                className={`mt-2 rounded-[2px] bg-encre px-4 py-2 text-center text-sm font-semibold text-papier ${FOCUS}`}
              >
                Se connecter
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
