import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { LABEL_STATUT, COULEUR_STATUT, formaterDate, type StatutPublic } from "@/lib/tournois";
import { obtenirVersionDDragon, urlIconeChampion } from "@/lib/riot";
import FondArene from "@/components/accueil/FondArene";
import Reveal from "@/components/accueil/Reveal";
import Badge from "@/components/ui/Badge";

const ICONE_ETAPE = {
  inscription: (
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M22 11h-6" />
  ),
  partie: <polygon points="6 3 20 12 6 21 6 3" />,
  verdict: <path d="M9 12l2 2 4-4M12 3l8 4v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V7l8-4Z" />,
} as const;

function IconeEtape({ chemin }: { chemin: keyof typeof ICONE_ETAPE }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
      {ICONE_ETAPE[chemin]}
    </svg>
  );
}

// Tailwind ne peut pas générer une classe construite dynamiquement
// (`border-t-${accent}`) — le nom complet doit apparaître tel quel dans le
// code source. Même principe que BORDURE_ACCENT dans lib/ui.ts.
const ACCENT_ETAPE = {
  laiton: { bordure: "border-t-laiton", icone: "bg-laiton/15 text-laiton", label: "text-laiton" },
  sceau: { bordure: "border-t-sceau", icone: "bg-sceau/15 text-sceau", label: "text-sceau" },
  atteste: { bordure: "border-t-atteste", icone: "bg-atteste/15 text-atteste", label: "text-atteste" },
} as const;

const ETAPES = [
  {
    accent: "laiton" as const,
    icone: "inscription" as const,
    titre: "Inscris-toi",
    texte: "Choisis un tournoi 1v1 ou 5v5 ouvert dans ta région. L'inscription prend quelques secondes, aucune vérification manuelle à attendre.",
  },
  {
    accent: "sceau" as const,
    icone: "partie" as const,
    titre: "Joue ta partie",
    texte: "Comme d'habitude, dans le client League of Legends. Aucune configuration spéciale, aucun logiciel à installer pour jouer.",
  },
  {
    accent: "atteste" as const,
    icone: "verdict" as const,
    titre: "Le verdict tombe",
    texte: "Le résultat est lu automatiquement dans ton historique de partie Riot — jamais une déclaration entre joueurs, jamais une capture d'écran.",
  },
];

const ACCENT_NIVEAU = {
  compte: { bordure: "border-l-atteste", texte: "text-atteste" },
  non: { bordure: "border-l-ardoise", texte: "text-ardoise" },
} as const;

const NIVEAUX = [
  {
    num: "03",
    titre: "Code de tournoi Riot",
    texte: "Lecture directe depuis l'API — la preuve la plus forte.",
    compte: true,
  },
  {
    num: "02",
    titre: "Retrouvé dans l'historique",
    texte: "Rapproché automatiquement depuis tes parties Riot.",
    compte: true,
  },
  {
    num: "01",
    titre: "Décision manuelle",
    texte: "Tranchée par l'organisateur, motif affiché publiquement.",
    compte: false,
  },
];

export const metadata: Metadata = {
  title: "League of Legends — Najarena",
  description:
    "Tournois League of Legends en 1v1, quotidiens, sur Najarena. Résultats lus dans la donnée officielle Riot, classement Glicko-2 vérifié.",
};

