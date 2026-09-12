// Couche de fond décorative du registre nuit : grille technique très
// discrète + deux halos de lueur (sceau / laiton). Purement visuel — aucun
// JS, aucune interaction. Se pose derrière le contenu d'une section
// `position:relative`.
export default function FondArene() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0 opacity-35"
        style={{
          backgroundImage:
            "linear-gradient(var(--color-trait) 1px, transparent 1px), linear-gradient(90deg, var(--color-trait) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 30%, black 0%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 30%, black 0%, transparent 75%)",
        }}
      />
      <div
        className="absolute -top-[10%] left-1/2 h-[700px] w-[900px] -translate-x-1/2 blur-[10px]"
        style={{ background: "radial-gradient(circle, var(--color-sceau-lueur) 0%, transparent 65%)" }}
      />
      <div
        className="absolute -right-[10%] -bottom-[20%] h-[700px] w-[700px] blur-[10px]"
        style={{ background: "radial-gradient(circle, var(--color-laiton-lueur) 0%, transparent 65%)" }}
      />
    </div>
  );
}
