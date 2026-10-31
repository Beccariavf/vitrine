---
status: pending
---

# Instruction: Source ARCOM

## Architecture projection

```txt
.
├── veille/
│   ├── main.ts ✏
│   └── sources/
│       └── arcom.ts ✅
├── src/
│   └── lib/
│       └── sources.ts ✏
└── tests/
    ├── arcom.test.ts ✅
    ├── entries.test.ts ✏
    ├── write.test.ts ✏
    └── fixtures/
        └── arcom/
            ├── press.xml ✅
            ├── page-mym.html ✅
            └── page-frequences.html ✅
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Lire la fixture presse et les deux pages | Deux items FR, deux EN, aucune description dans le flux | cli |
| Happy path   | Parser le flux | Deux entrées françaises, résumé nul, `themes` vide | cli |
| Happy path   | Lire la page Mym | `keep` vrai, résumé citant le règlement sur les services numériques | cli |
| Happy path   | Lancer la passe ARCOM simulée | Une entrée écrite, source `arcom`, matière `plateformes` | cli |
| Edge case    | Lire la page fréquences | `keep` faux ; l'item est écarté | cli |
| Edge case    | Faire échouer une page ou sortir de `arcom.fr` | Avertissement et aucune entrée pour cette page ; lien hors hôte refusé | cli |

## Tasks to do

### `1)` Ajouter un enrichissement de page aux sources à flux

> Le flux ARCOM ne porte ni description ni signal DSA ; la page article porte les deux.

1. Dans `veille/main.ts`, ajouter à `Source` un champ optionnel `page` : `url(entry)` rend la page officielle, `parse(html)` rend `{ summary: string | null; keep: boolean }`.
2. Dans `run`, après `source.parse(xml)` et avant l'enrichissement des références, parcourir les entrées quand `source.page` existe : lire la page, écarter l'entrée si `keep` est faux, remplacer son résumé par celui de la page quand il existe.
3. Sur une page en panne, pousser un avertissement nommant la source et l'URL, écarter l'entrée et continuer : les autres entrées et sources restent.
4. Ne pas snapshoter la page : le flux reste la réponse brute conservée ; la page sert de filtre et de résumé.

### `2)` Créer l'adaptateur ARCOM

> Le flux presse mélange le français et l'anglais, et ne dit pas lui-même s'il parle du DSA.

1. Créer `veille/sources/arcom.ts` : `SOURCE_ID = "arcom"`, `FEED_URL = "https://www.arcom.fr/rss/presse"`.
2. Limiter les liens à `www.arcom.fr` et `arcom.fr`, en `https` ; écarter les chemins commençant par `/en/`.
3. Parser `<rss><channel><item>` : titre et lien obligatoires, date via `toIsoUtc`, identifiant via `hashId` et `canonicalUrl`, `summary: null`, `themes: []`.
4. Exporter `PAGE` : `url(entry)` rend `entry.url` ; `parse(html)` extrait le texte de `<main>` sinon du document, reconnaît le DSA par `règlement sur les services numériques`, `RSN`, `DSA`, `2022/2065` ou `Digital Services Act`.
5. Rendre `keep` à partir de ce texte et `summary` à partir du premier `<p>` qui contient un marqueur, via `toSummary` ; `null` si aucun paragraphe ne le porte.

### `3)` Brancher la source et son libellé

> L'ARCOM entre dans la passe comme une source isolée, sans matière par défaut.

1. Dans `veille/main.ts`, importer `FEED_URL`, `PAGE` et `parseFeed` de `./sources/arcom.ts`, puis ajouter l'entrée `kind: "rss"`, `id: "arcom"`, `page: PAGE` au registre `SOURCES`.
2. Dans `src/lib/sources.ts`, ajouter `"arcom": "ARCOM"`.
3. Ne pas ajouter de matière par défaut : seule la page qui parle du DSA produit une entrée, et le rattachement central décide.

### `4)` Fixer le comportement par les fixtures

> Le test prouve le dédoublonnage de langue, le filtre par page et le résumé.

1. Créer `tests/fixtures/arcom/press.xml` avec quatre items : Mym en FR et EN, appel aux candidatures FM en FR et EN, tous sans description.
2. Créer `page-mym.html` avec un `<main>` contenant « Le règlement sur les services numériques (RSN) impose… » et `page-frequences.html` sans marqueur DSA.
3. Créer `tests/arcom.test.ts` : le flux rend deux entrées FR, sans résumé ; `PAGE.parse` garde Mym avec un résumé et écarte les fréquences ; un lien hors `arcom.fr` et un XML invalide lèvent.
4. Dans `tests/write.test.ts`, ajouter une passe simulée avec le flux et les deux pages : une seule entrée ARCOM est écrite, porte `plateformes`, et son résumé vient de la page.
5. Dans `tests/entries.test.ts`, ajouter `"arcom": "www.arcom.fr"` à la table des hôtes.

### `5)` Passer les portes

> L'adaptateur est terminé quand les tests et le typage passent.

1. Lancer `npm run typecheck`.
2. Lancer `npm test`.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Une source à `page` lit la page de chaque entrée, écarte les non retenues, remplace le résumé et avertit sans bloquer quand une page échoue. |
| 2 | Le flux rend deux entrées françaises ; la page Mym est retenue avec un résumé DSA ; la page fréquences est écartée ; les liens hors hôte lèvent. |
| 3 | `SOURCES` contient `arcom` avec `page` ; le badge affiche « ARCOM » ; aucune matière n'est ajoutée par défaut. |
| 4 | La passe simulée écrit une seule entrée ARCOM, porte `plateformes`, et son résumé vient de la page ; les doublons anglais et l'appel FM sont absents. |
| 5 | Typecheck et tests passent. |
