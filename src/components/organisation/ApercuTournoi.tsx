"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import EmblemePalier from "@/components/design/EmblemePalier";
import LigneTournoi from "@/components/tournoi/LigneTournoi";
import { libelleNiveau, paliersDuNiveau } from "@/lib/niveau-tournoi";
import { instantDepuisSaisieParis } from "@/lib/tournois-auto/creneaux";
import type { TournoiListe } from "@/lib/tournois";

// Aperçu en direct de la page « Organiser un tournoi » (27/11/2026, maquette
// v2 validée par le porteur) : à côté du formulaire, la page du tournoi et sa
// ligne dans la liste, telles que les joueurs les verront, mises à jour
// pendant la saisie. Lit seulement le formulaire du navigateur : rien n'est
// envoyé, rien n'est enregistré. La ligne de la liste est le vrai composant
// (LigneTournoi), rendue inerte (aucun lien cliquable dans l'aperçu).

const LIBELLE_BRACKET: Record<string, string> = {
  elim_simple: "Élimination directe",
  double_elim: "Double élimination",
  suisse: "Format suisse",
};

interface Saisie {
  nom: string;
  format: "1v1" | "5v5";
  capacite: number;
  bestOf: number;
  bracket: string;
  min: number | null;
  max: number | null;
  region: string;
  debut: string;
  checkin: string;
  brouillon: boolean;
  amical: boolean;
  reserveMembres: boolean;
}

function lire(form: HTMLFormElement): Saisie {
  const d = new FormData(form);
  const texte = (cle: string) => String(d.get(cle) ?? "");
  const nombre = (cle: string) => (texte(cle) === "" ? null : Number(texte(cle)));
  const format = texte("format") === "5v5" ? "5v5" : "1v1";
  return {
    nom: texte("nom").trim(),
    format,
    capacite: Number(texte("capacite")) || 8,
    bestOf: Number(texte("best_of")) || 1,
    bracket: texte("type_bracket") || "elim_simple",
    min: nombre("niveau_min"),
    max: nombre("niveau_max"),
    region: texte("region"),
    debut: texte("debute_le"),
    checkin: texte("checkin_ouvre_le"),
    brouillon: texte("statut_initial") === "brouillon",
    amical: d.get("amical") === "oui",
    // Même règle que creerTournoi : réservé seulement avec une communauté choisie.
    reserveMembres: texte("communaute_id") !== "" && d.get("reserve_membres") === "oui",
  };
}

/** Choix que creerTournoi refusera (lib/tournoi-actions.ts) : annoncés dans
 *  l'aperçu, jamais corrigés en silence. */
function refus(s: Saisie, debut: Date | null, checkin: Date | null): string[] {
  const r: string[] = [];
  if (s.format === "5v5" && s.bracket !== "elim_simple")
    r.push(`${LIBELLE_BRACKET[s.bracket] ?? "Ce déroulement"} : en 1v1 seulement. En 5v5, choisis l'élimination directe.`);
  if (s.format === "5v5" && (s.min !== null || s.max !== null)) r.push("Le niveau ne s'applique qu'en 1v1 : retire les paliers.");
  if (s.min !== null && s.max !== null && s.max <= s.min) r.push("Le palier maximum est sous le palier minimum.");
  if (debut && debut.getTime() < Date.now()) r.push("La date de début est déjà passée.");
  if (debut && checkin && checkin.getTime() > debut.getTime()) r.push("Le check-in doit ouvrir avant le début du tournoi.");
  return r;
}

const DATE_LONGUE = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

