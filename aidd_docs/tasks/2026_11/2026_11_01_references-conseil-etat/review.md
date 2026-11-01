# Revue du candidat

Statut : **cleared**, aucun bloqueur. Revue indépendante et challenge terminés sur `5b00d74`.

## Validation

| Commande | Résultat |
| -------- | -------- |
| `npm test` | 230 tests, 0 échec |
| `npm run typecheck` | propre |
| `npm run build` | 2 pages, aucune erreur |
| Passe ciblée CETAT | 9 décisions relues, 10 appels PISTE (1 jeton + 9 consultations) |
| Passe ciblée 501268 | 1 consultation, 2 appels |
| Page construite | 501268 : `LIL · art. 8, 82, 20`, `CPCE · art. L. 34-5`, `RGPD · art. 83` ; 509589, 513996, 509210, 511155 conformes ; 520279 sans pastille |
| Liens | `target="_blank" rel="noopener"`, Légifrance / EUR-Lex |
| Portée | seules les entrées CETAT ont changé |

## Constats

| # | Sévérité | Constat | Suite |
| - | -------- | ------- | ----- |
| F1 | majeur | Le plancher de 6 appels ne couvrait pas la consultation qui retente après un 401 (3 appels). | Corrigé : `postLegifrance` prend un plancher et le vérifie avant le jeton et avant le POST ; test dédié. |
| F2 | mineur | Une passe à froid laisse zéro lecture à Judilibre et la mémoire annonçait 14 appels. | Corrigé : la mémoire décrit 13 appels de recherche et le partage des 3 restants. |
| F3 | mineur | L'article 8 de la LIL, cité « en vertu des dispositions du I de l'article 8 », était écarté. | Corrigé : l'article est retenu, l'entrée et le test sont à jour. |
| F4 | mineur | La directive ePrivacy nommée par sa date (« du 12 juillet 2002 ») restait non reconnue. | Corrigé après la fusion : la date est ramenée à `2002/58/CE`, et 501268 affiche `Directive 2002/58/CE · art. 13`. |
| F5 | majeur | Une formule introduite par un grief pouvait passer (« soutient que, », « est soutenu que, », « selon la partie, »). | Corrigé : lecture limitée aux motifs après « Considérant ce qui suit », garde de discours rapporté élargi, « il résulte de l'instruction » neutralisé. |
| F6 | mineur | Le report CETAT était journalisé « visa not read ». | Corrigé : « references not read ». |
| F7 | mineur | `data/usage/<date>.json` est écrasé à chaque passe ; la journée du 1er novembre ne garde que le dernier passage. | Laissé en suggestion ; comportement existant de `flushUsage`. |
| F8 | mineur | Le plan et la spec citaient deux références pour 501268 ; le texte réel en porte trois. | Plan aligné ; la spec reste verrouillée. |
| F9 | mineur | `CetatApiResult` duplique la forme de `ApiResult`. | Laissé en suggestion. |

## Challenge

Confiance : **88 %**. Aucun bloqueur.

- Les neuf décisions collectées portent toutes « Considérant ce qui suit : » ; la lecture des motifs ne perd aucun article appliqué du corpus.
- 520279 perd une pastille qui venait d'un grief ; les autres cartes ne changent pas.
- Le risque résiduel est heuristique : un verbe de grief absent de la liste (« reproche », « conteste », « se plaint ») ou une décision sans repère de motifs resteraient sans effet. La lecture des motifs et le « jamais inventé » contiennent ce risque.

## Suggestions ouvertes

- Étendre la liste des verbes de grief, ou documenter ses limites.
- Restreindre `selon` aux noms de parties : « Selon la Cour de justice, en vertu de l'article 5 » est aujourd'hui écarté.
- Ajouter un repère de repli pour une décision sans « Considérant ce qui suit ».
- Aligner `spec.md` sur les trois références de 501268, ou acter que seul le contrat compte.
- Reconstituer un journal de passe complète, et décider du sort de l'écrasement quotidien.
- Partager le type de résultat des sources API.

## Passe 2 — précision et journal

Statut : **cleared** sur `020bfb7` ; confiance 90 %, aucun bloqueur.

| Constat | Suite |
| ------- | ----- |
| « selon les requérantes », « selon une partie », « selon cette partie » passaient encore. | Corrigé : préfixes définis, indéfinis et démonstratifs, formes plurielles et féminines (`défenderesse`, `demanderesse`). |
| « se plaint de ce que, en vertu de… » passait. | Corrigé : le connecteur `de ce que` est reconnu. |
| Le contrat ne nommait pas les sept verbes de grief. | Corrigé : la spec les nomme, `testing.md` les liste. |
| Journal : aucune erreur ; l'écriture reste non atomique entre deux passes concurrentes. | Note : même limite qu'avant, hors périmètre. |
| Limite assumée : « reproche à la CNIL d'avoir, en application de… » n'est pas couvert. | Documenté comme limite de l'heuristique. |

Validation : `npm test` 238 tests, 0 échec ; typecheck et build propres ; les neuf entrées CETAT rejouées depuis `data/raw` sont identiques.
