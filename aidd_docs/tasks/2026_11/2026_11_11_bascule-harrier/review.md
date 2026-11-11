# Revue du candidat

- Rounds : 2
- Started : 2026-11-11

## Round 1 · r-4a1f

Statut : **changes requested** sur `ff52089` ; aucun bloqueur de code, trois corrections de
documentation et un critère de contrat partiellement tenu.

- Date : 2026-11-11
- By : revue indépendante (checker)
- Diff : `30bd0d0...ff52089`
- Axes : code, fonctionnel, pertinence
- Verdict : changes-requested
- Score : 15/17 met, 1 unmet, 1 unverified at runtime, 0 out of the diff

## Validation

| Commande / contrôle | Résultat |
| ------------------- | -------- |
| `npm test` | 640 tests, 639 pass, 1 skipped, 0 fail |
| `npm run typecheck` | propre |
| `npm run build` | 2 pages, code de sortie 0 |
| `npm run corpus:index` (relancé) | `incremental`, 53 143 unités, **0 ajoutée, 0 modifiée, 0 supprimée, 53 143 inchangées, 0 métadonnées rafraîchies` |
| `meta` de `data/corpus/index/index.db` | `model` = `leoipulsar/harrier-0.6b`, `dim` = 1024, `unites` = 53143 |
| Somme des `unites.jsonl` | 29 299 (cnil) + 17 703 (ce) + 5 443 (cepd) + 293 (aiact) + 272 (rgpd) + 133 (lil) = **53 143** |
| `meta` de `~/.cache/vitrine-harrier-ollama/root/…/index.db` | `leoipulsar/harrier-0.6b`, 1024, **29 299** unités |
| `npm run mcp:smoke` | `leoipulsar/harrier-0.6b, 1024 dimensions, norme 1.000000` |
| `ollama show leoipulsar/harrier-0.6b` | qwen3, 596,05 M, contexte 32 768, embedding 1024, Q8_0, 639 Mo |
| `git status --short` | vide |
| `dev` recalculé sur `dev-harrier-ollama.json` | 44/54 top 5, 38/54 rang 1, MRR 0,7404321, 5 pièges cités, 0 piège confiant |
| Balayage recalculé (`haut` × `marge`) | **198 couples** (66 × 3) ; aucun ≤ 10 % ; étape 2 = 28 confiantes, 2 erreurs, borne 22,65 %, couverture 51,85 % ; étape 3 = 16, 0 erreur, 19,36 %, 29,63 % ; plateau 28/2 pour `haut` 0,30–0,73 à `marge` 0,01 |
| Courbe du refus recalculée | `bas` 0,72 → 0 refusée ; 0,73 → 0 ; 0,74 → 1, juste ; plus faible similarité d'une bonne réponse = **0,730407** |
| `test` recalculé sur `test-harrier.json` | 34 confiantes, **0 erreur**, borne 10,15 %, couverture 62,96 %, 0 refusée ; 5 pièges cités, 2 confiants et faux |
| Cinq autres corpus + doctrine recalculés | table de `mesures/autres-corpus.md` reproduite à l'unité (RGPD 19/19, AI Act 3/3, LIL 9/10, CE 6/12, CEPD 10/10, doctrine 2/10 dont 3 confiantes fausses) |
| Reproductibilité du portage | 60/60 questions et `refs` identiques à `harrier-dev-actuelle.json` ; similarités différentes au plus de **7,04 × 10⁻⁵** → mesure refaite, pas une copie |
| Marge de décision du `test` | plus petit écart au seuil de marge = 7,29 × 10⁻⁴, soit 10 × la dérive observée ; plus petit écart au plancher = 1,43 × 10⁻² |

## Constats

| # | Sévérité | Constat | Suite |
| - | -------- | ------- | ----- |
| F1 | majeur | `mesures/confirmation.md:69-73`, committé le 2026-11-10 à 22:18 (`85cfd1a`), donne **déjà** le triplet `0,73 / 0,73 / 0,01` et ses résultats `dev` (28 / 2 / 22,6 %) et `test` (34 / 0 / 10,2 %). `calibration.md:6` (« écrite **avant** toute lecture de `test-harrier.json` ») et `test-harrier-promesse.md:3-7` présentent donc comme aveugle une règle dont le résultat `test` était publié la veille : la confirmation « hors échantillon » est surdéclarée. Atténuation mesurée : le `test` rend 34 confiantes et 0 erreur pour **toute** valeur du plateau `dev` 0,30–0,73, donc le seul arbitrage libre n'a pas choisi le résultat ; la validité des chiffres tient, la rédaction non. | Réécrire les deux pages et `promesse.md` §6 : dater la publication antérieure, et remplacer la garantie de gel par le constat d'invariance du plateau. |
| F2 | mineur | « 162 couples » (`promesse.md:64`, `calibration.md:28`) est faux : 0,30 → 0,95 par 0,01 font 66 valeurs × 3 marges = **198** couples, exactement les lignes 8–205 de `risque-dev-harrier.txt`. | Corriger le compte, ou écrire « 66 × 3 ». |
| F3 | mineur | `README.md:232` et `memory/data.md:112` : « Le plancher de refus CNIL passe de 0,69 à 0,73 ». L'ancien plancher CNIL valait **0,67** (retiré par ce même diff, `mcp/confidence.ts`) ; 0,69 est le repli. | Écrire « de 0,67 à 0,73 ». |
| F4 | mineur | Commentaire obsolète `tests/mcp.test.ts:737` : « Triplet `0,67 / 0,67 / 0,02` lu dans une ligne de `promesse.md` ». | Mettre 0,73 / 0,73 / 0,01. |
| F5 | mineur | `mesures/confirmation.md:88` conclut « le produit garde `qwen3-embedding:0.6b` » sans note de péremption, alors que `promesse.md` du même dossier dit le produit passé à Harrier : le dossier se contredit. | Ajouter une ligne « périmé, voir #20 ». |
| F6 | mineur | « vecteurs identiques » (`README.md:216-217`, `test-harrier-promesse.md:6-7`, `promesse.md:183-184`, `memory/data.md:101`) est démenti par la mesure : les similarités du même jeu diffèrent jusqu'à **7,04 × 10⁻⁵** entre les deux services. | Écrire « équivalents à 7 × 10⁻⁵ près, aucun rang ni niveau déplacé ». |
| F7 | mineur | `mcp/server.ts:29-30` : « Aucun réglage mesuré ne descend sous 10 % » est vrai mais trompeur — le meilleur réglage `dev` mesuré est **19,4 %**. | Écrire « le meilleur réglage mesuré plafonne à 19,4 %, à 29,6 % de couverture ». |
| F8 | mineur | Critère de contrat 5 : les instructions MCP (`CONSIGNE_PROMESSE`) portent la table et la borne, mais **ne nomment pas le modèle retenu** ; README et mémoire le nomment. | Ajouter le nom du modèle, ou amender le critère. |
| F9 | suggestion | Le plancher 0,73 n'est qu'à **4,0 × 10⁻⁴** au-dessus de la plus faible bonne réponse (0,730407) : un ré-embed ou une dérive de quantification tairait cette réponse. `bas = 0,72` ne refuse rien non plus et garde la garantie (`bas < haut` suffit). | Choisir 0,72, ou documenter la fragilité. |
| F10 | suggestion | `promesse.md` §5 recopie la table des sept jeux de `mesures/autres-corpus.md` ; deux homes pour les mêmes chiffres (F3 montre déjà la dérive). | Garder la table dans `autres-corpus.md` et lier. |
| F11 | suggestion | Le recul Conseil d'État (8/12 → 6/12, MRR 0,486 → 0,347) est publié dans `autres-corpus.md` mais absent de la section promesse du README : le basculement échange un gain CNIL contre une perte CE. | Une phrase dans le README. |
| F12 | hors diff | Le serveur `vitrine` exposé à cette session annonce encore `0,67 / 0,67 / 0,02` et 33,3 % : le processus en cours précède le commit. | Redémarrer l'hôte MCP après fusion. |

## Critères

- [x] Phase 1 — Index d'expérience 29 299 unités `leoipulsar/harrier-0.6b` en 1 024 dimensions ; l'index produit n'est pas touché par la phase. — `meta` de `~/.cache/vitrine-harrier-ollama/root/…/index.db`
- [x] Phase 1 — Le `dev` rend la référence au top 5 pour 44/54, au rang 1 pour 38/54, MRR 0,7404 ; aucun écart à expliquer. — `dev-harrier-ollama.json` recalculé ; 60/60 `refs` identiques à `harrier-dev-actuelle.json`
- [x] Phase 2 — Grille et courbe du refus produites hors ligne sur 54 questions sémantiques. — `risque-dev-harrier.txt`, 198 lignes de balayage + 76 de refus
- Unverified at runtime: Phase 2 — « le `test` n'a pas été lu » — aucun artefact ne l'établit, et `confirmation.md:69-73` (2026-11-10) porte déjà le triplet et son résultat ; voir F1.
- [x] Phase 3 — Borne et couverture `test` calculées avec le triplet figé, sans nouveau tir. — 34/0/10,15 %/62,96 % recalculés ; marqueur `questions-cnil-etendu.test-consomme.json` intact, sans entrée Harrier Ollama
- [x] Phase 3 — `test-harrier-promesse.md` nomme triplet, confiantes, erreurs, borne, couverture et verdict. — `mesures/test-harrier-promesse.md:11-21`
- [x] Phase 4 — L'index produit porte 53 143 unités, `leoipulsar/harrier-0.6b`, 1 024 dimensions. — `meta` de `index.db` ; somme des `unites.jsonl`
- [x] Phase 4 — Le second passage n'ajoute, ne modifie et ne supprime aucune unité. — `npm run corpus:index` relancé : 0/0/0/53 143
- [x] Phase 5 — Six mesures `dev` sur l'index produit, sans reconstruction ni tir `test`. — `dev-rgpd-v2/aiact/lil/ce/cepd/cnil-doctrine.json`, tous à 53 143 unités
- [x] Phase 5 — `autres-corpus.md` porte par jeu top 5, rang 1, MRR, confiantes, et ne promet aucune borne hors CNIL. — table recalculée à l'unité
- [x] Phase 6 — `creerEmbedder("ollama", {})` rend `leoipulsar/harrier-0.6b` en 1 024 dimensions ; `SEUILS_PAR_CORPUS.cnil` vaut le triplet de `calibration.md`. — `tests/index.test.ts:384`, `tests/mcp.test.ts:753`, `mcp/confidence.ts:42-45`
- [x] Phase 6 — Les lignes « Seuils retenus » et « Repli » de `promesse.md` portent les triplets du code, et la borne publiée est celle de `test-harrier-promesse.md`. — `tests/mcp.test.ts` (lecture du fichier), `promesse.md:19,27-28`
- [x] Phase 6 — `npm test`, `npm run typecheck` et `npm run build` passent ; README et mémoire ne nomment plus qwen3 comme modèle du produit. — sorties ci-dessus ; mentions restantes historiques et datées
- [x] Contrat 1 — Le `dev` re-mesuré reproduit le classement du modèle mesuré ; tout écart est expliqué. — identique au chiffre près
- [x] Contrat 2 — La table CNIL est calibrée sur `dev` et sa promesse constatée sur le `test` stocké, borne et couverture publiées. — chiffres exacts, mais voir F1 pour la formulation
- [x] Contrat 3 — L'index produit est complet, à jour, et le second passage n'embarque rien. — 53 143 unités, `incremental`, 0 delta
- [ ] Contrat 5 — README, instructions MCP et mémoire disent le modèle retenu, la table et la borne. — les instructions MCP ne nomment pas le modèle (F8)

## Challenge

Confiance : **70 %**. Un bloqueur de rédaction, aucun bloqueur de mesure.

- **Correct.** Le portage est authentique : ce n'est pas une copie, les similarités diffèrent de 7 × 10⁻⁵ au plus et les 60 classements sont identiques. Tous les chiffres publiés se recalculent exactement depuis les JSON du lot : `dev` 28/2/22,6 %/51,9 %, `test` 34/0/10,2 %/63,0 %, minimum `dev` 19,4 % à 16 confiantes, courbe du refus, pièges, cinq autres corpus, doctrine 3/3 fausses. L'idempotence est vérifiée, pas seulement affirmée.
- **Correct.** La réutilisation du `test` stocké est défendable : le plus petit écart de décision du `test` (7,29 × 10⁻⁴) est dix fois la dérive mesurée entre les deux services (7,04 × 10⁻⁵), et aucune question ne passe près du plancher (1,43 × 10⁻²). Risque résiduel non vérifiable : une bascule au cinquième rang du top 5, invisible sans un nouveau tir.
- **Deal breaker — la confirmation n'est pas aveugle.** Le triplet et son résultat `test` sont publiés depuis le 2026-11-10 (`confirmation.md:69-73`), avant le plan. Le lot peut revendiquer la reproductibilité du classement et l'invariance du `test` sur tout le plateau ; il ne peut pas revendiquer un gel antérieur à la lecture. C'est une correction de texte, pas de mesure : le seul arbitrage libre (`haut` dans le plateau) ne change pas le `test`.
- **Surdéclaré.** « Vecteurs identiques » : faux au sens strict, la mesure du lot le contredit.
- **Non vérifié.** Le cosinus 1,00000000 sur phrase de contrôle n'a aucun artefact committé et le service Unsloth n'écoute plus ; l'argument fort est le `dev` reproduit, pas cette phrase.
- **Pertinence.** La promesse publiée est plus prudente que le `test` (22,6 % contre 10,2 %) : pas de surpromesse côté chiffres. En revanche, le produit échange un gain CNIL contre un recul Conseil d'État non dit dans le README, et la doctrine passe à 3/3 fausses — publié, mais visible seulement dans `autres-corpus.md`.

## Suggestions ouvertes

- Corriger F1 avant toute citation publique de « constatée hors échantillon » : dater la connaissance antérieure et publier l'invariance du plateau comme preuve d'absence de sélection.
- Choisir `bas = 0,72` ou écrire que la marge de 4 × 10⁻⁴ est un choix assumé de sévérité, pas de sécurité.
- Régler le compte des couples (198), le plancher « 0,67 → 0,73 », le commentaire de `tests/mcp.test.ts:737` et la note de péremption de `confirmation.md`.
- Supprimer la copie de la table des sept jeux dans `promesse.md` §5 au profit d'un lien vers `autres-corpus.md`.
- Ajouter au README une phrase sur le recul Conseil d'État, et le modèle retenu à la consigne MCP.

## Round 2 · r-225a

Statut : **changes requested** sur `bac4621` ; aucun défaut de code ni de mesure, mais l'affirmation
fausse du premier tour survit dans `phase-2.md` et trois documents gardent une formulation périmée.

- Date : 2026-11-11
- By : revue indépendante (checker)
- Diff : `30bd0d0...bac4621` (corrections du tour : `ff52089...bac4621`)
- Axes : code, fonctionnel, pertinence
- Verdict : changes-requested
- Score : 16/17 met, 1 unmet, 0 unverified at runtime, 0 out of the diff

### Validation

| Commande / contrôle | Résultat |
| ------------------- | -------- |
| `npm test` | 640 tests, 639 pass, 1 skipped, 0 fail |
| `npm run typecheck` | propre, code de sortie 0 |
| `npm run build` | 2 pages, code de sortie 0 |
| `meta` de `data/corpus/index/index.db` | `leoipulsar/harrier-0.6b`, 1024, **53 143** unités, construit le 2026-11-11T12:54:46Z |
| Somme des `unites.jsonl` | 29 299 (cnil) + 17 703 (ce) + 5 443 (cepd) + 293 (aiact) + 272 (rgpd) + 133 (lil) = **53 143** |
| `meta` de `~/.cache/vitrine-harrier-ollama/root/…/index.db` | `leoipulsar/harrier-0.6b`, 1024, **29 299** unités |
| Marqueur `questions-cnil-etendu.test-consomme.json` | deux entrées (qwen3, mradermacher), **aucune** `leoipulsar` |
| `risque-dev-harrier.txt` | **198** lignes de balayage (lignes 8–205), 66 `haut` × 3 `marge` |
| Plateau `dev` 0,30–0,73, `marge` 0,01 | 44 valeurs, **une seule ligne** : 28 confiantes, 2 erreurs, 22,6 %, 0 refusée |
| Plateau `test` 0,30–0,73, `marge` 0,01 | 44 valeurs, **une seule ligne** : 34 confiantes, 0 erreur, 10,2 %, 0 refusée |
| `dev` Ollama vs Unsloth | 60/60 mêmes `refs` et `rangs` ; écart de similarité maximal **7,04 × 10⁻⁵** |
| Plus faible similarité d'une bonne réponse | **0,730407** ; marge au plancher **4,07 × 10⁻⁴** |
| Doctrine au triplet CNIL | 3 confiantes, 3 fausses, borne 100,0 % |
| Agrégats des cinq autres corpus | RGPD 19/19 (0,886), AI Act 3/3 (0,733), LIL 9/10 (0,725), CE 6/12 (0,347), CEPD 10/10 (1,000) |
| `git status --short` | vide avant cette revue |

### Les 11 corrections annoncées

| # | Constat | État |
| - | ------- | ---- |
| 1 | Affirmation « figé avant lecture du test » | **Partiel** — corrigée dans `calibration.md:5-10`, `test-harrier-promesse.md:3-7` et `promesse.md:25-28` ; `phase-2.md:27,41,44,52` affirme encore le contraire (voir critère 4). |
| 2 | 162 → 198 couples | Corrigé — `promesse.md:67`, `calibration.md:33` ; 198 lignes vérifiées. |
| 3 | Ancien plancher CNIL 0,69 → 0,67 | Corrigé — `README.md:238`, `memory/data.md:112` ; `0,67 / 0,67 / 0,02` vérifié sur `30bd0d0`. |
| 4 | Commentaire de test périmé | Corrigé — `tests/mcp.test.ts:737`. |
| 5 | Note de péremption de `confirmation.md` | Corrigée — `confirmation.md:91-93`, datée et liée au lot. |
| 6 | « Vecteurs identiques » → équivalents | **Partiel** — `README.md:220`, `test-harrier-promesse.md:8`, `promesse.md:183`, `plan.md:54` corrigés ; `memory/data.md:103` dit encore « vecteurs identiques ». |
| 7 | « Aucun réglage sous 10 % » | Corrigé dans `mcp/server.ts:28` et `mcp/confidence.ts:11-12` ; `calibration.md:78-81` prescrit encore l'ancienne phrase. |
| 8 | Modèle nommé dans les instructions MCP | Corrigé — `mcp/server.ts:46` (`CONSIGNE_SERVEUR`), exposé à `mcp/server.ts:68`. |
| 9 | Fragilité du plancher (4 × 10⁻⁴) | Corrigé — `calibration.md:56-59`, `promesse.md:123-124` ; arithmétique vérifiée. |
| 10 | Recul Conseil d'État dans le README | Corrigé — `README.md:222-227` ; chiffres recoupés avec `autres-corpus.md`. |
| 11 | Table des sept jeux dupliquée | Corrigé — `promesse.md:166-176` ; la table complète n'y est plus, le lien reste. |

### Critères

- [x] Phase 1 — Index d'expérience 29 299 unités `leoipulsar/harrier-0.6b`, 1 024 dimensions ; index produit intact. — `meta` de la racine d'expérience.
- [x] Phase 1 — Le `dev` rend 44/54 au top 5, 38/54 au rang 1, MRR 0,7404 ; aucun écart à expliquer. — `dev-harrier-ollama.json` ; 60/60 `refs` et `rangs` identiques à `harrier-dev-actuelle.json`.
- [x] Phase 2 — Grille et courbe du refus produites hors ligne sur 54 questions sémantiques. — `risque-dev-harrier.txt`, 198 lignes de balayage + courbe du refus.
- [ ] Phase 2 — « le `test` n'a pas été lu » — `phase-2.md:41,44,52` affirme encore « Le triplet est écrit avant toute lecture du `test` » et « le `test` n'a pas été lu », alors que `calibration.md:5-10` et `confirmation.md:69-73,91-93` établissent que le triplet et son résultat `test` sont publiés depuis le 2026-11-10. À réécrire comme les deux pages : « le triplet n'a pas été choisi sur le test ; résultat invariant sur le plateau `dev` 0,30–0,73 ».
- [x] Phase 3 — Borne et couverture `test` calculées avec le triplet, sans nouveau tir. — 34/0/10,2 %/63,0 % recalculés ; marqueur sans entrée `leoipulsar`.
- [x] Phase 3 — `test-harrier-promesse.md` nomme triplet, confiantes, erreurs, borne, couverture et verdict. — `test-harrier-promesse.md:3-23`.
- [x] Phase 4 — L'index produit porte 53 143 unités, `leoipulsar/harrier-0.6b`, 1 024 dimensions. — `meta` et somme des `unites.jsonl`.
- [x] Phase 4 — Le second passage n'ajoute, ne modifie et ne supprime aucune unité. — run du premier tour sur le même index (`0 / 0 / 0 / 53 143`), non rejoué ici pour ne pas ré-embarquer ; le diff ne touche pas l'indexation.
- [x] Phase 5 — Six mesures `dev` sur l'index produit, sans reconstruction ni tir `test`. — `dev-rgpd-v2/aiact/lil/ce/cepd/cnil-doctrine.json`, agrégats recalculés.
- [x] Phase 5 — `autres-corpus.md` porte top 5, rang 1, MRR et confiantes par jeu, sans promesse hors CNIL. — table recoupée à l'unité.
- [x] Phase 6 — `creerEmbedder("ollama", {})` rend `leoipulsar/harrier-0.6b` en 1 024 dimensions ; `SEUILS_PAR_CORPUS.cnil` vaut le triplet de `calibration.md`. — `mcp/embed/embedder.ts:12,14`, `mcp/confidence.ts:42`.
- [x] Phase 6 — Les lignes « Seuils retenus » et « Repli » de `promesse.md` portent les triplets du code, et la borne publiée est celle de `test-harrier-promesse.md`. — `tests/mcp.test.ts:827-857` ; test vert.
- [x] Phase 6 — `npm test`, `npm run typecheck` et `npm run build` passent ; README et mémoire ne nomment plus qwen3 comme modèle du produit. — sorties ci-dessus ; mentions restantes historiques et datées.
- [x] Contrat 1 — Le `dev` re-mesuré reproduit le classement du modèle mesuré ; tout écart est expliqué. — identique en rangs et en niveaux.
- [x] Contrat 2 — La table CNIL est calibrée sur `dev` et sa promesse constatée sur le `test` stocké, borne et couverture publiées. — chiffres exacts ; la réserve de non-aveuglement est désormais écrite.
- [x] Contrat 3 — L'index produit est complet, à jour, et le second passage n'embarque rien. — 53 143 unités, `meta` du 2026-11-11, run du premier tour.
- [x] Contrat 5 — README, instructions MCP et mémoire disent le modèle, la table et la borne. — `mcp/server.ts:46`, `README.md:215-220`, `memory/data.md:107-112`.

### Constats

- `aidd_docs/memory/data.md:103` : « dont les vecteurs sont identiques à ceux du modèle mesuré » contredit l'écart mesuré de 7,04 × 10⁻⁵ (F6 non clos) → écrire « équivalents, écart ≤ 7,0 × 10⁻⁵, rangs et niveaux identiques » — 🟢 minor, rot.
- `mesures/calibration.md:78-81` : prescrit encore « aucun réglage mesuré ne descend sous 10 % » et « 19,4 % coûterait la couverture utile », phrase retirée de `mcp/server.ts:28` et `mcp/confidence.ts:11-12` → supprimer ou aligner — 🟢 minor, rot.
- `README.md:229`, `mcp/server.ts:27`, `mcp/confidence.ts:10`, `mesures/test-harrier-promesse.md:23` : « hors échantillon » sans la réserve désormais écrite dans les deux pages de mesure → dire « constatée sur le `test` stocké, triplet non choisi par lui » — 🟢 minor, fit.
- `mesures/calibration.md:62` : titre « Triplet figé » après avoir dit que la page n'est pas une confirmation aveugle → « Triplet retenu » — 🟢 minor, rot.
- `mcp/server.ts:28`, `mcp/confidence.ts:12` : « Le meilleur réglage mesuré sur `dev` plafonne à 19,4 % » omet que c'est au prix de la couverture (29,6 % contre 51,9 %) ; se lit comme une contradiction avec la promesse de 22,6 % → ajouter « au prix de la couverture » — 🟢 minor, rot.
- Ticket #20 (hors dépôt) : le corps dit encore « ses vecteurs sont identiques … cosinus 1,00000000 » → amender le contrat pour ne pas citer l'affirmation retirée — 🟢 minor, fit.
- F12 (hors diff, toujours ouvert) : l'hôte MCP `vitrine` de cette session sert encore `0,67 / 0,67 / 0,02`, 33,3 % et « vecteurs identiques » → redémarrer l'hôte après fusion — 🟢 minor, fit.

### Challenge

Confiance : **90 %**. La correction est honnête sur le fond, et le point le plus fort n'est pas la
pré-publication, c'est l'invariance : j'ai recalculé les 44 valeurs du plateau `dev` 0,30–0,73 et
retrouvé une seule ligne, `28 / 2 / 22,6 %` en `dev` et `34 / 0 / 10,2 %` en `test`, à chaque fois.
Le test ne pouvait donc pas choisir parmi les valeurs du plateau. La promesse publiée est en outre
plus prudente que le meilleur réglage `dev` (22,6 % contre 19,4 % de borne) : un biais de sélection
irait vers le bas, pas vers le haut. Restent surdéclarés, sans toucher un chiffre : « hors
échantillon » sur les surfaces publiques, « vecteurs identiques » dans `memory/data.md:103` et le
ticket #20. Aucun défaut de code, de mesure ou d'index.

**Verdict final : changes-requested** — les corrections de texte listées (dont `phase-2.md`, résidu
du constat majeur du premier tour) avant de citer publiquement la confirmation.
