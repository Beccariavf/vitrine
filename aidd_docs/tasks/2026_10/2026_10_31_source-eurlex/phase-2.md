---
status: pending
---

# Instruction: Tags et filtre

## Architecture projection

```txt
.
├── veille/
│   ├── tags.json ✅
│   └── tags.ts ✅
└── tests/
    └── tags.test.ts ✅
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor   |
| ------------ | ----------------------- | -------------------- | ------- |
| Setup        | Lire `veille/tags.json` | Quatre tags, deux actifs | cli |
| Happy path   | Tester le titre Jautiva | Il correspond au tag RGPD | cli |
| Edge case    | Tester un titre sur la citoyenneté | Aucun tag ne correspond | cli |
| Edge case    | Tester « droit d'accès à un avocat » | Aucun tag ne correspond | cli |
| Edge case    | Tester un titre IA avec le tag inactif, puis actif | Inactif : pas de publication ; actif : correspondance | cli |
| Teardown     | Charger une configuration invalide | Erreur nommée, aucun résultat partiel | cli |

## Tasks to do

### `1)` Écrire le catalogue

> Quatre tags, dont deux actifs, avec les motifs validés.

1. Créer `veille/tags.json` avec `RGPD`, `droits des données`, `IA` et `cybersécurité`.
2. Activer `RGPD` et `droits des données` ; laisser `IA` et `cybersécurité` inactifs.
3. Reprendre les motifs actifs validés : protection des données, données à caractère personnel, RGPD, règlement 2016/679, directive 95/46, vie privée, ePrivacy, CNIL, CEPD, cookies, traceurs, consentement, transfert de données, décision d'adéquation, clauses types, Privacy Shield, portabilité, effacement, oubli, données de santé, biométrie, reconnaissance faciale, vidéosurveillance, géolocalisation, profilage, décision automatisée, violation de données, personne concernée, responsable du traitement, sous-traitant, conservation des données, PNR, espace européen des données, données ouvertes.
4. Donner à `IA` et `cybersécurité` leurs motifs versionnés, sans les activer.
5. Répartir les motifs entre `RGPD` et `droits des données` sans en perdre.

### `2)` Lire et appliquer les tags

> Un seul catalogue, deux usages : ingérer tout, publier l'actif.

1. Créer `veille/tags.ts` : type `Tag`, `readTags(rootDir)`, validation des identifiants, des libellés, des termes et des booléens.
2. Normaliser casse, accents et ponctuation en mots ; comparer des séquences de mots pour éviter que `IA` matche `relative`.
3. Exposer `activeTags(tags)`, `matchesTag(title, tag)` et `matchesActiveTags(title, tags)`.
4. Tester Jautiva, la citoyenneté, l'accès à un avocat, un titre IA avec le tag inactif puis actif, un titre cyber, une configuration invalide.
5. Vérifier que `matchesActiveTags` ignore les tags inactifs et que le titre officiel, non le titre d'affichage, porte le sujet.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Le catalogue contient quatre tags, deux actifs ; les motifs validés sont tous présents ; une configuration invalide lève une erreur claire. |
| 2 | Jautiva correspond à RGPD ; la citoyenneté et l'accès à un avocat ne correspondent à rien ; un titre IA ne correspond que lorsque le tag est actif. |