export default async function LolHubPage() {
  const supabase = await createClient();
  const versionDDragon = await obtenirVersionDDragon();

  const { data: jeu } = await supabase.from("games").select("id").eq("slug", "lol").maybeSingle();

  let prochainsTournois: Array<{
    slug: string;
    nom: string;
    format: string;
    capacite: number;
    region: string;
    statut: StatutPublic;
    debute_le: string;
  }> = [];

  if (jeu) {
    const { data } = await supabase
      .from("tournaments")
      .select("slug, nom, format, capacite, region, statut, debute_le")
      .eq("game_id", jeu.id)
      .in("statut", ["ouvert", "checkin"])
      .order("debute_le", { ascending: true })
      .limit(6);
    prochainsTournois = (data ?? []) as typeof prochainsTournois;
  }

  return (
    <div className="min-h-screen bg-papier">
      <section className="relative overflow-hidden px-6 pt-40 pb-16">
        <FondArene />
        <div className="relative mx-auto max-w-3xl">
          <Reveal>
            <span className="font-mono text-[0.66rem] tracking-[0.22em] text-[var(--color-ardoise)] uppercase">
              League of Legends
            </span>
            <h1 className="mt-1 font-display text-4xl font-extrabold tracking-tight text-[var(--color-encre)] sm:text-5xl">
              Ton niveau, vérifié.
            </h1>
            <p className="mt-3 max-w-md text-[var(--color-ardoise)]">
              Des tournois 1v1 et 5v5 quotidiens. Les résultats sont lus dans
              la donnée officielle Riot — ton classement devient une preuve,
              pas une déclaration.
            </p>
          </Reveal>

          <Reveal delai={0.1}>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <Link
                href="/lol/tournois"
                className="rounded-[2px] bg-[var(--color-sceau)] px-4 py-2 text-sm font-semibold text-[#14090C] shadow-[0_8px_24px_-6px_var(--color-sceau-lueur)] transition hover:-translate-y-0.5 hover:brightness-110"
                style={{ clipPath: "polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%)" }}
              >
                Voir les tournois
              </Link>
              <Link
                href="/lol/classement"
                className="rounded-[2px] border border-white/20 bg-white/6 px-4 py-2 text-sm font-semibold text-[var(--color-encre)] transition hover:border-white/40"
                style={{ clipPath: "polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%)" }}
              >
                Voir le classement
              </Link>
              <Link
                href="/lol/coequipiers"
                className="rounded-[2px] border border-white/20 bg-white/6 px-4 py-2 text-sm font-semibold text-[var(--color-encre)] transition hover:border-white/40"
                style={{ clipPath: "polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%)" }}
              >
                Trouver un coéquipier
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="relative bg-fond-2 px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <h2 className="border-l-4 border-laiton pl-3 font-display text-xl font-extrabold tracking-tight text-encre">
              Comment ça marche
            </h2>
            <p className="mt-3 max-w-lg text-ardoise">
              Trois étapes, aucune capture d&apos;écran à envoyer, aucun litige à trancher entre joueurs.
            </p>
          </Reveal>

          <Reveal delai={0.1}>
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {ETAPES.map((e, i) => {
                const accent = ACCENT_ETAPE[e.accent];
                return (
                  <div
                    key={e.titre}
                    className={`rounded-[3px] border border-trait border-t-[3px] bg-carte p-5 ${accent.bordure}`}
                  >
                    <span className={`flex h-9 w-9 items-center justify-center rounded-full ${accent.icone}`}>
                      <IconeEtape chemin={e.icone} />
                    </span>
                    <span className={`mt-3 block font-mono text-[0.64rem] tracking-[0.1em] uppercase ${accent.label}`}>
                      Étape {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3 className="mt-1.5 font-display text-base font-extrabold text-encre">{e.titre}</h3>
                    <p className="mt-1.5 text-sm text-ardoise">{e.texte}</p>
                  </div>
                );
              })}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="relative px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <h2 className="border-l-4 border-laiton pl-3 font-display text-xl font-extrabold tracking-tight text-encre">
              Les niveaux de preuve
            </h2>
            <p className="mt-3 max-w-lg text-ardoise">
              Un match ne connaît pas son résultat tant qu&apos;il n&apos;a pas consommé un verdict — et ce verdict porte son propre niveau de fiabilité, affiché publiquement sur chaque match.
            </p>
          </Reveal>

          <Reveal delai={0.1}>
            <div className="mt-6 flex flex-col gap-2">
              {NIVEAUX.map((n) => {
                const accent = ACCENT_NIVEAU[n.compte ? "compte" : "non"];
                return (
                  <div
                    key={n.num}
                    className={`flex items-center gap-3.5 rounded-[3px] border border-trait bg-carte px-4 py-3 border-l-[3px] ${accent.bordure}`}
                  >
                    <span className={`w-5 shrink-0 font-mono text-sm font-bold ${accent.texte}`}>{n.num}</span>
                    <span className="text-sm text-encre">
                      {n.titre}
                      <small className="mt-0.5 block text-[0.76rem] text-ardoise">{n.texte}</small>
                    </span>
                    <span className={`ml-auto shrink-0 font-mono text-[0.62rem] tracking-[0.08em] uppercase ${accent.texte}`}>
                      {n.compte ? "Compte" : "Hors classement"}
                    </span>
                  </div>
                );
              })}
            </div>
          </Reveal>

          <Reveal delai={0.15}>
            <div className="mt-6 max-w-xs rounded-[3px] border border-trait border-l-[3px] border-l-atteste bg-carte p-4 shadow-[0_20px_40px_-22px_rgba(62,156,110,0.45)]">
              <span className="inline-block rounded-full border border-trait px-2 py-0.5 font-mono text-[0.58rem] tracking-[0.1em] text-ardoise uppercase">
                Exemple · Tour 2, Finale
              </span>
              <div className="mt-3 flex items-center gap-2.5">
                <Image
                  src={urlIconeChampion(versionDDragon, "Kaisa")}
                  alt=""
                  width={28}
                  height={28}
                  unoptimized
                  className="h-7 w-7 shrink-0 rounded-full border border-atteste"
                />
                <span className="flex-1 text-sm font-semibold text-encre">KaisaMain</span>
                <span className="font-mono text-sm text-encre">2</span>
              </div>
              <div className="mt-2 flex items-center gap-2.5">
                <Image
                  src={urlIconeChampion(versionDDragon, "Zed")}
                  alt=""
                  width={28}
                  height={28}
                  unoptimized
                  className="h-7 w-7 shrink-0 rounded-full border border-trait"
                />
                <span className="flex-1 text-sm text-encre">Faker_du_dimanche</span>
                <span className="font-mono text-sm text-ardoise">0</span>
              </div>
              <div className="mt-3">
                <Badge couleur="text-atteste">Niveau 2 · Historique</Badge>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="relative bg-gradient-to-b from-[var(--color-fond-2)] to-[var(--color-papier)] px-6 pt-8 pb-32">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-xl font-extrabold tracking-tight text-[var(--color-encre)]">
                Prochains tournois
              </h2>
              <Link
                href="/lol/tournois"
                className="font-mono text-[0.7rem] text-[var(--color-ardoise)] underline underline-offset-3 hover:text-[var(--color-encre)]"
              >
                Tout voir
              </Link>
            </div>
            <p className="mt-2 text-sm text-[var(--color-ardoise)]">
              Les tournois ouverts aux inscriptions, triés par date de début.
            </p>
          </Reveal>

          {prochainsTournois.length === 0 ? (
            <Reveal delai={0.1}>
              <p className="mt-4 border border-[var(--color-trait)] bg-[var(--color-carte)] p-4 text-sm text-[var(--color-ardoise)]">
                Aucun tournoi ouvert pour l&apos;instant.{" "}
                <Link href="/organiser/nouveau" className="text-[var(--color-encre)] underline underline-offset-3">
                  Organiser le premier
                </Link>
                .
              </p>
            </Reveal>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {prochainsTournois.map((t, i) => (
                <Reveal key={t.slug} delai={Math.min(i * 0.06, 0.3)}>
                  <Link
                    href={`/lol/tournois/${t.slug}`}
                    className="group block border border-[var(--color-trait)] bg-[var(--color-carte)] p-4 transition-[border-color,box-shadow] duration-300 hover:border-[var(--color-sceau)]/40 hover:shadow-[0_0_0_1px_rgba(196,72,92,0.3),0_20px_44px_-16px_var(--color-sceau-lueur)]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="font-display text-lg font-extrabold tracking-tight text-[var(--color-encre)]">
                        {t.nom}
                      </span>
                      <span className={`font-mono text-[0.6rem] tracking-[0.1em] uppercase ${COULEUR_STATUT[t.statut]}`}>
                        {LABEL_STATUT[t.statut]}
                      </span>
                    </div>
                    <div className="mt-2 font-mono text-[0.72rem] text-[var(--color-ardoise)]">
                      {t.format} · {t.capacite} joueurs · {t.region} · {formaterDate(t.debute_le)}
                    </div>
                  </Link>
                </Reveal>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
