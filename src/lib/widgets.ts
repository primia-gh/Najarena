// Widgets intégrables (03/10/2026, audit N31) : bracket, top 10 et carte
// CV, à placer dans une page d'équipe (iframe) ou un overlay de stream
// (source « navigateur » d'OBS). Pages HTML autonomes, sans script, aux
// couleurs du site ; tout texte venant d'un utilisateur est échappé.
// Logique pure, testée dans widgets.test.ts.

import { echapperHtml } from "@/lib/echappement";
import type { JoueurPublic, LigneTop, MatchPublic, TournoiPublic } from "@/lib/donnees-publiques";
import { estTableau, libelleTourDouble, type Tableau } from "@/lib/double-elim";

export const RAFRAICHISSEMENT_WIDGET_SECONDES = 60;

export interface OptionsWidget {
  /** Fond transparent, pour un overlay de stream. */
  transparent: boolean;
}

export function optionsWidget(params: URLSearchParams): OptionsWidget {
  return { transparent: params.get("fond") === "transparent" };
}

export const PIED_RIOT = "Données Najarena — résultats lus chez Riot";

export function pageWidget(
  titre: string,
  corps: string,
  lien: string,
  options: OptionsWidget,
  pied: string = PIED_RIOT,
): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="${RAFRAICHISSEMENT_WIDGET_SECONDES}">
<meta name="robots" content="noindex">
<title>${echapperHtml(titre)} — Najarena</title>
<style>
:root{color-scheme:dark}
*{box-sizing:border-box;margin:0;padding:0}
body{background:${options.transparent ? "transparent" : "#080908"};color:#f5f5f4;font:14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;padding:12px}
a{color:inherit;text-decoration:none}
.titre{font-weight:800;text-transform:uppercase;letter-spacing:.04em;font-size:15px;margin-bottom:8px}
h1,h2,h3{font:inherit}
.muted{color:#9ca39c}
.accent{color:#b6ff3b}
.carte{background:#131513;border:1px solid rgba(245,245,244,.12);border-radius:6px;padding:10px 12px}
.tours{display:flex;gap:12px;overflow-x:auto}
.tour{display:flex;flex-direction:column;justify-content:space-around;gap:8px;min-width:150px}
.tours:focus-visible{outline:2px solid #f5f5f4;outline-offset:2px}
.ligne{display:flex;justify-content:space-between;gap:8px;padding:2px 0}
.gagnant{font-weight:700}
.badge{font-size:11px;text-transform:uppercase;letter-spacing:.06em}
.chiffre{font-variant-numeric:tabular-nums}
table{width:100%;border-collapse:collapse}
td{padding:4px 6px;border-bottom:1px solid rgba(245,245,244,.08)}
.pied{margin-top:8px;font-size:11px}
.tableau+.tableau{margin-top:14px;padding-top:10px;border-top:1px solid rgba(245,245,244,.12)}
.colonne{display:flex;flex-direction:column;gap:6px}
.colonne .tour{flex:1}
.sous-titre{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}
.entete{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#9ca39c}
.overlay{background:#131513;border:1px solid rgba(245,245,244,.12);border-radius:6px;padding:10px 16px;display:flex;flex-direction:column;gap:6px}
.overlay-haut{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 10px;font-size:13px;text-transform:uppercase;letter-spacing:.06em}
.titre-tournoi{font-weight:800}
.etat{margin-left:auto;font-weight:700}
.affiche{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:16px}
.cote{display:flex;flex-direction:column;min-width:0}
.cote.droite{text-align:right;align-items:flex-end}
.nom{font-size:24px;line-height:1.15;font-weight:800;text-transform:uppercase;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
.detail{font-size:12px}
.perdant .nom{color:#9ca39c}
.vainqueur{color:#f5f5f4;font-weight:700;text-transform:uppercase;letter-spacing:.06em}
.contre{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#9ca39c}
.overlay-bas{font-size:12px}
${options.transparent ? ".titre,.sous-titre,.entete,.pied{text-shadow:0 0 2px rgba(0,0,0,.95),0 1px 4px rgba(0,0,0,.9)}\n.entete,.pied{color:#e7e9e7}\n" : ""}</style>
</head>
<body>
${corps}
<p class="pied muted"><a href="${echapperHtml(lien)}" target="_blank" rel="noopener">${echapperHtml(pied)}</a></p>
</body>
</html>`;
}

function badgeVerdict(verdict: TournoiPublic["matchs"][number]["verdict"]): string {
  if (!verdict) return "";
  return verdict.verifie ? `<span class="badge accent">✓ vérifié</span>` : `<span class="badge muted">manuel</span>`;
}

function carteMatch(m: MatchPublic): string {
  return `<div class="carte">${
    m.participants.length === 0
      ? `<div class="ligne muted">À venir</div>`
      : m.participants
          .map(
            (p) =>
              // Pas de score avant le verdict : « 0 / 0 » passerait pour un résultat.
              `<div class="ligne${p.gagnant ? " gagnant" : ""}"><span>${echapperHtml(p.nom)}</span><span class="chiffre${m.verdict ? "" : " muted"}">${m.verdict ? p.score : "–"}</span></div>`,
          )
          .join("")
  }${m.verdict ? `<div>${badgeVerdict(m.verdict)}</div>` : ""}</div>`;
}

/** Colonnes par tour ; `entete` nomme chaque colonne (double élimination). */
function colonnesHtml(matchs: MatchPublic[], entete?: (tour: number) => string): string {
  const tours = new Map<number, MatchPublic[]>();
  for (const m of matchs) tours.set(m.tour, [...(tours.get(m.tour) ?? []), m]);
  return [...tours.entries()]
    .sort(([a], [b]) => a - b)
    .map(
      ([tour, ms]) => {
        const cartes = `<div class="tour">${ms
          .sort((a, b) => a.position - b.position)
          .map(carteMatch)
          .join("")}</div>`;
        // L'en-tête au-dessus de la colonne, hors de la répartition verticale
        // des matchs.
        return entete ? `<div class="colonne"><h3 class="entete">${echapperHtml(entete(tour))}</h3>${cartes}</div>` : cartes;
      },
    )
    .join("");
}

const TITRE_TABLEAU: Record<Tableau, string> = {
  gagnants: "Tableau des gagnants",
  perdants: "Tableau des perdants",
  finale: "Grande finale",
};

/** Zone qui défile : atteignable au clavier, nommée pour les lecteurs d'écran. */
function zoneTours(colonnes: string, nom: string): string {
  return `<div class="tours" tabindex="0" role="region" aria-label="${echapperHtml(nom)}">${colonnes}</div>`;
}

export function widgetBracket(t: TournoiPublic, options: OptionsWidget): string {
  // Double élimination (20/11/2026) : trois blocs titrés, colonnes nommées
  // (« Gagnants · tour 1 », « Finale des perdants »…), comme sur la page.
  const double = t.matchs.some((m) => estTableau(m.tableau));
  let bracket: string;
  if (double) {
    const toursGagnants = Math.max(0, ...t.matchs.filter((m) => m.tableau === "gagnants").map((m) => m.tour));
    bracket = (["gagnants", "perdants", "finale"] as const)
      .map((tableau) => {
        const matchs = t.matchs.filter((m) => m.tableau === tableau);
        if (matchs.length === 0) return "";
        // La grande finale n'a qu'une colonne : son titre suffit.
        const colonnes = colonnesHtml(
          matchs,
          tableau === "finale" ? undefined : (tour) => libelleTourDouble(tableau, tour, toursGagnants),
        );
        return `<section class="tableau" aria-labelledby="tableau-${tableau}"><h2 class="sous-titre" id="tableau-${tableau}">${TITRE_TABLEAU[tableau]}</h2>${zoneTours(
          colonnes,
          TITRE_TABLEAU[tableau],
        )}</section>`;
      })
      .join("");
  } else {
    const colonnes = colonnesHtml(t.matchs);
    bracket = colonnes ? zoneTours(colonnes, `Bracket du tournoi ${t.nom}`) : "";
  }
  const corps = `<h1 class="titre">${echapperHtml(t.nom)}</h1>${
    bracket || `<p class="muted">Le bracket n'a pas encore été généré.</p>`
  }`;
  // « Lus chez Riot » seulement si tous les verdicts le sont : exemptions et
  // décisions de l'organisateur sont des verdicts manuels.
  const verdicts = t.matchs.flatMap((m) => (m.verdict ? [m.verdict] : []));
  return pageWidget(
    t.nom,
    corps,
    t.url,
    options,
    verdicts.length === 0
      ? "Données Najarena"
      : verdicts.every((v) => v.verifie)
        ? PIED_RIOT
        : "Données Najarena — chaque match indique s'il a été lu chez Riot ou décidé à la main",
  );
}

export function widgetTop(lignes: LigneTop[], lien: string, options: OptionsWidget): string {
  const corps = `<p class="titre">Top ${lignes.length || 10} — League of Legends</p>${
    lignes.length === 0
      ? `<p class="muted">Personne n'est encore classé cette saison.</p>`
      : `<table>${lignes
          .map(
            (l) =>
              `<tr><td class="chiffre muted">#${l.rang}</td><td>${echapperHtml(l.pseudo)}</td><td class="muted">${echapperHtml(l.palier ?? "")}</td><td class="chiffre">${l.rating}</td></tr>`,
          )
          .join("")}</table>`
  }`;
  return pageWidget("Classement", corps, lien, options);
}

export function widgetJoueur(j: JoueurPublic, options: OptionsWidget): string {
  const niveau = j.classe
    ? `<p><span class="accent chiffre" style="font-size:28px;font-weight:800">${j.rating}</span> <span class="muted">${echapperHtml(j.palier ?? "")}</span></p>`
    : `<p class="muted">Pas encore classé · confiance <span class="chiffre">${j.confiancePct} %</span></p>`;
  const corps = `<div class="carte"><p class="titre">${echapperHtml(j.pseudo)}</p>${niveau}<p class="muted chiffre">${j.matchsVerifies} match${j.matchsVerifies > 1 ? "s" : ""} vérifié${j.matchsVerifies > 1 ? "s" : ""} chez Riot</p></div>`;
  return pageWidget(j.pseudo, corps, j.url, options);
}
