// Commandes du bot Discord liées aux communautés (03/10/2026, audit N30) :
// logique pure, testée dans discord-commandes.test.ts ; la route
// /api/discord/interactions s'en sert.

import { REGIONS } from "@/lib/regions";

/** Permission Discord « Gérer le serveur » (MANAGE_GUILD, 1 << 5). */
const GERER_SERVEUR = BigInt(1) << BigInt(5);
/** Permission « Administrateur » (ADMINISTRATOR, 1 << 3) : couvre toutes les autres. */
const ADMINISTRATEUR = BigInt(1) << BigInt(3);

/** Le membre qui lance la commande peut-il gérer le serveur ? */
export function peutGererServeur(permissions: string | undefined): boolean {
  if (!permissions || !/^\d+$/.test(permissions)) return false;
  const bits = BigInt(permissions);
  return (bits & GERER_SERVEUR) !== BigInt(0) || (bits & ADMINISTRATEUR) !== BigInt(0);
}

export interface OptionCommande {
  name: string;
  value?: string | number | boolean;
}

export function lireOption(options: OptionCommande[] | undefined, nom: string): string | undefined {
  const valeur = options?.find((o) => o.name === nom)?.value;
  return valeur === undefined ? undefined : String(valeur);
}

const CAPACITES_DISCORD = [4, 8, 16, 32, 64];

/** "2026-10-05T20:00" décalé de `minutes` (heure murale, sans fuseau). */
function decaler(dateHeure: string, minutes: number): string {
  const d = new Date(`${dateHeure}:00Z`);
  d.setUTCMinutes(d.getUTCMinutes() + minutes);
  return d.toISOString().slice(0, 16);
}

/**
 * Lien pré-rempli vers le formulaire de création de tournoi, depuis la
 * commande /organiser. Le bot n'écrit rien : l'organisateur relit et crée
 * le tournoi sur le site, avec toutes les règles habituelles. Date au
 * format JJ/MM (année en cours, ou suivante si la date est passée), heure
 * HH:MM (heure de Paris). Check-in proposé 30 minutes avant.
 */
export function lienOrganiser(
  saisie: { nom?: string; jour?: string; heure?: string; places?: string; region?: string; communaute?: string },
  aujourdhuiParis: string,
  urlSite: string,
): { ok: true; lien: string } | { ok: false; erreur: string } {
  const nom = (saisie.nom ?? "").trim();
  if (nom.length < 3 || nom.length > 60) return { ok: false, erreur: "Le nom doit faire entre 3 et 60 caractères." };

  const jour = /^(\d{1,2})\/(\d{1,2})$/.exec((saisie.jour ?? "").trim());
  const heure = /^(\d{1,2})[:hH](\d{2})$/.exec((saisie.heure ?? "").trim());
  if (!jour || !heure)
    return { ok: false, erreur: "Date au format JJ/MM et heure au format HH:MM, par exemple 05/10 et 20:30." };
  const [j, m, h, min] = [Number(jour[1]), Number(jour[2]), Number(heure[1]), Number(heure[2])];
  if (m < 1 || m > 12 || j < 1 || j > 31 || h > 23 || min > 59) return { ok: false, erreur: "Date ou heure invalide." };

  const deux = (n: number) => String(n).padStart(2, "0");
  let annee = Number(aujourdhuiParis.slice(0, 4));
  if (`${deux(m)}-${deux(j)}` < aujourdhuiParis.slice(5, 10)) annee += 1;
  const debut = `${annee}-${deux(m)}-${deux(j)}T${deux(h)}:${deux(min)}`;
  if (Number.isNaN(new Date(`${debut}:00Z`).getTime()) || new Date(`${debut}:00Z`).getUTCDate() !== j) {
    return { ok: false, erreur: "Cette date n'existe pas." };
  }

  const params = new URLSearchParams({ nom, debut, checkin: decaler(debut, -30) });
  if (saisie.places && CAPACITES_DISCORD.includes(Number(saisie.places))) params.set("capacite", saisie.places);
  if (saisie.region && REGIONS.some((r) => r.code === saisie.region)) params.set("region", saisie.region);
  if (saisie.communaute) params.set("communaute", saisie.communaute);
  return { ok: true, lien: `${urlSite}/organiser/nouveau?${params.toString()}` };
}
