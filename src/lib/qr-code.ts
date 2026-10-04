import qrcode from "qrcode-generator";

// QR code du certificat de niveau (audit N9) : calculé côté serveur, dessiné
// en SVG par la page (aucun script, aucune image externe). Correction
// d'erreur « M » : lisible même imprimé un peu abîmé.

export interface ModulesQrCode {
  /** Nombre de modules par côté. */
  taille: number;
  /** Chemin SVG des modules sombres, un carré de 1 × 1 par module. */
  chemin: string;
  estSombre: (ligne: number, colonne: number) => boolean;
}

export function modulesQrCode(texte: string): ModulesQrCode {
  const qr = qrcode(0, "M");
  qr.addData(texte, "Byte");
  qr.make();
  const taille = qr.getModuleCount();
  let chemin = "";
  for (let ligne = 0; ligne < taille; ligne++) {
    for (let colonne = 0; colonne < taille; colonne++) {
      if (qr.isDark(ligne, colonne)) chemin += `M${colonne} ${ligne}h1v1h-1z`;
    }
  }
  return { taille, chemin, estSombre: (ligne, colonne) => qr.isDark(ligne, colonne) };
}
