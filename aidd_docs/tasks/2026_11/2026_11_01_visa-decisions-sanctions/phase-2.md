---
status: completed
---

# Instruction: Lecture du visa Judilibre

## Architecture projection

```txt
.
├── ✏️ veille/piste.ts
├── ✏️ veille/sources/judilibre.ts
├── ✏️ veille/main.ts
├── ✏️ tests/piste.test.ts
├── ✏️ tests/judilibre.test.ts
├── ✅ tests/main.test.ts
└── ✅ tests/fixtures/judilibre/decision.json
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Secrets PISTE simulés et journal remis à zéro | La session est prête | cli |
| Happy path   | Rechercher puis enrichir la décision | L'entrée porte le visa et le JSON de décision est snapshoté | cli |
| Edge case    | Plafond atteint, entrée déjà écrite, visa vide, instrument hors matières ou panne | Entrée différée si le visa n'est pas lu ; références vides seulement si le visa est vide ; avertissement | cli |
| Teardown     | Restaurer l'environnement et vider le journal | État initial | cli |

## Tasks to do

### `1)` Lire une décision

> Un seul appel par décision, sous la garde existante.

1. Ajouter `judilibreDecision` à `PisteSession`, avec l'URL `/decision` et l'en-tête `KeyId`.
2. Ajouter `remainingCalls()` pour connaître le budget.
3. Tester l'URL, l'en-tête, le journal et le plafond.

### `2)` Porter l'enrichissement

> Le visa se lit après le rattachement, uniquement pour les entrées retenues.

1. Ajouter `enrich?: (entry) => Promise<string[]>` à `ApiResult`.
2. Dans `run`, enrichir après `assignThemes`, ne pas rappeler une entrée déjà écrite, écrire les snapshots bruts après l'enrichissement.
3. Tester avec `tests/main.test.ts` : entrée nouvelle enrichie, entrée existante non rappelée, visa non lu différé.

### `3)` Brancher Judilibre

> Le visa remplace le résumé ; une panne ou un plafond laisse l'entrée sans référence.

1. Dans `judilibre.ts`, rendre `references: []` et retourner un `enrich` qui appelle `judilibreDecision`, pousse la réponse dans `raw` et applique `extractVisaReferences`.
2. Semer la matière de la requête sur chaque résultat pour garder une décision que seul son visa rattache.
3. Filtrer les références sur les instruments des matières de l'entrée, via `instrumentOf` et le catalogue reçu.
4. Arrêter les appels quand le budget est nul et avertir.

### `4)` Verrouiller les tests

> Le fixture de décision et les cas de panne.

1. Ajouter `tests/fixtures/judilibre/decision.json` avec le visa réel observé : `Articles 4, § 1, 5 et 6, § 1, du règlement (UE) n° 2016/679…` et le visa du code du travail.
2. Adapter `tests/judilibre.test.ts` : recherche, enrich, absence de secrets, plafond, visa vide, instrument hors matières.
3. Lancer `npm test`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | Un appel `/decision` porte le `KeyId` et apparaît au journal. |
| 2 | Une entrée nouvelle reçoit le visa ; une entrée déjà écrite n'est pas rappelée ; une panne ou un plafond diffère l'entrée, qui sera relue. |
| 3 | Une décision trouvée par une matière survit au rattachement même si son résumé la tait ; une décision enrichie expose `Règlement (UE) 2016/679 · art. 4, 5, 6` ; un visa vide ou un instrument hors matières laisse `[]`. |
| 4 | Les tests Judilibre et PISTE passent hors ligne, avec le visa réel de 25-10.664. |
