import { notFound } from "next/navigation";
import { equipeIntrouvable } from "@/lib/existence-pages";

// Vérifié avant l'écran de chargement : une équipe inexistante répond 404
// (lib/existence-pages.ts).
export default async function EquipeLayout({ children, params }: LayoutProps<"/equipe/[slug]">) {
  const { slug } = await params;
  if (await equipeIntrouvable(slug)) notFound();
  return children;
}