export default function ApercuTournoi({ formId }: { formId: string }) {
  const [s, setS] = useState<Saisie | null>(null);

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;
    const maj = () => setS(lire(form));
    maj();
    form.addEventListener("input", maj);
    form.addEventListener("change", maj);
    return () => {
      form.removeEventListener("input", maj);
      form.removeEventListener("change", maj);
    };
  }, [formId]);

  // Avant la lecture du formulaire (rendu serveur, hydratation) : un cadre
  // vide de même hauteur, pour ne rien rendre qui dépende de l'heure.
  if (!s) return <div aria-hidden="true" className="min-h-[640px]" />;
  const saisie = s;

  const nom = saisie.nom || "Nom du tournoi";
  const instant = saisie.debut ? instantDepuisSaisieParis(saisie.debut) : null;
  const instantCheckin = saisie.checkin ? instantDepuisSaisieParis(saisie.checkin) : null;
  const alertes = refus(saisie, instant, instantCheckin);
  // Comme la vraie liste (versTournoiListe) : jamais « Amical » sur un 5v5.
  const amicalAffiche = saisie.amical && saisie.format === "1v1";
  const dateLongue = instant ? DATE_LONGUE.format(instant) : "";
  const niveauRefuse = saisie.format === "5v5" || (saisie.min !== null && saisie.max !== null && saisie.max <= saisie.min);
  const minInvalide = niveauRefuse;
  const niveau = minInvalide ? null : libelleNiveau(saisie.min, saisie.max);
  const paliers = minInvalide ? [] : paliersDuNiveau(saisie.min, saisie.max);
  const mots = nom.split(/\s+/);
  const fin = mots.pop() ?? "";
  const debutNom = mots.join(" ");

  const ligne: TournoiListe | null = instant && {
    id: "apercu",
    slug: "apercu",
    nom,
    format: saisie.format,
    capacite: saisie.capacite,
    region: saisie.region || "—",
    statut: "ouvert",
    debute_le: instant.toISOString(),
    reserve_membres: saisie.reserveMembres,
    reserve_non_classes: false,
    niveau,
    paliersNiveau: paliers,
    officiel: false,
    amical: amicalAffiche,
    classe: null,
    inscrits: 0,
  };

  const etiquette =
    "inline-flex items-center rounded-bouton border border-line-strong px-1.5 py-0.5 text-mini font-semibold tracking-[2px] text-text-2 uppercase";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-3 text-mini text-muted uppercase">
        <span>Aperçu · ce que verront les joueurs</span>
        <span className="text-text-2">Suit ta saisie</span>
      </div>

      {alertes.length > 0 && (
        <ul role="status" className="flex flex-col gap-1.5 rounded-panneau border border-danger/50 px-4 py-3 text-sm text-danger">
          {alertes.map((a) => (
            <li key={a}>{a} Le tournoi serait refusé à la création.</li>
          ))}
        </ul>
      )}

      <section className="flex flex-col gap-2.5">
        <p className="text-mini text-faint uppercase">La page de ton tournoi</p>
        <div className="relative isolate flex min-h-[300px] flex-col justify-end gap-3.5 overflow-hidden rounded-panneau border border-line-strong bg-[radial-gradient(ellipse_at_75%_25%,var(--color-halo)_0%,var(--color-bg-alt)_55%,var(--color-bg)_100%)] p-6 shadow-[0_40px_90px_-40px_rgba(0,0,0,.9)]">
          <div
            aria-hidden="true"
            className="absolute -top-64 -right-36 -z-10 aspect-square w-[560px] rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--color-accent)_16%,transparent)_0%,transparent_62%)]"
          />
          <Image
            src="/brand/najarena-logo-blanc.svg"
            alt=""
            width={312}
            height={420}
            unoptimized
            aria-hidden="true"
            className="pointer-events-none absolute -top-16 right-[6%] -z-10 h-[420px] w-auto max-w-none rotate-[-10deg] opacity-[0.09]"
          />
          <span aria-hidden="true" className="text-mini tracking-[3px] text-muted uppercase">
            ← Tous les tournois
          </span>
          <div className="flex min-h-6 flex-wrap items-center gap-2">
            {amicalAffiche && <span className={etiquette}>Amical</span>}
            {saisie.reserveMembres && <span className={etiquette}>Réservé aux membres</span>}
            {niveau && (
              <span className="inline-flex flex-wrap items-center gap-1.5">
                {paliers.map((p) => (
                  <EmblemePalier key={p} palier={p} taille={24} />
                ))}
                <span className={etiquette}>Niveau {niveau}</span>
              </span>
            )}
            {saisie.brouillon && <span className={etiquette}>Brouillon</span>}
          </div>
          <p className="font-titre text-[clamp(2.8rem,5.2vw,4.6rem)] leading-[0.84] font-black uppercase [overflow-wrap:anywhere]">
            {debutNom && <>{debutNom} </>}
            <span className="text-accent">{fin}</span>
          </p>
          <p className="text-[15px] text-text-2">
            {instant ? (
              <>
                {dateLongue.charAt(0).toUpperCase() + dateLongue.slice(1)} (heure de Paris)
              </>
            ) : (
              "Date à choisir"
            )}
            {saisie.region && <> · {saisie.region}</>}
          </p>
          <dl className="mt-1.5 grid grid-cols-2 gap-x-5 gap-y-3.5 rounded-panneau border border-line-strong bg-bg/60 px-4 py-3.5 backdrop-blur-sm">
            <div className="flex min-w-0 flex-col gap-1">
              <dt className="text-mini text-muted uppercase">{saisie.format === "5v5" ? "Équipes" : "Inscrits"}</dt>
              <dd className="font-titre text-[28px] leading-none font-black tabular-nums">0/{saisie.capacite}</dd>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <dt className="text-mini text-muted uppercase">Format</dt>
              <dd className="text-[15px] font-semibold">
                {saisie.format} · BO{saisie.bestOf}
              </dd>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <dt className="text-mini text-muted uppercase">Déroulement</dt>
              <dd
                className={`text-[15px] font-semibold ${saisie.format === "5v5" && saisie.bracket !== "elim_simple" ? "text-danger" : ""}`}
              >
                {LIBELLE_BRACKET[saisie.bracket] ?? LIBELLE_BRACKET.elim_simple}
              </dd>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <dt className="text-mini text-muted uppercase">Niveau</dt>
              <dd className="flex flex-wrap items-center gap-1.5 text-[15px] font-semibold">
                {minInvalide && (saisie.min !== null || saisie.max !== null) ? (
                  <span className="text-danger">À corriger</span>
                ) : (
                  <>
                    {paliers.map((p) => (
                      <EmblemePalier key={p} palier={p} taille={24} />
                    ))}
                    <span>{niveau ?? "Ouvert à tous"}</span>
                  </>
                )}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="flex flex-col gap-2.5">
        <p className="text-mini text-faint uppercase">
          {saisie.brouillon ? "Une fois publié, dans la liste des tournois" : "Dans la liste des tournois"}
        </p>
        {/* Le vrai composant de la liste, inerte : rien de cliquable dans l'aperçu. */}
        {ligne ? (
          <div inert className="rounded-panneau border border-line px-4">
            <LigneTournoi t={ligne} etroite />
          </div>
        ) : (
          <p className="rounded-panneau border border-line px-4 py-5 text-sm text-muted">
            Choisis la date de début pour voir la ligne du tournoi.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2.5">
        <p className="text-mini text-faint uppercase">Et ensuite</p>
        <ol className="panneau flex flex-col px-5 py-3">
          {[
            [
              saisie.brouillon ? "Les inscriptions ouvriront à la publication" : "Les inscriptions ouvrent tout de suite",
              saisie.brouillon
                ? "En brouillon, toi seul vois le tournoi. Publie-le depuis ton cockpit pour ouvrir les inscriptions."
                : "Le tournoi apparaît dans la liste ; les joueurs s'inscrivent depuis sa page.",
            ],
            [
              "Le check-in",
              saisie.format === "5v5"
                ? "À l'ouverture du check-in que tu as choisie, chaque capitaine confirme la présence de son équipe."
                : "À l'ouverture du check-in que tu as choisie, chaque inscrit confirme sa présence.",
            ],
            ["Tu lances le bracket", "Depuis ton cockpit (Mon compte) : têtes de série selon le rating, le tirage ne départage que les égalités."],
            [
              "Les résultats se lisent seuls",
              "Chaque partie est retrouvée dans l'historique Riot. En cas de doute, c'est toi qui tranches, et le résultat reste marqué « manuel ».",
            ],
          ].map(([titre, texte], i) => (
            <li key={titre} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 border-t border-line py-3 first:border-t-0">
              <span className="font-titre text-2xl leading-none font-black text-faint">{i + 1}</span>
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold">{titre}</span>
                <span className="text-[13px] text-text-2">{texte}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
