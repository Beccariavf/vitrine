---
status: done
---

# Instruction: Extraire les références des pages CNIL

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── veille/
│   ├── references.ts ✏
│   └── sources/
│       └── cnil.ts ✏
└── tests/
    ├── references.test.ts ✏
    ├── cnil-page.test.ts ✅
    └── fixtures/
        └── cnil/
            ├── page-fnac.html ✅
            ├── page-multi.html ✅
            ├── page-singular.html ✅
            └── page-no-references.html ✅
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Lire les quatre fixtures HTML dans `tests/fixtures/cnil/`. | Les sections cibles et leurs leurres sont disponibles hors réseau. | cli |
| Happy path   | Extraire les références de la page FNAC. | `["Loi Informatique et Libertés · art. 82"]` ; « La délibération » et « Pour approfondir » sont ignorés. | cli |
| Happy path   | Extraire les références de la page webinaire. | `Code de la consommation · art. L. 223-1` et `Règlement (UE) 2016/679 · art. 6, 7, 21, 4.11` ; le décret non reconnu est ignoré. | cli |
| Edge case    | Extraire une page au titre singulier « Texte de référence ». | `Règlement (UE) 2016/679 · art. 6`. | cli |
| Edge case    | Extraire une page sans section cible. | `[]`. | cli |
| Edge case    | Extraire `L. 34-5 et suivants`, un instrument sans article, des doublons, une plage et un instrument inconnu. | `L. 34-5 et suivants` conservé ; aucun tag inventé, articles dédoublonnés, plage reconnue seulement avec un instrument reconnu. | cli |

## Tasks to do

Le bloc utile a cette forme, observée sur les pages citées :

```html
<div class='ctn-gen-textes-references'>
  <div class='textref text-hide'>Texte reference</div>
  <div class='ctn-gen-textes-references-contenu'>
    <h2>Textes de référence</h2>
    <ul>
      <li class='ctn-gen-textes-references-lien'><a href="…">…</a></li>
    </ul>
  </div>
</div>
```

### `1)` Ajouter l'extracteur CNIL

> La page CNIL nomme l'instrument après l'article ; l'extracteur CJUE ne suffit pas.

1. Ajouter `extractCnilReferences(items: readonly string[]): string[]` dans `veille/references.ts`, sans changer `extractReferences`.
2. Reconnaître les alias et rendre les libellés canoniques : `RGPD`, `règlement général sur la protection des données`, `règlement (UE) 2016/679` → `Règlement (UE) 2016/679` ; `loi Informatique et Libertés`, `loi n° 78-17` → `Loi Informatique et Libertés` ; `CPCE`, `Code des postes et des communications électroniques` → ce nom complet ; `directive ePrivacy` → `Directive 2002/58/CE` ; `Code de la consommation` → ce nom ; toute autre `Directive (UE|CE|CEE) n° …` → son libellé.
3. Reconnaître les articles `82`, `L.223-1`, `L. 34-5`, `R. 123-45`, `4.11`, `1er`, les listes `5 et 6`, les plages `134 à 137` et le suffixe `L. 34-5 et suivants` ; normaliser `L.223-1` en `L. 223-1`, une plage en `134–137` et conserver `et suivants` tel quel.
4. Regrouper par instrument dans l'ordre de première apparition, dédoublonner les articles et exiger au moins un article, comme pour la CJUE.

### `2)` Lire la section dans la page HTML

> Le HTML CNIL isole chaque section dans un bloc `ctn-gen-textes-references`.

1. Ajouter `parseCnilPageReferences(html: string): string[]` dans `veille/sources/cnil.ts`.
2. Ancrer sur la classe exacte du div extérieur `ctn-gen-textes-references`, pas sur les préfixes `ctn-gen-textes-references-contenu` ou `-lien` ; accepter les guillemets simples ou doubles.
3. Lire le `<h2>` dans le wrapper `ctn-gen-textes-references-contenu` et ne garder que `Textes? de références?`.
4. Capturer le bloc jusqu'à la paire `</div></div>` de fin, jamais au premier `</div>` ; décoder les entités deux fois, retirer les balises et normaliser les espaces des `<li>`.
5. Passer les textes à `extractCnilReferences` et rendre `[]` sans lever quand la section est absente ou vide.

### `3)` Figer les variantes HTML

> Les fixtures prouvent le parseur sans réseau et sans dépendance à la page vivante.

1. Capturer `page-fnac.html` depuis la page citée : « La délibération », la section cible et « Pour approfondir » ; réduire au strict nécessaire sans réécrire les classes, guillemets ou entités.
2. Capturer `page-multi.html` depuis la page webinaire : le bloc « Pour approfondir » qui précède, puis code de la consommation, décret, articles RGPD et `4.11`.
3. Capturer `page-singular.html` depuis la page de reconstitution, avec le titre « Texte de référence ».
4. Capturer `page-no-references.html` depuis une page sans section cible, en gardant le bloc « Pour approfondir » comme leurre.

### `4)` Tester l'extraction et le parseur

> Chaque comportement du contrat est observé sur une fixture ou une chaîne.

1. Étendre `tests/references.test.ts` avec les alias, les articles `L.`, `4.11`, `1er`, les listes, les plages, l'instrument inconnu et les doublons.
2. Créer `tests/cnil-page.test.ts` avec les quatre fixtures.
3. Vérifier la FNAC, le regroupement RGPD, le titre singulier, la page sans section et les leurres ignorés.
4. Relancer les tests CJUE existants sans modifier leurs attentes.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | La FNAC rend exactement `Loi Informatique et Libertés · art. 82` ; les alias RGPD, LIL, CPCE, ePrivacy, 95/46 et Code de la consommation rendent les libellés canoniques ; `L. 34-5 et suivants` est conservé. |
| 2 | Le parseur ne lit que la section cible, décode les entités, ignore les autres blocs et rend `[]` sans erreur quand la section manque. |
| 3 | Les quatre fixtures sont des captures réduites des pages réelles, avec leurs classes et guillemets d'origine, et couvrent FNAC, multi-items, titre singulier et absence de section. |
| 4 | Les tests couvrent les cas du spec ; les tests CJUE existants passent inchangés. |
