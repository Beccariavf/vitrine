import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { apiRecherche } from "./src/integrations/api-recherche.ts";

// Rendu statique : la page est écrite au build à partir de `data/`, et le site
// n'a besoin d'aucune API au runtime. `npm run dev` lance en plus l'API locale
// de la recherche lexicale ; le build ignore cette intégration.
export default defineConfig({
  output: "static",
  integrations: [apiRecherche()],
  vite: {
    plugins: [tailwindcss()],
  },
});
