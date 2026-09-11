import { ImageResponse } from "next/og";
import { sceauIconSvg } from "@/lib/marque-icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(sceauIconSvg(size.width), size);
}
