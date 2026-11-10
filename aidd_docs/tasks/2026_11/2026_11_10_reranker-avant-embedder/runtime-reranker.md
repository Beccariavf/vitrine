---
phase: 3
status: done
observed: 2026-11-10
machine: macOS arm64 (Apple Silicon), 16 GB RAM, Homebrew 7.0.12
---

# Runtime du reranker : faits mesurés

Tout ce qui suit a été observé sur cette machine le **2026-11-10** (UTC `13:33`–`13:5x`). Aucune valeur n'est reprise d'une documentation sans avoir été reproduite ici.

## 1. Refus des runtimes déjà installés

Date de l'observation : **2026-11-10T13:33:09Z**.

| Runtime                                     | Requête                         | Code   | Sens                            |
| ------------------------------------------- | ------------------------------- | ------ | ------------------------------- |
| Ollama 0.40.14 (`127.0.0.1:11434`)          | `POST /api/rerank`              | **404** | pas d'endpoint de rerank        |
| Ollama 0.40.14 (`127.0.0.1:11434`)          | `POST /v1/rerank`               | **404** | pas d'alias OpenAI non plus     |
| Unsloth Studio (`127.0.0.1:8888`, Python)   | `POST /v1/rerank`               | **404** | embeddings et chat seulement    |

Conclusion : aucun des deux ne peut servir un reranker sur cette machine.

## 2. Runtime retenu

```console
$ brew install llama.cpp          # → llama.cpp 0.9.0 (dépendances : libomp 23.1.5, ggml 0.29.0)
$ llama-server --version
version: 0.9.0 (build 12110, commit cd959bae9)
built with AppleClang 21.0.0.21000401 for Darwin arm64
```

Binaire : `/opt/homebrew/bin/llama-server`.

## 3. Modèle

| Élément      | Valeur                                                                 |
| ------------ | ---------------------------------------------------------------------- |
| Dépôt GGUF   | `ggml-org/Qwen3-Reranker-0.6B-Q8_0-GGUF` (Hugging Face)                |
| Fichier      | `qwen3-reranker-0.6b-q8_0.gguf`                                        |
| Taille       | 639 153 184 octets (610 Mio)                                            |
| Emplacement  | `~/.cache/vitrine-rerank/qwen3-reranker-0.6b-q8_0.gguf`                 |
| `sha256`     | `22c9979ce4fbcdc5acdc310c6641c32797eff1aa980b8f7a2db8a8ea23429a48`      |

Le `sha256` local est identique au `lfs.sha256` publié par l'API Hugging Face pour ce fichier : le téléchargement est intègre.

Obtenu par :

```console
$ curl -L -o ~/.cache/vitrine-rerank/qwen3-reranker-0.6b-q8_0.gguf \
    https://huggingface.co/ggml-org/Qwen3-Reranker-0.6B-Q8_0-GGUF/resolve/main/qwen3-reranker-0.6b-q8_0.gguf
```

## 4. Démarrage

```console
$ llama-server --reranking \
    -m ~/.cache/vitrine-rerank/qwen3-reranker-0.6b-q8_0.gguf \
    --port 8080
```

