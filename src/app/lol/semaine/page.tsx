import { redirect } from "next/navigation";
import { ajouterJours } from "@/lib/tournois-auto/creneaux";
import { lundiDeLaSemaine } from "@/lib/recap-semaine";

// /lol/semaine : le récap de la dernière semaine complète.
export default function SemainePage() {
  redirect(`/lol/semaine/${ajouterJours(lundiDeLaSemaine(new Date()), -7)}`);
}
