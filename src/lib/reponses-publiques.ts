// Réponses de l'API publique et des widgets (audit N31) : lecture seule,
// ouvertes à tous les sites (CORS), mises en cache une minute par le CDN
// de l'hébergeur — c'est aussi ce qui limite la charge sur la base.

const CACHE = "public, s-maxage=60, stale-while-revalidate=300";

const ENTETES_API = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": CACHE,
};

export function reponseApi(corps: unknown, statut = 200): Response {
  return Response.json(corps, { status: statut, headers: ENTETES_API });
}

/**
 * Adresse canonique d'une lecture coûteuse : sans paramètres et en
 * minuscules, pour que le cache d'une minute du CDN serve tout le monde.
 * « ?x=1 », « ?x=2 »… ou « /Vipere » contournaient le cache et relisaient
 * toute la base à chaque appel (contrôle de sécurité du 17/10/2026). Null
 * si l'adresse est déjà canonique.
 */
export function redirectionCanonique(requete: Request): Response | null {
  const url = new URL(requete.url);
  const chemin = url.pathname.toLowerCase();
  if (!url.search && chemin === url.pathname) return null;
  return new Response(null, {
    status: 308,
    headers: { ...ENTETES_API, Location: chemin },
  });
}

export function reponseOptions(): Response {
  return new Response(null, { status: 204, headers: ENTETES_API });
}

/** Lecture publique protégée : base injoignable = réponse 503 (sans cache). */
export async function lirePublic<T>(lecture: () => Promise<T>): Promise<{ ok: true; valeur: T } | { ok: false }> {
  try {
    return { ok: true, valeur: await lecture() };
  } catch {
    return { ok: false };
  }
}

export function reponseIndisponible(): Response {
  return Response.json(
    { erreur: "Données indisponibles pour l'instant." },
    { status: 503, headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" } },
  );
}

export function reponseWidget(html: string, statut = 200): Response {
  return new Response(html, {
    status: statut,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": statut === 503 ? "no-store" : CACHE },
  });
}
