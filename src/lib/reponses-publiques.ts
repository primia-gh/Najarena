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
