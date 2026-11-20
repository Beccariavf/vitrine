# Direction artistique : décisions

Remplace la DA brutaliste « béton » (`aidd_docs/memory/design.md`, 2026-11-13). Rien n'est encore appliqué au site ; `design.md` sera réécrit à l'application.

## Positionnement

- Adjectifs : **attrayant, rigoureux, éditorial**.
- Référence principale : america.gov (même promesse : réponses tirées de sources officielles). S'en inspirer, ne pas l'imiter.
- Planche validée : `planche.html` (même dossier), publiée sur https://claude.ai/artifact/KCqQjY7by6q1LKBfH6iGeL.

## Décisions

| Sujet | Décision |
| --- | --- |
| Polices | Instrument Serif (400, titres forts seulement) + Inter (tout le reste). Auto-hébergées, aucune requête tierce. Police mono abandonnée ; chiffres en `tabular-nums`. |
| Couleurs | Fond blanc, surface `#F5F5F2`, encre `#0F1623`, encre douce = encre à 64 %, un seul accent bleu juridique `#1D3557`. |
| Familles de sources | Conservées (même sens), adoucies, en pastilles rondes seulement ; plus jamais en aplat d'en-tête. |
| Formes | Boutons en pilule, cartes arrondies (24–32 px), filets 1 px, ombres légères. Fin des angles droits, cadres 2 px et ombres dures. |
| Mode sombre | Accepté : jetons clair et sombre, contrastes testés dans les deux thèmes. |
| Mouvement | Accepté : montée en fondu du hero et survols doux, en CSS seul, coupés par `prefers-reduced-motion`. Toujours aucun JavaScript client. |
| Structure | Hero centré en grand serif, manifeste en serif, rangées alternées visuel / texte, veille en cartes ou liste à filets, pied de page en liens serif. |

## Écarté

- Logos d'institutions (CNIL, CJUE…) : laisseraient croire à un soutien.
- Barre de question fixe : pas tant que le connecteur n'est pas utilisable en ligne.
- 3D, animations lourdes.

## Points à vérifier à l'application

- `tests/contrastes.test.ts` : nouvelles paires, dans les deux thèmes (encre douce par opacité à calculer sur chaque fond).
- Façade du corpus : garder le calcul d'étages, adoucir le rendu.
- Veille dense : style « lecture » plus serré que l'accueil.
