import Link from "next/link";
import BracketBackground from "@/components/BracketBackground";
import FondArene from "@/components/accueil/FondArene";
import Reveal from "@/components/accueil/Reveal";
import CompteurAnime from "@/components/accueil/CompteurAnime";
import SceauVitrine from "@/components/accueil/SceauVitrine";
import CarteMatch from "@/components/accueil/CarteMatch";
import { createClient } from "@/lib/supabase/server";
import { COULEUR_PALIER } from "@/lib/paliers";

async function chargerPreuveSociale() {
  const supabase = await createClient();

  const [{ count: tournois }, { count: matchs }, { count: joueurs }] = await Promise.all([
    supabase.from("tournaments").select("*", { count: "exact", head: true }).eq("statut", "termine"),
    supabase
      .from("match_verdicts")
      .select("*", { count: "exact", head: true })
      .eq("est_definitif", true),
    supabase.from("ratings").select("*", { count: "exact", head: true }).eq("est_classe", true),
  ]);

  return {
    tournois: tournois ?? 0,
    matchs: matchs ?? 0,
    joueurs: joueurs ?? 0,
  };
}

async function chargerPaliers() {
  const supabase = await createClient();

  // game_id=1 est LoL — seule ligne de `games` en V1 (même convention que
  // /lol/classement). Évite un aller-retour supplémentaire pour résoudre
  // l'id depuis le slug avant de pouvoir requêter les paliers ; c'était
  // le vrai goulot de l'accueil (chargerPreuveSociale, en revanche, est
  // déjà bien parallélisée).
  const { data } = await supabase
    .from("tiers")
    .select("nom, rating_min, ordre")
    .eq("game_id", 1)
    .order("ordre", { ascending: true });

  return data ?? [];
}

