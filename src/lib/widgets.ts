// Widgets intégrables (03/10/2026, audit N31) : bracket, top 10 et carte
// CV, à placer dans une page d'équipe (iframe) ou un overlay de stream
// (source « navigateur » d'OBS). Pages HTML autonomes, sans script, aux
// couleurs du site ; tout texte venant d'un utilisateur est échappé.
// Logique pure, testée dans widgets.test.ts.

import { echapperHtml } from "@/lib/echappement";
import type { JoueurPublic, LigneTop, TournoiPublic } from "@/lib/donnees-publiques";

export const RAFRAICHISSEMENT_WIDGET_SECONDES = 60;

export interface OptionsWidget {
  /** Fond transparent, pour un overlay de stream. */
  transparent: boolean;
}

export function optionsWidget(params: URLSearchParams): OptionsWidget {
  return { transparent: params.get("fond") === "transparent" };
}

export function pageWidget(titre: string, corps: string, lien: string, options: OptionsWidget): string {
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
.muted{color:#9ca39c}
.accent{color:#b6ff3b}
.carte{background:#131513;border:1px solid rgba(245,245,244,.12);border-radius:6px;padding:10px 12px}
.tours{display:flex;gap:12px;overflow-x:auto}
.tour{display:flex;flex-direction:column;justify-content:space-around;gap:8px;min-width:170px}
.ligne{display:flex;justify-content:space-between;gap:8px;padding:2px 0}
.gagnant{font-weight:700}
.badge{font-size:11px;text-transform:uppercase;letter-spacing:.06em}
.chiffre{font-variant-numeric:tabular-nums}
table{width:100%;border-collapse:collapse}
td{padding:4px 6px;border-bottom:1px solid rgba(245,245,244,.08)}
.pied{margin-top:8px;font-size:11px}
</style>
</head>
<body>
${corps}
<p class="pied muted"><a href="${echapperHtml(lien)}" target="_blank" rel="noopener">Données Najarena — résultats lus chez Riot</a></p>
</body>
</html>`;
}

function badgeVerdict(verdict: TournoiPublic["matchs"][number]["verdict"]): string {
  if (!verdict) return "";
  return verdict.verifie ? `<span class="badge accent">✓ vérifié</span>` : `<span class="badge muted">manuel</span>`;
}

export function widgetBracket(t: TournoiPublic, options: OptionsWidget): string {
  const tours = new Map<number, TournoiPublic["matchs"]>();
  for (const m of t.matchs) tours.set(m.tour, [...(tours.get(m.tour) ?? []), m]);
  const colonnes = [...tours.entries()]
    .sort(([a], [b]) => a - b)
    .map(
      ([, matchs]) =>
        `<div class="tour">${matchs
          .map(
            (m) =>
              `<div class="carte">${
                m.participants.length === 0
                  ? `<div class="ligne muted">À venir</div>`
                  : m.participants
                      .map(
                        (p) =>
                          `<div class="ligne${p.gagnant ? " gagnant" : ""}"><span>${echapperHtml(p.nom)}</span><span class="chiffre">${p.score}</span></div>`,
                      )
                      .join("")
              }${m.verdict ? `<div>${badgeVerdict(m.verdict)}</div>` : ""}</div>`,
          )
          .join("")}</div>`,
    )
    .join("");
  const corps = `<p class="titre">${echapperHtml(t.nom)}</p>${
    colonnes ? `<div class="tours">${colonnes}</div>` : `<p class="muted">Le bracket n'a pas encore été généré.</p>`
  }`;
  return pageWidget(t.nom, corps, t.url, options);
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
