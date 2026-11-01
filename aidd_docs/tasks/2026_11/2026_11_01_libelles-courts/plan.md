---
objective: "Chaque pastille de référence affiche le nom court d'un instrument connu, sans changer la donnée ni le lien officiel."
status: pending
---

# Plan: Libellés courts des références

Source: aidd_docs/tasks/2026_11/2026_11_01_libelles-courts/spec.md

## Phases

| #   | Phase        | File                         | Depends on |
| --- | ------------ | ---------------------------- | ---------- |
| 1   | Libellé court et survol | [`phase-1.md`](./phase-1.md) | none |

## External sources

| URL   | What it settled   |
| ----- | ----------------- |
| none | Aucune source externe : table statique et rendu. |

## Impact

| Category                                           | Verdict and evidence | Handled in         |
| -------------------------------------------------- | -------------------- | ------------------ |
| runtime | Aucun appel réseau : la table des libellés est statique et lue au build. | 1 |
| regression | Le changement ne touche que le texte affiché ; l'URL reste dérivée du libellé canonique, et les tests de `referenceUrl` verrouillent le lien. | 1 |
| architecture | Une fonction de rendu dans `src/lib/references.ts` ; aucune donnée ni schéma modifié. | 1 |
| documentation | `design.md` décrit les pastilles sans libellé court, `testing.md` ne teste pas les libellés et `codebase-map.md` ne nomme pas `referenceLabel` : les trois doivent être mis à jour. | 1 |

## Rules

| Rule   | Why it applies |
| ------ | -------------- |
| `Entry.references` reste le libellé canonique. | Le rattachement des matières et l'URL dépendent de ce libellé. |
| Un instrument inconnu garde son libellé complet. | Aucun acronyme inventé. |
| Le libellé complet reste accessible. | Le lecteur doit pouvoir vérifier l'instrument d'un coup d'œil. |
| Le site ne lit aucune API au runtime. | La table est statique. |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| Raccourcir au rendu, pas dans les données. | Évite une migration et préserve le rattachement et les URL. |
| Porter le libellé complet dans `title`. | Le survol restaure l'information sans allonger la pastille. |
