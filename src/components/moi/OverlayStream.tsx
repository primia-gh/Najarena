import Link from "next/link";
import BoutonCopier from "@/components/design/BoutonCopier";
import LibelleSection from "@/components/design/LibelleSection";
import { URL_PUBLIQUE } from "@/lib/donnees-publiques";
import { typographie } from "@/lib/typographie";

// « Mon overlay » (21/11/2026), bloc de /moi : l'adresse toute prête de
// l'overlay de match du joueur (/widget/joueur/[slug]/match), à coller dans
// OBS. Mode d'emploi complet sur /developpeurs#overlay. Sans compte Riot
// vérifié, pas de tournoi donc pas de match à montrer : le bloc invite
// d'abord à lier son Riot ID, comme « Tournois pour toi ».

export default function OverlayStream({ slug, compteVerifie }: { slug: string; compteVerifie: boolean }) {
  const adresse = `${URL_PUBLIQUE}/widget/joueur/${slug}/match?fond=transparent`;
  const apercu = `/widget/joueur/${slug}/match`;
  return (
    <section aria-labelledby="moi-overlay" className="flex scroll-mt-28 flex-col gap-4">
      <LibelleSection as="h2" id="moi-overlay" className="border-b border-line-strong pb-4">
        Overlay de match pour ton stream
      </LibelleSection>
      {!compteVerifie ? (
        <p className="text-sm text-text-2">
          {typographie(
            "Lie et vérifie ton Riot ID pour jouer des tournois : tu trouveras ici l'adresse d'une bannière qui montre ton match sur ton stream.",
          )}{" "}
          <Link href="/lier-riot" className="text-text underline underline-offset-3 hover:text-accent">
            Lier mon Riot ID
          </Link>
        </p>
      ) : (
        <>
          <p className="text-sm text-text-2">
            {typographie(
              "Ton match sur ton stream : les deux joueurs, l'étape, puis le vainqueur et la source du résultat. Dans OBS, ajoute une source « Navigateur » avec cette adresse, en 1280 × 200 pixels. Elle suit ton match d'un tournoi à l'autre, sans rien à changer ; entre deux matchs, elle affiche une seule ligne discrète.",
            )}
          </p>
          <p className="text-xs text-muted">
            {typographie(
              "Pas de score en direct : le résultat s'affiche une fois lu chez Riot, en général quelques minutes après la partie, ou marqué « manuel » s'il a été tranché autrement.",
            )}
          </p>
          <pre
            tabIndex={0}
            role="region"
            aria-label="Adresse de mon overlay"
            className="overflow-x-auto rounded-bouton border border-line bg-bg p-3 text-xs text-text-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <code>{adresse}</code>
          </pre>
          <span className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <BoutonCopier
              texte={adresse}
              libelle="Copier l'adresse"
              libelleAccessible="Copier l'adresse de mon overlay"
            />
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
        </>
      )}
    </section>
  );
}
