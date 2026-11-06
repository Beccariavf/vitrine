---
objective: "`get_decision` rend la partie opératoire par défaut et la décision entière sur `partie: \"tous\"`, sans troncature de texte."
status: active
---

# Plan : borner `get_decision` par défaut

Source: [`contract.md`](./contract.md).

## Phases

| #   | Phase                                | File                     | Depends on |
| --- | ------------------------------------ | ------------------------ | ---------- |
| 1   | Exposer la borne du dispositif       | [`phase-1.md`](./phase-1.md) | none       |
| 2   | Sélectionner les fragments rendus    | [`phase-2.md`](./phase-2.md) | 1          |
| 3   | Vérifier les charges et documenter   | [`phase-3.md`](./phase-3.md) | 2          |

## Contrat

- `mcp/corpus/cnil/meta.ts` expose `debutDispositif(texte): number` ; `extraireMetaSanction` s'en sert, aucune règle n'est dupliquée.
- `getDecision` accepte `partie: "dispositif" | "tous"` (défaut `"dispositif"`), rend `partie` et `fragments_total`.
- Le découpage choisit des fragments entiers à partir de la borne ; il ne coupe jamais un texte.
- `search`, `get_article` et l'index sont inchangés.

## Impact

| Category   | Verdict and evidence | Handled in |
| ---------- | -------------------- | ---------- |
| api        | `get_decision` gagne un paramètre et deux champs ; le défaut change de comportement. | 2 |
| measure    | Charge par défaut ≤ 3 000 tokens sur les 249 décisions (pire : 2 771). | 3 |
| regression | Les tests qui attendaient tous les fragments passent `partie: "tous"`. | 2 |

## Rules

| Rule | Why it applies |
| ---- | -------------- |
| Une seule règle de borne | `extraireMetaSanction` et `getDecision` doivent lire la même limite, sinon deux vérités. |
| Aucune troncature de texte | Un fragment coupé produirait une citation fausse, ce que le produit interdit. |
| Pas de ré-embarquement | Le changement est en lecture seule sur l'index existant. |
