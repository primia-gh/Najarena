import { redirect } from "next/navigation";
import { ajouterJours } from "@/lib/tournois-auto/creneaux";
import { lundiDeLaSemaine } from "@/lib/recap-semaine";

// /lol/semaine : le récap de la dernière semaine complète. Calculé à chaque
// visite (sinon figé à la date de construction du site).
export const dynamic = "force-dynamic";

export default function SemainePage() {
  redirect(`/lol/semaine/${ajouterJours(lundiDeLaSemaine(new Date()), -7)}`);
}
