import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { formaterDate, type StatutPublic } from "@/lib/tournois";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";
import BoutonLien from "@/components/design/BoutonLien";
import LibelleSection from "@/components/design/LibelleSection";
import Panneau from "@/components/design/Panneau";
import AvatarJoueur from "@/components/design/AvatarJoueur";
import Icone from "@/components/design/Icone";
import { BadgeVerdict, BadgeVerifie } from "@/components/design/Badges";
import { StatutTournoi } from "@/components/tournoi/BlocsTournoi";

// Hub League of Legends — refonte « Venin » du 24/09/2026 (MASTER.md) :
// même contenu et même requête qu'avant. Retiré : les icônes de champions
// servies par Riot (DDragon) et les pseudos qui citaient un champion ou un
// joueur professionnel réel — MASTER §9, aucun visuel ni nom de marque Riot.

const ICONE_ETAPE = {
  inscription: (
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M22 11h-6" />
  ),
  partie: <polygon points="6 3 20 12 6 21 6 3" />,
  verdict: <path d="M9 12l2 2 4-4M12 3l8 4v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V7l8-4Z" />,
} as const;

function IconeEtape({ chemin }: { chemin: keyof typeof ICONE_ETAPE }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
      aria-hidden="true"
    >
      {ICONE_ETAPE[chemin]}
    </svg>
  );
}

