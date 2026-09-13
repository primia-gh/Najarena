import Squelette from "@/components/ui/Squelette";

export default function Chargement() {
  return (
    <main className="relative min-h-screen overflow-hidden pt-28 pb-16">
      <div className="relative mx-auto max-w-3xl px-6">
        <Squelette className="h-3 w-32" />
        <Squelette className="mt-2 h-9 w-56" />
        <Squelette className="mt-4 h-12 w-full max-w-lg" />
        <div className="mt-4 flex flex-wrap gap-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Squelette key={i} className="h-6 w-24 rounded-full" />
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-[1px]">
          {Array.from({ length: 8 }).map((_, i) => (
            <Squelette key={i} className="h-[52px] w-full rounded-none first:rounded-t-[3px] last:rounded-b-[3px]" />
          ))}
        </div>
      </div>
    </main>
  );
}
