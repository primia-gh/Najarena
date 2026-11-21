import Squelette from "@/components/ui/Squelette";

export default function Chargement() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24">
      {/* Calé sur la grille des pages (bord gauche du logo), comme la page qui arrive. */}
      <div className="relative px-grille">
        <Squelette className="h-3 w-32" />
        <Squelette className="mt-2 h-9 w-48" />

        <div className="mt-8 flex flex-wrap items-end gap-4">
          <Squelette className="h-[58px] w-32" />
          <Squelette className="h-[58px] w-32" />
          <Squelette className="h-10 w-24" />
        </div>

        <div className="mt-8 flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Squelette key={i} className="h-[74px] w-full" />
          ))}
        </div>
      </div>
    </main>
  );
}
