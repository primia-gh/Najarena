import Link from "next/link";
import { reglerAnalyse } from "@/lib/analyse-actions";
import { libelleRang, PREMIERE_LECTURE_JOURS, PREMIERE_LECTURE_PARTIES } from "@/lib/analyse-classees";
import { formaterDate } from "@/lib/tournois";
import { classeBoutonContour } from "@/lib/design";
import BoutonEnvoi from "@/components/design/BoutonEnvoi";
import BoutonLien from "@/components/design/BoutonLien";
import LibelleSection from "@/components/design/LibelleSection";
import Panneau from "@/components/design/Panneau";
import BoutonConfirmation from "@/components/ui/BoutonConfirmation";

// Réglages de l'analyse du joueur (bilan, étape 2, 05/10/2026) : son accord
// pour la lecture de ses parties classées, et le bilan de la semaine sur
// Discord. Le texte dit exactement ce qui est lu, gardé et montré ; la base
// refuse tout réglage qui ne remplit pas les conditions (regler_analyse).

export interface EtatReglages {
  classees: boolean;
  classeesDepuis: string | null;
  bilanHebdo: boolean;
  derniereSynchro: string | null;
  palier: string | null;
  division: string | null;
  pointsLigue: number | null;
}

interface ReglagesAnalyseProps {
  etat: EtatReglages;
  compteVerifie: boolean;
  elite: boolean;
  discordLie: boolean;
  partiesLues: number;
  enAttente: number;
  format: string;
}

export default function ReglagesAnalyse({
  etat,
  compteVerifie,
  elite,
  discordLie,
  partiesLues,
  enAttente,
  format,
}: ReglagesAnalyseProps) {
  const rang = libelleRang(etat.palier, etat.division, etat.pointsLigue);
  const champs = (classees: boolean, bilanHebdo: boolean) => (
    <>
      <input type="hidden" name="classees" value={classees ? "oui" : "non"} />
      <input type="hidden" name="bilan_hebdo" value={bilanHebdo ? "oui" : "non"} />
      <input type="hidden" name="format" value={format} />
    </>
  );

  return (
    <section id="reglages" aria-labelledby="bilan-reglages" className="scroll-mt-28">
      <Panneau className="flex flex-col gap-8 p-6 sm:p-8">
        <LibelleSection as="h2" id="bilan-reglages">
          Tes parties classées et ton bilan de la semaine
        </LibelleSection>

        <div className="flex flex-col gap-4">
          <h3 className="font-titre text-2xl font-black uppercase">Parties classées</h3>
          {etat.classees ? (
            <>
              <p className="text-text-2 tabular-nums">
                Analyse active
                {etat.classeesDepuis ? ` depuis le ${formaterDate(etat.classeesDepuis)}` : ""} · {partiesLues} partie
                {partiesLues > 1 ? "s" : ""} analysée{partiesLues > 1 ? "s" : ""}
                {enAttente > 0 ? `, ${enAttente} en cours de lecture` : ""}
                {etat.derniereSynchro ? ` · dernière lecture chez Riot : ${formaterDate(etat.derniereSynchro)}` : " · première lecture dans les prochaines minutes"}
                .
              </p>
              {rang && <p className="text-sm text-muted">Rang Riot (classée) : {rang}.</p>}
              <form action={reglerAnalyse}>
                {champs(false, etat.bilanHebdo)}
                <BoutonConfirmation
                  type="submit"
                  className={classeBoutonContour()}
                  confirmation="Tes parties classées et ton rang Riot seront effacés de Najarena. Continuer ?"
                >
                  Arrêter et effacer mes parties classées
                </BoutonConfirmation>
              </form>
            </>
          ) : (
            <>
              <p className="text-text-2">
                Avec ton accord, Najarena lit chez Riot tes parties classées (Solo/Duo et Flexible) : les{" "}
                {PREMIERE_LECTURE_PARTIES} dernières sur {PREMIERE_LECTURE_JOURS} jours, puis les suivantes, et ton rang.
                On garde les chiffres de ta partie (champion, poste, farm, dégâts, vision, objets, runes, écart d&apos;or à
                15 minutes) et le lieu de chacune de tes morts.
              </p>
              <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-text-2">
                <li>Elles ne comptent jamais pour le classement Najarena : le classement reste celui des tournois.</li>
                <li>Elles sont visibles de toi seul. Les autres joueurs n&apos;en voient que des moyennes anonymes (5 joueurs au moins).</li>
                <li>Tu peux arrêter à tout moment : tes parties classées et ton rang sont alors effacés.</li>
              </ul>
              {compteVerifie ? (
                <form action={reglerAnalyse}>
                  {champs(true, etat.bilanHebdo)}
                  <BoutonEnvoi libelleEnCours="Activation…">Analyser mes parties classées</BoutonEnvoi>
                </form>
              ) : (
                <div className="flex flex-wrap items-center gap-4">
                  <p className="text-sm text-muted">D&apos;abord, lie et vérifie ton compte Riot principal.</p>
                  <BoutonLien href="/lier-riot" variante="secondaire">
                    Lier mon Riot ID
                  </BoutonLien>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex flex-col gap-4 border-t border-line pt-8">
          <h3 className="font-titre text-2xl font-black uppercase">Bilan de la semaine</h3>
          <p className="text-text-2">
            Chaque lundi, en message privé sur Discord : tes parties de la semaine, trois chiffres comparés à la semaine
            d&apos;avant et ta règle d&apos;arrêt s&apos;il y en a une. Seulement si tu as joué.
          </p>
          {!elite ? (
            <p className="text-sm text-muted">
              Fait partie de l&apos;offre Elite.{" "}
              <Link href="/tarifs?pour=joueur" className="text-text underline underline-offset-3 hover:text-accent">
                Voir l&apos;offre Elite
              </Link>
            </p>
          ) : !discordLie ? (
            <p className="text-sm text-muted">
              Connecte-toi une fois avec Discord pour le recevoir en message privé.
            </p>
          ) : (
            <form action={reglerAnalyse}>
              {champs(etat.classees, !etat.bilanHebdo)}
              <BoutonEnvoi variante={etat.bilanHebdo ? "contour" : "principal"} libelleEnCours="Enregistrement…">
                {etat.bilanHebdo ? "Ne plus recevoir mon bilan de la semaine" : "Recevoir mon bilan chaque lundi"}
              </BoutonEnvoi>
            </form>
          )}
        </div>
      </Panneau>
    </section>
  );
}
