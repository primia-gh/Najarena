import Squelette from "@/components/ui/Squelette";

export default function Chargement() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24">
      {/* Calé sur la grille des pages (bord gauche du logo), comme la page qui arrive. */}
      <div className="relative px-grille">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <Squelette className="h-9 w-40" />
          <Squelette className="h-9 w-32" />
        </div>

        {["Riot ID", "Notifications", "Mes équipes", "Mes inscriptions", "Tournois que j'organise"].map((titre) => (
          <div key={titre} className="mt-10">
            <Squelette className="h-5 w-40" />
            <Squelette className="mt-3 h-14 w-full" />
          </div>
        ))}
      </div>
    </main>
  );
}
