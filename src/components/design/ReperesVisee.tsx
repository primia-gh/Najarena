// Repères de visée aux 4 coins d'un visuel (MASTER §5) : équerres de 14 px,
// trait de 1 px, blanc à 35 %. Le parent doit être en `relative`.

const COINS = [
  "left-3.5 top-3.5 border-l border-t",
  "right-3.5 top-3.5 border-r border-t",
  "left-3.5 bottom-3.5 border-l border-b",
  "right-3.5 bottom-3.5 border-r border-b",
];

export default function ReperesVisee() {
  return (
    <>
      {COINS.map((position) => (
        <span
          key={position}
          aria-hidden="true"
          className={`pointer-events-none absolute h-3.5 w-3.5 border-[rgba(245,245,244,0.35)] ${position}`}
        />
      ))}
    </>
  );
}
