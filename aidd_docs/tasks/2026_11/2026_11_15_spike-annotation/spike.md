# Spike #40 — annotation humaine complète ou juge automatique calibré (ARES) ?

Date : 2026-11-15. Étude seule : aucun changement du serveur ni des corpus.
**La décision appartient à l'auteur** ; ce document recommande.

## Question

Pour mesurer la fiabilité sur au moins 150 questions, faut-il tout annoter à la main, ou annoter
environ 150 à 300 exemples et utiliser un juge automatique calibré par inférence assistée par
prédiction (ARES, arXiv 2311.09476) ?

## Investigation

| Attempt | Evidence | Result |
| --- | --- | --- |
| ARES, article | arXiv 2311.09476v2, §3, §5.1, tableaux 1 et 3, §7 | 150 annotations humaines **au minimum**, 300 dans les expériences, 200 sur AIS ; en dessous de 100–150, ARES ne distingue plus les systèmes (tableau 3). Juges : trois classifieurs binaires DeBERTa-v3-Large (304 M) affinés sur des données **synthétiques** produites par FLAN-T5-XXL à partir des passages du domaine et de 5 exemples ou plus (GPT-3.5 few-shot sert de variante sans affinage). |
| ARES, ce qui est calibré | §3.3, figures 2 et 3 | Le juge prédit sur un grand ensemble non annoté ; l'ensemble humain sert à estimer son **erreur** (rectifier) et à corriger la moyenne. Intervalle à 95 %, largeur moyenne 7,4 points (pertinence du contexte) et 6,1 points (pertinence de la réponse) sur des systèmes séparés de 2,5 points. Le classement se fait sur le milieu de l'intervalle. |
| PPI, mécanique | arXiv 2301.09633v4, §1.3, algorithme 1 | `θ̂ = moyenne(juge, N non annotés) − moyenne(juge − humain, n annotés)`, intervalle `± 1,96 √(σ²(juge−humain)/n + σ²(juge)/N)`. Hypothèses : annotés et non annotés **i.i.d. de même loi**, prédicteur indépendant des deux, `N ≫ n`. Aucune hypothèse sur la qualité du modèle, mais la largeur en dépend entièrement. |
| PPI, cas où il ne sert à rien | Annexe G.1, G.2, G.3 | L'intervalle PPI est plus étroit que le classique seulement si `Var(juge − humain) < Var(humain)`. Pour une issue binaire, cela exige une erreur du juge **< 25 % à p = 0,5, < 9,6 % à p = 0,1, < 2 % à p = 0,02** ; et `N ≤ n` supprime tout gain (G.3). |
| Harnais actuel | `mcp/eval/run.ts`, `compare.ts`, `risque.ts`, `mcp/statistiques.ts`, lu le 2026-11-15 | Mesure au **document dans le top 5 brut** (ou au fragment si l'attendue porte un `#`) : recall@5, MRR, top 1, pièges cités, niveaux confiant/incertain/refusé. Borne de Wilson (`intervalleWilson`) sur les seules confiantes (`risque.ts`) ; comparaison appariée par McNemar exact avec plancher de 6 paires discordantes (`compare.ts`). `dev` calibre, `test` se mesure une fois avec marqueur (`*.test-consomme.json`). |
| Ce que #61–#64 demandent | `gh issue view 61 62 63 64` | #61 : précision et rappel **au fragment**, par corpus, sur `dev`. #62 : chaque référence rendue classée « existe et soutient / existe sans soutenir / n'existe pas », taux + borne. #63 : taux de réponses `confiant` sur des questions **hors périmètre**. #64 : borne haute à 95 % **par corpus**, sur le `test`, une seule fois. |
| Composition actuelle du jeu | CSV de `mcp/eval/`, comptés le 2026-11-15 | 198 questions sémantiques `dev` sur **8 corpus** : RGPD 73 (jeux v1, v2, v3), CNIL 70 (54 étendu + 6 v1 + 10 doctrine), CE 12, CEPD 10, CC 10, CJUE 10, LIL 10, AI Act 3. **10 des 19 corpus n'ont aucune question** : eprivacy, police, eudpr, rgpdproc, ccs, adequation, textes_fr, preparation, constit, metadonnees. |
| Arithmétique par corpus | Wilson (0 erreur) et formule PPI de l'annexe G.1, calculés ici | 150 questions sur 19 corpus = **7,9 par corpus** ; à la couverture CNIL mesurée (51,9 % de confiantes) ≈ **4 confiantes par corpus**, soit 0/4 → borne 49,0 % (règle 3/n : 75 %). 0/8 → 32,4 % ; 0/35 → **9,9 %**. Atteindre 10 % par corpus demande **35 confiantes par corpus = 665**, donc ≈ 1 280 questions à 52 % de couverture. Avec un juge à 5 % d'erreur, un intervalle PPI à 8 annotations vaut ±15,3 points, à 20 annotations ±9,7 ; il faut ≈ 19 annotations par corpus (**361**) pour 10 points, et le juge doit rester sous 9,6 % d'erreur pour seulement battre le classique à p = 0,1. |
| Kit de mesure, 10 questions | `kit-10-questions.md`, sortie réelle du serveur local (stdio, `search`, k = 5, seuils produit) | 8 corpus, 1 question multi-fragments (art. 44 et 45), 1 hors périmètre. Le serveur rend 2 `confiant` (LIL, CEPD), 7 `incertain` — dont 3 sans le passage attendu dans le top 5 (CNIL doctrine, CE, CC) — et **refuse** la question hors périmètre (`aucun_resultat_fiable`, aucun passage). Le seul cas multi-références du `dev` reste dans **un** document : aucun jeu `dev` ne teste une réponse répartie sur deux documents. |
| Coût d'annotation | hypothèse 3 / 5 / 8 min par question, à remplacer par le kit | 150 questions : **7,5 / 12,5 / 20 h**. 665 annotations : 33 / 55 / 89 h. 1 280 questions : 64 / 107 / 171 h. Mise en place d'ARES en plus : génération synthétique et affinage (32 Go de GPU, « plusieurs heures » selon §7) **ou** juge few-shot local, plus le harnais juge et l'estimateur PPI, soit au moins une journée de travail. |

### Exigences d'ARES, en une page

| Exigence | Ce que dit la source | Conséquence ici |
| --- | --- | --- |
| Annotations humaines | « a human preference validation set of approximately 150 annotated datapoints or more » (§3) ; 300 dans les expériences, 200 sur AIS | 150 est un plancher, pas une cible ; en dessous de 100–150, le classement n'est plus fiable (tableau 3) |
| Unité annotée | triplets (question, passage, réponse) pour trois axes : pertinence du contexte, fidélité, pertinence de la réponse | Notre grille annote des **passages**, pas des réponses générées : 5 passages par question, donc 150 annotations = **30 questions**, pas 150 |
| Juge | DeBERTa-v3-Large affiné sur données synthétiques (FLAN-T5-XXL, ≥ 5 exemples) ; GPT-3.5 few-shot en variante | Sans GPU 32 Go ni cloud, seule la variante few-shot locale est réaliste ; l'affinage est hors de portée de la machine |
| Ce qui est calibré | l'**erreur du juge** (rectifier), pas le juge | un juge faux de façon corrélée reste corrigible ; un juge non corrélé ne l'est pas |
| Forme de l'intervalle | 95 %, normale, `± 1,96 √(σ²(juge−humain)/n + σ²(juge)/N)` | intervalle sur une **moyenne**, pas sur un comptage ; il remplace Wilson, il ne s'y ajoute pas |
| Hypothèses | annotés et non annotés i.i.d. de même loi ; prédicteur indépendant ; `N ≫ n` | l'échantillon humain doit être **représentatif** du jeu évalué ; un échantillon tiré du top 5 du système est biaisé (juge et humain voient les mêmes candidats) |
| Quand PPI n'apporte rien | `Var(juge−humain) ≥ Var(humain)` ; erreur > 25 % (p = 0,5), > 9,6 % (p = 0,1), > 2 % (p = 0,02) ; `N ≤ n` | notre cible est un taux d'erreur faible : à p = 2 %, un juge doit se tromper **moins de 2 %** du temps pour valoir mieux que 150 annotations humaines |
| Limites déclarées | droit, médecine, finance exigent des annotateurs experts ; jeux uniquement en anglais ; transfert cross-lingue (Kendall 0,33) et texte→code (0,28) échouent (§5.4, §7) | le domaine est juridique et francophone : le juge doit être mesuré ici, pas supposé |

## Outcome

**Result — recommandation : annoter à la main le jeu doré, et n'utiliser un juge que comme
pré-annotateur, sans revendication statistique.** Quatre raisons.

1. **ARES ne réduit pas le coût qui nous contraint.** Dans ARES, le juge prédit des étiquettes sur
   des sorties de système non annotées, parce que juger une réponse générée coûte cher. Ici, la
   métrique (recall@5, précision@k) est **déterministe** dès que la référence existe : le harnais
   la calcule gratuitement pour toute question dont on connaît le fragment attendu. Le coût est
   dans l'écriture de la référence, pas dans le jugement répété des sorties. Un juge peut
   proposer la référence, il ne peut pas la remplacer de façon certifiée.
2. **La borne par corpus est un problème de nombre de questions, pas de méthode.** 150 questions
   sur 19 corpus donnent ≈ 4 confiantes par corpus, donc une borne à 49 % (Wilson) ou 75 %
   (règle 3/n) : inutilisable. Il faut 35 confiantes par corpus, soit 665, soit ≈ 1 280 questions.
   ARES abaisse le nombre d'**annotations**, pas le nombre de **questions confiantes** nécessaires ;
   et à 8 annotations par corpus, même un juge à 5 % d'erreur laisse ±15 points. Le plafond de 150
   de #60 et la borne par corpus de #64 sont incompatibles, quelle que soit la méthode.
3. **Le seuil d'utilité de PPI est hors d'atteinte pour une cible à 2 %.** La condition de l'annexe
   G.1 se traduit en erreur de juge maximale : 9,6 % à p = 0,1, **2 % à p = 0,02**. Publier « 0
   erreur sur 150 » et le remplacer par une borne PPI plus étroite exige un juge faux moins de 2 %
   du temps sur la pertinence juridique — aucune mesure ne le soutient, et ARES lui-même ne teste
   que l'anglais et des domaines généralistes, en déclarant que le droit demande des experts (§7).
4. **Deux exigences du harnais ne sont pas exprimables en PPI.** #61 demande le **rappel** au
   passage : il faut l'ensemble complet des fragments pertinents, qu'un juge du top 5 ne voit
   jamais. #62 demande « existe et soutient la réponse » : le serveur ne génère pas de réponse, il
   rend des passages. Au mieux, la troisième classe devient « existe mais ne soutient pas le
   passage », ce qui reste un jugement humain.

**Ce qu'un juge apporte quand même.** Comme pré-annotateur, il propose les passages candidats et
l'humain valide : c'est là que le temps se gagne, et le kit mesure ce temps. ARES/PPI devient
pertinent plus tard, si le jeu dépasse le millier de questions et qu'un accord juge/humain est
mesuré sur un échantillon tenu à l'écart ; la condition de bascule est alors chiffrée (erreur du
juge < 2 % à p = 0,02, ≥ 19 annotations par corpus pour une borne à 10 points).

