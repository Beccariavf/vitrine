---
status: approved
---

# Sélection par matière et sources officielles

Un visiteur choisit sa matière — données personnelles, IA, cybersécurité, données non personnelles — et voit une veille sourcée auprès des autorités, de la CJUE et de Légifrance ; la démonstration reste locale.

## Clear

| Matière | Couvre | Sources |
| --- | --- | --- |
| Données personnelles | RGPD, loi Informatique et Libertés, ePrivacy | CNIL, CEPD, ARCEP |
| IA | AI Act | CNIL, Commission numérique |
| Cybersécurité | NIS2, CER, DORA, CRA | ANSSI (flux « actualité » seul) |
| Données non personnelles | Data Act | ARCEP, Commission numérique |
| Transverse | — | CJUE (EUR-Lex), Légifrance CETAT |

- Quatre matières, pas les règlements un à un. La CJUE et le Conseil d'État sont transverses : un seul flux ou une recherche, filtré par matière via les instruments cités.
- CNIL alimente données personnelles et IA ; ANSSI alimente cybersécurité via le flux « actualité » seul.
- PISTE/Légifrance : CETAT (Conseil d'État) et Judilibre pour la jurisprudence française en tranche 2. La CJUE reste sur EUR-Lex. Pas de JORF : les transpositions sont couvertes par les actualités des autorités, qui renvoient au texte.
- Sélection locale, réservée au propriétaire ; pages publiques en lecture seule ; aucun visiteur, aucun serveur.
- Chaque entrée porte ses matières, calculées à l'ingestion.
- Résumés déterministes : description officielle nettoyée, 200 caractères. Aucun modèle, aucun coût. Le titre officiel suffit quand la source n'a pas de résumé.
- Passe hebdomadaire incrémentale : curseur de dernière passe, cache par identifiant + hash, déduplication sur identifiants stables (CELEX, id CETAT, id Judilibre). Pas de fusion floue entre sources.
- CETAT : recherche par matière sur une fenêtre de 30 jours, déduplication par `id` ; le texte intégral n'est consulté que pour les décisions retenues.
- Judilibre : recherche par matière sur une fenêtre de 30 jours, car les décisions sont publiées avec du retard ; déduplication par `id`.
- Quotas PISTE : un jeton OAuth par passe, plafond d'appels, journal des appels ; échec partiel signalé.
- Une source en panne n'emporte pas les autres ; le snapshot brut reste la preuve.

## Assumed

- DORA et CRA sont couverts dans « cybersécurité », non sélectionnables séparément.
- Pas de veille législative française : les transpositions sont couvertes par les actualités des autorités, qui renvoient au texte.
- Pas de résumé LLM tant que les sources fournissent un titre ou un sommaire exploitable.
- Les secrets PISTE vivent hors du dépôt : `.env` local, secrets GitHub Actions pour le cron.
- CETAT et Judilibre sont en tranche 2 ; leurs accès sont confirmés.

## Open

- Quotas Légifrance : chiffres à relever dans le tableau de bord PISTE à la première passe.
