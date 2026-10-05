import type { ReactNode } from "react";
import {
  detailConstat,
  formaterIndicateur,
  INDICATEURS,
  LIBELLE_POSTE,
  PARTIES_FIABLE,
  PARTIES_MIN_BILAN,
  PARTIES_MIN_BUILD_REFERENCE,
  PARTIES_MIN_REPERE,
  PARTIES_RECENTES,
  type Bilan,
  type BuildChampion,
  type CleIndicateur,
  type Constat,
  type ElementFrequent,
  type Objectif,
  type SerieProgression,
} from "@/lib/bilan";
import { championDe, objetDe, runeDe, sortDe, type DonneesJeu, type ElementJeu } from "@/lib/ddragon";
import BoutonLien from "@/components/design/BoutonLien";
import LibelleSection from "@/components/design/LibelleSection";
import Panneau from "@/components/design/Panneau";
import Tableau from "@/components/design/Tableau";
import CourbeIndicateur, { dateCourte } from "./CourbeIndicateur";
import IconeJeu from "./IconeJeu";

// Affichage du bilan du joueur (étape 1, 05/10/2026), commun à la vraie page
// (/moi/bilan) et à l'exemple (/lol/bilan). Le bilan express (résumé,
// forces, axes de travail) est gratuit ; le plan, la progression, les
// champions et les builds sont réservés à l'offre Elite. Rien n'est montré
// sans donnée : une section sans chiffres dit ce qu'il manque.

interface VueBilanProps {
  bilan: Bilan;
  builds: BuildChampion[];
  donnees: DonneesJeu | null;
  /** Bilan complet (offre Elite, ou page d'exemple) ; sinon le bilan express seul. */
  complet: boolean;
}

const TITRE_H2 = "font-titre text-3xl font-black tracking-[1px] uppercase sm:text-4xl";
const PETIT_LIBELLE = "font-texte text-mini font-medium uppercase text-faint";

function pourcentage(part: number): string {
  return `${Math.round(part * 100)} %`;
}

function libelleFormat(bilan: Bilan): string {
  return bilan.format === "5v5" && bilan.postePrincipal
    ? `5v5 au poste ${LIBELLE_POSTE[bilan.postePrincipal] ?? bilan.postePrincipal}`
    : bilan.format;
}

function Fiabilite({ c }: { c: Constat }) {
  return (
    <p className="mt-3 font-texte text-xs text-faint tabular-nums">
      {c.fiabilite === "fiable" ? "Fiable" : "Indicatif"} · {c.partiesJoueur} partie{c.partiesJoueur > 1 ? "s" : ""}
      {c.fiabilite === "indicatif" && ` (fiable à partir de ${PARTIES_FIABLE})`}
    </p>
  );
}

// ---------- Résumé ----------

function Tuile({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-t border-line-strong pt-4">
      <p className={PETIT_LIBELLE}>{libelle}</p>
      <div className="font-texte text-text">{children}</div>
    </div>
  );
}

function Resume({ bilan, donnees }: { bilan: Bilan; donnees: DonneesJeu | null }) {
  const champion = bilan.championPrincipal;
  const element = champion ? championDe(donnees, champion.champion, champion.championId) : null;
  return (
    <section aria-labelledby="bilan-resume" className="flex flex-col gap-5">
      <LibelleSection as="h2" id="bilan-resume">
        En bref · {libelleFormat(bilan)}
      </LibelleSection>
      <div className="grid grid-cols-2 gap-x-6 gap-y-6 lg:grid-cols-4">
        <Tuile libelle="Parties vérifiées">
          <p className="font-titre text-4xl font-black tabular-nums">{bilan.parties}</p>
          {bilan.postePrincipal && bilan.partiesComparees !== bilan.parties && (
            <p className="mt-1 text-xs text-muted tabular-nums">
              dont {bilan.partiesComparees} au poste {LIBELLE_POSTE[bilan.postePrincipal]}
            </p>
          )}
        </Tuile>
        <Tuile libelle="Victoires">
          <p className="font-titre text-4xl font-black tabular-nums">
            {bilan.victoires}
            <span className="ml-2 font-texte text-base font-medium text-muted">
              {bilan.parties > 0 ? pourcentage(bilan.victoires / bilan.parties) : "—"}
            </span>
          </p>
        </Tuile>
        <Tuile libelle="Champion le plus joué">
          {champion && element ? (
            <div className="flex items-center gap-3">
              <IconeJeu element={element} taille={40} decorative />
              <div>
                <p className="font-semibold">{element.nom}</p>
                <p className="text-xs text-muted tabular-nums">
                  {champion.parties} partie{champion.parties > 1 ? "s" : ""}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-muted">—</p>
          )}
        </Tuile>
        <Tuile libelle="Période">
          <p className="font-semibold tabular-nums">
            {bilan.premiere && bilan.derniere ? `${dateCourte(bilan.premiere)} → ${dateCourte(bilan.derniere)}` : "—"}
          </p>
        </Tuile>
      </div>
    </section>
  );
}

