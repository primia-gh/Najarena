import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Najarena — Ton niveau, vérifié.",
    short_name: "Najarena",
    description:
      "Tournois League of Legends en 1v1, quotidiens. Résultats lus dans la donnée officielle Riot.",
    start_url: "/",
    display: "standalone",
    background_color: "#12161D",
    theme_color: "#12161D",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
    ],
  };
}
