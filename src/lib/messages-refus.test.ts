import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { messageRefusBourse } from "./bourse-remplacants";
import { messageRefusCoach } from "./coach";
import { messageRefusDivision } from "./divisions";

// Chaque refus levé par la base pour la bourse aux remplaçants, le coach
// et les divisions a son message en français (contrôle du testeur,
// 11/10/2026) : jamais le message par défaut pour un cas prévu.

const SCHEMA = readFileSync(join(process.cwd(), "docs/schema.sql"), "utf8");
const PAR_DEFAUT = "Action impossible pour l'instant.";

/** Codes levés (raise exception 'CODE') par la dernière version d'une fonction. */
function codesLeves(fonction: string): string[] {
  const debut = SCHEMA.lastIndexOf(`create or replace function public.${fonction}(`);
  expect(debut, `fonction ${fonction} absente du schéma`).toBeGreaterThan(-1);
  const corps = SCHEMA.slice(debut, SCHEMA.indexOf("\n$$;", debut));
  return [...corps.matchAll(/raise exception '([A-Z_]+)'/g)].map((m) => m[1]);
}

describe("messages de refus", () => {
  it.each([
    ["proposer_remplacement", messageRefusBourse],
    ["remplacer_aligne", messageRefusBourse],
    ["demander_coaching", messageRefusCoach],
    ["repondre_coaching", messageRefusCoach],
    ["s_inscrire_division", messageRefusDivision],
    ["je_suis_la_division", messageRefusDivision],
  ] as const)("%s : un message pour chaque refus", (fonction, message) => {
    const codes = codesLeves(fonction);
    expect(codes.length).toBeGreaterThan(0);
    for (const code of codes) expect(message(`ERROR: ${code}`), code).not.toBe(PAR_DEFAUT);
  });

  it("un refus inconnu garde le message par défaut", () => {
    expect(messageRefusBourse("autre chose")).toBe(PAR_DEFAUT);
    expect(messageRefusCoach("autre chose")).toBe(PAR_DEFAUT);
    expect(messageRefusDivision("autre chose")).toBe(PAR_DEFAUT);
  });
});
