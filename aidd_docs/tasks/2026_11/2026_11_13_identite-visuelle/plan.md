---
objective: "Le site garde sa grammaire Le Corbusier et gagne une identité polychrome qui signifie : chaque couleur nomme une famille de source, et une façade dessinée à partir du corpus prouve sa couverture, avec une police de titre monumentale, sans JavaScript et sans perte de contraste."
status: completed
---

# Plan: Identité polychrome : la façade est le corpus

Source: demande du 13 novembre 2026 (« il manque quelque chose au niveau des couleurs, illustrations ») ; références : pavillon Le Corbusier, Cité radieuse, Espaces d'Abraxas (Bofill), ai-driven-dev.fr ; critique de webdesigner ; maquettes A/B comparées, piste A retenue : polychromie Le Corbusier, façade construite à partir du corpus, démo dans la colonne droite du hero.

## Phases

| #   | Phase        | File                         | Depends on |
| --- | ------------ | ---------------------------- | ---------- |
| 1   | Fondations : palette, police, marque, contrastes testés | [`phase-1.md`](./phase-1.md) | none |
| 2   | Couleurs signifiantes : une famille, une couleur | [`phase-2.md`](./phase-2.md) | 1 |
| 3   | La façade du corpus et la mise en page | [`phase-3.md`](./phase-3.md) | 1, 2 |

## External sources

| URL   | What it settled   |
| ----- | ----------------- |
| https://www.npmjs.com/package/@fontsource-variable/archivo | Version 5.3.0, licence OFL-1.1 ; `wdth.css` et `archivo-latin-wdth-normal.woff2` (90,1 ko) présents (`npm pack --dry-run`). Nom de famille et axe `wght` à lire dans le paquet en phase 1. |
| https://www.ai-driven-dev.fr | Non consulté : navigation refusée dans le navigateur intégré. La direction repose sur les images fournies et les maquettes A/B. |

## Impact

| Category                                           | Verdict and evidence | Handled in         |
| -------------------------------------------------- | -------------------- | ------------------ |
| runtime | Une police (~90 ko pour le sous-ensemble latin) servie par le site, sans requête externe ; aucun JavaScript. Poids réellement chargé : unverified jusqu'à la phase 1. | 1 |
| regression | Moyen : la police change les titres des trois pages ; la veille passe d'un cycle de couleurs au rang à une couleur par famille (répartition observée sur `data/entries/` : Union européenne 50, autorités françaises 31, juridictions françaises 13). Aucun test du rendu : la phase 1 prend des captures de référence et ajoute un test de contrastes ; la phase 2 teste la correspondance source → famille. | 1, 2 |
| architecture | Nouveau `src/lib/familles.ts`, source unique de la correspondance source → famille → couleur, lu par la veille, l'accueil et la façade ; `SourceCorpus` gagne `unites` ; nouveau `src/components/Facade.astro`. | 2, 3 |
| documentation | `design.md` (jetons, police, règle « aucune web font » remplacée, couleurs par famille, façade, socle), `codebase-map.md` (`familles.ts`, `Facade.astro`), `testing.md` (contrastes, familles, façade). | 1, 2, 3 |

## Rules

| Rule   | Why it applies |
| ------ | -------------- |
| Aucun JavaScript côté client (`design.md`) | Façade en HTML/SVG calculé au build. |
| Rayon 0, bordures 2 px, ombres dures, aucun dégradé ni flou (`design.md`) | La polychromie vient d'aplats cadrés d'encre. |
| Texte long jamais sur aplat coloré ; rouge réservé aux grands textes (`design.md`) | Vaut aussi pour le vert et le béton sombre. |
| Versions épinglées (`coding-assertions.md`) | `@fontsource-variable/archivo` épinglé à `5.3.0`. |
| Contrastes AA mesurés (`design.md`) | Toute paire texte/fond passe 4,5:1, ou 3:1 en grand texte. |
| La couleur ne porte jamais seule le sens (WCAG 1.4.1) | Chaque famille a aussi un libellé texte et une légende. |
| `data/` n'est jamais édité à la main (`coding-assertions.md`) | La façade lit les manifestes, elle ne les réécrit pas. |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| Une couleur = une famille de source : bleu textes (RGPD, AI Act, LIL) ; rouge autorités françaises (CNIL, ANSSI, ARCEP, ARCOM) ; vert Union européenne (CEPD, CJUE, Commission, DMA) ; jaune juridictions françaises (Conseil d'État, Cour de cassation) | La couleur devient une information, la même partout ; la répartition de la veille reste équilibrée, aucune famille n'écrase les autres. |
| Une seule illustration : la façade du corpus, une colonne par collection, hauteur `ceil(log10(unités))` cases (3 à 5), cases colorées alternées avec des loggias papier | L'image prouve la couverture au lieu de décorer ; échelle log pour que les textes restent visibles face aux 29 299 fragments CNIL. |
| La démo garde la colonne droite du hero ; sans démo, le hero tient sur une colonne ; la façade est une bande sous le hero, toujours présente | Le premier écran ne change pas d'identité quand la démo arrive. |
| Archivo variable condensée pour les titres et la marque, auto-hébergée, importée depuis `Base.astro` | Échelle monumentale sans requête tierce ; le corps reste en police système. |
| Jetons ajoutés : vert `#2F6B4F`, béton sombre `#2B2A27` (pied de page seulement), pierre `#B8B2A7` | Vert de la Cité radieuse ; un seul socle sombre, où les ombres encre n'ont pas à vivre. |
| Livraison sur une branche empilée sur `feat/accueil-organisation` | Les pages à habiller n'existent que dans la PR #66, encore ouverte. |
