---
objective: "Chaque actualité de la page de veille affiche un résumé nettoyé et tronqué, et chaque push passe typecheck, tests et build en CI."
status: implemented
---

# Plan: Résumé des actualités et vérification continue

Source: `aidd_docs/tasks/2026_10/2026_10_30_resume-et-ci/spec.md`

## Phases

| #   | Phase                  | File                         | Depends on |
| --- | ---------------------- | ---------------------------- | ---------- |
| 1   | resume-dans-le-contrat | [`phase-1.md`](./phase-1.md) | none       |
| 2   | verification-continue  | [`phase-2.md`](./phase-2.md) | 1          |

## External sources

| URL | What it settled |
| --- | --- |
| https://www.cnil.fr/fr/rss.xml | Les descriptions contiennent du HTML et des entités doublement encodées |
| https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions | Syntaxe du workflow, déclencheurs `push` et `pull_request`, permissions |
| https://github.com/actions/setup-node | Installation de Node 24 avec cache npm |

## Impact

| Category | Verdict and evidence | Handled in |
| --- | --- | --- |
| runtime | Le pipeline extrait un résumé supplémentaire ; la page l'affiche. Aucune requête réseau ajoutée. | phase 1 |
| regression | Le contrat `Entry` change : lecteur, tests et données régénérées sont mis à jour ensemble. | phase 1 |
| architecture | Un module `veille/summary.ts` isole le nettoyage, réutilisable par la prochaine source. | phase 1 |
| deployment | Ajoute la première CI : typecheck, tests et build à chaque push et PR. | phase 2 |
| documentation | `memory/vcs.md` et `memory/coding-assertions.md` mentionnent la CI. | phase 2 |

## Rules

| Rule | Why it applies |
| --- | --- |
| `data/` n'est écrit que par le pipeline | Les résumés doivent venir de la source, jamais d'une édition manuelle. |
| Un adaptateur par source | Le nettoyage reste hors de l'adaptateur, dans un module partagé. |
| Chaque source a sa fixture et son test | Les tests restent hors ligne et déterministes. |
| Versions épinglées | La CI doit installer exactement ce que le lockfile décrit. |
| Un commit par tâche validée | Convention VCS du projet. |

## Decisions

| Decision | Why |
| --- | --- |
| `summary` dérivé du champ de description de la source, 200 caractères max | Assez pour comprendre l'actualité, assez court pour deux lignes stables. |
| Coupure sur une frontière de mot, ellipse seulement si tronqué | Évite les mots coupés et les ellipses mensongères sur un texte déjà complet. |
| Nettoyage sans dépendance : entités décodées deux fois, puis balises retirées, puis espaces normalisés | Décoder avant de retirer les balises est le seul ordre qui neutralise aussi les balises doublement encodées. |
| Budget de 200 caractères **ellipse incluse** : 199 de texte + `…` | Une ellipse ajoutée après coup dépasserait la limite annoncée. |
| Le changement de contrat est un seul commit atomique | Un `Entry` qui exige `summary` casse le lecteur et les données tant que les trois ne bougent pas ensemble. |
| `data/` régénéré après le changement de contrat | Les dix entrées existantes n'ont pas de résumé ; le pipeline est la seule source de vérité. |
| CI sur `push` et `pull_request`, Node 24, `npm ci`, permissions en lecture | Même porte que la locale, sans droit d'écriture, et prépare le futur cron. |
