"use client";

import { useEffect, useRef } from "react";

// Couleurs "nuit" (voir globals.css .accueil), en rgb pour les rgba() du canvas.
const LIEN = "196,72,92"; // sceau nuit
const NOEUD_MAJEUR = "210,162,87"; // laiton nuit
const NOEUD_MINEUR = "231,230,225"; // papier

type Noeud = { x: number; y: number; vx: number; vy: number; r: number };

export default function BracketBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let largeur = 0;
    let hauteur = 0;
    let noeuds: Noeud[] = [];
    let frameId = 0;
    let actif = true;

    const initNoeuds = () => {
      const n = largeur < 700 ? 26 : 46;
      noeuds = Array.from({ length: n }, () => ({
        x: Math.random() * largeur,
        y: Math.random() * hauteur,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28,
        r: Math.random() < 0.12 ? 2.6 : 1.4,
      }));
    };

    const redimensionner = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      largeur = canvas.clientWidth;
      hauteur = canvas.clientHeight;
      canvas.width = largeur * dpr;
      canvas.height = hauteur * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initNoeuds();
    };

    const dessiner = () => {
      ctx.clearRect(0, 0, largeur, hauteur);
      const distanceMax = largeur < 700 ? 130 : 165;

      for (const p of noeuds) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > largeur) p.vx *= -1;
        if (p.y < 0 || p.y > hauteur) p.vy *= -1;
      }

      for (let i = 0; i < noeuds.length; i++) {
        for (let j = i + 1; j < noeuds.length; j++) {
          const a = noeuds[i];
          const b = noeuds[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < distanceMax * distanceMax) {
            const o = 1 - Math.sqrt(d2) / distanceMax;
            ctx.strokeStyle = `rgba(${LIEN},${o * 0.34})`;
            ctx.lineWidth = o * 1.15;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      for (const p of noeuds) {
        ctx.fillStyle = p.r > 2 ? `rgba(${NOEUD_MAJEUR},.85)` : `rgba(${NOEUD_MINEUR},.45)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const boucle = () => {
      frameId = requestAnimationFrame(boucle);
      if (actif) dessiner();
    };

    const onVisibilite = () => {
      actif = !document.hidden;
    };

    redimensionner();
    frameId = requestAnimationFrame(boucle);
    window.addEventListener("resize", redimensionner);
    document.addEventListener("visibilitychange", onVisibilite);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", redimensionner);
      document.removeEventListener("visibilitychange", onVisibilite);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 block h-full w-full motion-reduce:hidden"
    />
  );
}