| Mesure                                              | Valeur          |
| --------------------------------------------------- | --------------- |
| Démarrage à froid (1er lancement, jusqu'à `/health` = `ok`) | ≈ 6,5 s |
| Démarrage à chaud (lancement suivant)                | 0,84 s          |
| `n_slots` / `n_ctx_slot` par défaut                  | 4 / 40 960      |
| Mémoire résidente après chargement (défauts)         | 5,04–5,19 Go    |

Sans `--reranking`, le serveur démarre mais l'endpoint échoue explicitement (voir §6).

## 5. Forme de la réponse

`POST http://127.0.0.1:8080/reranking` avec `{"query": "...", "documents": ["...", "...", "..."]}` :

```json
{
  "model": "/Users/val/.cache/vitrine-rerank/qwen3-reranker-0.6b-q8_0.gguf",
  "object": "list",
  "usage": { "prompt_tokens": 295, "total_tokens": 295 },
  "results": [
    { "index": 0, "relevance_score": 0.9961873888969421 },
    { "index": 1, "relevance_score": 0.006530832499265671 },
    { "index": 2, "relevance_score": 3.068277510465123e-05 }
  ]
}
```

Faits vérifiés :

- **un score par document** : 3 documents envoyés → 3 résultats, 50 → 50 (vérifié à chaque appel de la mesure de latence) ;
- `top_n` absent rend **tous** les documents ;
- chaque `relevance_score` est un **nombre fini** (`math.isfinite` → vrai) dans `[0, 1]` ;
- **les résultats reviennent dans l'ordre d'entrée, pas triés.** Requête dont le meilleur document est en dernière position → `[{index:2, 0.9991}, {index:0, 0.0074}, {index:1, 0.0011}]`. L'appelant doit trier lui-même sur `relevance_score` ;
- les alias `/rerank`, `/v1/rerank`, `/v1/reranking` répondent 200 avec le même corps ;
- les scores ne sont **pas des cosinus** : ils ne se comparent ni aux seuils de `niveauConfiance`, ni entre modèles.

## 6. Cas limite : serveur sans `--reranking`

```console
$ llama-server -m ~/.cache/vitrine-rerank/qwen3-reranker-0.6b-q8_0.gguf --port 8081
$ curl -X POST http://127.0.0.1:8081/reranking -d '{"query":"effacement","documents":["a","b"]}'
HTTP 501
{"error":{"code":501,"message":"This server does not support reranking. Start it with `--reranking`","type":"not_supported_error"}}
```

L'échec est explicite et ne rend aucun score. Un serveur sans le drapeau (ou un modèle non reranker) ne peut donc pas être pris pour un reranker silencieusement.

## 7. Contrôle français

Question : **« droit à l'effacement »**. Trois passages réels du corpus, tous < 2 000 caractères.

| Position | Passage                                                                 | Longueur | `relevance_score` |
| -------- | ----------------------------------------------------------------------- | -------- | ----------------- |
| 1        | RGPD, article 17 — `32016R0679#art_17` (tronqué à 1 999 c, il en fait 3 104) | 1 999    | **0,999082**      |
| 2        | CNIL, SAN-2022-027 — `CNILTEXT000046977994#f49` (cookies)                | 1 413    | 0,007420          |
| 3        | CNIL, avis 2017-114 — `CNILTEXT000045372645#f3` (Linky)                  | 1 464    | 0,001125          |

Le passage d'effacement sort **premier**, avec un écart de deux ordres de grandeur : le modèle sépare nettement le cas du ticket. Passages textuels envoyés, hors troncature de l'article 17, tels quels depuis `data/corpus/rgpd/unites.jsonl` et `data/corpus/cnil/unites.jsonl`.

## 8. Latence : 50 candidats

Taille des fragments CNIL recalculée sur `data/corpus/cnil/unites.jsonl` (29 299 unités, toutes de niveau `fragment`, maximum 1 500 caractères) : **médiane 1 296 c, p90 1 495 c**. Les chiffres du plan sont confirmés.

Charge envoyée : 50 passages réels distincts tronqués à la taille cible, question « droit à l'effacement des données », une passe de chauffe puis trois passes mesurées, configuration par défaut (`n_slots` 4, `n_ctx_slot` 40 960, port 8080).

| Taille des passages | Passes mesurées (ms)    | **Médiane**  | Jetons d'entrée |
| ------------------- | ----------------------- | ------------ | --------------- |
| 1 296 c (médiane)   | 3 540 · 3 646 · 3 701   | **3 646 ms** | 21 367          |
| 1 495 c (p90)       | 4 226 · 4 217 · 4 332   | **4 226 ms** | 23 986          |

Une série antérieure sur le même réglage a donné 3 522 ms et 4 023 ms : la dispersion entre séries est de l'ordre de 5 %, la latence se lit donc en secondes, pas en dixièmes. Coût indicatif : ≈ 73 ms par passage à 1 296 c, ≈ 85 ms à 1 495 c.

### Effet de la configuration sur la mémoire

Même modèle, même requête de 50 × 1 296 c, trois lancements :

| Configuration                            | Mémoire résidente | Médiane 50 × 1 296 |
| ---------------------------------------- | ----------------- | ------------------ |
| défauts (`n_ctx_slot` 40 960 × 4 slots)  | 5,04–5,19 Go      | 3 646 ms           |
| `--ctx-size 16384 --parallel 4`          | 2,49 Go           | 4 145 ms           |
| `--ctx-size 4096 --parallel 1`           | 1,17 Go           | 3 811 ms           |

Le contexte par défaut (4 × 40 960 jetons) domine la mémoire : 0,6 Go de poids pour 5 Go résidents. Un réglage explicite divise la mémoire par deux à quatre au prix de 0 à 15 % de latence. C'est un fait à trancher en phase 4, pas ici.

## 9. Limites à retenir

1. **Un seul serveur, un seul modèle à la fois.** `llama-server` charge le GGUF dans le processus et le garde : le port 8080 est occupé tant que le processus vit, et changer de modèle impose de l'arrêter puis d'en relancer un. Deux rerankers ne cohabitent pas sur le même port.
2. **Mémoire non négligeable** : 1,2 à 5,2 Go selon le contexte, sur 16 Go. Unsloth Studio occupe déjà la machine avec deux `llama-server` (`harrier-oss-v1-0.6b` entre autres).
3. **La latence est un coût réel** : 3,6 s pour 50 candidats, contre quelques millisecondes pour la recherche dense actuelle. Le rerank ne peut pas être activé par défaut sans que la phase 5 le mesure.
4. **Les scores ne sont pas des cosinus** : une seule échelle de confiance doit rester dans le produit, celle de la recherche dense.
5. **Les résultats ne sont pas triés** : le client trie sur `relevance_score`.
6. Non vérifié ici : un second reranker (`bge-reranker-v2-m3`) n'a pas été lancé ; le comportement de `top_n` explicite n'a pas été testé.

## 10. Relancer le serveur

```console
$ llama-server --reranking \
    -m ~/.cache/vitrine-rerank/qwen3-reranker-0.6b-q8_0.gguf \
    --port 8080 &
$ until curl -sf http://127.0.0.1:8080/health | grep -q ok; do sleep 0.25; done   # ≈ 1 s à chaud
```

Arrêt : `pkill -f "llama-server --reranking -m .* --port 8080"`.

Le serveur a été arrêté après la mesure ; le port 8080 est libre. Les deux serveurs d'Unsloth Studio (ports éphémères, processus préexistants) n'ont pas été touchés.
