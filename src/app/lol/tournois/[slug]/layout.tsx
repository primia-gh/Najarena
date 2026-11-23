import { notFound } from "next/navigation";
import { tournoiIntrouvable } from "@/lib/existence-pages";

// Vérifié avant l'écran de chargement : un tournoi inexistant (ou pas
// encore public) répond 404 (lib/existence-pages.ts).
export default async function TournoiLayout({ children, params }: LayoutProps<"/lol/tournois/[slug]">) {
  const { slug } = await params;
  if (await tournoiIntrouvable(slug)) notFound();
  return children;
}
