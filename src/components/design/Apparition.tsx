"use client";

// Apparition au défilement de la nouvelle identité (MASTER §7 : apparitions
// 300–450 ms). Même mécanique que l'ancien components/accueil/Reveal.tsx,
// durées recalées sur MASTER. Mouvement réduit : contenu affiché tel quel.

import type { ReactNode } from "react";
import { motion, useReducedMotion, type Variants } from "motion/react";

interface ApparitionProps {
  children: ReactNode;
  /** Décalage en secondes, pour échelonner les éléments d'une même rangée. */
  delai?: number;
  className?: string;
}

const variantes: Variants = {
  cache: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

export default function Apparition({ children, delai = 0, className }: ApparitionProps) {
  const mouvementReduit = useReducedMotion();

  if (mouvementReduit) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial="cache"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      variants={variantes}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: delai }}
    >
      {children}
    </motion.div>
  );
}
