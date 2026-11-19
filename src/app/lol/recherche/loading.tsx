import FondEcailles from "@/components/design/FondEcailles";
import Squelette from "@/components/ui/Squelette";

// Même grille que la page (px-grille, pt-32) : la recherche porte sur tous
// les comptes vérifiés et peut prendre un instant (revue design du 19/11/2026).
export default function Chargement() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24">
      <FondEcailles />
      <div className="relative flex flex-col gap-10 px-grille">
        <div className="flex flex-col gap-4">
          <Squelette className="h-3 w-32" />
          <Squelette className="h-9 w-72" />
          <Squelette className="h-4 w-full max-w-2xl" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Squelette className="h-48 w-full" />
          <Squelette className="h-48 w-full" />
        </div>
        <div className="flex flex-col gap-3">
          <Squelette className="h-5 w-40" />
          <Squelette className="h-14 w-full" />
          <Squelette className="h-14 w-full" />
          <Squelette className="h-14 w-full" />
        </div>
      </div>
    </main>
  );
}
