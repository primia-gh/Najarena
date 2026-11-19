// Vérification anti-robot (audit F1, 19/11/2026) : Cloudflare Turnstile,
// contrôlée par Supabase Auth elle-même (Authentication > Attack
// Protection > CAPTCHA, avec la clé secrète Turnstile). Le site ne fait que
// montrer le widget et transmettre le jeton à Supabase.
//
// Éteinte tant que NEXT_PUBLIC_TURNSTILE_SITE_KEY n'est pas réglée : aucun
// widget, aucun jeton, rien ne change. À allumer EN MÊME TEMPS que la
// protection dans Supabase : une fois allumée là-bas, Supabase exige un
// jeton à l'inscription, à la connexion par mot de passe et à la demande
// de nouveau mot de passe — sans la clé ici, ces trois formulaires
// échoueraient.

/** Clé publique du widget (pas un secret : elle est lue par le navigateur). */
export function cleSiteCaptcha(): string | null {
  const cle = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  return cle ? cle : null;
}

/** Jeton envoyé par le widget avec le formulaire, à passer à Supabase. */
export function jetonCaptcha(formData: FormData): string | undefined {
  const jeton = formData.get("cf-turnstile-response");
  return typeof jeton === "string" && jeton.length > 0 && jeton.length <= 4096 ? jeton : undefined;
}
