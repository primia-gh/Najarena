import FondEcailles from "@/components/design/FondEcailles";
import Squelette from "@/components/ui/Squelette";

// Même grille que la page (px-grille, pt-32) : pas de saut de mise en page.
export default function Chargement() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24">
      <FondEcailles />
      <div className="relative flex flex-col gap-10 px-grille *:max-w-4xl">
        <div className="flex flex-col gap-4">
          <Squelette className="h-3 w-40" />
          <Squelette className="h-10 w-72" />
          <Squelette className="h-4 w-full max-w-2xl" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Squelette className="h-48 w-full" />
          <Squelette className="h-48 w-full" />
        </div>
        <Squelette className="h-64 w-full" />
      </div>
    </main>
  );
}
