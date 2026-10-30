# Guide pratique AIDD — le 20 % utile

> But : savoir **quelle suite de skills lancer** selon le besoin, sans jamais te demander « laquelle des 51 ».
> Périmètre : **13 skills sur 51**. Le reste est listé en fin de guide et n'a pas à être appris.

---

## 0. Ton outillage complet (13 skills)

| Rôle | Skill | Fréquence |
| --- | --- | --- |
| Boussole | `00-onboard` | quand tu es perdu |
| Démarrer | `01-bootstrap`, `00-repo-init`, `02-project-memory` | 1 fois |
| Cadrer | `01-brainstorm` | si l'idée est floue |
| Livrer (tout-en-un) | `01-sdlc` | le cas normal |
| Livrer (à la main) | `01-plan`, `02-implement`, `03-assert`, `05-review` | quand tu veux le contrôle |
| Sortir | `01-commit`, `02-pull-request` | fin de tâche |
| Réparer | `08-debug` | quand ça casse |
| Capitaliser | `10-learn` | après une décision |

---

## 1. La seule décision à prendre : one-shot ou pas à pas

```
La demande est claire et bornée (quoi changer + résultat observable) ?
├─ NON  → @01-brainstorm, puis reviens ici
└─ OUI
   ├─ Micro-tâche mécanique (1 fichier, < 30 min)  → fais-la, puis @01-commit
   ├─ Feature complète, tu acceptes 3 pauses        → @01-sdlc interactive
   ├─ Feature complète, tu veux voir chaque artefact → @01-plan → @02-implement → @03-assert → @05-review
   └─ Ça casse                                      → @08-debug
```

**Règle d'or : `01-sdlc` orchestre et délègue ; les 4 skills manuelles, c'est toi qui orchestres. Jamais les deux sur la même feature.**

---

## 2. Les parcours, dans l'ordre de la vie d'un projet

### P1 — Projet neuf (dossier vide, pas de git) ← ton cas actuel

```
@01-bootstrap "SaaS de vitrine de projets, comptes utilisateurs, publication publique"
@00-repo-init
@02-project-memory
@01-sdlc interactive "un visiteur peut voir un projet via /p/<slug>, avec titre et description indexables"
```

**Preuves attendues :** `aidd_docs/INSTALL.md` (stack + arborescence) → `git log --oneline` = 1 commit bootstrap + `CONTRIBUTING.md` → `aidd_docs/memory/` rempli + bloc `aidd_project_memory` dans `AGENTS.md` → puis la boucle normale.

> `01-bootstrap` est le **seul** point d'entrée prévu pour un projet neuf. Il ne scaffolde aucun code : il écrit la décision d'architecture.

### P2 — Dépôt existant, framework fraîchement installé

```
@02-project-memory
@01-sdlc interactive "<une petite feature réelle>"
```

La première feature sert de **calibration** : c'est là que tu corriges la mémoire (conventions, commandes de test, style de commit) tant que c'est encore bon marché.

### P3 — Idée floue / besoin mal défini

```
@01-brainstorm "je veux un truc pour partager mes projets"
```

Puis, selon la sortie : `@01-plan <brief>` (tu gardes la main) ou `@01-sdlc interactive <brief>` (tu délègues).

`01-brainstorm` ne planifie **jamais** et ne code **jamais** : il ne fait que poser les bonnes questions et produire un brief.

### P4 — Feature standard (le cas 80 %) : one-shot

```
@01-sdlc interactive "un visiteur peut filtrer les projets par tag, et l'URL conserve le filtre"
```

Ce que tu fais, concrètement :

| Pause | Ce qu'on te montre | Ta réponse utile |
| --- | --- | --- |
| 1. Contrat | le besoin + les critères observables | « OK » / « il manque le cas tag vide » |
| 2. Plan | phases, fichiers touchés | « OK » / « fusionne 2 et 3 » |
| 3. Résultat | diff + preuves + revue | « OK, ouvre la PR » / « refuse : le cas X n'est pas couvert » |

Sans `interactive`, le mode est `auto` : **aucune pause**, il va jusqu'à la draft PR.

### P5 — Feature où tu veux la main : pas à pas

```
@01-plan "un visiteur peut filtrer les projets par tag, et l'URL conserve le filtre"
@02-implement aidd_docs/tasks/2026_10/2026_10_30_filtre-tags/plan.md
@03-assert
@05-review
@02-pull-request
```

- `01-plan` écrit `plan.md` + `phase-N.md` et **ne code pas**.
- `02-implement` crée la branche, code, et **commit une fois par tâche validée** → pas besoin de `01-commit` ensuite, sauf changements hors plan.
- `03-assert` **corrige** jusqu'au vert ; `05-review` **ne corrige jamais**, il juge.
- `02-pull-request` crée toujours une **draft**.

Choisis cette voie quand : la feature touche l'architecture, tu veux relire le plan avant qu'une ligne soit écrite, ou tu veux comprendre ce que fait le framework.

### P6 — Bug

Une seule skill, mais trois formulations pour trois besoins :

| Ta phrase | Action déclenchée | Ce que ça fait |
| --- | --- | --- |
| « reproduis et corrige : le filtre renvoie 0 résultat si le tag a un espace » | `reproduce` | reproduit, corrige en TDD, branche + PR |
| « pourquoi le filtre renvoie 0 résultat ? » | `debug` | hypothèses validées, **s'arrête à la cause** |
| « je suis bloqué, les correctifs précédents n'ont rien donné » | `reflect-issue` | rouvre l'espace de recherche, instrumente les logs |

