import type { FormatBilan } from "@/lib/bilan";
import { PARTIES_MIN_PROGRESSION } from "@/lib/progression-ia";
import { demanderAnalyseProgression } from "@/lib/progression-ia-actions";
import Alerte from "@/components/design/Alerte";
import BoutonEnvoi from "@/components/design/BoutonEnvoi";
import BoutonLien from "@/components/design/BoutonLien";
import LibelleSection from "@/components/design/LibelleSection";
import Panneau from "@/components/design/Panneau";
import Icone, { type NomIcone } from "@/components/design/Icone";
import { typographie } from "@/lib/typographie";

// Analyse de progression rédigée par l'IA (18/11/2026, offre Pro) : sous
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
  "sans-accord": {
    type: "erreur",
    texte: "L'analyse de tes parties classées demande ton accord : active-la dans les réglages ci-dessous.",
  },
  "a-jour": { type: "succes", texte: "Ton analyse est déjà à jour : rejoue des parties pour la refaire." },
  limite: { type: "erreur", texte: "Tu as fait 10 demandes à l'IA ces dernières 24 h : réessaie plus tard." },
  offre: { type: "erreur", texte: "L'analyse rédigée par l'IA fait partie de l'offre Pro." },
  indisponible: { type: "erreur", texte: "L'analyse par l'IA n'est pas disponible pour l'instant : réessaie plus tard." },
  refus: { type: "erreur", texte: "L'IA n'a pas pu rédiger cette analyse : réessaie plus tard." },
  invalide: { type: "erreur", texte: "La réponse de l'IA n'a pas passé nos vérifications : réessaie plus tard." },
};

function dateCourte(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" });
}

function Liste({ titre, icone, elements }: { titre: string; icone: NomIcone; elements: string[] }) {
  if (elements.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="inline-flex items-center gap-2 font-texte text-mini font-medium text-muted uppercase">
        <Icone nom={icone} taille={13} />
        {titre}
      </h3>
      <ul className="flex flex-col gap-2">
        {elements.map((e) => (
          <li key={e} className="border-l-2 border-line-strong pl-3 text-text-2">
            {typographie(e)}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AnalyseProgressionIA({
  format,
  elite,
  disponible,
  mesurable,
  partiesComparees,
  derniere,
  analyse,
  retour,
}: {
  format: FormatBilan;
  elite: boolean;
  /** La rédaction par l'IA est branchée (clé présente sur le serveur). */
  disponible: boolean;
  /** Assez de parties pour une tendance (10 dans le format, une tendance mesurée). */
  mesurable: boolean;
  partiesComparees: number;
  derniere: string | null;
  analyse: AnalyseEnregistree | null;
  /** Code renvoyé par l'action (?analyse=…). */
  retour?: string;
}) {
  const message = retour ? RETOURS[retour] : undefined;
  const nouvelles = analyse !== null && (analyse.parties !== partiesComparees || analyse.derniere_partie !== derniere);
  // Parties classées : lues chez Riot avec l'accord du joueur, pas jouées en tournoi.
  const parties = format === "classees" ? "parties classées lues chez Riot" : "parties vérifiées";

  const bouton = (libelle: string) =>
    disponible ? (
      <form action={demanderAnalyseProgression} className="flex flex-col items-start gap-2">
        <input type="hidden" name="format" value={format} />
        <BoutonEnvoi variante={analyse ? "contour" : "principal"} libelleEnCours="Rédaction en cours…">
          {libelle}
        </BoutonEnvoi>
        <p className="text-xs text-muted">{typographie("La rédaction prend quelques secondes : reste sur la page.")}</p>
      </form>
    ) : (
      <p className="text-sm text-muted">{typographie("La rédaction par l'IA est indisponible pour l'instant.")}</p>
    );

  return (
    <section id="analyse-ia" aria-labelledby="titre-analyse-ia" className="flex max-w-3xl scroll-mt-28 flex-col gap-5">
      <LibelleSection as="h2" id="titre-analyse-ia" className="border-b border-line-strong pb-4">
        Analyse de ta progression
      </LibelleSection>

      {message && <Alerte type={message.type}>{message.texte}</Alerte>}

      {!elite ? (
        <Panneau className="flex flex-col items-start gap-4 p-6">
          <p className="text-text-2">
            {typographie(
              `Avec l'offre Pro, une IA lit les chiffres de ce bilan et rédige ce qui progresse, ce qui recule et quoi travailler à tes prochaines parties. Elle ne voit que ces chiffres et tes champions, lus dans tes ${parties}.`,
            )}
          </p>
          <BoutonLien href="/tarifs" variante="secondaire">
            Voir l&apos;offre Pro
          </BoutonLien>
        </Panneau>
      ) : analyse ? (
        <Panneau className="flex flex-col gap-6 p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="rounded-bouton border border-line-strong px-2 py-0.5 font-texte text-mini font-semibold tracking-[2px] text-muted uppercase">
              Rédigée par une IA
            </span>
            <span className="text-xs text-muted tabular-nums">
              {typographie(
                `le ${dateCourte(analyse.cree_le)}, sur ${analyse.parties} ${parties}${
                  analyse.derniere_partie ? ` (jusqu'au ${dateCourte(analyse.derniere_partie)})` : ""
                }`,
              )}
            </span>
          </div>
          <p className="text-courant text-text">{typographie(analyse.resume)}</p>
          <Liste titre="Ce qui progresse" icone="fleche-droite" elements={analyse.progres} />
          <Liste titre="Ce qui recule" icone="alerte" elements={analyse.reculs} />
          <Liste titre="À travailler" icone="coche" elements={analyse.priorites} />
          <div className="flex flex-col items-start gap-2 border-t border-line pt-5">
            {nouvelles && mesurable ? (
              <>
                <p className="text-sm text-text-2">
                  {typographie("Tu as joué depuis : l'analyse peut tenir compte de tes nouvelles parties.")}
                </p>
                {bouton("Refaire l'analyse")}
              </>
            ) : (
              <p className="text-xs text-muted">{typographie("Tu pourras la refaire après tes prochaines parties.")}</p>
            )}
          </div>
        </Panneau>
      ) : mesurable ? (
        <Panneau className="flex flex-col items-start gap-4 p-6">
          <p className="text-text-2">
            {typographie(
              "L'IA lit tes tendances (tes 5 dernières parties contre les 5 précédentes), tes forces, tes axes de travail, ton plan et tes champions, puis rédige ce qui progresse, ce qui recule et quoi travailler.",
            )}
          </p>
          {bouton("Rédiger mon analyse")}
        </Panneau>
      ) : partiesComparees < PARTIES_MIN_PROGRESSION ? (
        <p className="text-text-2">
          {typographie(
            `Il faut ${PARTIES_MIN_PROGRESSION} ${parties} dans ce format pour comparer tes 5 dernières parties aux 5 précédentes : tu en as ${partiesComparees}.`,
          )}
        </p>
      ) : (
        <p className="text-text-2">
          {typographie(
            "Tes dernières parties ne permettent pas encore de mesurer une tendance : rejoue, l'analyse s'ouvrira ensuite.",
          )}
        </p>
      )}

      {elite && (
        <p className="text-xs text-muted">
          {typographie(
            "L'IA ne voit que les chiffres et les champions de cette page : ni le déroulé de tes parties, ni le KDA, ni l'or par minute. Elle peut se tromper ; les chiffres du bilan font foi. 10 demandes à l'IA par 24 h, revues de match comprises.",
          )}
        </p>
      )}
    </section>
  );
}
