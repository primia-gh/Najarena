import Squelette from "@/components/ui/Squelette";

export default function Chargement() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24">
      {/* Calé sur la grille des pages (bord gauche du logo), comme la page qui arrive. */}
      <div className="relative px-grille">
        <div className="flex items-center gap-3">
          <Squelette className="h-8 w-16" />
          <Squelette className="h-10 w-56" />
        </div>
        <Squelette className="mt-2 h-3 w-24" />
        <Squelette className="mt-2 h-3 w-40" />

        <Squelette className="mt-10 h-5 w-24" />
        <div className="mt-3 flex flex-col gap-2">
          <Squelette className="h-12 w-full" />
          <Squelette className="h-12 w-full" />
        </div>
      </div>
    </main>
  );
}
