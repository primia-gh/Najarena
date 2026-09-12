// Carte de match illustrative pour la section "système de verdict" de
// l'accueil — reprend le vocabulaire réel du produit (niveaux de preuve,
// docs/moteur-resultats.md §3), noms d'exemple clairement fictifs.
export default function CarteMatch() {
  return (
    <div
      className="border border-[var(--nuit-trait)] bg-[var(--nuit-fond-2)] p-6 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)] transition-[border-color,box-shadow] duration-300 hover:border-[var(--nuit-sceau)]/40 hover:shadow-[0_0_0_1px_rgba(196,72,92,0.3),0_24px_60px_-12px_var(--nuit-sceau-lueur)]"
      style={{ clipPath: "polygon(0 0, calc(100% - 22px) 0, 100% 22px, 100% 100%, 0 100%)" }}
    >
      <div className="mb-4 flex items-center justify-between">
        <span className="flex items-center gap-2 font-mono text-[0.62rem] tracking-[0.12em] text-[var(--nuit-sceau)] uppercase">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--nuit-sceau)] opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--nuit-sceau)]" />
          </span>
          Tour 2 · Finale
        </span>
        <span className="font-mono text-[0.68rem] text-[var(--nuit-ardoise)]">#TRN-0842</span>
      </div>

      <div className="mb-4 flex flex-col gap-2">
        <div className="flex items-center justify-between font-semibold text-[var(--nuit-papier)]">
          <span>KaisaMain</span>
          <span className="font-mono tabular-nums">2</span>
        </div>
        <div className="flex items-center justify-between text-[var(--nuit-ardoise)]">
          <span>Faker_du_dimanche</span>
          <span className="font-mono tabular-nums">0</span>
        </div>
      </div>

      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--nuit-atteste-lueur)] px-2.5 py-1 font-mono text-[0.62rem] tracking-[0.08em] text-[var(--nuit-atteste)] uppercase">
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        Niveau 2 · Historique Riot
      </span>
    </div>
  );
}
