"use client";

// Barre de navigation partagée par tout le site — rendue une seule fois dans
// le layout racine (CLAUDE.md §7). Refonte « Venin » du 23/09/2026 : seule
// l'apparence change (maquette accueil.dc.html) ; la détection de session
// ci-dessous est reprise telle quelle de l'ancienne NavbarArene. Liens :
// ceux du site, pas « Équipes / Recruteurs » de la maquette (décision du
// 23/09/2026). Barre complète à partir de 1280 px, menu repliable en dessous
// (5 liens + 2 boutons ne tiennent pas sur une ligne à 1024 px).

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/design/Logo";

const LIENS = [
  { href: "/lol/tournois", label: "Tournois" },
  { href: "/lol/classement", label: "Classement" },
  { href: "/lol/coequipiers", label: "Coéquipiers" },
  { href: "/organiser/nouveau", label: "Organiser" },
  { href: "/tarifs", label: "Tarifs" },
];

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent";

const LIEN_TEXTE = `inline-flex min-h-11 items-center text-[13px] font-semibold uppercase tracking-[2px] transition-colors duration-200 ${FOCUS}`;

const BOUTON_CONTOUR = `inline-flex min-h-11 items-center justify-center rounded-bouton border border-[rgba(245,245,244,0.25)] px-[22px] text-[13px] font-semibold uppercase tracking-[2px] text-text transition-colors duration-200 hover:border-accent hover:text-accent ${FOCUS}`;

export default function Navbar() {
  const pathname = usePathname();
  const [defile, setDefile] = useState(false);
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [connecte, setConnecte] = useState(false);

  useEffect(() => {
    const onScroll = () => setDefile(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    // Revérifie la session à chaque changement de page. La connexion se
    // fait via une Server Action (redirect() côté serveur) : le layout
    // racine — donc cette navbar — n'est pas remonté par ce type de
    // navigation, un effet [] au montage ne se rejouerait jamais après une
    // connexion réussie et la navbar resterait bloquée sur "Se connecter".
    // `pathname` en dépendance force la revérification exactement au
    // moment où le symptôme apparaissait ("dès que je change de page").
    createClient()
      .auth.getSession()
      .then(({ data }) => setConnecte(!!data.session));
  }, [pathname]);

  useEffect(() => {
    // Complément pour les changements décidés par le client dans la même
    // page (ex. déconnexion sans navigation) — sans dépendance à pathname,
    // un seul abonnement pour la durée de vie du composant.
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setConnecte(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const cibleCompte = connecte ? "/moi" : "/connexion";
  const libelleCompte = connecte ? "Mon compte" : "Se connecter";
  const masquerCta = pathname === cibleCompte;

  const masquerRejoindre = connecte || pathname === "/inscription";
  // Mouvement réduit demandé : le menu mobile s'ouvre sans animation.
  const mouvementReduit = useReducedMotion();
  const estActif = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      aria-label="Navigation principale"
      className={`print:hidden fixed inset-x-0 top-0 z-40 flex items-center justify-between gap-6 px-gouttiere font-texte text-text transition-[padding,background-color,border-color] duration-300 ${
        defile ? "border-b border-line bg-bg/85 py-3 backdrop-blur-md" : "border-b border-transparent py-5"
      }`}
    >
      <Link href="/" aria-label="Najarena — accueil" className={`inline-flex min-h-11 shrink-0 items-center rounded-bouton ${FOCUS}`}>
        <Logo hauteur={defile ? 34 : 40} />
      </Link>

      <ul className="hidden items-center gap-9 xl:flex">
        {LIENS.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              aria-current={estActif(l.href) ? "page" : undefined}
              className={`${LIEN_TEXTE} font-medium ${estActif(l.href) ? "text-accent" : "text-text hover:text-accent"}`}
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-7">
        <div className="hidden items-center gap-7 sm:flex">
          {!masquerCta &&
            (connecte ? (
              <Link href={cibleCompte} className={BOUTON_CONTOUR}>
                {libelleCompte}
              </Link>
            ) : (
              <Link href={cibleCompte} className={`${LIEN_TEXTE} text-text hover:text-accent`}>
                {libelleCompte}
              </Link>
            ))}
          {!masquerRejoindre && (
            <Link href="/inscription" className={BOUTON_CONTOUR}>
              Rejoindre
            </Link>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMenuOuvert((v) => !v)}
          aria-expanded={menuOuvert}
          aria-label={menuOuvert ? "Fermer le menu" : "Ouvrir le menu"}
          className={`flex h-11 w-11 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-bouton xl:hidden ${FOCUS}`}
        >
          <span className={`h-px w-6 bg-text transition-transform duration-200 ${menuOuvert ? "translate-y-[3.5px] rotate-45" : ""}`} />
          <span className={`h-px w-6 bg-text transition-opacity duration-200 ${menuOuvert ? "opacity-0" : ""}`} />
          <span className={`h-px w-6 bg-text transition-transform duration-200 ${menuOuvert ? "-translate-y-[3.5px] -rotate-45" : ""}`} />
        </button>
      </div>

      <AnimatePresence>
        {menuOuvert && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: mouvementReduit ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-x-0 top-full flex flex-col overflow-hidden border-b border-line bg-bg px-gouttiere py-4 xl:hidden"
          >
            {LIENS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuOuvert(false)}
                aria-current={estActif(l.href) ? "page" : undefined}
                className={`${LIEN_TEXTE} ${estActif(l.href) ? "text-accent" : "text-text"}`}
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-3 flex flex-wrap items-center gap-x-7 gap-y-3 border-t border-line pt-4 sm:hidden">
              {!masquerCta && (
                <Link
                  href={cibleCompte}
                  onClick={() => setMenuOuvert(false)}
                  className={connecte ? BOUTON_CONTOUR : `${LIEN_TEXTE} text-text`}
                >
                  {libelleCompte}
                </Link>
              )}
              {!masquerRejoindre && (
                <Link href="/inscription" onClick={() => setMenuOuvert(false)} className={BOUTON_CONTOUR}>
                  Rejoindre
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