export default async function Home() {
  const [preuve, paliers] = await Promise.all([chargerPreuveSociale(), chargerPaliers()]);

  // Jamais de chiffre inventé : chaque statistique de trafic vient d'un
  // vrai compte en base, et une statistique à zéro ne s'affiche pas plutôt
  // que d'afficher "0" (qui découragerait sans rien prouver). Les
  // constantes du moteur (rating initial, seuil de classement, niveaux de
  // preuve), elles, sont vraies dès le premier jour, sans trafic.
  const statsTrafic = [
    { valeur: preuve.joueurs, libelle: "joueurs classés" },
    { valeur: preuve.tournois, libelle: "tournois joués" },
    { valeur: preuve.matchs, libelle: "matchs enregistrés" },
  ].filter((s) => s.valeur > 0);

  const echelleMax = paliers.length > 0 ? paliers[paliers.length - 1].rating_min * 1.12 : 1;

  return (
    <div className="bg-papier">
      {/* ================= HERO ================= */}
      <section className="relative isolate flex min-h-screen flex-col justify-center overflow-hidden px-6 pt-36 pb-24">
        <BracketBackground />
        <FondArene />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 60%, rgba(11,14,20,.15) 0%, rgba(11,14,20,.82) 72%)",
          }}
        />

        <div className="relative mx-auto w-full max-w-2xl">
          <Reveal>
            <span className="font-mono text-[0.64rem] uppercase tracking-[0.24em] text-[var(--color-ardoise)]">
              League of Legends · 1v1 &amp; 5v5 quotidiens
            </span>
          </Reveal>

          <Reveal delai={0.08}>
            <h1 className="mt-3 font-display text-5xl leading-[0.98] font-extrabold tracking-tight text-[var(--color-encre)] sm:text-7xl">
              Ton niveau,
              <br />
              <span className="text-[var(--color-sceau)]">vérifié.</span>
            </h1>
          </Reveal>

          <Reveal delai={0.16}>
            <p className="mt-4 max-w-md text-[1.02rem] text-[#B9BFC7]">
              Des tournois quotidiens en 1v1 et 5v5. Les résultats sont lus
              dans la partie officielle — aucune capture d&apos;écran, aucun
              litige. Ton classement devient une preuve.
            </p>
          </Reveal>

          <Reveal delai={0.24}>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <Link
                href="/lol/tournois"
                className="rounded-[2px] bg-[var(--color-sceau)] px-5 py-3 text-sm font-semibold text-[#14090C] shadow-[0_8px_24px_-6px_var(--color-sceau-lueur)] transition hover:-translate-y-0.5 hover:brightness-110"
                style={{ clipPath: "polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%)" }}
              >
                Voir les tournois
              </Link>
              <Link
                href="/lol/classement"
                className="rounded-[2px] border border-white/20 bg-white/6 px-5 py-3 text-sm font-semibold text-[var(--color-encre)] transition hover:border-white/40"
                style={{ clipPath: "polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%)" }}
              >
                Voir le classement
              </Link>
            </div>
          </Reveal>

          <Reveal delai={0.32}>
            <dl className="mt-10 flex flex-wrap gap-x-8 gap-y-3 border-t border-white/10 pt-6">
              <div>
                <dd className="font-mono text-2xl font-bold tracking-tight text-[var(--color-encre)]">1v1 · 5v5</dd>
                <dt className="font-mono text-[0.62rem] tracking-[0.14em] text-[var(--color-ardoise)] uppercase">Formats</dt>
              </div>
              <div>
                <dd className="font-mono text-2xl font-bold tracking-tight text-[var(--color-encre)]">3</dd>
                <dt className="font-mono text-[0.62rem] tracking-[0.14em] text-[var(--color-ardoise)] uppercase">Niveaux de preuve</dt>
              </div>
              <div>
                <dd className="font-mono text-2xl font-bold tracking-tight text-[var(--color-encre)]">24/7</dd>
                <dt className="font-mono text-[0.62rem] tracking-[0.14em] text-[var(--color-ardoise)] uppercase">Suivi en direct</dt>
              </div>
            </dl>
          </Reveal>
        </div>
      </section>

      {/* ================= SYSTÈME DE VERDICT ================= */}
      <section className="relative bg-gradient-to-b from-[var(--color-papier)] to-[var(--color-fond-2)] px-6 py-28">
        <div className="mx-auto grid max-w-5xl items-center gap-16 md:grid-cols-2">
          <Reveal>
            <span className="font-mono text-[0.7rem] tracking-[0.24em] text-[var(--color-ardoise)] uppercase">
              Le système de verdict
            </span>
            <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-[var(--color-encre)] sm:text-4xl">
              On n&apos;invente
              <br />
              jamais un résultat.
            </h2>
            <p className="mt-4 max-w-md text-[var(--color-ardoise)]">
              Chaque match consomme un verdict qui porte son propre niveau de
              fiabilité, affiché publiquement. En cas de doute, on escalade
              vers l&apos;organisateur — jamais de résultat supposé.
            </p>

            <div className="mt-6 flex flex-col gap-2.5">
              {[
                { n: "03", l: "Code de tournoi Riot", s: "Lecture directe de l'API — la preuve la plus forte", compte: true },
                { n: "02", l: "Retrouvé dans l'historique", s: "Rapproché automatiquement depuis les parties Riot", compte: true },
                { n: "01", l: "Décision manuelle", s: "Tranchée par l'organisateur, motif affiché", compte: false },
              ].map((niv) => (
                <div
                  key={niv.n}
                  className="flex items-center gap-3.5 border border-[var(--color-trait)] bg-[var(--color-carte)] px-4 py-3"
                >
                  <span
                    className={`w-5 font-mono text-sm font-bold ${niv.compte ? "text-[var(--color-atteste)]" : "text-[var(--color-ardoise)]"}`}
                  >
                    {niv.n}
                  </span>
                  <span className="text-[0.86rem] text-[var(--color-encre)]">
                    {niv.l}
                    <small className="mt-0.5 block text-[0.76rem] text-[var(--color-ardoise)]">{niv.s}</small>
                  </span>
                  <span
                    className={`ml-auto font-mono text-[0.62rem] tracking-[0.08em] uppercase ${niv.compte ? "text-[var(--color-atteste)]" : "text-[var(--color-ardoise)]"}`}
                  >
                    {niv.compte ? "Compte" : "Hors classement"}
                  </span>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delai={0.1}>
            <CarteMatch />
          </Reveal>
        </div>
      </section>

      {/* ================= SCEAU DE FIABILITÉ ================= */}
      <section className="relative bg-[var(--color-fond-2)] px-6 py-28 text-center">
        <Reveal className="mx-auto max-w-lg">
          <span className="font-mono text-[0.7rem] tracking-[0.24em] text-[var(--color-ardoise)] uppercase">
            Élément signature
          </span>
          <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-[var(--color-encre)] sm:text-4xl">
            Le sceau de fiabilité.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[var(--color-ardoise)]">
            Une couronne de crans dont le remplissage traduit le calibrage de
            ton classement (RD). Non calibré, il reste pâle et incomplet — il
            se referme match après match.
          </p>
        </Reveal>

        <Reveal delai={0.15} className="mt-10">
          <SceauVitrine cible={68} />
        </Reveal>
      </section>

      {/* ================= TROIS FAÇONS D'ENTRER ================= */}
      <section className="relative px-6 py-28">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <span className="font-mono text-[0.7rem] tracking-[0.24em] text-[var(--color-ardoise)] uppercase">
              Par où commencer
            </span>
            <h2 className="mt-3 max-w-lg font-display text-3xl font-extrabold tracking-tight text-[var(--color-encre)] sm:text-4xl">
              Trois façons d&apos;entrer dans l&apos;arène.
            </h2>
          </Reveal>

          <Reveal delai={0.1}>
            <div className="mt-10 grid grid-cols-1 gap-px border border-[var(--color-trait)] bg-[var(--color-trait)] sm:grid-cols-3">
              {[
                {
                  titre: "Je veux jouer",
                  texte: "Des tournois quotidiens en 1v1 et 5v5, ton classement qui progresse à chaque résultat vérifié.",
                  cta: "Voir les tournois",
                  href: "/lol/tournois",
                },
                {
                  titre: "Je cherche une équipe",
                  texte: "Publie une annonce ou rejoins un effectif qui a besoin de toi — pas de 5-stack obligatoire.",
                  cta: "Trouver un coéquipier",
                  href: "/lol/coequipiers",
                },
                {
                  titre: "J'organise un tournoi",
                  texte: "Check-in, bracket, verdicts — un cockpit qui fait le travail d'admin à ta place.",
                  cta: "Organiser un tournoi",
                  href: "/organiser/nouveau",
                },
              ].map((c) => (
                <Link
                  key={c.titre}
                  href={c.href}
                  className="group flex flex-col gap-3 bg-[var(--color-carte)] px-6 py-8 transition hover:bg-[#1c222c]"
                >
                  <h3 className="font-display text-lg font-extrabold text-[var(--color-encre)]">{c.titre}</h3>
                  <p className="flex-1 text-sm text-[var(--color-ardoise)]">{c.texte}</p>
                  <span className="font-mono text-[0.66rem] tracking-[0.1em] text-[var(--color-sceau-texte)] uppercase transition group-hover:text-[var(--color-sceau)]">
                    {c.cta} →
                  </span>
                </Link>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================= PALIERS ================= */}
      {paliers.length > 0 && (
        <section className="relative bg-gradient-to-b from-[var(--color-fond-2)] to-[var(--color-papier)] px-6 py-28">
          <div className="mx-auto max-w-4xl">
            <Reveal>
              <span className="font-mono text-[0.7rem] tracking-[0.24em] text-[var(--color-ardoise)] uppercase">
                Le classement
              </span>
              <h2 className="mt-3 max-w-lg font-display text-3xl font-extrabold tracking-tight text-[var(--color-encre)] sm:text-4xl">
                Glicko-2, seuils fixes, jamais de remise à zéro.
              </h2>
            </Reveal>

            <Reveal delai={0.1}>
              <div className="mt-10 grid grid-cols-2 gap-px border border-[var(--color-trait)] bg-[var(--color-trait)] sm:grid-cols-3 md:grid-cols-6">
                {paliers.map((p, i) => {
                  const couleur = COULEUR_PALIER[p.nom.toLowerCase()] ?? "var(--color-ardoise)";
                  // Le premier palier (Bronze) a rating_min = 0 en base — la
                  // borne qui a du sens à afficher est celle du palier
                  // suivant ("< 1300", cf. CLAUDE.md §4), pas "0".
                  const seuilSuivant = paliers[i + 1]?.rating_min;
                  const libelle = i === 0 && seuilSuivant ? `< ${seuilSuivant}` : String(p.rating_min);
                  const largeur = Math.max(6, Math.min(100, Math.round((p.rating_min / echelleMax) * 100)));
                  return (
                    <div
                      key={p.nom}
                      className="bg-[var(--color-carte)] px-3.5 py-5 text-center transition-[background-color,transform] duration-300 hover:-translate-y-1 hover:bg-[#1c222c]"
                    >
                      <div className="font-mono text-[0.68rem] tracking-[0.1em] text-[var(--color-ardoise)] uppercase">{p.nom}</div>
                      <div className="mt-1.5 font-mono text-lg font-bold text-[var(--color-encre)]">{libelle}</div>
                      <div className="mt-3.5 h-[3px] rounded-full bg-[var(--color-trait)]">
                        <div className="h-full rounded-full" style={{ width: `${largeur}%`, background: couleur }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {/* ================= EN CHIFFRES ================= */}
      <section className="relative px-6 pt-8 pb-28">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <span className="font-mono text-[0.7rem] tracking-[0.24em] text-[var(--color-ardoise)] uppercase">En chiffres</span>
            <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-[var(--color-encre)] sm:text-4xl">
              La preuve s&apos;accumule.
            </h2>
          </Reveal>

          <Reveal delai={0.1}>
            {/* 3 colonnes, pas 4 : les constantes du moteur sont toujours
                exactement 3, et statsTrafic (0 à 3 de plus tant qu'il n'y a
                pas encore de vrai trafic) vient s'ajouter en ligne(s)
                suivante(s) plutôt que de laisser une case vide en bout de
                grille. */}
            <div className="mt-10 grid grid-cols-1 gap-px border border-[var(--color-trait)] bg-[var(--color-trait)] sm:grid-cols-3">
              {[
                { valeur: 1500, libelle: "Rating initial" },
                { valeur: 10, libelle: "Matchs avant classement" },
                { valeur: 3, libelle: "Niveaux de preuve" },
                ...statsTrafic,
              ].map((s) => (
                <div key={s.libelle} className="bg-[var(--color-papier)] px-5 py-8 text-center">
                  <div className="font-mono text-3xl font-bold tabular-nums text-[var(--color-encre)] sm:text-4xl">
                    <CompteurAnime valeur={s.valeur} />
                  </div>
                  <span className="mt-2 block font-mono text-[0.62rem] tracking-[0.12em] text-[var(--color-ardoise)] uppercase">
                    {s.libelle}
                  </span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================= CTA FINAL ================= */}
      <section className="relative bg-gradient-to-b from-[var(--color-papier)] via-[#171b22] to-[var(--color-fond-2)] px-6 pt-8 pb-36 text-center">
        <Reveal className="mx-auto max-w-2xl">
          <span className="font-mono text-[0.7rem] tracking-[0.24em] text-[var(--color-ardoise)] uppercase">Rejoindre</span>
          <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-[var(--color-encre)] sm:text-4xl">
            Ton prochain match compte. Pour de vrai.
          </h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/inscription"
              className="rounded-[2px] bg-[var(--color-sceau)] px-6 py-3 text-sm font-semibold text-[#14090C] shadow-[0_8px_24px_-6px_var(--color-sceau-lueur)] transition hover:-translate-y-0.5 hover:brightness-110"
              style={{ clipPath: "polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%)" }}
            >
              Créer mon compte
            </Link>
            <Link
              href="/organiser/nouveau"
              className="rounded-[2px] border border-white/20 bg-white/6 px-6 py-3 text-sm font-semibold text-[var(--color-encre)] transition hover:border-white/40"
              style={{ clipPath: "polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%)" }}
            >
              Organiser un tournoi
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
