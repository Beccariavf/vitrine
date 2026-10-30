---
status: pending
---

# Instruction: Lire et normaliser le flux CNIL

## Architecture projection

```txt
.
├── package.json ✅
├── package-lock.json ✅
├── tsconfig.json ✅
├── .nvmrc ✅
├── veille/
│   ├── types.ts ✅
│   ├── normalize.ts ✅
│   └── sources/
│       └── cnil.ts ✅
└── tests/
    ├── fixtures/
    │   └── cnil/
    │       └── feed.xml ✅
    └── cnil.test.ts ✅
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | Charger `tests/fixtures/cnil/feed.xml` | XML RSS 2.0 en mémoire | cli |
| Happy path | Parser le flux complet | 10 entrées, chaque champ renseigné | cli |
| Edge case | Parser un item sans `pubDate` | Entrée conservée avec `publishedAt` nul | cli |
| Edge case | Parser une date invalide ou un offset `+0100` | Date UTC correcte, ou `null` si illisible | cli |
| Edge case | Parser un flux vide | Zéro entrée, aucune exception | cli |
| Edge case | Parser un XML malformé | Exception explicite, aucune entrée | cli |
| Edge case | Parser deux items de même URL canonique | Une seule entrée conservée | cli |
| Edge case | Comparer une URL avec query et fragment à sa forme canonique | Même identifiant pour les deux formes | cli |
| Teardown | Aucun fichier écrit | Dépôt inchangé | cli |

## Tasks to do

### `1)` Manifeste et outillage

> Un projet Node 24 exécutable et testable, sans build.

1. Créer `package.json` : `type: module`, `engines.node >= 24`, scripts `test`, `typecheck` et `veille`, dépendances épinglées.
2. Créer `tsconfig.json` : `strict`, `noEmit`, `allowImportingTsExtensions`, `module: nodenext`.
3. Écrire `.nvmrc` avec `24`.
4. Générer `package-lock.json` et le commiter : les dépendances transitives sont verrouillées.

### `2)` Type d'entrée

> Le contrat de données que le site et le MCP liront.

1. Créer `veille/types.ts` avec `Entry` : `id`, `title`, `url`, `publishedAt`, `source`.

### `3)` Normalisation

> Deux formes d'une même URL donnent le même identifiant.

1. Créer `veille/normalize.ts` : `canonicalUrl` (host minuscule, sans query, sans fragment, sans slash final) et `hashId` (`sha256` tronqué à 16 hex).

### `4)` Adaptateur CNIL

> Le flux devient une liste d'entrées, sans réseau.

1. Créer `veille/sources/cnil.ts` : parser le XML avec `fast-xml-parser`, mapper chaque item.
2. Convertir `pubDate` en ISO UTC ; une date absente ou illisible donne `null`.
3. Refuser un XML illisible par une exception explicite ; un flux vide donne une liste vide.
4. Conserver une seule entrée quand deux items partagent la même URL canonique.

### `5)` Fixture et tests

> La preuve hors ligne que la normalisation tient.

1. Enregistrer le flux réel dans `tests/fixtures/cnil/feed.xml`.
2. Créer `tests/cnil.test.ts` : 10 entrées, champs, stabilité de l'identifiant, URL canonique, date absente ou invalide, flux vide, XML malformé, doublon d'URL.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Les scripts `test`, `typecheck` et `veille` sont déclarés et invoquent Node et tsc ; le lockfile est présent |
| 2 | `Entry` expose les cinq champs attendus |
| 3 | Deux formes équivalentes d'une URL produisent le même identifiant ; deux URL différentes en produisent deux distincts |
| 4 | Le flux de la fixture produit 10 entrées normalisées ; un XML malformé lève une exception ; un flux vide donne 0 entrée ; deux items de même URL ne donnent qu'une entrée |
| 5 | Les tests passent hors ligne ; une date absente ou invalide donne `publishedAt: null`, un offset `+0100` donne l'heure UTC |