**Piste de l'auteur (2026-11-15) : des questions tirées de la doctrine publiée.** Les articles
d'avocats et de professeurs de droit en ligne fournissent à la fois une question réelle et sa
référence experte (les textes et décisions qu'ils citent). C'est exactement le coût identifié au
point 1 : la référence. La mesure devient alors largement automatique.

- Apport : rappel mesurable sans jugement répété (le serveur retrouve-t-il les sources citées par
  l'auteur ?), questions de praticiens plutôt que fabriquées, référence attribuable à un expert.
- Limites : la référence vaut pour le **rappel**, pas pour la **précision** des autres passages
  rendus (jugement humain toujours requis) ; granularité au document ou à l'article, plus grossière
  que le fragment de #61 ; articles datés ou discutables (garder la date, écarter ceux dépassés par
  une réforme) ; biais vers les sujets en vogue, à compléter pour les corpus peu commentés
  (2016/680, 2018/1725, métadonnées) ; droit d'auteur : ne garder que la question reformulée, la
  liste des références citées, le lien et la date, jamais le texte de l'article.
- Coût : la relecture humaine porte sur la reformulation de la question et le rattachement des
  références aux identifiants du corpus (CELEX, `CNILTEXT…`, numéro d'article), plus rapide que
  l'écriture d'une référence de zéro ; à mesurer sur quelques articles avec le kit.
- Effet sur la recommandation : elle s'en trouve renforcée (jeu doré humain), et la piste réduit le
  coût de #60 sans changer la contrainte de nombre de #64.

**Veille des méthodes publiées (2026-11-15, résumés et extraits lus, articles complets non lus).**

| Travail | Méthode | Leçon pour nous |
| --- | --- | --- |
| [Legal RAG Bench](https://arxiv.org/html/2603.01710v1) (2026) | 100 questions écrites à la main, juge LLM pour la génération (99 % d'exactitude déclarée par les auteurs) | jeu doré humain ; la recherche est le premier facteur de qualité |
| [ClaimRAG-LAW](https://arxiv.org/html/2605.21071) (2026) | 317 questions validées par des experts, RGPD (anglais) et Code civil (français), contrôle au niveau de l'affirmation | source possible de questions RGPD (licence à vérifier) |
| [CanLegalRAGBench](https://arxiv.org/html/2605.30497v3) (2026) | requêtes générées par LLM depuis une décision, filtre LLM (≈ 20 % écartées), réponses vérifiées par des étudiants en droit | les métriques automatiques sous-estiment quand le corrigé est incomplet ; valider tout juge contre des humains |
| [BSARD](https://ar5iv.labs.arxiv.org/html/2108.11792) / [LLeQA](https://arxiv.org/pdf/2309.17050.pdf) (Maastricht) | vraies questions de citoyens, articles de loi rattachés par des juristes ; 1 868 questions en français | même logique que la piste « doctrine » ; droit belge, modèle de méthode seulement |
| [Abualhaija et al.](https://orbilu.uni.lu/bitstream/10993/51182/1/AASB-RE22-CRV.pdf) | 107 questions sur quatre règlements UE dont le RGPD | source possible pour `rgpd` (licence à vérifier) |
| [UMBRELA](https://arxiv.org/html/2406.06519v1), [TREC 2024 RAG](https://arxiv.org/abs/2411.08275) | juge LLM de pertinence ; classement des systèmes très corrélé au classement humain (77 runs), humains plus sévères en absolu | juge utilisable pour **comparer** deux versions, pas pour la borne publiée |
| [Vals AI](https://vals.ai/benchmarks/legal_research) (2025-2026) | 210 questions inspirées de cas pratiques, notation à l'aveugle par cabinets et universitaires ; banc plus récent noté par juge LLM | aucun concurrent ne publie de méthode plus simple et défendable |

Conséquence : la recommandation tient (borne publiée sur un échantillon validé par un humain), mais une **chaîne mixte** réduit le temps humain :

1. questions issues de la doctrine, sources citées comme corrigé (rappel) ;
2. questions générées par LLM depuis un passage (le passage est le corrigé), filtrées par un second LLM, **validées** par l'humain — pour les corpus peu commentés ; risque : vocabulaire recopié du texte, qui surestime le serveur, donc reformulation et mélange avec de vraies questions ;
3. juge LLM de pertinence réservé aux comparaisons entre versions (décisions McNemar), jamais à la borne ;
4. sous-ensemble annoté par l'auteur, base de la borne Wilson par corpus.

Le kit gagnerait une seconde mesure : le temps de **validation** d'une question générée, à côté du temps d'annotation complète.

**Compatibilité, méthode par méthode**

| Besoin | Aujourd'hui | Annotation complète | ARES / PPI |
| --- | --- | --- | --- |
| #61 précision/rappel au fragment | une attendue par question, `refSatisfaite` gère déjà `#` ; pas de précision@k ni de rappel@k | ajouter des **jeux d'attendues** multiples par question, `precisionAtK`/`recallAtK`, tests | ne dispense de rien pour le rappel : l'ensemble pertinent complet reste humain |
| #62 exactitude des citations | `search` rend `citations`, que `mesurer` jette ; aucune grille | conserver `citations` par question, grille à trois classes, taux + Wilson | « existe / n'existe pas » est jugeable ; « soutient » suppose une réponse, absente du serveur |
| #63 hors périmètre | les `piege` sont des pièges **dans** le corpus, pas des questions hors sujet | ajouter un type `hors_perimetre` et publier le taux de `confiant` ; peu coûteux | aucun gain : la mesure est déjà déterministe |
| #64 borne par corpus | Wilson sur les confiantes du `test`, un marqueur par CSV | agréger par corpus, publier « non mesurable » sous 30 confiantes | remplacer Wilson par un estimateur PPI (module + tests), un rectifier par corpus, et inscrire le juge dans le marqueur du `test` |
| Bornes et appariement | Wilson pour le niveau ; McNemar exact `b`/`c` (plancher 6) pour la différence | inchangé | PPI remplace Wilson pour le **niveau** ; McNemar reste, car la différence porte sur des issues déterministes, sans labels supplémentaires |

**Coût provisoire** (hypothèse 3 / 5 / 8 min par **question**, à remplacer par le kit) :

| Méthode | Volume | Heures | Ce que ça achète |
| --- | --- | --- | --- |
| Annotation complète, #60 | 150 questions | 7,5 / 12,5 / 20 | le jeu doré, 9 corpus couverts, bornes par corpus non atteignables |
| Annotation complète, #64 | 665 confiantes ≈ 1 280 questions | 64 / 107 / 171 | des bornes à 10 % par corpus |
| ARES, 150–300 annotations | 150–300 passages = 30–60 questions | 1,5–8 h d'annotation + ≥ 8 h de mise en place | une borne plus étroite sur 30–60 questions, soit 1,6–3,2 annotations par corpus : insuffisant pour #64 |
| ARES, borne à 10 points par corpus | 19 annotations × 19 corpus = 361 passages ≈ 72 questions | 3,6–9,6 h + ≥ 8 h | 19 bornes à 10 points, sous réserve d'un juge à 5 % d'erreur |

L'unité d'ARES est le **passage**, pas la question : à 5 passages par question, une annotation
coûte environ le cinquième d'une question. Si l'annotateur doit relire tout le contexte à chaque
passage, la fourchette ARES monte à 7,5–40 h pour 150–300 annotations ; le kit ne mesure que la
question, pas le passage isolé.

**Repli si le juge est peu corrélé** : annotation humaine seule, périmètre réduit aux corpus où 35
confiantes sont atteignables, et mention « non mesurable » avec sa raison pour les autres — la
clause est déjà dans #64. La mesure de l'accord juge/humain sur un échantillon tenu à l'écart est
le critère de bascule ; sans elle, aucun intervalle PPI n'est publiable.

**Confidence** : élevée sur les exigences d'ARES et de PPI (lues dans les articles, formules et
seuils recopiés) et sur les écarts avec le harnais (lus dans le code) ; moyenne sur le coût
d'annotation (non mesuré : c'est l'objet du kit) et sur l'accord d'un juge juridique francophone
(aucun juge mesuré ici).

**Remaining uncertainty** :

- Temps réel par question : le kit le donne, y compris le temps de recherche quand aucun passage
  ne répond. L'hypothèse 3 / 5 / 8 min n'a aucune preuve.
- Taux d'erreur d'un juge local sur la pertinence juridique : inconnu ; ARES ne fournit que des
  chiffres anglais et généralistes, et déclare le droit comme domaine à experts.
- Couverture de l'étiquette `confiant` par corpus après #24 : inconnue ; 51,9 % est la seule mesure
  (CNIL), et c'est elle qui fixe le nombre de confiantes pour 150 questions.
- Unité d'annotation : compter une question ou un passage change le coût d'ARES d'un facteur 5.
  Le kit compte la question, passages compris.
- Représentativité de l'échantillon humain : un tirage depuis le top 5 du système biaise le
  rectifier ; il faudrait un tirage indépendant, donc plus cher.

## Follow-up

- **#60** : écrire le jeu doré à la main, 150 questions réparties sur les 19 corpus ; viser 35
  confiantes par corpus si #64 doit publier une borne, sinon déclarer le périmètre réduit.
- **#61** : jeux d'attendues multiples par question, précision@k et rappel@k au fragment ; le
  rappel exige l'ensemble pertinent complet, pas le seul top 5.
- **#62** : conserver les `citations` rendues par `search`, grille à trois classes ; préciser que
  le serveur ne produit pas de réponse, donc que « soutient la réponse » devient « soutient le
  passage » ou exige une génération hors périmètre.
- **#63** : ajouter un type `hors_perimetre` au CSV et publier le taux de `confiant` ; c'est la
  seule story que le harnais couvre presque entièrement.
- **#64** : borner par corpus avec Wilson sur les confiantes ; PPI seulement après mesure de
  l'accord juge/humain (< 2 % à p = 0,02) et ≥ 19 annotations par corpus.
- **Décision utilisateur requise** : l'auteur choisit la méthode et remplace l'hypothèse de temps
  par les minutes du kit.
