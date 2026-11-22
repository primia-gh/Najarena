import Squelette from "@/components/ui/Squelette";

export default function Chargement() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24">
      {/* Calé sur la grille des pages (bord gauche du logo), comme la page qui arrive. */}
      <div className="relative px-grille">
        <div className="flex flex-wrap items-start justify-between gap-6 rounded-bouton border border-line bg-surface p-4">
          <div className="min-w-0 flex-1">
            <Squelette className="h-9 w-48" />
            <Squelette className="mt-2 h-3 w-64" />
            <Squelette className="mt-3 h-6 w-20 rounded-full" />
          </div>
          <Squelette className="h-24 w-24 rounded-full" />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-[1px] overflow-hidden rounded-bouton border border-line">
          <Squelette className="h-20 w-full rounded-none" />
          <Squelette className="h-20 w-full rounded-none" />
          <Squelette className="h-20 w-full rounded-none" />
        </div>

        <Squelette className="mt-10 h-5 w-32" />
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Squelette className="h-14 w-full" />
          <Squelette className="h-14 w-full" />
        </div>
      </div>
    </main>
  );
}
