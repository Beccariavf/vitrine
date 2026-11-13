---
status: planned
---

# Instruction: Traduire le statut source en statut d'application

## Architecture projection

```txt
.
├── mcp/corpus/
│   └── statut.ts          ➕ `StatutApplication`, `statutApplication(corpus, statut, nature?)`
└── tests/
    └── statut.test.ts     ➕ les vocabulaires sources (dont ABROGE, ANNULE, MODIFIE), propose/pendant, inconnu, natures CNIL
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Happy path | `statutApplication("rgpd", "en_vigueur")`, `("lil", "VIGUEUR")` | `en_vigueur` pour les deux | system |
| Happy path | `statutApplication("lil", "ABROGE")` | `abroge` | system |
| Happy path | `statutApplication("ce", "Publié au recueil")`, `("cc", "Publié au Bulletin · Cassation")`, `("cjue", "Arrêt de la Cour")` | `rendue` pour les trois | system |
| Happy path | `statutApplication("cnil", "VIGUEUR", "Sanction")`, `("cnil", "VIGUEUR", "Avis")`, `("cepd", "finale")` | `rendue`, `adoptee`, `adoptee` | system |
| Edge case | `statutApplication("lil", "PROJET")`, `("lil", "PENDANT")` | `propose`, `pendant` | system |
| Edge case | `statutApplication("rgpd", "n'importe quoi")`, corpus inconnu, nature CNIL absente | `inconnu` | system |
| Edge case | casse et diacritiques du statut source | la table reste insensible (`Abrogé`, `abroge`) | system |

## Tasks to do

### `1)` Définir le vocabulaire

1. Créer `mcp/corpus/statut.ts` :
   - `export type StatutApplication = "en_vigueur" | "abroge" | "propose" | "pendant" | "rendue" | "adoptee" | "inconnu"` ;
   - `export const STATUTS_APPLICATION: readonly StatutApplication[]`, dans l'ordre du contrat.
2. Documenter chaque valeur en une ligne : `rendue` pour une décision juridictionnelle ou une sanction, `adoptee` pour une doctrine (ligne directrice, avis, recommandation), `inconnu` quand la source n'est pas reconnue.

### `2)` Écrire la table

1. `export function statutApplication(corpus: string, statut: string, nature?: string): StatutApplication`.
2. Normaliser le statut source : majuscules, diacritiques retirés, espaces et tirets réduits — sans dépendre d'un module de recherche.
3. Textes (`rgpd`, `aiact`, `lil`) : `EN_VIGUEUR` et `VIGUEUR` → `en_vigueur` ; `ABROGE` → `abroge` ; `PROJET`, `PROPOSE`, `PROPOSITION` → `propose` ; `PENDANT` → `pendant` ; sinon `inconnu`.
4. Décisions (`ce`, `cc`, `cjue`) : `rendue`, quel que soit le statut source.
5. Pour `cnil` et `cepd` seulement, un statut sans effet (`ABROGE`, `ANNULE`) prime sur la nature : une recommandation ou un avis CNIL abrogé ou annulé rend `abroge`. Un statut `MODIFIE` rend `inconnu`.
6. `cnil` : nature normalisée `SANCTION` → `rendue` ; `AVIS`, `RECOMMANDATION`, `RECOMMANDATION/LIGNES DIRECTRICES` → `adoptee` ; nature absente ou inconnue → `inconnu`.
7. `cepd` : `adoptee`.
8. Tout autre corpus : `inconnu`.
9. Ne jamais lever : une entrée inattendue rend `inconnu`.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1... | `STATUTS_APPLICATION` porte les sept valeurs du contrat, sans doublon |
| 2... | chaque vocabulaire source relevé sur le corpus réel rend la valeur attendue |
| 2... | `propose` et `pendant` sont atteints par la table, même si aucun corpus ne les porte |
| 2... | une valeur inconnue, un corpus inconnu et une nature CNIL absente rendent `inconnu`, jamais `en_vigueur` |
| 2... | `npm run typecheck` passe |
