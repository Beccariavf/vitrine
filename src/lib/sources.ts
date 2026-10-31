/** Libellés lisibles des sources ; l'identifiant reste dans les données. */
const SOURCE_LABELS: Record<string, string> = {
  cnil: "CNIL",
  cjeu: "CJUE",
};

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}
