# Acceptance QA: Veille par matière

- **Verdict**: blocked
- **Source**: `aidd_docs/tasks/2026_10/2026_10_31_veille-matieres/spec.md`
- **Candidate**: `veille/matieres-piste`, `http://localhost:4321/veille`
- **Run**: 2026_10_31

## Out of interface

- « La page de veille présente les matières actives, les instruments couverts et les sources de chacune » : le bloc textes/sources a été retiré à la demande du propriétaire ; le sélecteur et les badges restent observables.
- « Aucune page publique ne charge de JavaScript » : vérifié dans le HTML généré (0 `<script>`), pas un parcours navigateur.
- « Une panne d'une source laisse les autres publications en place » : non observable dans l'interface.

## Scenarios

| Scenario | Criteria | Expected | Actual | Verdict | Duration | Evidence |
| -------- | -------- | -------- | ------ | ------- | -------- | -------- |
| Choisir une matière | Une matière décochée masque ses publications ; recochée, elles reviennent ; les badges et liens officiels restent visibles | 46 publications ; décocher « Données personnelles » masque la carte FNAC et laisse le cyber visible ; recocher restaure 46 ; lien Cour de cassation officiel ; zéro erreur console | 46 → 16 → 46 publications ; carte FNAC masquée ; carte cyber visible ; lien `courdecassation.fr/decision/...` ; zéro erreur console | pass | n/a | Exécution navigateur, pas de WebM (ffmpeg absent) |

## Rejected

- Preuve vidéo — `ffmpeg` et `ffprobe` absents ; aucun WebM produit. Le parcours produit est vérifié, la preuve média est bloquée.

## Findings

Aucun écart produit observé.
