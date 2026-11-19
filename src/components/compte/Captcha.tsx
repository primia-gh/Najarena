"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

// Widget Cloudflare Turnstile (audit F1). Rendu « explicite » : le widget
// est créé à l'affichage du formulaire et retiré quand on le quitte — avec
// le rendu automatique, une navigation interne du site laissait un
// formulaire sans widget. Le jeton part dans le champ caché
// « cf-turnstile-response » que Turnstile ajoute lui-même au formulaire.

interface Turnstile {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
}

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

export default function Captcha({ cleSite }: { cleSite: string }) {
  const conteneur = useRef<HTMLDivElement>(null);
  const [scriptPret, setScriptPret] = useState(false);

  useEffect(() => {
    if (!scriptPret || !conteneur.current || !window.turnstile) return;
    const id = window.turnstile.render(conteneur.current, {
      sitekey: cleSite,
      theme: "dark",
      language: "fr",
    });
    return () => window.turnstile?.remove(id);
  }, [scriptPret, cleSite]);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setScriptPret(true)}
      />
      <div ref={conteneur} className="min-h-[65px]" />
      <p className="text-xs text-muted">
        Vérification anti-robot par Cloudflare Turnstile, sans compte ni publicité.
      </p>
    </>
  );
}
