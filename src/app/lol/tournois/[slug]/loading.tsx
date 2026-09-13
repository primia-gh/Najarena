import Squelette from "@/components/ui/Squelette";

export default function Chargement() {
  return (
    <main className="relative min-h-screen overflow-hidden pt-28 pb-16">
      <div className="relative mx-auto max-w-3xl px-6">
        <Squelette className="h-3 w-20" />

        <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1">
            <Squelette className="h-3 w-32" />
            <Squelette className="mt-2 h-10 w-72" />
          </div>
          <Squelette className="h-6 w-32 rounded-full" />
        </div>

        <Squelette className="mt-3 h-3 w-64" />
        <Squelette className="mt-4 h-16 w-full max-w-lg" />
        <Squelette className="mt-4 h-10 w-32" />

        <Squelette className="mt-10 h-5 w-24" />
        <div className="mt-3 flex flex-col gap-2">
          <Squelette className="h-12 w-full" />
          <Squelette className="h-12 w-full" />
        </div>

        <Squelette className="mt-10 h-5 w-20" />
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Squelette className="h-28 w-full" />
          <Squelette className="h-28 w-full" />
        </div>
      </div>
    </main>
  );
}
