"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface SuiviTempsReelProps {
  canal: string;
  tables: string[];
}

// Rejoue le chargement des données serveur (router.refresh) dès qu'une des
// tables suivies change — pas de duplication de la logique de lecture ici,
// juste un signal "quelque chose a changé, recharge". Les tables comme
// match_participants/match_verdicts/disputes n'ont pas de colonne
// tournament_id à filtrer directement ; vu le volume de trafic actuel du
// site, un refresh non filtré à chaque événement est largement suffisant.
export function SuiviTempsReel({ canal, tables }: SuiviTempsReelProps) {
  const router = useRouter();
  const tablesKey = tables.join(",");

  useEffect(() => {
    const supabase = createClient();
    let delai: ReturnType<typeof setTimeout> | undefined;

    const rafraichir = () => {
      clearTimeout(delai);
      delai = setTimeout(() => router.refresh(), 300);
    };

    let abonnement = supabase.channel(canal);
    for (const table of tablesKey.split(",")) {
      abonnement = abonnement.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        rafraichir,
      );
    }
    abonnement.subscribe();

    return () => {
      clearTimeout(delai);
      supabase.removeChannel(abonnement);
    };
  }, [canal, tablesKey, router]);

  return null;
}
