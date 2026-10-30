import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// Rendu statique : la page est écrite au build à partir de `data/`, et le site
// n'a besoin d'aucun serveur ni d'aucune API au runtime.
export default defineConfig({
  output: "static",
  vite: {
    plugins: [tailwindcss()],
  },
});
