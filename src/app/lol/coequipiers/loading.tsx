import Squelette from "@/components/ui/Squelette";

export default function Chargement() {
  return (
    <main className="relative min-h-screen overflow-hidden pt-28 pb-16">
      <div className="relative mx-auto max-w-3xl px-6">
        <Squelette className="h-3 w-32" />
        <Squelette className="mt-6 h-9 w-64" />
        <Squelette className="mt-2 h-3 w-80" />

        <Squelette className="mt-6 h-28 w-full" />

        <Squelette className="mt-10 h-5 w-40" />
        <div className="mt-3 flex flex-col gap-3">
          <Squelette className="h-16 w-full" />
          <Squelette className="h-16 w-full" />
        </div>
      </div>
    </main>
  );
}
