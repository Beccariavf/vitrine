# Reranker sur option — #114

Mesure du 2026-11-27, index réel `data/corpus/index/index.db` (178 359 unités, 24 corpus,
`leoipulsar/harrier-0.6b` sur Ollama), reranker `bge-reranker-v2-m3` Q8_0 servi par
`llama-server --reranking` sur `127.0.0.1:8080`. Les passes sont en lecture seule : aucun
`corpus:index`, aucune écriture sous `data/`.

## Qualité et latence selon le nombre de candidats

Jeu `mcp/eval/questions-sources-publiees.csv`, mode par défaut (`--sans-filtre --detection`),
une passe par groupe `--corpus` comme dans `2026_11_26_mode-defaut-hybride/resultats.md`. « Top 5
brut » : la référence attendue est dans les 5 meilleurs passages, avant le filtre de confiance.
« Top 5 rendu » : ce que le client reçoit sous les seuils calibrés (`aucun_resultat_fiable` ne rend
aucun passage). « Textes seuls » : référence attendue dans un corpus de type `texte` (42 questions) ;
« autres » : doctrine, décisions et métadonnées (18). La latence est la médiane des durées du bloc
`rerank` sur les 60 questions.

| candidats | top 5 brut | top 5 rendu | brut : textes / autres | rendu : textes / autres | latence médiane | latence moyenne |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sans reranker | 27/60 | 27/60 | 19/42 / 8/18 | 19/42 / 8/18 | — | — |
| 20 | 30/60 | 29/60 | 21/42 / 9/18 | 20/42 / 9/18 | 1 240 ms | 1 656 ms |
| 30 | 31/60 | 30/60 | 21/42 / 10/18 | 20/42 / 10/18 | 1 788 ms | 1 890 ms |
| 50 | 31/60 | 29/60 | 21/42 / 10/18 | 19/42 / 10/18 | 3 242 ms | 3 357 ms |

Le témoin dense reproduit exactement les 27/60 du 2026-11-26. Au brut, 20 candidats gagnent trois
questions, 30 et 50 en gagnent quatre ; au rendu, 30 en gagne trois et 20 comme 50 en gagnent deux.
Le gain vient des textes (+1) et des autres (+1 à +2). 30 candidats est le meilleur compromis rendu ;
20 égale 50 au rendu pour un tiers de sa latence, et 50 fait passer six questions sous
`aucun_resultat_fiable` contre quatre à 20 et 30. La machine était partagée (charge système entre 3
et 40 selon les passes) : les latences situent les ordres de grandeur, pas la performance isolée.
La mesure du 2026-11-10 donnait 3 595 ms par question à 50 candidats ; celle de sélection du 27/11
≈1,9 s.

La mesure de sélection du 2026-11-27 (35/60, ≈1,9 s/question) ne se reproduit pas à l'identique :
cette passe rend 31/60 au brut (29/60 au rendu) à 50 candidats. L'écart de quatre questions n'est
pas attribué ; il peut venir de la troncature à 2 000 caractères, des lots de 25, ou de la charge.
Le témoin dense, lui, reproduit exactement 27/60.

## CNIL `dev`

Jeu `mcp/eval/questions-cnil-etendu.csv --split dev`, 54 questions référencées et 6 pièges.

| configuration | top 5 brut | top 5 rendu | MRR brut | top 1 brut | latence médiane |
| --- | ---: | ---: | ---: | ---: | ---: |
| sans reranker | 44/54 | 44/54 | 0,740 | 38/54 | — |
| bge, 50 candidats | 45/54 | 42/54 | 0,769 | 39/54 | 2 828 ms |

Le classement brut gagne une question au top 5 et une au rang 1 ; le rendu perd deux questions
parce que trois réponses passent sous `aucun_resultat_fiable` (contre zéro sans reranker). Les
pièges cités tombent de 5 à 2. Comparaison au 2026-11-10 (`2026_11_10_reranker-avant-embedder`) :
le témoin Harrier est bien meilleur que le témoin qwen3 de l'époque (44/54 contre 39/54), et le
gain du reranker se réduit à +1 question au top 5 au lieu de +6.

## Panne du reranker

Serveur MCP démarré avec `VITRINE_RERANK_URL=http://127.0.0.1:8080`, question « Quelles sanctions
pour des cookies déposés sans consentement ? » (`corpus: cnil`, `k: 5`) :

- reranker actif : `rerank: { modele: "bge-reranker-v2-m3", duree_ms: 3412 }`, cinq passages
  `CNILTEXT…` ;
- `llama-server` arrêté, second appel : la réponse est rendue avec le classement dense et
  `rerank: { modele: "bge-reranker-v2-m3", indisponible: true, raison: "Reranker injoignable sur
  http://127.0.0.1:8080 : fetch failed." }` ;
- `stderr` du serveur : une seule ligne de panne pour ce démarrage, pas une par requête.

Le test hors ligne `tests/rerank-option.test.ts` vérifie qu'un second échec n'écrit pas de second
message.

## Validation

Voir le compte rendu de la PR : `npm run typecheck`, `npm test`, `npm run build`. Le test hors ligne
couvre les variables absentes ou invalides, la troncature à 2 000 caractères, les lots de 25
(60 passages → 3 appels), les pannes réseau, HTTP 500, délai dépassé et réponse incomplète, le repli
dense avec `indisponible: true`, et le mode lexical qui n'appelle jamais le reranker.

## Commandes

```sh
D=aidd_docs/tasks/2026_11/2026_11_27_reranker-option/mesures
llama-server --reranking -m ~/.cache/vitrine-rerank/bge-reranker-v2-m3-q8_0.gguf \
  --port 8080 -c 16384 -np 1 -ub 4096 -b 4096

for n in 20 30 50; do
  for c in $(awk -F, 'NR>1{print $5}' mcp/eval/questions-sources-publiees.csv | sort -u); do
    node mcp/eval/run.ts --questions mcp/eval/questions-sources-publiees.csv --corpus "$c" \
      --sans-filtre --detection --rerank bge-reranker-v2-m3 --candidats "$n" --json \
      > "$D/rerank-$n-$c.json"
  done
done

# témoin dense, mêmes groupes
for c in $(awk -F, 'NR>1{print $5}' mcp/eval/questions-sources-publiees.csv | sort -u); do
  node mcp/eval/run.ts --questions mcp/eval/questions-sources-publiees.csv --corpus "$c" \
    --sans-filtre --detection --json > "$D/dense-$c.json"
done

node mcp/eval/run.ts --questions mcp/eval/questions-cnil-etendu.csv --split dev --json \
  > "$D/cnil-dev-sans.json"
node mcp/eval/run.ts --questions mcp/eval/questions-cnil-etendu.csv --split dev --json \
  --rerank bge-reranker-v2-m3 --candidats 50 > "$D/cnil-dev-rerank-50.json"
```
