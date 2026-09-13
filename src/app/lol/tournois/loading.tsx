import Squelette from "@/components/ui/Squelette";

export default function Chargement() {
  return (
    <main className="relative min-h-screen overflow-hidden pt-28 pb-16">
      <div className="relative mx-auto max-w-3xl px-6">
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
