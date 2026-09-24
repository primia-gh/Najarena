"use client";

import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

const TAILLE_MAX = 2 * 1024 * 1024; // 2 Mo
const TYPES_ACCEPTES = ["image/png", "image/jpeg", "image/webp"];

interface UploadLogoProps {
  // Chemin d'objet dans le bucket "logos" : logos/{type}/{id}.{ext} — la
  // policy Storage s'appuie sur `owner`, pas sur ce chemin, mais le garder
  // stable évite d'accumuler des fichiers orphelins à chaque remplacement.
  type: "tournoi" | "equipe";
  id: string;
  logoActuel?: string | null;
  // Nom du champ caché soumis avec le reste du formulaire parent — l'upload
  // se fait au choix du fichier, avant la soumission, pour ne pas avoir
  // besoin d'une Server Action dédiée juste pour ça.
  nomChamp: string;
}

export default function UploadLogo({ type, id, logoActuel, nomChamp }: UploadLogoProps) {
  const [url, setUrl] = useState(logoActuel ?? "");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function gererFichier(fichier: File) {
    setErreur(null);
    if (!TYPES_ACCEPTES.includes(fichier.type)) {
      setErreur("Formats acceptés : PNG, JPEG, WebP.");
      return;
    }
    if (fichier.size > TAILLE_MAX) {
      setErreur("2 Mo maximum.");
      return;
    }

    setEnCours(true);
    const supabase = createClient();
    const extension = fichier.name.split(".").pop() ?? "png";
    const chemin = `${type}/${id}.${extension}`;

    const { error } = await supabase.storage.from("logos").upload(chemin, fichier, { upsert: true });
    setEnCours(false);

    if (error) {
      setErreur("Envoi impossible pour l'instant.");
      return;
    }

    const { data } = supabase.storage.from("logos").getPublicUrl(chemin);
    // Cache-bust : le chemin ne change pas d'un remplacement à l'autre
    // (upsert), sans ça le navigateur pourrait garder l'ancienne image.
    setUrl(`${data.publicUrl}?v=${Date.now()}`);
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="font-texte tabular-nums text-[0.62rem] tracking-[0.14em] text-muted uppercase">Logo</span>
      {url && (
        <Image
          src={url}
          alt=""
          width={64}
          height={64}
          className="h-16 w-16 rounded-[3px] border border-line object-cover"
          unoptimized
        />
      )}
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => {
          const fichier = e.target.files?.[0];
          if (fichier) gererFichier(fichier);
        }}
        className="text-sm text-muted file:mr-3 file:rounded-[3px] file:border file:border-line file:bg-surface file:px-3 file:py-1.5 file:text-sm file:text-text"
      />
      <input type="hidden" name={nomChamp} value={url} />
      {enCours && <p className="text-[0.72rem] text-muted">Envoi en cours…</p>}
      {erreur && <p className="text-[0.72rem] text-accent">{erreur}</p>}
    </div>
  );
}
