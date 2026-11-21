import FondEcailles from "@/components/design/FondEcailles";
import Squelette from "@/components/ui/Squelette";

// Même grille que la page (px-grille, pt-32) : pas de saut de mise en page
// à l'arrivée du contenu : filtre, puis grille d'annonces (revue design du
// 19/11/2026).
export default function Chargement() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24">
      <FondEcailles />
      <div className="relative flex flex-col gap-12 px-grille">
        <div className="flex flex-col gap-4">
          <Squelette className="h-3 w-40" />
          <Squelette className="h-12 w-72" />
          <Squelette className="h-4 w-full max-w-2xl" />
          <Squelette className="h-4 w-2/3 max-w-xl" />
        </div>
        <Squelette className="h-11 w-full max-w-xl" />
        <div className="flex flex-col gap-6">
          <Squelette className="h-6 w-56" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Squelette className="h-56 w-full" />
            <Squelette className="h-56 w-full" />
            <Squelette className="h-56 w-full" />
          </div>
        </div>
      </div>
    </main>
  );
}
