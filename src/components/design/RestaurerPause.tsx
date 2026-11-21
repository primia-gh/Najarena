"use client";

import { useEffect } from "react";
import { restaurerPause } from "@/lib/pause-animations";

// Préférence « animations en pause » réappliquée sur toutes les pages, pas
// seulement sur l'accueil où se trouve le bouton (18/11/2026) : un visiteur
// qui a figé les animations les retrouve figées partout (WCAG 2.2.2).

export default function RestaurerPause() {
  useEffect(() => {
    restaurerPause();
  }, []);
  return null;
}
