import Squelette from "@/components/ui/Squelette";

export default function Chargement() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24">
      {/* Calé sur la grille des pages (bord gauche du logo), comme la page qui arrive. */}
      <div className="relative px-grille">
        <Squelette className="h-3 w-24" />
        <Squelette className="mt-6 h-9 w-56" />
        <Squelette className="mt-2 h-3 w-40" />

        <Squelette className="mt-10 h-5 w-40" />
        <div className="mt-3 grid grid-cols-2 gap-[1px] overflow-hidden rounded-bouton border border-line sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Squelette key={i} className="h-20 w-full rounded-none" />
          ))}
        </div>

        <Squelette className="mt-10 h-5 w-40" />
        <Squelette className="mt-3 h-40 w-full" />

        <Squelette className="mt-10 h-5 w-48" />
        <Squelette className="mt-3 h-16 w-full" />
      </div>
    </main>
  );
}
