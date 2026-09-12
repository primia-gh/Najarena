"use client";

// Pattern d'apparition au scroll centralisé (CLAUDE.md refonte du 12/09) —
// un seul réglage de durée/easing réutilisé partout plutôt que des
// animations codées au cas par cas. `prefers-reduced-motion` : le contenu
// s'affiche directement, sans transition.

import type { ReactNode } from "react";
import { motion, useReducedMotion, type Variants } from "motion/react";

interface RevealProps {
  children: ReactNode;
  delai?: number;
  className?: string;
}

const variantes: Variants = {
  cache: { opacity: 0, y: 26 },
  visible: { opacity: 1, y: 0 },
};

export default function Reveal({ children, delai = 0, className }: RevealProps) {
  const reduitMotion = useReducedMotion();

  if (reduitMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial="cache"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={variantes}
      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1], delay: delai }}
    >
      {children}
    </motion.div>
  );
}
