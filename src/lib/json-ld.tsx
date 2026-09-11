// Rendu d'un bloc JSON-LD (schema.org) dans une page serveur. Échappe "<"
// pour empêcher toute donnée utilisateur (pseudo, motif...) de fermer
// prématurément la balise <script> — JSON.stringify seul ne le fait pas.
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
  );
}
