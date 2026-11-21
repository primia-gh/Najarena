import { describe, expect, it } from "vitest";
import {
  choisirMatchJoueur,
  etapeMatch,
  widgetMatch,
  widgetSansMatch,
  type MatchCandidat,
  type MatchOverlay,
} from "./overlay-match";

const opaque = { transparent: false };

function match(p: Partial<MatchOverlay> = {}): MatchOverlay {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    tournoi: "Coupe du soir",
    etape: "Demi-finale",
    bestOf: 3,
    statut: "en_cours",
    tournoiAnnule: false,
    cotes: [
      { nom: "Vipere", niveau: "Platine · 1623", pret: true },
      { nom: "Aspic", niveau: null, pret: false },
    ],
    verdict: null,
    urlPreuve: "https://najarena.example/lol/match/00000000-0000-0000-0000-000000000001",
    ...p,
  };
}

describe("etapeMatch", () => {
  const elim = { nature: "tournoi", typeBracket: "elim_simple" };
  it("nomme les tours d'une élimination directe depuis la finale", () => {
    expect(etapeMatch(elim, 3, null, 3, 0)).toBe("Finale");
    expect(etapeMatch(elim, 2, null, 3, 0)).toBe("Demi-finale");
    expect(etapeMatch(elim, 2, null, 4, 0)).toBe("Quart de finale");
    expect(etapeMatch(elim, 1, null, 4, 0)).toBe("Tour 1");
  });
  it("duel, scrim, suisse et double élimination", () => {
    expect(etapeMatch({ nature: "defi", typeBracket: "elim_simple" }, 1, null, 1, 0)).toBe("Duel");
    expect(etapeMatch({ nature: "scrim", typeBracket: "elim_simple" }, 1, null, 1, 0)).toBe("Scrim");
    expect(etapeMatch({ nature: "tournoi", typeBracket: "suisse" }, 2, null, 3, 0)).toBe("Ronde 2");
    const double = { nature: "tournoi", typeBracket: "double_elim" };
    expect(etapeMatch(double, 3, "gagnants", 7, 3)).toBe("Finale des gagnants");
    expect(etapeMatch(double, 8, "finale", 8, 3)).toBe("Grande finale");
  });
});

describe("choisirMatchJoueur", () => {
  const maintenant = new Date("2026-11-21T20:00:00Z");
  const il = (minutes: number) => new Date(maintenant.getTime() - minutes * 60_000).toISOString();
  const c = (p: Partial<MatchCandidat> & { id: string }): MatchCandidat => ({
    statut: "en_attente",
    tournoiEnCours: true,
    ouvertLe: null,
    verdictLe: null,
    adversaireConnu: true,
    ...p,
  });

  it("le match en cours passe avant un résultat qui vient de tomber", () => {
    const choix = choisirMatchJoueur(
      [
        c({
          id: "fini",
          statut: "termine",
          ouvertLe: il(40),
          verdictLe: il(2),
        }),
        c({ id: "en-cours", statut: "en_cours", ouvertLe: il(1) }),
      ],
      maintenant,
    );
    expect(choix).toBe("en-cours");
  });

  it("un résultat de moins de 15 minutes passe avant le match suivant, puis le suivant reprend la main", () => {
    const candidats = [
      c({ id: "fini", statut: "termine", verdictLe: il(5) }),
      c({ id: "suivant", statut: "en_attente", adversaireConnu: false }),
    ];
    expect(choisirMatchJoueur(candidats, maintenant)).toBe("fini");
    candidats[0].verdictLe = il(20);
    expect(choisirMatchJoueur(candidats, maintenant)).toBe("suivant");
  });

  it("jamais une exemption mise en avant, jamais un match d'un tournoi qui ne se joue plus", () => {
    expect(
      choisirMatchJoueur(
        [
          c({
            id: "exemption",
            statut: "termine",
            verdictLe: il(1),
            adversaireConnu: false,
          }),
          c({ id: "annule", statut: "en_cours", tournoiEnCours: false }),
        ],
        maintenant,
      ),
    ).toBeNull();
  });

  it("le dernier résultat reste jusqu'à 3 heures, puis plus rien", () => {
    expect(choisirMatchJoueur([c({ id: "fini", statut: "termine", verdictLe: il(170) })], maintenant)).toBe("fini");
    expect(choisirMatchJoueur([c({ id: "fini", statut: "termine", verdictLe: il(190) })], maintenant)).toBeNull();
  });

  it("le prochain match avec un adversaire connu passe avant celui qui attend encore le sien", () => {
    expect(
      choisirMatchJoueur(
        [c({ id: "attend", adversaireConnu: false }), c({ id: "pret", adversaireConnu: true, ouvertLe: il(3) })],
        maintenant,
      ),
    ).toBe("pret");
  });
});

