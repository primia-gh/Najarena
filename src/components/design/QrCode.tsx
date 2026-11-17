import { modulesQrCode } from "@/lib/qr-code";

// QR code en SVG (audit N9), sombre sur fond blanc : c'est ce que lisent
// tous les appareils photo, y compris sur le fond sombre du site. La marge
// blanche de 4 modules fait partie de la norme.

const MARGE = 4;

export default function QrCode({ texte, taille = 168, libelle }: { texte: string; taille?: number; libelle: string }) {
  const { taille: modules, chemin } = modulesQrCode(texte);
  const cote = modules + 2 * MARGE;
  return (
    <svg
      role="img"
      aria-label={libelle}
      viewBox={`${-MARGE} ${-MARGE} ${cote} ${cote}`}
      width={taille}
      height={taille}
      shapeRendering="crispEdges"
      className="shrink-0 rounded-bouton"
    >
      <rect x={-MARGE} y={-MARGE} width={cote} height={cote} fill="#ffffff" />
      <path d={chemin} fill="#000000" />
    </svg>
  );
}
