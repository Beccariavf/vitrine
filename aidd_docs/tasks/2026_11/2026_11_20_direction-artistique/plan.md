---
objective: "Le site entier (accueil, connecteur, veille) suit la direction artistique de `decisions.md` et `planche.html`, en clair et en sombre, sans JavaScript client, contrastes testés."
status: pending
---

# Plan: Refonte de la direction artistique

Source: `aidd_docs/tasks/2026_11/2026_11_20_direction-artistique/decisions.md` et `planche.html` (même dossier)

## Phases

| #   | Phase        | File                         | Depends on |
| --- | ------------ | ---------------------------- | ---------- |
| 1   | Fondations : polices, jetons clair et sombre, contrastes | [`phase-1.md`](./phase-1.md) | none |
| 2   | Coquille et éléments communs | [`phase-2.md`](./phase-2.md) | 1 |
| 3   | Accueil | [`phase-3.md`](./phase-3.md) | 2 |
| 4   | Connecteur et veille | [`phase-4.md`](./phase-4.md) | 2 |
| 5   | Retrait de l'ancien thème et mémoire design | [`phase-5.md`](./phase-5.md) | 3, 4 |

## External sources

| URL   | What it settled   |
| ----- | ----------------- |
| https://www.npmjs.com/package/@fontsource/instrument-serif | `5.3.0`, licence OFL-1.1 (lu par `npm view`) |
| https://www.npmjs.com/package/@fontsource-variable/inter | `5.3.0`, licence OFL-1.1 (lu par `npm view`) |

## Impact

| Category                                           | Verdict and evidence | Handled in         |
| -------------------------------------------------- | -------------------- | ------------------ |
| Runtime | Deux paquets de polices ajoutés et épinglés ; noms de famille CSS et fichiers d'import non encore lus dans les paquets : unverified | 1 |
| Regression | Tests couplés au style : `tests/contrastes.test.ts`, `tests/contrastes.ts`, `tests/familles.test.ts` (jetons et classes `bg-*`/`text-*`) ; aucun autre test ne lit de classe (grep). Risque moyen : rendu de toutes les pages. Pas de phase filet, la vérification visuelle se fait à chaque phase aux deux largeurs. | 1, 2, 4, 5 |
| Architecture | Observé (lecture de `global.css`, `familles.ts`, `veille/index.astro:161`) : les jetons restent dans `@theme` de `global.css` ; le sombre redéfinit les mêmes variables sous `prefers-color-scheme: dark`. `familles.ts` perd la paire texte sur aplat (plus aucun texte sur couleur de famille), en phase 4 seulement, quand la veille ne la lit plus. | 1, 2, 4 |
| Documentation | Observé (lecture de `design.md`, `testing.md`, `codebase-map.md`) : `design.md` décrit l'ancien thème jusqu'à la phase 5, ses règles non typographiques restent en vigueur ; réécrit (jetons, typo, modules, accessibilité) ; `testing.md` (contrastes deux thèmes, familles) ; `codebase-map.md` si un composant naît | 1, 2, 5 |

## Rules

| Rule | Why it applies |
| ------ | -------------- |
| Aucun JavaScript client (`design.md`) | Mouvement, mode sombre, filtres et bascule de vue restent en HTML et CSS |
| Aucune requête tierce, polices auto-hébergées (`design.md`) | Instrument Serif et Inter passent par Fontsource, pas Google Fonts |
| Contrastes verrouillés par test (`design.md`, `testing.md`) | Chaque nouvelle paire, en clair et en sombre, entre dans `tests/contrastes.ts` |
| La couleur ne porte jamais seule le sens (`design.md`) | Pastilles de famille toujours suivies du libellé ; légende conservée |
| Démo réelle seulement (`design.md`) | Aucune démo fictive ; `src/demo/demo.json` absent aujourd'hui, le hero tient sans |
| Versions épinglées (`coding-assertions.md`) | Paquets de polices à version exacte |
| `typecheck`, `npm test`, `npm run build` (`coding-assertions.md`) | Passent à la fin de chaque phase |
| Hors périmètre (`decisions.md`, « Écarté ») | Aucune phase n'ajoute de logos d'institutions, de barre de question fixe, de 3D ni d'animation lourde |

## Decisions

| Decision | Why |
| ---------- | ---------- |
| Nouveaux jetons nommés par rôle (`fond`, `surface`, `encre`, `encre-douce`, `filet`, `accent`, familles `textes`, `autorites`, `ue`, `juridictions`), ajoutés à côté des anciens puis anciens retirés en phase 5 | Chaque phase reste livrable ; les noms « béton, papier » ne décriraient plus rien |
| `encre-douce` et `filet` en hexadécimal opaque, pas en opacité | Le test de contrastes lit des `#rrggbb` ; une opacité dépendrait du fond |
| Mode sombre suivant le système seulement, sans bascule | Une bascule demanderait du JavaScript |
| Police mono réservée au code (`pipeline.log`) | Les dates et références passent en Inter `tabular-nums` |
