// Fond des pages intérieures (MASTER §5 et §7) : motif d'écailles très
// discret estompé vers le bas, et un halo vert léger en haut à droite —
// comme l'en-tête des maquettes profil et tournoi. Remplace l'ancien fond
// animé (FondArene + BracketBackground) : aucune animation, les pages
// outils restent calmes. Même placement que l'ancien : le parent est en
// `relative`, le contenu qui suit est en `relative` et passe devant.

export default function FondEcailles() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[560px] overflow-hidden">
      <div className="fond-ecailles absolute inset-0" />
      <div className="absolute -top-[420px] -right-24 aspect-square w-[800px] rounded-full bg-[radial-gradient(circle,rgba(182,255,59,.08)_0%,rgba(182,255,59,0)_65%)]" />
    </div>
  );
}
