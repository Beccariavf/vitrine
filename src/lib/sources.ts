/** Libellés lisibles des sources ; l'identifiant reste dans les données. */
const SOURCE_LABELS: Record<string, string> = {
  cnil: "CNIL",
  cjeu: "CJUE",
  anssi: "ANSSI",
  cepd: "CEPD",
  arcep: "ARCEP",
  commission: "Commission européenne",
  cetat: "Conseil d'État",
  judilibre: "Cour de cassation",
};

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}