const PORTES = [
  {
    titre: "Je veux jouer",
    texte: "Des tournois quotidiens en 1v1 (5v5 bientôt), ton classement qui progresse à chaque résultat vérifié.",
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
];

const ETAPES = [
  {
    icone: "inscription" as const,
    titre: "Inscris-toi",
    texte: "Choisis un tournoi 1v1 ouvert dans ta région. L'inscription prend quelques secondes, aucune vérification manuelle à attendre.",
  },
  {
    icone: "partie" as const,
    titre: "Joue ta partie",
    texte: "Comme d'habitude, dans le client du jeu. Aucune configuration spéciale, aucun logiciel à installer pour jouer.",
  },
  {
    icone: "verdict" as const,
    titre: "Le verdict tombe",
    texte: "Le résultat est lu automatiquement dans ton historique de partie Riot — jamais une déclaration entre joueurs, jamais une capture d'écran.",
  },
];

const NIVEAUX = [
  { num: "03", titre: "Code de tournoi Riot", texte: "Lecture directe depuis l'API — la preuve la plus forte.", compte: true },
  { num: "02", titre: "Retrouvé dans l'historique", texte: "Rapproché automatiquement depuis tes parties Riot.", compte: true },
  { num: "01", titre: "Décision manuelle", texte: "Tranchée par l'organisateur, motif affiché publiquement.", compte: false },
];

export const metadata: Metadata = {
  title: "League of Legends — Najarena",
  description:
    "Tournois League of Legends en 1v1, quotidiens, sur Najarena. Résultats lus dans la donnée officielle Riot, classement Glicko-2 vérifié.",
};

export default async function LolHubPage() {
  const supabase = await createClient();

  // game_id=1 est LoL — seule ligne de `games` en V1 (voir docs/design-system.md
  // et le correctif du 13/09/2026 sur l'accueil) : pas besoin de résoudre
  // l'id depuis un slug.
  const { data } = await supabase
    .from("tournaments")
    .select("slug, nom, format, capacite, region, statut, debute_le")
    .eq("game_id", 1)
    .in("statut", ["ouvert", "checkin"])
    .order("debute_le", { ascending: true })
    .limit(6);

  const prochainsTournois = (data ?? []) as Array<{
    slug: string;
    nom: string;
    format: string;
    capacite: number;
    region: string;
    statut: StatutPublic;
    debute_le: string;
  }>;

  return (
    <main className="bg-bg font-texte text-text">
      {/* ================= EN-TÊTE ================= */}
      <section className="relative overflow-hidden px-gouttiere pt-36 pb-section-outil">
        <FondEcailles />
        <div className="relative mx-auto flex max-w-contenu flex-col gap-7">
          <Apparition className="flex flex-col gap-6">
            <LibelleSection>League of Legends</LibelleSection>
            <h1 className="font-titre text-section font-black uppercase">
              Ton niveau, <span className="text-accent">vérifié.</span>
            </h1>
            <p className="max-w-[560px] text-courant text-text-2">
              Des tournois 1v1 quotidiens, le 5v5 arrive bientôt. Les résultats sont lus dans la donnée officielle
              Riot — ton classement devient une preuve, pas une déclaration.
            </p>
          </Apparition>
          <Apparition delai={0.08} className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <BoutonLien href="/lol/tournois">Voir les tournois</BoutonLien>
            <BoutonLien href="/lol/classement" variante="contour">
              Voir le classement
            </BoutonLien>
            <BoutonLien href="/lol/coequipiers" variante="secondaire">
              Trouver un coéquipier
            </BoutonLien>
          </Apparition>
        </div>
      </section>

      {/* ================= PAR OÙ COMMENCER ================= */}
      <section className="bg-bg-alt px-gouttiere py-section-outil">
        <div className="mx-auto flex max-w-contenu flex-col gap-8">
          <Apparition className="flex flex-col gap-3">
            <LibelleSection numero="01" as="h2">
              Par où commencer
            </LibelleSection>
            <p className="max-w-lg text-muted">Trois profils, trois points d&apos;entrée — choisis le tien.</p>
          </Apparition>
          <ul className="grid gap-6 md:grid-cols-3">
            {PORTES.map((c, i) => (
              <li key={c.titre}>
                <Apparition delai={i * 0.06} className="h-full">
                  <Link
                    href={c.href}
                    className="group panneau flex h-full flex-col gap-3 p-6 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-accent/40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                  >
                    <h3 className="font-titre text-[28px] leading-none font-extrabold uppercase">{c.titre}</h3>
                    <p className="flex-1 text-sm leading-relaxed text-muted">{c.texte}</p>
                    <span className="inline-flex items-center gap-2 text-sm font-semibold tracking-[2px] text-accent uppercase">
                      {c.cta}
                      <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">
                        →
                      </span>
                    </span>
                  </Link>
                </Apparition>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ================= COMMENT ÇA MARCHE ================= */}
      <section className="px-gouttiere py-section-outil">
        <div className="mx-auto flex max-w-contenu flex-col gap-8">
          <Apparition className="flex flex-col gap-3">
            <LibelleSection numero="02" as="h2">
              Comment ça marche
            </LibelleSection>
            <p className="max-w-lg text-muted">
              Trois étapes, aucune capture d&apos;écran à envoyer, aucun litige à trancher entre joueurs.
            </p>
          </Apparition>
          <ol className="grid gap-6 md:grid-cols-3">
            {ETAPES.map((e, i) => (
              <li key={e.titre}>
                <Apparition delai={i * 0.06} className="h-full">
                  <Panneau className="flex h-full flex-col gap-3 p-6">
                    <span className="flex h-10 w-10 items-center justify-center rounded-bouton border border-accent/40 bg-accent/10 text-accent">
                      <IconeEtape chemin={e.icone} />
                    </span>
                    <span className="text-mini font-semibold text-accent uppercase">
                      Étape {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3 className="font-titre text-[28px] leading-none font-extrabold uppercase">{e.titre}</h3>
                    <p className="text-sm leading-relaxed text-muted">{e.texte}</p>
                  </Panneau>
                </Apparition>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ================= NIVEAUX DE PREUVE ================= */}
      <section className="bg-bg-alt px-gouttiere py-section-outil">
        <div className="mx-auto grid max-w-contenu items-start gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Apparition className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <LibelleSection numero="03" as="h2">
                Les niveaux de preuve
              </LibelleSection>
              <p className="max-w-lg text-muted">
                Un match ne connaît pas son résultat tant qu&apos;il n&apos;a pas consommé un verdict — et ce verdict
                porte son propre niveau de fiabilité, affiché publiquement sur chaque match.
              </p>
            </div>
            <ul className="flex flex-col">
              {NIVEAUX.map((n) => (
                <li key={n.num} className="flex items-center gap-4 border-b border-line py-4 last:border-b-0">
                  <span
                    className={`w-8 shrink-0 font-titre text-2xl font-extrabold tabular-nums ${n.compte ? "text-accent" : "text-muted"}`}
                  >
                    {n.num}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-semibold">{n.titre}</span>
                    <span className="text-sm text-muted">{n.texte}</span>
                  </span>
                  {n.compte ? (
                    <BadgeVerifie>Compte</BadgeVerifie>
                  ) : (
                    <span className="text-mini font-semibold whitespace-nowrap text-muted uppercase">Hors classement</span>
                  )}
                </li>
              ))}
            </ul>
          </Apparition>

          <Apparition delai={0.1}>
            <Panneau reperes className="flex flex-col gap-4 p-6">
              <span className="self-start rounded-bouton border border-line px-2 py-1 text-mini font-semibold text-muted uppercase">
                Exemple · Finale
              </span>
              <div className="flex flex-col">
                <div className="flex items-center gap-3 border-b border-[rgba(245,245,244,0.06)] py-2.5">
                  <AvatarJoueur pseudo="Vipere" taille={30} />
                  <span className="flex-1 text-sm font-semibold">Vipere</span>
                  <span className="text-sm font-bold text-accent tabular-nums">2</span>
                </div>
                <div className="flex items-center gap-3 py-2.5">
                  <AvatarJoueur pseudo="Crochet" taille={30} />
                  <span className="flex-1 text-sm text-faint">Crochet</span>
                  <span className="text-sm font-bold text-faint tabular-nums">0</span>
                </div>
              </div>
              <BadgeVerdict niveau="historique" />
            </Panneau>
          </Apparition>
        </div>
      </section>

      {/* ================= PROCHAINS TOURNOIS ================= */}
      <section className="px-gouttiere pt-section-outil pb-24">
        <div className="mx-auto flex max-w-contenu flex-col gap-8">
          <Apparition className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-3">
              <LibelleSection numero="04" as="h2">
                Prochains tournois
              </LibelleSection>
              <p className="text-sm text-muted">Les tournois ouverts aux inscriptions, triés par date de début.</p>
            </div>
            <BoutonLien href="/lol/tournois" variante="secondaire">
              Tout voir
            </BoutonLien>
          </Apparition>

          {prochainsTournois.length === 0 ? (
            <Apparition delai={0.08}>
              <Panneau reperes className="flex flex-col items-start gap-4 px-8 py-10">
                <p className="font-titre text-sous-titre font-extrabold uppercase">Aucun tournoi ouvert pour l&apos;instant.</p>
                <div className="flex flex-wrap gap-x-8 gap-y-2">
                  <BoutonLien href="/organiser/nouveau" variante="secondaire">
                    Organiser le premier
                  </BoutonLien>
                  <BoutonLien href="/lol/tournois/demo" variante="secondaire">
                    Voir le tournoi d&apos;exemple
                  </BoutonLien>
                </div>
              </Panneau>
            </Apparition>
          ) : (
            <ul className="flex flex-col gap-3">
              {prochainsTournois.map((t, i) => (
                <li key={t.slug}>
                  <Apparition delai={Math.min(i * 0.06, 0.3)}>
                    <Link
                      href={`/lol/tournois/${t.slug}`}
                      className="group panneau flex flex-wrap items-center justify-between gap-4 px-6 py-5 transition-[border-color] duration-200 hover:border-accent/40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                    >
                      <span className="flex min-w-0 flex-col gap-1.5">
                        <span className="font-titre text-2xl leading-none font-extrabold uppercase">{t.nom}</span>
                        <span className="text-sm text-muted tabular-nums">
                          {t.format} · {t.capacite} joueurs · {t.region} · {formaterDate(t.debute_le)}
                        </span>
                      </span>
                      <span className="flex items-center gap-4 text-mini font-semibold uppercase">
                        <StatutTournoi statut={t.statut} />
                        <Icone nom="fleche-droite" className="text-accent transition-transform duration-200 group-hover:translate-x-1" />
                      </span>
                    </Link>
                  </Apparition>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
