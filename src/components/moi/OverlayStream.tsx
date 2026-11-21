import Link from "next/link";
import BoutonCopier from "@/components/design/BoutonCopier";
import LibelleSection from "@/components/design/LibelleSection";
import { URL_PUBLIQUE } from "@/lib/donnees-publiques";
import { typographie } from "@/lib/typographie";

// « Mon overlay » (21/11/2026), bloc de /moi : l'adresse toute prête de
// l'overlay de match du joueur (/widget/joueur/[slug]/match), à coller dans
// OBS. Mode d'emploi complet sur /developpeurs#overlay.

export default function OverlayStream({ slug }: { slug: string }) {
  const adresse = `${URL_PUBLIQUE}/widget/joueur/${slug}/match?fond=transparent`;
  const apercu = `/widget/joueur/${slug}/match`;
  return (
    <section aria-labelledby="moi-overlay" className="flex scroll-mt-28 flex-col gap-4">
      <LibelleSection as="h2" id="moi-overlay" className="border-b border-line-strong pb-4">
        Overlay de stream
      </LibelleSection>
      <p className="text-sm text-text-2">
        {typographie(
          "Ton match sur ton stream : les deux joueurs, l'étape, puis le vainqueur et la source du résultat. Dans OBS, ajoute une source « Navigateur » avec cette adresse, largeur 1280, hauteur 200. Elle suit ton match d'un tournoi à l'autre, sans rien à changer.",
        )}
      </p>
      <pre className="overflow-x-auto rounded-bouton border border-line bg-bg p-3 text-xs text-text-2">
        <code>{adresse}</code>
      </pre>
      <span className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <BoutonCopier texte={adresse} libelle="Copier l'adresse" libelleAccessible="Copier l'adresse de mon overlay" />
        <a
          href={apercu}
          target="_blank"
          rel="noopener"
          className="inline-flex min-h-11 items-center text-sm text-text underline underline-offset-3 hover:text-accent"
        >
          Voir l&apos;aperçu<span className="sr-only"> (nouvel onglet)</span>
        </a>
        <Link
          href="/developpeurs#overlay"
          className="inline-flex min-h-11 items-center text-sm text-muted underline underline-offset-3 hover:text-text"
        >
          Mode d&apos;emploi
        </Link>
      </span>
    </section>
  );
}
