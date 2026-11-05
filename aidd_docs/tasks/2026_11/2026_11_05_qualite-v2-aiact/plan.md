---
objective: "Sur les 30 questions RGPD tenues à l'écart, mesurées une fois, le top 5 et les pièges sont rapportés avec leur intervalle ; l'AI Act s'ingère et se cherche par le même pipeline, avec un rapport séparé."
status: pending
---

# Plan: Qualité v2 et second corpus AI Act

Source: aidd_docs/tasks/2026_11/2026_11_05_qualite-v2-aiact/brainstorm.md

## Phases

| #   | Phase        | File                         | Depends on |
| --- | ------------ | ---------------------------- | ---------- |
| 1   | Jeu RGPD v2 | [`phase-1.md`](./phase-1.md) | none |
| 2   | Recherche hybride | [`phase-2.md`](./phase-2.md) | 1 |
| 3   | Corpus AI Act | [`phase-3.md`](./phase-3.md) | none |
| 4   | Questions AI Act | [`phase-4.md`](./phase-4.md) | 3 |
| 5   | Mesure finale et documentation | [`phase-5.md`](./phase-5.md) | 1, 2, 3, 4 |

## External sources

| URL   | What it settled   |
| ----- | ----------------- |
| https://publications.europa.eu/resource/celex/32024R1689 | Répond 200 en `application/xhtml+xml` avec `Accept-Language: fra` : 1 383 324 octets, 113 ancres `art_N`, 180 ancres `rct_N`, 13 chapitres `cpt_<romain>`. |
| https://nodejs.org/api/sqlite.html | `node:sqlite` embarque FTS5 ; vérifié : `fts5(texte, tokenize="unicode61 remove_diacritics 2")` indexe et classe « autorite chef de file ». |
| https://github.com/asg017/sqlite-vec | `vec0` et une table FTS5 cohabitent dans le même fichier ; le delta s'applique aux deux tables. |
| https://docs.ollama.com/api/embed | `POST /api/embed` reste la source des vecteurs ; `qwen3-embedding:0.6b`, 1 024 dimensions. |

## Impact

| Category                                           | Verdict and evidence | Handled in         |
| -------------------------------------------------- | -------------------- | ------------------ |
| runtime | Mesuré : FTS5 fonctionne dans `node:sqlite` ; l'AI Act pèse 1,38 Mo et rend 113/180. L'index reste local, sans service. | 2, 3 |
| regression | Le parseur devient générique : les 99/173 du RGPD et leurs tests doivent rester verts. La recherche change de classement ; les tests existants couvrent le contrat. Risque : moyen. | 2, 3 |
| architecture | Deuxième corpus par descripteur, recherche hybride dense + lexicale, table FTS5 mise à jour par le même delta. | 2, 3 |
| documentation | Deux rapports séparés, la mémoire et le README décrivent le second corpus et l'hybride. | 5 |

## Rules

| Rule   | Why it applies |
| ------ | -------------- |
| Le jeu de tests par défaut ne touche pas le réseau. | Les fixtures et l'embedder restent injectés. |
| Le test v2 est mesuré une seule fois, après les corrections. | Sinon il devient un jeu de réglage. |
| Le test v1 n'est jamais fusionné avec le v2. | Deux époques, deux preuves. |
| Chaque corpus a son rapport. | Un score moyen masquerait les différences de difficulté. |
| `data/` n'est jamais édité à la main. | Les commandes produisent corpus et index. |
| Aucune écriture sur `stdout` dans le serveur MCP. | `stdout` porte le JSON-RPC. |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| AI Act avant la LIL. | Même route CELLAR, même structure ELI : l'extensibilité se prouve sans nouveau parseur de source. La LIL demandera un chemin DILA LEGI. |
| 60 questions RGPD, 30 `dev` et 30 `test`. | Double le test actuel ; l'intervalle reste large mais devient interprétable. |
| Fusion RRF à `k = 60`, 50 candidats par voie. | Standard, sans réglage fin, et robuste aux échelles de score différentes. |
| Hybride conservé seulement si `dev` progresse sans dégrader les pièges. | Une amélioration qui casse le refus n'en est pas une. |
| FTS5 dans le même fichier que `sqlite-vec`. | Un seul artefact, un seul delta, pas de second service. |
| 12 questions AI Act, sans split. | Preuve d'extensibilité, pas benchmark ; le rapport le dira. |
