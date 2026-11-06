---
objective: "Le corpus CNIL des sanctions (249 documents, 6 342 fragments) est ingéré par deux voies déclarées, indexé avec le même modèle que les autres corpus, interrogeable par recherche et par identifiant, et mesuré dans un rapport séparé ; les incréments DILA se rejouent sans doubler aucune unité."
status: implemented
---

# Plan: Corpus CNIL hybride

Source: aidd_docs/tasks/2026_11/2026_11_05_corpus-cnil/brainstorm.md

## Phases

| #   | Phase        | File                         | Depends on |
| --- | ------------ | ---------------------------- | ---------- |
| 1   | Corpus explicite dans le schéma | [`phase-1.md`](./phase-1.md) | none |
| 2   | Historique DINUM | [`phase-2.md`](./phase-2.md) | 1 |
| 3   | Incréments DILA | [`phase-3.md`](./phase-3.md) | 2 |
| 4   | Outils et questions CNIL | [`phase-4.md`](./phase-4.md) | 1, 2 |
| 5   | Index complet et documentation | [`phase-5.md`](./phase-5.md) | 1, 2, 3, 4 |

## External sources

| URL   | What it settled   |
| ----- | ----------------- |
| https://huggingface.co/datasets/AgentPublic/cnil | 64 466 fragments, 9 935 documents, 74,2 Mo de texte ; colonnes `doc_id`, `chunk_index`, `text`, `chunk_text`, `number`, `date`, `status`, `nature_delib` ; embeddings `bge-m3`. Filtre `Sanction` : 6 342 fragments, 249 documents. |
| https://www.data.gouv.fr/datasets/les-deliberations-de-la-cnil-vectorisees/ | Même jeu, licence `lov2` sur data.gouv contre `etalab-2.0` sur Hugging Face : incohérence consignée dans le manifeste. |
| https://echanges.dila.gouv.fr/OPENDATA/CNIL/ | 146 archives incrémentales depuis le 11 juillet 2025 (1,6 à 24 Ko), XML `TEXTE_CNIL` ; aucune archive de base complète à cette adresse. |
| https://nodejs.org/api/sqlite.html | Une colonne texte et un filtre `WHERE` suffisent à ajouter le corpus à la table `unites`. |
| https://github.com/hyparam/hyparquet | `hyparquet` 1.32.0 (MIT, pur JS) lit le parquet ZSTD avec `hyparquet-compressors` ; `parquetReadObjects` accepte une sélection de colonnes et évite les vecteurs `bge-m3`. Vérifié localement sur les deux fichiers. |

## Impact

| Category                                           | Verdict and evidence | Handled in         |
| -------------------------------------------------- | -------------------- | ------------------ |
| runtime | L'historique pèse 334 Mo de parquet non commité ; les seules colonnes utiles font 74,2 Mo de texte. 6 342 fragments s'indexent en une dizaine de minutes à ~0,087 s par unité. | 2, 5 |
| regression | Ajouter `corpus` touche `Unite`, le schéma SQLite, `search`, les outils et l'évaluation : l'index doit être reconstruit. Les vecteurs sont identiques (même modèle, même texte) ; les chiffres `dev` publiés doivent se reproduire, sinon la phase s'arrête. | 1 |
| architecture | Un corpus devient une dimension de premier ordre, distincte du document ; deux origines de fragments cohabitent avec un manifeste qui les déclare ; l'URL publique est marquée non vérifiée. | 1, 2, 3 |
| documentation | Rapport CNIL séparé, mémoire et README à jour, limites (licence, URL, découpage double) écrites. | 5 |

## Rules

| Rule   | Why it applies |
| ------ | -------------- |
| Le jeu de tests par défaut ne touche pas le réseau. | Les fixtures XML et les lignes parquet injectées restent locales ; `MCP_TEST_CNIL=1` reste opt-in. |
| `data/` n'est jamais édité à la main. | `cnil:sync` et `corpus:index` produisent les fichiers. |
| Le parquet DINUM n'est pas commité. | 334 Mo ; le manifeste porte l'URL, la date et l'empreinte. |
| Aucun vecteur d'un autre modèle n'entre dans l'index. | `bge-m3` et `qwen3` sont deux espaces ; on ré-embarque le texte. |
| Un échec de parsing laisse le corpus intact. | Le corpus est écrit après validation complète, comme pour EUR-Lex. |
| Aucune écriture sur `stdout` dans le serveur MCP. | `stdout` porte le JSON-RPC. |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| `corpus` devient un champ explicite, distinct de `document`. | La CNIL a 249 documents dans un seul corpus : filtrer par document n'a aucun sens, filtrer par corpus oui. |
| Commencer par les sanctions (6 342 fragments) plutôt que les 64 466. | Le corpus complet pèserait ~80 Mo dans git et 93 minutes d'indexation ; les sanctions sont datées, numérotées et citables. Le filtre est un paramètre. |
| Conserver le `chunk_index` DINUM comme base de citation. | Un index publié se vérifie ; un numéro de paragraphe inventé par nous ne se vérifie pas. |
| Découpage local pour les incréments DILA, étiqueté `dila`. | Les XML DILA arrivent en paragraphes de 1 à 3 112 caractères ; il faut regrouper, et le dire. |
| Ne pas réutiliser les embeddings `bge-m3`. | Un index, un espace vectoriel. |
| `get_decision` séparé de `get_article`. | Un arrêt de sanction n'est pas un article ; mélanger les deux rendrait les deux confus. |
