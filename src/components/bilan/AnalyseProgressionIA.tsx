import type { FormatBilan } from "@/lib/bilan";
import { PARTIES_MIN_PROGRESSION } from "@/lib/progression-ia";
import { demanderAnalyseProgression } from "@/lib/progression-ia-actions";
import Alerte from "@/components/design/Alerte";
import BoutonEnvoi from "@/components/design/BoutonEnvoi";
import BoutonLien from "@/components/design/BoutonLien";
import LibelleSection from "@/components/design/LibelleSection";
import Panneau from "@/components/design/Panneau";

// Analyse de progression rédigée par l'IA (18/11/2026, offre Elite) : sous
// le bilan chiffré, un texte rédigé à partir de ces seuls chiffres. Toujours
// étiqueté comme rédigé par une IA, avec sa date et le nombre de parties
// lues ; jamais présenté comme un verdict.

export interface AnalyseEnregistree {
  resume: string;
  progres: string[];
  reculs: string[];
  priorites: string[];
  parties: number;
  derniere_partie: string | null;
  cree_le: string;
}

const RETOURS: Record<string, { type: "succes" | "erreur"; texte: string }> = {
  ok: { type: "succes", texte: "Analyse rédigée à partir de tes derniers chiffres." },
  insuffisant: {
    type: "erreur",
    texte: `Il faut ${PARTIES_MIN_PROGRESSION} parties vérifiées dans ce format pour mesurer une progression.`,
  },
  "a-jour": { type: "succes", texte: "Ton analyse est déjà à jour : rejoue des parties pour la refaire." },
  limite: { type: "erreur", texte: "Tu as fait 10 demandes à l'IA ces dernières 24 h : réessaie plus tard." },
  offre: { type: "erreur", texte: "L'analyse rédigée par l'IA fait partie de l'offre Elite." },
  indisponible: { type: "erreur", texte: "L'analyse par l'IA n'est pas disponible pour l'instant : réessaie plus tard." },
  refus: { type: "erreur", texte: "L'IA n'a pas pu rédiger cette analyse : réessaie plus tard." },
  invalide: { type: "erreur", texte: "La réponse de l'IA n'a pas passé nos vérifications : réessaie plus tard." },
};

function dateCourte(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" });
}

function Liste({ titre, elements }: { titre: string; elements: string[] }) {
  if (elements.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-texte text-mini font-medium text-muted uppercase">{titre}</h3>
      <ul className="flex flex-col gap-2">
        {elements.map((e) => (
          <li key={e} className="border-l-2 border-line-strong pl-3 text-text-2">
            {e}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AnalyseProgressionIA({
  format,
  elite,
  mesurable,
  partiesComparees,
  derniere,
  analyse,
  retour,
}: {
  format: FormatBilan;
  elite: boolean;
  /** Assez de parties pour une tendance (10 dans le format). */
  mesurable: boolean;
  partiesComparees: number;
  derniere: string | null;
  analyse: AnalyseEnregistree | null;
  /** Code renvoyé par l'action (?analyse=…). */
  retour?: string;
}) {
  const message = retour ? RETOURS[retour] : undefined;
  const nouvelles = analyse !== null && (analyse.parties !== partiesComparees || analyse.derniere_partie !== derniere);

  const bouton = (libelle: string) => (
    <form action={demanderAnalyseProgression}>
      <input type="hidden" name="format" value={format} />
      <BoutonEnvoi variante={analyse ? "contour" : "principal"} libelleEnCours="Rédaction…">
        {libelle}
      </BoutonEnvoi>
    </form>
  );

  return (
    <section id="analyse-ia" aria-labelledby="titre-analyse-ia" className="flex max-w-3xl scroll-mt-28 flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line-strong pb-4">
        <LibelleSection as="h2" id="titre-analyse-ia">
          Analyse de ta progression
        </LibelleSection>
        <span className="rounded-bouton border border-line-strong px-2 py-0.5 font-texte text-mini font-semibold tracking-[2px] text-muted uppercase">
          Rédigée par une IA
        </span>
      </div>

      {message && <Alerte type={message.type}>{message.texte}</Alerte>}

      {!elite ? (
        <Panneau className="flex flex-col items-start gap-4 p-6">
          <p className="text-text-2">
            Avec l&apos;offre Elite, une IA lit les chiffres de ce bilan et rédige ce qui progresse, ce qui recule et
            quoi travailler à tes prochaines parties. Elle ne voit que ces chiffres, lus dans tes parties vérifiées.
          </p>
          <BoutonLien href="/tarifs" variante="secondaire">
            Voir l&apos;offre Elite
          </BoutonLien>
        </Panneau>
      ) : analyse ? (
        <Panneau className="flex flex-col gap-6 p-6 sm:p-8">
          <p className="text-xs text-muted tabular-nums">
            Rédigée le {dateCourte(analyse.cree_le)}, sur {analyse.parties} parties vérifiées
            {analyse.derniere_partie ? ` (jusqu'au ${dateCourte(analyse.derniere_partie)})` : ""}.
          </p>
          <p className="text-courant text-text">{analyse.resume}</p>
          <Liste titre="Ce qui progresse" elements={analyse.progres} />
          <Liste titre="Ce qui recule" elements={analyse.reculs} />
          <Liste titre="À travailler" elements={analyse.priorites} />
          {nouvelles && mesurable && (
            <div className="flex flex-col items-start gap-2 border-t border-line pt-5">
              <p className="text-sm text-text-2">Tu as joué depuis : l&apos;analyse peut tenir compte de tes nouvelles parties.</p>
              {bouton("Refaire l'analyse")}
            </div>
          )}
        </Panneau>
      ) : mesurable ? (
        <Panneau className="flex flex-col items-start gap-4 p-6">
          <p className="text-text-2">
            L&apos;IA lit tes tendances (tes 5 dernières parties contre les 5 précédentes), tes forces, tes axes de travail
            et ton plan, puis rédige ce qui progresse, ce qui recule et quoi travailler.
          </p>
          {bouton("Rédiger mon analyse")}
        </Panneau>
      ) : (
        <p className="text-text-2">
          Il faut {PARTIES_MIN_PROGRESSION} parties vérifiées dans ce format pour comparer tes 5 dernières parties aux 5
          précédentes : tu en as {partiesComparees}.
        </p>
      )}

      {elite && (
        <p className="text-xs text-muted">
          L&apos;IA ne voit que les chiffres de cette page : ni le déroulé de tes parties, ni le KDA, ni l&apos;or par minute.
          Elle peut se tromper ; les chiffres du bilan font foi. 10 demandes à l&apos;IA par 24 h, revues de match comprises.
        </p>
      )}
    </section>
  );
}
