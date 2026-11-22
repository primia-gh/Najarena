import Squelette from "@/components/ui/Squelette";

export default function Chargement() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24">
      {/* Calé sur la grille des pages (bord gauche du logo), comme la page qui arrive. */}
      <div className="relative px-grille">
        <Squelette className="h-3 w-24" />
        <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1">
            <Squelette className="h-3 w-36" />
            <Squelette className="mt-2 h-10 w-72" />
          </div>
          <Squelette className="h-6 w-32 rounded-full" />
        </div>
        <Squelette className="mt-3 h-3 w-56" />

        <Squelette className="mt-10 h-5 w-40" />
        <div className="mt-3 flex flex-col gap-2">
          <Squelette className="h-12 w-full" />
          <Squelette className="h-12 w-full" />
        </div>

        <Squelette className="mt-10 h-5 w-20" />
        <Squelette className="mt-3 h-32 w-full" />
      </div>
    </main>
  );
}
