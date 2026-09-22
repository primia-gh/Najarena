// Grand numéro de section en filigrane (MASTER §5) : texte évidé, contour
// 1 px à 7 %, 320 px à 1440. Purement décoratif — le parent doit être en
// `relative` (et `isolate` si son fond ne doit pas passer par-dessus).

interface NumeroFiligraneProps {
  numero: string;
  className?: string;
}

export default function NumeroFiligrane({ numero, className = "" }: NumeroFiligraneProps) {
  return (
    <span
      aria-hidden="true"
      className={`texte-evide pointer-events-none absolute -z-10 select-none font-titre text-[clamp(10rem,22vw,20rem)] font-black leading-none ${className}`}
    >
      {numero}
    </span>
  );
}
