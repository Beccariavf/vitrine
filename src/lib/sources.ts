/** Libellés lisibles des sources ; l'identifiant reste dans les données. */
const SOURCE_LABELS: Record<string, string> = {
  cnil: "CNIL",
  cnil_doctrine: "CNIL — doctrine",
  cjeu: "CJUE",
  anssi: "ANSSI",
  cepd: "CEPD",
  arcep: "ARCEP",
  commission: "Commission européenne",
  "commission-dma": "Commission européenne — DMA",
  arcom: "ARCOM",
  cetat: "Conseil d'État",
  constit: "Conseil constitutionnel",
  judilibre: "Cour de cassation",
  legi: "Légifrance",
  eurlex: "EUR-Lex",
};

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}
