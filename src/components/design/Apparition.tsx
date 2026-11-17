"use client";

// Apparition au défilement de la nouvelle identité (MASTER §7 : apparitions
// 300–450 ms) : fondu + léger glissement vers le haut, une seule fois,
// durées recalées sur MASTER.
//
// Mouvement réduit (corrigé le 05/10/2026) : le composant rendait un simple
// <div> quand le navigateur demandait moins d'animations. Mais le serveur,
// qui ne connaît pas ce réglage, envoyait la version animée, masquée
// (opacity: 0) en attendant le défilement ; React ne corrige pas un
// attribut différent à l'hydratation, et le <div> sans animation ne
// l'enlevait jamais : tout le contenu restait invisible pour ces visiteurs.
// Désormais le même élément est rendu pour tous, et c'est la feuille de
// style (globals.css, [data-apparition]) qui l'affiche d'emblée, sans
// mouvement, quand prefers-reduced-motion vaut « reduce ».

import type { ReactNode } from "react";
import { motion, type Variants } from "motion/react";

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
  return (
    <motion.div
      data-apparition=""
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
