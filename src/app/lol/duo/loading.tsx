import FondEcailles from "@/components/design/FondEcailles";
import Squelette from "@/components/ui/Squelette";

// Même grille que la page (px-grille, pt-32) : pas de saut de mise en page
// à l'arrivée du contenu (revue design du 18/11/2026).
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
        <div className="grid max-w-5xl gap-6 md:grid-cols-3">
          <Squelette className="h-20 w-full" />
          <Squelette className="h-20 w-full" />
          <Squelette className="h-20 w-full" />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-12 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="grid gap-4 xl:grid-cols-2">
            <Squelette className="h-56 w-full" />
            <Squelette className="h-56 w-full" />
          </div>
          <Squelette className="order-first h-96 w-full lg:order-none" />
        </div>
      </div>
    </main>
  );
}
