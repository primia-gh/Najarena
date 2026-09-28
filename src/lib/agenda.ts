// Fichier calendrier (iCalendar, RFC 5545) d'un tournoi : « Ajouter à mon
// agenda » sur la page du tournoi (28/09/2026, audit N6). Lu par Google
// Agenda, Apple Calendrier et Outlook. Logique pure, testée dans
// agenda.test.ts.

export interface EvenementAgenda {
  uid: string;
  titre: string;
  debut: Date;
  /** Durée estimée du tournoi, en minutes. */
  dureeMinutes: number;
  description: string;
  url: string;
  maintenant?: Date;
}

// 20260927T190000Z
function dateIcs(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// Échappement des textes (RFC 5545 §3.3.11).
function texteIcs(texte: string): string {
  return texte.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/([,;])/g, "\\$1");
}

// Lignes de 75 octets au plus, les suivantes commencent par une espace (§3.1).
function plier(ligne: string): string {
  const octets = new TextEncoder().encode(ligne);
  if (octets.length <= 75) return ligne;
  const morceaux: string[] = [];
  let courant = "";
  for (const caractere of ligne) {
    const limite = morceaux.length === 0 ? 75 : 74;
    if (new TextEncoder().encode(courant + caractere).length > limite) {
      morceaux.push(courant);
      courant = caractere;
    } else {
      courant += caractere;
    }
  }
  morceaux.push(courant);
  return morceaux.join("\r\n ");
}

export function construireIcs(e: EvenementAgenda): string {
  const fin = new Date(e.debut.getTime() + e.dureeMinutes * 60_000);
  const lignes = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Najarena//Tournois//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${dateIcs(e.maintenant ?? new Date())}`,
    `DTSTART:${dateIcs(e.debut)}`,
    `DTEND:${dateIcs(fin)}`,
    `SUMMARY:${texteIcs(e.titre)}`,
    `DESCRIPTION:${texteIcs(e.description)}`,
    `URL:${e.url}`,
    // Rappel 30 minutes avant (l'heure du check-in du Daily).
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${texteIcs(e.titre)}`,
    "TRIGGER:-PT30M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lignes.map(plier).join("\r\n") + "\r\n";
}
