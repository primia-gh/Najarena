import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Même raccourci que tsconfig.json ("@/..." = src/...) : sans lui, un test qui
// importe un module utilisant "@/lib/..." ne trouve pas ses dépendances.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // « server-only » n'existe que pour la compilation Next.js (garde-fou
      // contre un import côté navigateur) : sans effet dans les tests.
      "server-only": fileURLToPath(new URL("./tests/server-only-vide.ts", import.meta.url)),
    },
  },
});
