---
objective: "Sur un jeu RGPD v3 de 80 questions dont 40 tenues à l'écart, les deux modèles sont mesurés une fois chacun et la règle pré-déclarée tranche : garder 0.6b ou adopter 4b, avec les comptes appariés et leur p-value."
status: pending
---

# Plan: Jeu v3 et décision entre modèles

Source: aidd_docs/tasks/2026_11/2026_11_05_mesure-v3-modeles/brainstorm.md

## Phases

| #   | Phase        | File                         | Depends on |
| --- | ------------ | ---------------------------- | ---------- |
| 1   | Jeu RGPD v3 | [`phase-1.md`](./phase-1.md) | none |
| 2   | Sortie JSON et marqueur par modèle | [`phase-2.md`](./phase-2.md) | none |
| 3   | Comparaison appariée | [`phase-3.md`](./phase-3.md) | 2 |
| 4   | Calibration des deux modèles | [`phase-4.md`](./phase-4.md) | 1, 2 |
| 5   | Mesure unique et décision | [`phase-5.md`](./phase-5.md) | 1, 2, 3, 4 |

## External sources

| URL   | What it settled   |
| ----- | ----------------- |
| https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.binomtest.html | Le test exact de McNemar est un test binomial sur les paires discordantes, `p = 0,5` sous l'hypothèse nulle ; `binomtest(k, n, 0.5, "two-sided")` en est la forme de référence. Le calcul sera implémenté localement, sans dépendance. |
| https://github.com/asg017/sqlite-vec | L'index reste à un fichier par racine : mesurer `4b` demande une seconde racine, pas un second service. |

## Impact

| Category                                           | Verdict and evidence | Handled in         |
| -------------------------------------------------- | -------------------- | ------------------ |
| runtime | Mesuré : index `4b` de 565 unités en 5 min 40 s contre 49 s ; une passe de 30 questions en 3,0 s contre 1,7 s. Le test v3 en mesurera 40 par modèle, soit quelques secondes. | 4, 5 |
| regression | La suite actuelle (371 tests) est rejouée à chaque phase. Le garde du test change de « une fois » à « une fois par modèle » ; le marqueur v2 reste refusé tel quel. Risque : moyen, couvert par des tests dédiés. | 2, 3, 5 |
| architecture | Le runner gagne une sortie JSON par question ; le marqueur devient une liste de mesures ; un module de comparaison appariée apparaît. Aucun changement de transport ni de corpus. | 2, 3 |
| documentation | Un rapport v3 séparé, les chiffres v2 intacts, la mémoire et le README mis à jour ; la décision sur le modèle y figure. | 5 |

## Rules

| Rule   | Why it applies |
| ------ | -------------- |
| Le jeu de tests par défaut ne touche pas le réseau. | Les fixtures et l'embedder restent injectés ; `MCP_TEST_OLLAMA=1` reste opt-in. |
| Les questions v3 sont écrites avant toute mesure. | Sinon elles décrivent le système, pas le droit. |
| La règle de décision est écrite avant la mesure du test. | Une règle choisie après les chiffres n'est pas une preuve. |
| Chaque modèle est mesuré une seule fois sur le test. | Deux passages du même modèle transformeraient le test en jeu de réglage. |
| Les seuils de chaque modèle viennent de son propre `dev`. | Comparer deux modèles avec les seuils de l'un avantage l'autre. |
| `data/` n'est jamais édité à la main. | `corpus:build` et `corpus:index` produisent les fichiers. |
| Aucune écriture sur `stdout` dans le serveur MCP. | `stdout` porte le JSON-RPC. |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| Comparaison appariée (McNemar exact) plutôt que deux intervalles indépendants. | Sur 34 questions, deux intervalles se recouvrent presque toujours ; l'appariement teste le désaccord, pas la marge. |
| 80 questions, 40 par split, dont 34 sémantiques. | Double le test v2 ; détecte un écart d'environ six questions, ce qui suffit pour dire si `4b` vaut 6,9× l'indexation. |
| Trois références exactes par split au lieu de six. | Elles sont servies par un `SELECT` : elles gonflent le top 5 sans mesurer la recherche. |
| Marqueur par couple (empreinte des questions, modèle). | Deux modèles pré-déclarés doivent pouvoir être mesurés ; le même modèle deux fois reste refusé. |
| Règle : `4b` adopté si McNemar exact p < 0,05 en sa faveur et top 5 rendu non dégradé. | Un gain de top 1 qui casse le top 5 ou le refus n'est pas un gain. |
| Si `b + c < 6`, aucune conclusion et `0.6b` reste. | En dessous, le test ne distingue rien et l'annoncer autrement serait faux. |
| Pas de reranker dans ce chantier. | Ollama n'en sert pas ; l'ajouter est une décision d'architecture séparée. |
