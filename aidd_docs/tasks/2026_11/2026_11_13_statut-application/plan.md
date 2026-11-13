---
objective: "Chaque passage de search, chaque article de get_article et chaque décision de get_decision porte un statut_application uniforme, distinct du statut source, et aucun texte abrogé ou proposé n'est présenté comme applicable."
status: planned
---

# Plan: Connaître le statut de chaque texte rendu

Source: GitHub issue #33 (epic #25, feuille de route #65), contrat dans `spec.md`.

## Phases

| #   | Phase            | File                         | Depends on |
| --- | ---------------- | ---------------------------- | ---------- |
| 1   | table-statut     | [`phase-1.md`](./phase-1.md) | none       |
| 2   | surfaces-outils  | [`phase-2.md`](./phase-2.md) | 1          |

## External sources

| URL | What it settled |
| --- | --------------- |
| aucune | Aucun réseau : la table lit les statuts déjà portés par les unités et les manifestes. |

## Impact

| Category | Verdict and evidence | Handled in |
| -------- | -------------------- | ---------- |
| runtime | Un appel de fonction pure par passage rendu, sur trois champs déjà chargés (`corpus`, `statut`, `nature`) : aucun accès disque, aucun réseau, aucun réindex. Les vocabulaires sources relevés le 2026-11-13 : `en_vigueur` (RGPD, AI Act), `VIGUEUR`, `ABROGE`, `ANNULE` et `MODIFIE` (LIL, CNIL), `Publié au recueil` (CE), `Publié au Bulletin · Cassation` (CC), `Arrêt de la Cour` (CJUE), `finale` (CEPD). | 1, 2 |
| regression | `statut` n'est pas réécrit : les clients qui le lisent déjà voient la même valeur. Trois types de réponse gagnent un champ ; `tests/mcp.test.ts` asserte les descriptions et les formes rendues. Aucun changement d'index, de `data/` ni de schéma SQLite. | 2 |
| architecture | Un module neuf `mcp/corpus/statut.ts`, pur, sans dépendance. Le rendu reste dans `mcp/tools.ts`, seule couche qui compose les réponses ; l'index ne connaît pas le vocabulaire uniforme. | 1, 2 |
| documentation | `README.md` (§ réponses des outils), `architecture.md` (statut d'application et table par corpus), `codebase-map.md` (`statut.ts`), `testing.md` (tests de la table et des trois surfaces). | 2 |

## Rules

| Rule | Why it applies |
| ---- | -------------- |
| Ne jamais déclarer applicable ce qui ne l'est pas | `inconnu` plutôt qu'une valeur par défaut ; l'acceptation 4 l'exige. |
| Le statut source reste la vérité de la source | Publication et type d'acte ne se réécrivent pas ; l'acceptation 2 l'exige. |
| Le statut vit au rendu, jamais dans `data/` | Choix de l'utilisateur : aucune synchronisation réseau, aucun réindex. |
| `npm run typecheck`, `npm test` et `npm run build` passent avant le push | Règle du dépôt (`coding-assertions.md`) ; la CI les rejoue. |

## Decisions

| Decision | Why |
| -------- | ----- |
| Une seule règle de texte pour `rgpd`, `aiact` et `lil` | Les trois portent un statut d'application ; deux vocabulaires (`en_vigueur`, `VIGUEUR`) se normalisent en un seul, `abroge` et `propose` suivent sans branche par corpus. |
| Le corpus décide pour les décisions, pas le statut source | `Arrêt de la Cour`, `Publié au recueil` et `Publié au Bulletin` sont des types ou des publications : ils ne disent pas l'applicabilité, `rendue` si. |
| La nature CNIL départage sanction et doctrine | Une sanction est rendue, un avis est adopté ; le corpus seul ne suffit pas. |
| Le champ est ajouté aux objets rendus, pas à `Unite` | `Unite` décrit `data/` ; le vocabulaire uniforme est une lecture, pas une donnée. |