Puis `@01-commit` si la correction n'a pas été committée.

### P7 — Reprise après interruption

```
@02-implement aidd_docs/tasks/2026_10/2026_10_30_filtre-tags/plan.md
```

Le statut vit dans le frontmatter du plan (`pending → in-progress → implemented`). Il reprend là où il s'est arrêté, pas au début.

### P8 — Perdu / « je fais quoi maintenant ? »

```
@00-onboard
```

Il inspecte l'état réel du projet et propose **la prochaine** étape (et refuse de lancer une étape guidée sans ta réponse).

---

## 3. Les 3 mots qui changent le résultat

1. **`interactive`** — doit être le **premier mot** de la demande. Sinon `auto`.
2. **La source** — `@01-sdlc interactive #42` ou une URL d'issue : la zone Frame résout le ticket au lieu d'inventer le besoin.
3. **Le refus** — dire non à une pause n'est pas « recommence » : c'est un finding routé vers l'artefact concerné. Refus du contrat → Frame. Refus du plan → Deliver. Refus du résultat → Deliver (ou Frame si ça change *ce qu'on construit*).

---

## 4. Les 8 enchaînements à ne jamais faire

| ❌ | Pourquoi |
| --- | --- |
| `@01-sdlc` puis `@01-plan` | double planification, deux plans concurrents |
| `@01-sdlc` puis `@05-review` | le checker indépendant l'a déjà fait |
| `@02-implement` sans plan | il s'arrête : `plan not found` |
| `@01-commit` juste après `@02-implement` | les commits sont déjà faits par tâche |
| `@03-assert` pour « écrire des tests » | il vérifie ; pour écrire, c'est `06-test` |
| `@05-review` en espérant une correction | il ne corrige jamais, il rapporte |
| `@01-sdlc auto` sur une demande floue | il tranche à ta place, dont des choix durables |
| 3 skills d'affilée sans lire l'artefact | tu perds tout le bénéfice du contrôle |

---

## 5. Checkpoints : ce que tu dois voir avant de continuer

| Après | Preuve |
| --- | --- |
| `01-bootstrap` | `aidd_docs/INSTALL.md` : stack + arborescence + étapes d'install |
| `00-repo-init` | `git log --oneline` = 1 commit bootstrap, `CONTRIBUTING.md` présent |
| `02-project-memory` | `aidd_docs/memory/` non vide + `<!-- aidd_project_memory:start -->` dans `AGENTS.md` |
| `01-plan` | `plan.md` + `phase-N.md`, script `validate-plan.cjs` → `VALID` |
| `02-implement` | plan `status: implemented`, 1 commit par tâche |
| `03-assert` | sortie verte des commandes du projet (pas une affirmation) |
| `05-review` | rapport avec verdict explicite |
| `02-pull-request` | une **draft** PR, URL retournée |

---

## 6. Entretien : 3 gestes, pas plus

- **`@10-learn`** après chaque feature où tu as tranché quelque chose (convention, arbitrage, piège). C'est ce qui garde la mémoire vraie.
- **`@02-project-memory refresh`** quand l'architecture bouge (nouveau module, nouveau runner de tests, changement de stack).
- **Mise à jour du framework** : remplacer `.opencode/`, conserver `opencode.json` fusionné, puis `/reload`.

Un hook rafraîchit le **bloc de liens** dans `AGENTS.md` à chaque session, mais **ne réécrit jamais le contenu** de la mémoire.

---

## 7. Les 38 skills exclues (et le jour où elles servent)

| Groupe | Skills | À ignorer jusqu'à… |
| --- | --- | --- |
| Générateurs de contexte | `03-context-generate`, `04-skill-generate`, `05-rule-generate`, `06-agent-generate`, `07-command-generate`, `08-hook-generate` | tu veux créer tes propres skills/règles/agents |
| Suite PM / backlog | `02-user-stories`, `03-prd`, `04-spec`, `05-spike`, `06-product-brief`, `07-epic`, `08-three-amigos`, `09-defect`, `10-task`, `02-backlog` | tu pilotes un vrai backlog à plusieurs |
| Automatisation asynchrone | `00-async-dev` | tu as GitHub + CI + des issues à traiter en tâche de fond |
| QA d'acceptation | `01-acceptance-qa` | tu dois produire des preuves vidéo de recette |
| Télémétrie | `00-init`, `01-usage` | tu veux mesurer tes tokens par tâche |
| Ponctuels utiles | `04-audit`, `07-refactor`, `09-mermaid`, `10-batch`, `09-for-sure`, `11-explore`, `12-cook`, `05-resolve-conflict`, `03-release-tag`, `01-ticket-info` | le besoin nommé apparaît (audit, refacto, diagramme, conflit…) |
| Alpha / smoke test | `01-hello` | jamais, en pratique |

---

## 8. Règles de budget (tokens et attention)

- **1 feature = 1 session.** La mémoire et le plan vivent sur disque, pas besoin de trainer le contexte.
- **`01-sdlc` coûte plus cher** que les 4 skills manuelles : il spawn plusieurs sous-agents. Pour une petite feature, la voie manuelle est plus économique.
- **Ne recharge jamais la mémoire à la main** : le bloc `AGENTS.md` le fait.
- **Ne relance pas une skill « pour être sûr »** : chaque étape écrit sa preuve. Lis la preuve.
