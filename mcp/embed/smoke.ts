import { createOllamaEmbedder, DIM_DEFAUT, HOTE_DEFAUT, MODELE_DEFAUT } from "./embedder.ts";

/**
 * Contrôle réel du modèle : Ollama doit écouter et le modèle être tiré. Lance
 * un seul appel, vérifie la dimension et la norme, puis sort en erreur avec la
 * commande qui répare. Jamais lancé par la CI.
 */
async function main(): Promise<void> {
  const host = process.env.OLLAMA_HOST ?? HOTE_DEFAUT;
  const embedder = createOllamaEmbedder({ host });

  const vecteur = await embedder.embedQuery("contrôle du modèle d'embedding");
  const norme = Math.sqrt(vecteur.reduce((total, valeur) => total + valeur * valeur, 0));

  if (vecteur.length !== DIM_DEFAUT) {
    throw new Error(
      `${MODELE_DEFAUT} rend ${vecteur.length} dimensions, ${DIM_DEFAUT} attendues. ` +
        `Lancez « ollama pull ${MODELE_DEFAUT} ».`,
    );
  }
  if (Math.abs(norme - 1) > 1e-5) {
    throw new Error(`Le vecteur rendu par ${MODELE_DEFAUT} n'est pas normalisé (norme ${norme}).`);
  }

  process.stderr.write(
    `Ollama ${host} répond : ${MODELE_DEFAUT}, ${vecteur.length} dimensions, norme ${norme.toFixed(6)}.\n`,
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
