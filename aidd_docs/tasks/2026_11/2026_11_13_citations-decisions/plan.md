---
objective: "Chaque décision rendue par search ou get_decision liste les instruments et articles du périmètre qu'elle cite, extraits du texte du corpus avec leur lien officiel, et la précision de l'extracteur est mesurée sur un échantillon relu."
status: pending
---

# Plan: Voir les textes qu'une décision cite

Source: GitHub issue #28 (epic #25, feuille de route #65), lue le 2026-11-13.

## Phases

| #   | Phase        | File                         | Depends on |
| --- | ------------ | ---------------------------- | ---------- |
| 1   | Extracteur déterministe des citations | [`phase-1.md`](./phase-1.md) | none |
| 2   | Exposition dans `search` et `get_decision` | [`phase-2.md`](./phase-2.md) | 1 |
| 3   | Mesure, documentation et mémoire | [`phase-3.md`](./phase-3.md) | 1, 2 |

## External sources

| URL   | What it settled   |
| ----- | ----------------- |
| https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016R0679 | URL officielle du RGPD, avec 95/46 (`31995L0046`), ePrivacy (`32002L0058`), 2016/680 (`32016L0680`) et 2018/1725 (`32018R1725`) sur le même gabarit CELEX. |
| https://www.legifrance.gouv.fr/loda/id/LEGITEXT000006068624 | URL officielle de la loi 78-17, déjà utilisée par `src/lib/references.ts`. |
| https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006070987 | URL officielle du CPCE, déjà utilisée par `src/lib/references.ts`. |
| https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006070719 | URL du Code pénal, retenue au niveau du code : l'URL d'un article `LEGIARTI…` n'est pas dérivable du seul numéro. |

## Impact

| Category                                           | Verdict and evidence | Handled in         |
| -------------------------------------------------- | -------------------- | ------------------ |
| runtime | Le premier appel qui touche un corpus de décisions lit son `unites.jsonl` et extrait toutes ses citations : mesuré le 2026-11-13 à 0,63 s pour les 3 245 documents CNIL (34 Mo), 0,31 s pour les 1 312 décisions CE (17 Mo), analyse JSON comprise. Le cache ne garde que les citations par document, jamais le texte ; sur la CNIL, 3 245 entrées de quelques dizaines d'octets, soit un ordre de grandeur de quelques centaines de Ko. Aucune écriture, aucun réseau. | 2 |
| regression | `Passage` gagne un champ optionnel `citations` ; `DecisionTrouvee` en gagne un obligatoire ; une consigne `CONSIGNE_CITATIONS` est ajoutée aux descriptions de `search` et `get_decision`, sans toucher `CONSIGNE_PROVENANCE` partagée avec `get_article`. `tests/server-stdio.test.ts` vérifie la description de `search` et les instructions : il est relu et ajusté si le texte ajouté casse une assertion. Aucun changement d'index, de schéma SQLite ni de `data/`. | 2 |
| architecture | Nouveau module `mcp/corpus/citations.ts`, distinct de `veille/references.ts` : l'architecture réserve `mcp/` et ne réutilise de `veille/` que `writeRaw` et `FetchLike`. L'extraction reste au niveau du document, jamais du fragment seul, pour ne pas masquer une citation située ailleurs dans la décision. Aucun stockage : #29 pourra bâtir sa table à partir de la même fonction. | 1, 2 |
| documentation | `README.md` (réponses des outils), `architecture.md` (décision d'extraction et périmètre), `codebase-map.md` (`mcp/corpus/citations.ts`), `testing.md` (tests et commande de mesure), et `mesure.md` (échantillon relu, précision, limites). | 3 |

## Rules

| Rule   | Why it applies |
| ------ | -------------- |
| Ne rendre que ce que le texte attribue explicitement | Un article n'est retenu que si son instrument le suit dans la même proposition, ou le précède dans la même énumération ; une liste vide est préférée à une citation inventée (critère d'acceptation de #28). |
| Périmètre fermé | Seuls RGPD, 95/46, ePrivacy, 2016/680, 2018/1725, loi 78-17, CPCE et Code pénal 226-16 et suivants sont rendus ; un article de code de la santé ou de justice administrative est écarté, même correctement attribué. |
| Le périmètre ne vide pas le critère « instrument inconnu » | `Citation.url` reste `null`-able et le libellé est rendu sans lien ; les huit instruments du périmètre ont tous une URL aujourd'hui, le cas est donc porté par le type et son test, pas par une entrée réelle. |
| La mesure conditionne la PR | Un faux positif de l'échantillon se corrige ou se retire de la règle avant la fusion ; aucun seuil n'est publié, #30 le fixe. |
| `data/` n'est jamais édité à la main | La mesure lit `data/corpus/` ; elle n'écrit que son rapport sous `aidd_docs/`. |
| `npm run typecheck`, `npm test` et `npm run build` passent avant tout push | Règle du dépôt (`coding-assertions.md`) ; la CI les rejoue. |
| Vocabulaire mesuré | La précision publiée est celle de l'échantillon, avec son dénominateur ; aucun taux extrapolé aux corpus entiers. |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| Extraction à la lecture, avec cache par corpus, plutôt qu'une colonne d'index | Aucune reconstruction d'index d'une heure, aucun schéma à migrer ; #29 reste libre de persister une table interrogeable quand le besoin de requête par article arrivera. |
| Citations au niveau du document, recopiées sur chaque passage rendu | Une décision citée par `search` garde sa base juridique complète, même si le passage remonté ne la nomme pas. |
| Instrument sans article non rendu | Même règle que `Entry.references` : « Vu le règlement (UE) 2016/679 » n'établit pas une base article par article, et la liste reste une liste de citations. |
| Anaphore résolue seulement si un seul instrument de même nature est nommé | « du même règlement » est courant (CJUE, Conseil d'État) ; sans cette garde, la résolution inventerait l'antécédent. |
| Alias anglais dans l'extracteur | La CJUE bascule en anglais quand le français manque (`langueCapture`, `(texte anglais)` dans le `chemin`) ; les 166 décisions actuelles sont françaises, mais une synchronisation peut en ajouter une anglaise, qui doit citer comme les autres. |
