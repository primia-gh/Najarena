import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Najarena — Ton niveau, vérifié.",
    short_name: "Najarena",
    description:
      "Tournois League of Legends en 1v1, quotidiens. Résultats lus dans la donnée officielle Riot.",
    start_url: "/",
    display: "standalone",
    background_color: "#080908",
    theme_color: "#080908",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
