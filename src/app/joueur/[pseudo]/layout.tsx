import { notFound } from "next/navigation";
import { profilIntrouvable } from "@/lib/existence-pages";

// Vérifié avant l'écran de chargement : un profil inexistant répond 404
// (lib/existence-pages.ts).
export default async function JoueurLayout({ children, params }: LayoutProps<"/joueur/[pseudo]">) {
  const { pseudo } = await params;
  if (await profilIntrouvable(pseudo)) notFound();
  return children;
}
