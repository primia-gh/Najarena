import Link from "next/link";

// Case « 15 ans et CGU » des formulaires de création de compte (e-mail ou
// Discord) — texte inchangé, posé une seule fois ici au lieu d'être recopié
// trois fois. Le serveur refuse la création sans elle (auth-actions).

export default function ConsentementCompte() {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm text-text-2">
      <input name="age_confirme" type="checkbox" required className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-accent" />
      <span>
        J&apos;ai au moins 15 ans (ou l&apos;autorisation de mon représentant légal) et j&apos;accepte les{" "}
        <Link href="/cgu" className="text-text underline underline-offset-3 hover:text-accent">
          CGU
        </Link>
        . Mes données sont traitées selon la{" "}
        <Link href="/confidentialite" className="text-text underline underline-offset-3 hover:text-accent">
          politique de confidentialité
        </Link>
        .
      </span>
    </label>
  );
}
