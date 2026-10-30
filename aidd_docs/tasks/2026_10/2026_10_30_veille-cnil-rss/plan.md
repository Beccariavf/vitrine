---
objective: "Un flux CNIL est transformé en entrées normalisées, idempotentes, avec snapshot brut et tests hors ligne."
status: implemented
---

# Plan: Premier maillon de la veille CNIL

Source: `aidd_docs/tasks/2026_10/2026_10_30_veille-cnil-rss/spec.md`

## Phases

| #   | Phase              | File                         | Depends on |
| --- | ------------------ | ---------------------------- | ---------- |
| 1   | lire-et-normaliser | [`phase-1.md`](./phase-1.md) | none       |
| 2   | ecrire-et-prouver  | [`phase-2.md`](./phase-2.md) | 1          |

## External sources

| URL | What it settled |
| --- | --- |
| https://www.cnil.fr/fr/rss.xml | Flux RSS 2.0, 10 items, champs title, link, description, guid, pubDate |
| https://nodejs.org/api/typescript.html | Exécution directe des fichiers TypeScript par Node 24, sans build |
| https://www.npmjs.com/package/fast-xml-parser | Parser XML, gère CDATA et entités ; version 5 épinglée avec ses dépendances transitives verrouillées |

## Impact

| Category | Verdict and evidence | Handled in |
| --- | --- | --- |
| runtime | Nouveau : `node veille/main.ts` exécute une passe. Aucun runtime existant à modifier, le dépôt n'a pas de code. | phase 2 |
| regression | none | none |
| architecture | Crée la frontière `veille/sources/` et la sortie `data/`, conformes à `memory/architecture.md`. | phase 1 |
| documentation | `aidd_docs/memory/coding-assertions.md` remplace « aucune commande » par les commandes réelles. | phase 2 |

## Rules

| Rule | Why it applies |
| --- | --- |
| `data/` n'est écrit que par le pipeline | La piste d'audit repose sur des fichiers produits, jamais édités à la main. |
| Un adaptateur par source | Une source cassée doit se réparer dans un seul fichier. |
| Chaque source a sa fixture et son test | Les tests doivent tourner hors ligne et rester déterministes. |
| Versions épinglées | Une montée de version est une décision, pas une surprise. |
| Un commit par tâche validée | Convention VCS du projet. |

## Decisions

| Decision | Why |
| --- | --- |
| Snapshot brut adressé par le contenu (`sha256`), jamais par date | Un flux inchangé réécrit le même fichier : aucune diff, idempotence prouvée. |
| Identifiant = `sha256` de l'URL canonique, tronqué à 16 hex | Portable entre sources, contrairement au `guid` propre à chaque flux. |
| Dossier d'entrée = date de publication UTC, `unknown/` si absente | Chemin stable entre exécutions, même quand la date manque. |
| `fast-xml-parser` épinglé, `package-lock.json` commité | Gère CDATA et entités ; ses dépendances transitives sont verrouillées, pas subies. |
| Une copie périmée du même id est supprimée ; une entrée absente du flux est conservée. | Une date corrigée déplace le fichier ; deux copies du même article seraient un doublon à l'écran. |
| Le snapshot brut est écrit avant le parse. | Un flux illisible laisse une preuve de ce qui a été reçu, jamais une entrée partielle. |
| Un item invalide fait échouer la passe entière. | Fail-closed : jamais d'actualité sautée en silence. |
