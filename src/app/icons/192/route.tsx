import { ImageResponse } from "next/og";
import { sceauIconSvg } from "@/lib/marque-icon";

const taille = 192;

export function GET() {
  return new ImageResponse(sceauIconSvg(taille), { width: taille, height: taille });
}