// ---------- Bilan express ----------

function SourceComparaison({ bilan }: { bilan: Bilan }) {
  if (bilan.comparaison === "vainqueurs") {
    const complement = [...bilan.forces, ...bilan.axes].some((c) => c.source !== "vainqueurs");
    return (
      <p className="text-sm text-text-2">
        Comparé aux vainqueurs de {bilan.partiesRepere} parties vérifiées d&apos;autres joueurs ({libelleFormat(bilan)}),
        sans tes propres parties.
        {complement &&
          " Quand rien ne ressort face à eux, ton bilan compare aussi tes victoires à tes défaites, et tes dernières parties aux précédentes."}
      </p>
    );
  }
  if (bilan.comparaison === "tes_parties" && bilan.format === "5v5" && !bilan.postePrincipal) {
    return (
      <p className="text-sm text-text-2">
        Ton poste n&apos;est pas connu dans ces parties (Riot ne le donne pas toujours dans les parties personnalisées) :
        sans lui, pas de comparaison juste avec les autres joueurs. Ton bilan compare tes victoires à tes défaites, et
        tes {PARTIES_RECENTES} dernières parties aux précédentes.
      </p>
    );
  }
  if (bilan.comparaison === "tes_parties") {
    return (
      <p className="text-sm text-text-2">
        Il n&apos;y a pas encore assez de parties vérifiées sur Najarena pour un repère commun ({PARTIES_MIN_REPERE} au
        moins) : ton bilan compare tes victoires à tes défaites, et tes {PARTIES_RECENTES} dernières parties aux
        précédentes.
      </p>
    );
  }
  return null;
}

