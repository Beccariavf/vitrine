---
status: pending
---

# Instruction: Lire le XHTML en français puis en anglais

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── mcp/
│   └── corpus/
│       ├── veille.ts ✏️
│       └── cjue/
│           ├── descripteur.json ✏️
│           ├── liste.ts ✏️
│           ├── parse.ts ✏️
│           └── sync.ts ✏️
└── tests/
    ├── cjue-corpus.test.ts ✏️
    ├── corpus-sync.test.ts ✏️
    └── fixtures/
        └── cjue/
            └── 62023CJ0413-en.xhtml ✅
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | servir `fra` pour un CELEX, `404` en `fra` puis `eng` pour un second, `404` partout pour un troisième | trois réponses distinctes | cli |
| Happy path   | synchroniser | le premier reste `fra`, le second est retenu en `eng` avec `chemin` marqué, l'URL en `/EN/` | cli |
| Edge case    | `502` en `fra`, `404` en `eng` | exclusion `echec_telechargement`, aucun marqueur durable écrit | cli |
| Edge case    | `429` en `fra` | la passe s'arrête, aucune exclusion ni marqueur, corpus antérieur intact | cli |
| Edge case    | relancer après un `404` dans les deux langues | une seule exclusion `xhtml_absent`, aucun téléchargement | cli |
| Teardown     | supprimer la racine temporaire | état initial restauré | cli |

## Tasks to do

### `1)` Déclarer les langues

> Le descripteur porte l'ordre des langues, sans doublon.

1. Dans `mcp/corpus/cjue/descripteur.json`, remplacer `langue` par `langues: ["fra", "eng"]` et `url_texte` par `https://eur-lex.europa.eu/legal-content/{langue}/TXT/?uri=CELEX:{celex}`.
2. Adapter `DescripteurCjue` dans `mcp/corpus/cjue/liste.ts` ; le manifeste garde `langue` avec `langues[0]`.

### `2)` Télécharger dans l'ordre des langues

> Un seul texte par décision, la première langue disponible, sans refus durable sur une panne.

1. Changer `telechargerCjue` en `telechargerCjue(celex, langues)` : boucle sur `langues`, retourne `{ texte, langue }` au premier 200 non vide.
2. Si un essai échoue autrement que par 404 ou texte vide, retourner `echec_telechargement` et n'écrire aucun marqueur ; seul un 404 dans toutes les langues donne `xhtml_absent`. Conserver le garde-fou existant : un `429` lève et interrompt la passe, sans marqueur ni exclusion.
3. Renommer le motif en `xhtml_absent` dans `liste.ts` et `sync.ts`, et faire accepter `version_francaise_absente` par `lireRefus` pour que les marqueurs déjà écrits restent durables.
4. Ajouter `xhtml_absent` à `MOTIFS_DURABLES` de `mcp/corpus/veille.ts`.

### `3)` Déduire la langue du texte capturé

> La langue vient du contenu, pas d'un fichier annexe.

1. Ajouter `langueCapture(xhtml)` dans `mcp/corpus/cjue/parse.ts` : `eng` si « On those grounds » ou un mois anglais, `fra` sinon.
2. Compter `couverture.langues` (`{ fra: n, eng: n }`), `couverture.documents_langues` (`{ <CELEX>: "eng" }`) et suffixer `chemin` par « (texte anglais) » hors `fra`.
3. Construire l'URL EUR-Lex avec la langue du texte (`FR` ou `EN`).

### `4)` Découper un arrêt anglais

> Le texte anglais garde sa date, son numéro d'affaire et son dispositif.

1. Dans `mcp/corpus/cjue/parse.ts`, reconnaître les mois anglais dans `chercherDate` (« 4 September 2025 ») et le suffixe d'appel (`C-413/23 P`).
2. Reconnaître « On those grounds » à côté de « par ces motifs » pour le dispositif, et « in Case » à côté de « dans l'affaire ».

### `5)` Tester le repli et la durabilité

> L'ordre des langues, la panne et le refus sont verrouillés.

1. Ajouter `tests/fixtures/cjue/62023CJ0413-en.xhtml` : extrait réel de l'arrêt anglais, en-tête daté, points `id="pointN"` et « On those grounds ».
2. Dans `tests/cjue-corpus.test.ts` : `fra` 404 puis `eng` 200 donne des unités, `documents_langues` vaut `eng`, l'URL porte `/EN/`, `chemin` porte la mention ; `502` + `404` donne `echec_telechargement` sans marqueur ; deux `404` donnent une exclusion `xhtml_absent` et un second passage ne télécharge rien ; un marqueur `version_francaise_absente` déjà présent reste durable.
3. Ajouter un cas de veille : une entrée `data/entries/` dont le CELEX n'est pas dans la liste CELLAR et dont seule la version anglaise répond, pour couvrir le chemin `entreesVeilleCjue`.
4. Dans `tests/corpus-sync.test.ts`, asserter qu'un document `xhtml_absent` du manifeste est classé `ecarte` et non `manquant`.
5. Couvrir le `429` : une réponse `429` en `fra` interrompt la synchronisation, n'écrit ni exclusion ni marqueur, et le corpus antérieur reste intact.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | le descripteur expose `langues` et `npm run typecheck` passe |
| 2 | l'ordre `fra` puis `eng` est respecté ; une panne réseau ne crée aucun marqueur et reste rejouée |
| 3 | le manifeste porte les comptes de langue, la liste des décisions non françaises et leurs URL `/EN/` |
| 4 | une décision anglaise produit une date `AAAA-MM-JJ`, son numéro d'affaire avec `P` et un fragment `dispositif` |
| 5 | `npm test` passe, y compris cache, marqueur hérité, chemin de veille, classement `ecarte` et arrêt sur `429` |
