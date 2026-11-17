"use client";

import { useEffect, useState } from "react";
import { sAbonnerPush, seDesabonnerPush } from "@/lib/push-actions";

const CLE_PUBLIQUE_VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

// L'API Push attend la clé serveur sous forme de Uint8Array, pas la chaîne
// base64url renvoyée par web-push generate-vapid-keys — conversion standard.
function versUint8Array(base64url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const brut = atob(base64);
  const tableau = new Uint8Array(new ArrayBuffer(brut.length));
  for (let i = 0; i < brut.length; i++) tableau[i] = brut.charCodeAt(i);
  return tableau;
}

type Etat = "verification" | "non_supporte" | "inactif" | "actif" | "refuse";

export default function PushOptIn() {
  const [etat, setEtat] = useState<Etat>("verification");
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    let annule = false;

    async function verifier() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !CLE_PUBLIQUE_VAPID) {
        if (!annule) setEtat("non_supporte");
        return;
      }
      if (Notification.permission === "denied") {
        if (!annule) setEtat("refuse");
        return;
      }
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        const subscription = await registration?.pushManager.getSubscription();
        if (!annule) setEtat(subscription ? "actif" : "inactif");
      } catch {
        if (!annule) setEtat("inactif");
      }
    }

    verifier();
    return () => {
      annule = true;
    };
  }, []);

  async function activer() {
    if (!CLE_PUBLIQUE_VAPID) return;
    setEnCours(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setEtat("refuse");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: versUint8Array(CLE_PUBLIQUE_VAPID),
      });
      const { endpoint, keys } = subscription.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };
      const resultat = await sAbonnerPush({ endpoint, keys });
      setEtat(resultat.ok ? "actif" : "inactif");
    } catch {
      setEtat("inactif");
    } finally {
      setEnCours(false);
    }
  }

  async function desactiver() {
    setEnCours(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await seDesabonnerPush(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setEtat("inactif");
    } finally {
      setEnCours(false);
    }
  }

  if (etat === "verification") return null;

  // Navigateur sans notifications push (ou clé absente) : on le dit, plutôt
  // que de laisser la rubrique « Notifications » vide (revue du 05/10/2026).
  if (etat === "non_supporte") {
    return (
      <p className="text-sm text-muted">
        Les notifications push ne sont pas disponibles sur ce navigateur. Si ton compte est lié à Discord, les rappels
        de match y arrivent en message privé.
      </p>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <span className="text-sm font-semibold text-text">Notifications push</span>
        <p className="mt-1 text-sm text-muted">
          {etat === "actif" && "Activées sur cet appareil"}
          {etat === "inactif" && "Check-in, résultats, litiges — en plus de l'e-mail"}
          {etat === "refuse" && "Bloquées par ton navigateur — à réactiver dans ses réglages"}
        </p>
      </div>
      {etat !== "refuse" && (
        <button
          type="button"
          disabled={enCours}
          onClick={etat === "actif" ? desactiver : activer}
          className="inline-flex min-h-11 shrink-0 cursor-pointer items-center rounded-bouton border border-line-strong px-4 text-sm text-text-2 hover:border-[rgba(245,245,244,0.25)] hover:text-text disabled:opacity-50"
        >
          {etat === "actif" ? "Désactiver" : "Activer"}
        </button>
      )}
    </div>
  );
}