describe("widgetMatch", () => {
  it("échappe les noms venant des utilisateurs, sans score avant le verdict", () => {
    const html = widgetMatch(
      match({
        tournoi: "<script>alert(1)</script>",
        cotes: [
          { nom: "A&B", niveau: null, pret: false },
          { nom: "C", niveau: null, pret: false },
        ],
      }),
      opaque,
    );
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("A&amp;B");
    expect(html).toContain("En cours");
    expect(html).toContain("Résultat lu chez Riot après la partie.");
    expect(html).not.toContain("Vainqueur");
    expect(html).not.toContain("Vérifié");
  });

  it("montre « Prêt » pendant le match seulement", () => {
    expect(widgetMatch(match(), opaque)).toContain("Platine · 1623 · Prêt");
    expect(widgetMatch(match({ statut: "en_attente" }), opaque)).not.toContain("Prêt");
  });

  it("un verdict lu chez Riot : vainqueur, « ✓ Vérifié » et sa source", () => {
    const html = widgetMatch(
      match({
        statut: "termine",
        verdict: {
          niveau: "historique",
          motif: null,
          gagnant: 1,
          sansVainqueur: false,
          decideur: "automatique",
        },
      }),
      opaque,
    );
    expect(html).toContain("✓ Vérifié");
    expect(html).toContain("partie lue dans l'historique Riot");
    expect(html).toContain(
      '<div class="cote perdant"><div class="ligne-nom"><p class="nom">Vipere</p><span class="pastille-v pastille-d" aria-hidden="true">D</span><span class="masque">Défaite</span></div>',
    );
    expect(html).toContain(
      '<div class="cote droite"><div class="ligne-nom"><p class="nom">Aspic</p><span class="pastille-v" aria-hidden="true">V</span></div><p class="detail muted chiffre"><span class="vainqueur">Vainqueur</span>',
    );
    expect(html).toContain("Données Najarena — résultats lus chez Riot");
  });

  it("un verdict manuel n'est jamais présenté comme vérifié, et son motif est affiché", () => {
    const html = widgetMatch(
      match({
        statut: "forfait",
        verdict: {
          niveau: "manuel",
          motif: "Forfait : <b>Aspic</b> ne s'est pas déclaré prêt.",
          gagnant: 0,
          sansVainqueur: false,
          decideur: "automatique",
        },
      }),
      opaque,
    );
    expect(html).not.toContain("Vérifié");
    expect(html).not.toContain("badge accent");
    expect(html).toContain('<span class="badge muted">');
    expect(html).toContain("Manuel</span>");
    expect(html).toContain("Forfait : &lt;b&gt;Aspic&lt;/b&gt;");
    expect(html).not.toContain("résultats lus chez Riot");
    // Forfait d'absence : une règle appliquée par Najarena, pas une décision de l'organisateur.
    expect(html).toContain("appliqué automatiquement par Najarena");
    expect(html).not.toContain("décision de l'organisateur");
    // Le vert et le rouge restent à la preuve : pastilles « V » et « D » neutres.
    expect(html).toContain('class="pastille-v neutre"');
    expect(html).toContain('class="pastille-v pastille-d neutre"');
  });

  it("vainqueur introuvable : personne n'est désigné, rien n'est affirmé", () => {
    const html = widgetMatch(
      match({
        statut: "termine",
        verdict: {
          niveau: "manuel",
          motif: null,
          gagnant: null,
          sansVainqueur: false,
          decideur: "arbitre",
        },
      }),
      opaque,
    );
    expect(html).not.toContain("Vainqueur");
    expect(html).not.toContain("Aucun vainqueur");
    expect(html).not.toContain("cote perdant");
    expect(html).toContain("décision de l'arbitre");
  });

  it("terminé sans verdict définitif : « Terminé », sans vainqueur ni annonce", () => {
    const html = widgetMatch(match({ statut: "termine" }), opaque);
    expect(html).toContain("Terminé");
    expect(html).not.toContain("À venir");
    expect(html).not.toContain("Vainqueur");
    expect(html).not.toContain("Résultat lu chez Riot");
  });

  it("tournoi annulé : pas de « À venir », pas d'annonce de résultat", () => {
    const html = widgetMatch(match({ statut: "en_attente", tournoiAnnule: true }), opaque);
    expect(html).toContain("Tournoi annulé");
    expect(html).not.toContain("À venir");
    expect(html).not.toContain("Résultat lu chez Riot");
    // Duel annulé resté en litige : personne ne tranchera.
    const litige = widgetMatch(match({ statut: "litige", tournoiAnnule: true }), opaque);
    expect(litige).toContain("Tournoi annulé");
    expect(litige).not.toContain("tranche le litige");
  });

  it("aucun vainqueur, litige, place encore vide", () => {
    expect(
      widgetMatch(
        match({
          statut: "termine",
          verdict: {
            niveau: "manuel",
            motif: null,
            gagnant: null,
            sansVainqueur: true,
            decideur: "organisateur",
          },
        }),
        opaque,
      ),
    ).toContain("Aucun vainqueur.");
    expect(widgetMatch(match({ statut: "litige" }), opaque)).toContain("L'organisateur tranche le litige.");
    const seul = widgetMatch(
      match({
        statut: "en_attente",
        cotes: [{ nom: "Vipere", niveau: null, pret: false }],
      }),
      opaque,
    );
    expect(seul).toContain("En attente de l'adversaire");
    expect(seul).toContain("À déterminer");
    expect(seul).not.toContain("Résultat lu chez Riot");
  });

  it("Best-of affiché au-delà d'une partie", () => {
    expect(widgetMatch(match(), opaque)).toContain("Demi-finale · Bo3");
    expect(widgetMatch(match({ bestOf: 1 }), opaque)).not.toContain("Bo1");
  });

  it("fond transparent pour OBS, joueur sans match", () => {
    const transparent = widgetMatch(match(), { transparent: true });
    expect(transparent).toContain("background:transparent");
    expect(transparent).toContain(".overlay{background:rgba(19,21,19,.82)");
    const html = widgetSansMatch("Vipere", "https://najarena.example/joueur/vipere", opaque);
    expect(html).toContain("pas de match en cours");
    expect(html).toContain("https://najarena.example/joueur/vipere");
  });
});
