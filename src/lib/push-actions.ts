"use server";

import { createClient } from "@/lib/supabase/server";

interface AbonnementPush {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

// Écriture liée à la session de l'appelant uniquement (RLS : profile_id =
// auth.uid()) — jamais de client service_role ici, contrairement à la
// lecture croisée dans notifications.ts.
export async function sAbonnerPush(abonnement: AbonnementPush): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false };

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      profile_id: userData.user.id,
      endpoint: abonnement.endpoint,
      p256dh: abonnement.keys.p256dh,
      auth: abonnement.keys.auth,
    },
    { onConflict: "endpoint" },
  );

  return { ok: !error };
}

export async function seDesabonnerPush(endpoint: string): Promise<void> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;

  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("profile_id", userData.user.id);
}