function BilanExpress({ bilan }: { bilan: Bilan }) {
  const vide = bilan.forces.length === 0 && bilan.axes.length === 0;
  return (
    <section aria-labelledby="bilan-express" className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h2 id="bilan-express" className={TITRE_H2}>
          Tes forces et tes axes de travail
        </h2>
        <SourceComparaison bilan={bilan} />
      </div>
      {vide ? (
        <p className="text-text-2">
          Aucun écart assez net pour en tirer une conclusion. Continue à jouer : ton bilan se précise à chaque partie
          vérifiée.
        </p>
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <h3 className="font-texte text-sm font-bold tracking-[2px] text-text uppercase">
              <span aria-hidden="true" className="mr-2 text-accent">
                ✓
              </span>
              Tes forces
            </h3>
            {bilan.forces.length === 0 ? (
              <p className="text-sm text-muted">Aucune force nette pour l&apos;instant.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {bilan.forces.map((c) => (
                  <li key={c.indicateur} className="rounded-carte border border-line bg-surface/60 p-4">
                    <p className="font-semibold text-text">{INDICATEURS[c.indicateur].libelle}</p>
                    <p className="mt-1 text-sm text-text-2 tabular-nums">{detailConstat(c)}</p>
                    <Fiabilite c={c} />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-col gap-4">
            <h3 className="font-texte text-sm font-bold tracking-[2px] text-text uppercase">
              <span aria-hidden="true" className="mr-2 text-text-2">
                ↗
              </span>
              Tes axes de travail
            </h3>
            {bilan.axes.length === 0 ? (
              <p className="text-sm text-muted">Aucun axe de travail net pour l&apos;instant.</p>
            ) : (
              <ol className="flex flex-col gap-3">
                {bilan.axes.map((c, i) => (
                  <li key={c.indicateur} className="rounded-carte border border-line bg-surface/60 p-4">
                    <p className="font-semibold text-text">
                      <span className="mr-2 font-titre text-faint tabular-nums">{i + 1}.</span>
                      {INDICATEURS[c.indicateur].libelle}
                    </p>
                    <p className="mt-1 text-sm text-text-2 tabular-nums">{detailConstat(c)}</p>
                    <p className="mt-3 text-sm text-text">
                      <span className="font-semibold">Conseil : </span>
                      {INDICATEURS[c.indicateur].conseil?.[bilan.format]}
                    </p>
                    <Fiabilite c={c} />
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
      {bilan.auNiveau.length > 0 && (
        <p className="text-sm text-muted">
          Dans la moyenne des vainqueurs : {bilan.auNiveau.map((cle) => INDICATEURS[cle].libelle.toLowerCase()).join(", ")}.
        </p>
      )}
    </section>
  );
}

// ---------- Plan d'entraînement ----------

const STATUT: Record<Objectif["statut"], { texte: string; signe: string; classe: string }> = {
  atteint: { texte: "Atteint", signe: "✓", classe: "border-accent/40 text-accent" },
  en_bonne_voie: { texte: "En bonne voie", signe: "↗", classe: "border-line-strong text-text" },
  a_travailler: { texte: "À travailler", signe: "•", classe: "border-line-strong text-muted" },
};

function Plan({ bilan }: { bilan: Bilan }) {
  return (
    <section aria-labelledby="bilan-plan" className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <h2 id="bilan-plan" className={TITRE_H2}>
          Ton plan d&apos;entraînement
        </h2>
        <p className="text-sm text-text-2">
          Un objectif par axe de travail : atteindre la moyenne de référence. Il est suivi sur tes{" "}
          {PARTIES_RECENTES} dernières parties, recalculé à chaque partie vérifiée.
        </p>
      </div>
      {bilan.plan.length === 0 ? (
        <p className="text-text-2">Pas d&apos;axe de travail net : pas d&apos;objectif à fixer pour l&apos;instant.</p>
      ) : (
        <ol className="grid gap-4 lg:grid-cols-3">
          {bilan.plan.map((o) => {
            const statut = STATUT[o.statut];
            const fmt = (v: number) => formaterIndicateur(o.indicateur, v);
            return (
              <li key={o.indicateur}>
                <Panneau className="flex h-full flex-col gap-3 p-5">
                  <p className="font-semibold text-text">{INDICATEURS[o.indicateur].libelle}</p>
                  <p className="font-titre text-3xl font-black tabular-nums">
                    {fmt(o.cible)}
                    <span className="ml-2 font-texte text-xs font-medium tracking-[2px] text-muted uppercase">
                      objectif
                    </span>
                  </p>
                  <dl className="grid grid-cols-2 gap-2 text-sm tabular-nums">
                    <div>
                      <dt className="text-xs text-faint">{o.source === "tes_victoires" ? "Toutes tes parties" : "Ta moyenne"}</dt>
                      <dd className="text-text-2">{fmt(o.actuel)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-faint">{PARTIES_RECENTES} dernières</dt>
                      <dd className="text-text">{o.recent === null ? "—" : fmt(o.recent)}</dd>
                    </div>
                  </dl>
                  <p
                    className={`mt-auto inline-flex w-fit items-center gap-2 rounded-bouton border px-2.5 py-1 font-texte text-xs font-semibold tracking-[1px] uppercase ${statut.classe}`}
                  >
                    <span aria-hidden="true">{statut.signe}</span>
                    {statut.texte}
                  </p>
                  {o.source === "tes_victoires" && (
                    <p className="text-xs text-faint">Objectif = ta moyenne dans tes victoires.</p>
                  )}
                </Panneau>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

// ---------- Progression ----------

const TENDANCE: Record<NonNullable<SerieProgression["tendance"]>, string> = {
  progres: "↗ En progrès",
  recul: "↘ En recul",
  stable: "→ Stable",
};

/** Courbes montrées : les axes de travail d'abord, puis les indicateurs clés. */
function seriesMontrees(bilan: Bilan): SerieProgression[] {
  const ordre: CleIndicateur[] = [
    ...bilan.axes.map((a) => a.indicateur),
    "kda",
    "sbires_min",
    "morts_10min",
    "degats_min",
    "vision_min",
  ];
  return [...new Set(ordre)]
    .flatMap((cle) => bilan.progression.filter((s) => s.indicateur === cle))
    .slice(0, 4);
}

function Progression({ bilan }: { bilan: Bilan }) {
  const series = seriesMontrees(bilan);
  return (
    <section aria-labelledby="bilan-progression" className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <h2 id="bilan-progression" className={TITRE_H2}>
          Ta progression
        </h2>
        <p className="text-sm text-text-2">
          Partie par partie : point plein = victoire, point creux = défaite ; la ligne verte est ta moyenne sur tes{" "}
          {PARTIES_RECENTES} dernières parties (à partir de la {PARTIES_RECENTES}e), le pointillé la moyenne des
          vainqueurs. Survole un point pour son détail.
        </p>
      </div>
      {series.length === 0 ? (
        <p className="text-text-2">Pas encore assez de parties pour tracer une courbe.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {series.map((s) => {
            const fmt = (v: number) => formaterIndicateur(s.indicateur, v);
            const derniere = s.points[s.points.length - 1];
            return (
              <Panneau key={s.indicateur} className="flex flex-col gap-3 p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-semibold text-text">{INDICATEURS[s.indicateur].libelle}</h3>
                  {s.tendance && <p className="text-xs font-semibold tracking-[1px] text-text-2 uppercase">{TENDANCE[s.tendance]}</p>}
                </div>
                <p className="text-sm text-muted tabular-nums">
                  {derniere.moyenne !== null && `${fmt(derniere.moyenne)} sur tes ${PARTIES_RECENTES} dernières parties`}
                  {s.precedente !== null && ` · ${fmt(s.precedente)} sur les ${PARTIES_RECENTES} d'avant`}
                </p>
                <CourbeIndicateur serie={s} />
                <details className="text-sm">
                  <summary className="inline-flex min-h-11 cursor-pointer items-center text-muted hover:text-text">
                    Voir les chiffres
                  </summary>
                  <Tableau legende={`${INDICATEURS[s.indicateur].libelle}, partie par partie`} className="mt-2">
                    <thead>
                      <tr>
                        <th scope="col">Partie</th>
                        <th scope="col">Valeur</th>
                        <th scope="col">Moyenne sur {PARTIES_RECENTES}</th>
                        <th scope="col">Résultat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...s.points].reverse().map((p, i) => (
                        <tr key={`${p.joueLe}-${i}`}>
                          <td className="tabular-nums">{dateCourte(p.joueLe)}</td>
                          <td className="tabular-nums">{fmt(p.valeur)}</td>
                          <td className="tabular-nums">{p.moyenne === null ? "—" : fmt(p.moyenne)}</td>
                          <td>{p.gagne ? "Victoire" : "Défaite"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Tableau>
                </details>
              </Panneau>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ---------- Champions ----------

const APPRENTISSAGE: Record<NonNullable<Bilan["champions"][number]["apprentissage"]>, string> = {
  progres: "↗ En progrès",
  recul: "↘ En recul",
  stable: "→ Stable",
};

function Champions({ bilan, donnees }: { bilan: Bilan; donnees: DonneesJeu | null }) {
  const solide = bilan.championLePlusSolide;
  return (
    <section aria-labelledby="bilan-champions" className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <h2 id="bilan-champions" className={TITRE_H2}>
          Tes champions
        </h2>
        {solide && (
          <p className="text-sm text-text-2 tabular-nums">
            Ton champion le plus sûr : <strong className="text-text">{championDe(donnees, solide.champion, solide.championId).nom}</strong>,{" "}
            {solide.victoires} victoire{solide.victoires > 1 ? "s" : ""} sur {solide.parties} parties (le classement
            tient compte du nombre de parties : 3 sur 3 compte moins que 9 sur 10).
          </p>
        )}
      </div>
      <Tableau legende={`Tes champions en ${bilan.format}`}>
        <thead>
          <tr>
            <th scope="col">Champion</th>
            <th scope="col">Parties</th>
            <th scope="col">Victoires</th>
            <th scope="col">KDA</th>
            <th scope="col">Sbires / min</th>
            <th scope="col">Évolution</th>
          </tr>
        </thead>
        <tbody>
          {bilan.champions.map((c) => {
            const element = championDe(donnees, c.champion, c.championId);
            return (
              <tr key={c.champion}>
                <td>
                  <span className="flex items-center gap-3">
                    <IconeJeu element={element} taille={28} decorative />
                    {element.nom}
                  </span>
                </td>
                <td className="tabular-nums">{c.parties}</td>
                <td className="tabular-nums">
                  {c.victoires} <span className="text-muted">({pourcentage(c.victoires / c.parties)})</span>
                </td>
                <td className="tabular-nums">{formaterIndicateur("kda", c.kda)}</td>
                <td className="tabular-nums">{c.sbiresMin === null ? "—" : formaterIndicateur("sbires_min", c.sbiresMin)}</td>
                <td className="text-text-2">
                  {c.apprentissage ? APPRENTISSAGE[c.apprentissage] : <span className="text-faint">6 parties au moins</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Tableau>
    </section>
  );
}

// ---------- Builds ----------

function Element({ element, legende }: { element: ElementJeu; legende: string }) {
  return (
    <li className="flex w-[3.25rem] flex-col items-center gap-1.5 text-center">
      <IconeJeu element={element} taille={40} />
      <span className="text-[11px] leading-tight text-muted tabular-nums">{legende}</span>
    </li>
  );
}

function LigneBuild({
  titre,
  objets,
  runes,
  sorts,
  donnees,
  legende,
}: {
  titre: string;
  objets: ElementFrequent[];
  runes: ElementFrequent[];
  sorts: ElementFrequent[];
  donnees: DonneesJeu | null;
  legende: (e: ElementFrequent) => string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className={PETIT_LIBELLE}>{titre}</p>
      <div className="flex flex-wrap gap-x-6 gap-y-4">
        <div className="flex flex-col gap-2">
          <p className="text-xs text-faint">Objets</p>
          <ul className="flex flex-wrap gap-2">
            {objets.map((o) => (
              <Element key={o.valeur} element={objetDe(donnees, o.valeur)} legende={legende(o)} />
            ))}
          </ul>
        </div>
        {runes[0] && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-faint">Rune principale</p>
            <ul className="flex gap-2">
              <Element element={runeDe(donnees, runes[0].valeur)} legende={legende(runes[0])} />
            </ul>
          </div>
        )}
        {sorts[0] && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-faint">Sorts</p>
            <ul className="flex gap-2">
              {sorts[0].valeur.split(",").map((id, i) => (
                <Element
                  key={id}
                  element={sortDe(donnees, id)}
                  legende={i === 0 ? legende(sorts[0]) : ""}
                />
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function Builds({ bilan, builds, donnees }: { bilan: Bilan; builds: BuildChampion[]; donnees: DonneesJeu | null }) {
  return (
    <section aria-labelledby="bilan-builds" className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <h2 id="bilan-builds" className={TITRE_H2}>
          Tes builds
        </h2>
        <p className="text-sm text-text-2">
          Ce que tu as en fin de partie sur tes champions les plus joués (potions et balises écartées), comparé à ce que
          prennent les vainqueurs sur le même champion en {bilan.format}, dans les parties vérifiées d&apos;autres
          joueurs. Survole une icône pour son nom.
        </p>
        {!donnees && (
          <p className="text-sm text-muted">
            Noms et icônes du jeu indisponibles pour le moment : Data Dragon, le serveur d&apos;images de Riot, ne répond
            pas. Réessaie dans quelques minutes.
          </p>
        )}
      </div>
      {builds.length === 0 ? (
        <p className="text-text-2">Pas encore de partie avec le détail des objets.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {builds.map((b) => {
            const champion = championDe(donnees, b.champion, b.championId);
            return (
              <Panneau key={b.champion} className="flex flex-col gap-6 p-5 sm:p-6">
                <div className="flex items-center gap-4">
                  <IconeJeu element={champion} taille={48} decorative />
                  <div>
                    <h3 className="font-titre text-2xl font-black uppercase">{champion.nom}</h3>
                    <p className="text-sm text-muted tabular-nums">
                      {b.parties} partie{b.parties > 1 ? "s" : ""} · {b.victoires} victoire{b.victoires > 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                {b.joueur.objets.length + b.joueur.runes.length === 0 ? (
                  <p className="text-sm text-muted">
                    Le détail des objets n&apos;est gardé que pour les parties jouées depuis le 5 octobre 2026.
                  </p>
                ) : (
                  <LigneBuild
                    titre="Ton build"
                    objets={b.joueur.objets}
                    runes={b.joueur.runes}
                    sorts={b.joueur.sorts}
                    donnees={donnees}
                    legende={(e) => `${e.parties}/${b.parties}`}
                  />
                )}
                {b.reference ? (
                  <LigneBuild
                    titre={`Les vainqueurs · ${b.reference.victoires} victoires sur ${b.reference.parties} parties`}
                    objets={b.reference.objets}
                    runes={b.reference.runes}
                    sorts={b.reference.sorts}
                    donnees={donnees}
                    legende={(e) => pourcentage(e.part)}
                  />
                ) : (
                  <p className="text-sm text-muted">
                    Pas encore assez de parties d&apos;autres joueurs sur {champion.nom} en {bilan.format} pour un build
                    de référence ({PARTIES_MIN_BUILD_REFERENCE} au moins).
                  </p>
                )}
                {b.aEssayer.length > 0 && (
                  <div className="flex flex-col gap-2 border-t border-line pt-4">
                    <p className={PETIT_LIBELLE}>À essayer</p>
                    <ul className="flex flex-col gap-2">
                      {b.aEssayer.map((e) => {
                        const element = e.genre === "objet" ? objetDe(donnees, e.valeur) : runeDe(donnees, e.valeur);
                        return (
                          <li key={`${e.genre}-${e.valeur}`} className="flex items-center gap-3 text-sm text-text-2">
                            <IconeJeu element={element} taille={32} decorative />
                            <span className="tabular-nums">
                              <strong className="text-text">{element.nom}</strong> : présent dans{" "}
                              {pourcentage(e.partVainqueurs)} des victoires sur {champion.nom},{" "}
                              {e.partJoueur === 0 ? "jamais dans tes parties" : `dans ${pourcentage(e.partJoueur)} de tes parties`}.
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </Panneau>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ---------- Offre Elite ----------

function Verrou() {
  return (
    <section aria-labelledby="bilan-elite">
      <Panneau className="flex flex-col gap-5 p-6 sm:p-8">
        <LibelleSection as="h2" id="bilan-elite">
          Bilan complet · offre Elite
        </LibelleSection>
        <ul className="flex flex-col gap-2 text-text-2">
          <li>Ton plan d&apos;entraînement : un objectif chiffré par axe de travail, suivi partie après partie.</li>
          <li>Ta progression partie par partie, comparée à la moyenne des vainqueurs.</li>
          <li>Tes champions : taux de victoire, KDA, farm, ton champion le plus sûr.</li>
          <li>Tes builds comparés à ceux des vainqueurs sur le même champion, avec les icônes du jeu.</li>
        </ul>
        <div className="flex flex-wrap items-center gap-4">
          <BoutonLien href="/tarifs?pour=joueur">Voir l&apos;offre Elite</BoutonLien>
          <BoutonLien href="/lol/bilan" variante="secondaire">
            Voir un bilan d&apos;exemple
          </BoutonLien>
        </div>
      </Panneau>
    </section>
  );
}

// ---------- Méthode ----------

export function MethodeBilan() {
  return (
    <details className="rounded-carte border border-line p-5 text-sm text-text-2">
      <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-text">
        Comment ce bilan est calculé
      </summary>
      <ul className="mt-3 flex list-disc flex-col gap-2 pl-5">
        <li>
          Seulement des parties vérifiées : résultat et statistiques lus chez Riot. Un match tranché à la main par un
          organisateur n&apos;y entre jamais.
        </li>
        <li>
          Les parties au 1v1 classique (premier sang, première tour ou 100 sbires) n&apos;y entrent pas : elles
          continuent après la condition remplie, leurs chiffres ne se comparent pas à ceux d&apos;une partie jouée
          jusqu&apos;au Nexus.
        </li>
        <li>
          Repère : la moyenne des vainqueurs des parties vérifiées des autres joueurs, dans le même format (et au même
          poste en 5v5), dès {PARTIES_MIN_REPERE} parties. Un indicateur qui ne sépare pas vainqueurs et perdants
          n&apos;est jamais donné comme force ou comme axe. Le KDA et l&apos;or, qui suivent surtout l&apos;issue de la
          partie, sont montrés mais jamais donnés comme conseil.
        </li>
        <li>
          Un constat est « indicatif » sous {PARTIES_FIABLE} parties. Il faut {PARTIES_MIN_BILAN} parties vérifiées
          pour un premier bilan.
        </li>
        <li>
          Sbires par minute : sbires et monstres tués, divisés par la durée de la partie. Sbires à 10 minutes : seulement
          les parties d&apos;au moins 10 minutes. Morts par 10 minutes : morts rapportées à 10 minutes de jeu.
        </li>
        <li>
          Builds : objets en fin de partie (potions, élixirs et balises écartés), rune principale et sorts
          d&apos;invocateur. Le détail des objets n&apos;est gardé que depuis le 5 octobre 2026.
        </li>
        <li>
          Aucun texte n&apos;est rédigé par une IA : chaque constat est un calcul sur tes parties, avec ses chiffres. Les
          icônes et les noms du jeu viennent de Data Dragon, la bibliothèque publique de Riot Games.
        </li>
      </ul>
    </details>
  );
}

// ---------- Page ----------

export default function VueBilan({ bilan, builds, donnees, complet }: VueBilanProps) {
  return (
    <div className="flex flex-col gap-14">
      <Resume bilan={bilan} donnees={donnees} />
      {bilan.partiesManquantes > 0 ? (
        <Panneau as="section" className="flex flex-col gap-4 p-6 sm:p-8">
          <h2 className="font-titre text-3xl font-black uppercase">
            Encore {bilan.partiesManquantes} partie{bilan.partiesManquantes > 1 ? "s" : ""}
          </h2>
          <p className="text-text-2">
            Il faut {PARTIES_MIN_BILAN} parties vérifiées pour un premier bilan. Chaque partie lue chez Riot compte :
            tournoi, arène ou défi.
          </p>
          <div className="flex flex-wrap gap-4">
            <BoutonLien href="/lol/tournois">Voir les tournois</BoutonLien>
            <BoutonLien href="/lol/arene" variante="secondaire">
              Entrer dans l&apos;arène
            </BoutonLien>
          </div>
        </Panneau>
      ) : (
        <BilanExpress bilan={bilan} />
      )}
      {complet ? (
        <>
          {bilan.partiesManquantes === 0 && <Plan bilan={bilan} />}
          {bilan.partiesManquantes === 0 && <Progression bilan={bilan} />}
          {bilan.champions.length > 0 && <Champions bilan={bilan} donnees={donnees} />}
          {bilan.champions.length > 0 && <Builds bilan={bilan} builds={builds} donnees={donnees} />}
        </>
      ) : (
        <Verrou />
      )}
      <MethodeBilan />
    </div>
  );
}
