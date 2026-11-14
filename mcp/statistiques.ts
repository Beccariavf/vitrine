/** Statistiques partagées par la mesure (`mcp/eval`) et le serveur, sans dépendance. */

/** Intervalle de confiance à 95 % d'une proportion, méthode de Wilson. */
export function intervalleWilson(succes: number, total: number): [number, number] {
  if (total === 0) return [0, 0];
  const z = 1.959963984540054;
  const proportion = succes / total;
  const denominateur = 1 + (z * z) / total;
  const centre = (proportion + (z * z) / (2 * total)) / denominateur;
  const demiLargeur =
    (z * Math.sqrt((proportion * (1 - proportion)) / total + (z * z) / (4 * total * total))) /
    denominateur;
  return [Math.max(0, centre - demiLargeur), Math.min(1, centre + demiLargeur)];
}
