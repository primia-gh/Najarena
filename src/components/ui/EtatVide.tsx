import type { ReactNode } from "react";
import Panneau from "@/components/design/Panneau";

// État vide « soigné » (MASTER §9) — même mode d'emploi qu'avant, mis au
// style « Venin » le 24/09/2026 : panneau avec repères de visée.
export default function EtatVide({ illustration, children }: { illustration: ReactNode; children: ReactNode }) {
  return (
    <Panneau reperes className="flex flex-col items-center gap-1 px-6 py-10 text-center">
      {illustration}
      <p className="mt-4 max-w-xs text-sm text-muted">{children}</p>
    </Panneau>
  );
}
