// Bloc de chargement générique (états loading.tsx) — un simple
// rectangle qui pulse, dimensionné par les classes passées. Respecte
// prefers-reduced-motion via la règle globale sur .animate-pulse
// (globals.css).
export default function Squelette({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-[3px] bg-carte ${className}`} />;
}
