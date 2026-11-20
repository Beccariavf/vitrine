# Direction artistique : décisions

Remplace la DA brutaliste « béton » (2026-11-13). Appliquée au site par la PR Beccariavf/vitrine#109 ; l'état courant fait foi dans `aidd_docs/memory/design.md` (section « Direction »).

## Positionnement

- Adjectifs : **attrayant, rigoureux, éditorial**.
- Référence principale : america.gov (même promesse : réponses tirées de sources officielles). S'en inspirer, ne pas l'imiter.
- Planche : `planche.html` (même dossier), publiée sur https://claude.ai/artifact/KCqQjY7by6q1LKBfH6iGeL.

## Méthode suivie

1. Positionnement et trois adjectifs, qui filtrent chaque choix.
2. Références analysées et mesurées (polices, couleurs, rayons, espacements d'america.gov).
3. Planche de style : polices comparées sur pièce, palette, composants, pages types.
4. Plan en cinq phases, exécuté (phases 3 et 4 en parallèle), contrôlé visuellement à 375 et 1 440 px, clair et sombre.
5. Itérations sur le site réel, puis mémoire (`design.md`) réécrite d'après le code livré.

## Décisions

| Sujet | Décision |
| --- | --- |
| Polices | Instrument Serif (400, titres forts seulement) + Inter (tout le reste). Auto-hébergées, aucune requête tierce. Mono réservée au bloc code ; chiffres en `tabular-nums`. |
| Couleurs | Fond blanc, surface `#F5F5F2`, encre `#0F1623`, encre douce `#656A72`, un seul accent bleu juridique `#1D3557`. Jaune des juridictions assombri en `#9C7419` pour tenir 3:1. |
| Familles de sources | Conservées (même sens), en pastilles rondes seulement ; plus jamais en aplat sous du texte. |
| Formes | Boutons en pilule, cartes arrondies (24–32 px), filets 1 px, ombres légères. Fin des angles droits, cadres 2 px et ombres dures. |
| Mode sombre | Suit le système, sans bascule ; contrastes testés dans les deux thèmes. |
| Mouvement | Montée en fondu du hero, survols doux, dérive lente du collage ; CSS seul, coupé par `prefers-reduced-motion`. |
| Espacement | « Une idée par écran » : `espace-section` (6 à 15 rem) entre sections, mesuré sur america.gov (~290 px). |
| Accueil | Hero centré sans surtitre, manifeste en serif, collage pleine largeur des sources à la place de la façade (cartes tirées des données au build, une photo du Conseil d'État, le bandeau sanction CNIL), rangée de vérification, dernières publications. |
| Façade du corpus | Gardée sur `/connecteur` seulement : le détail va à qui le cherche. |

## Écarté

- Logos d'institutions (CNIL, CJUE…) : marques protégées, laisseraient croire à un soutien.
- Barre de question fixe : pas tant que le connecteur n'est pas utilisable en ligne.
- 3D, animations lourdes.

## Risques assumés par l'utilisateur

- Bandeau sanction : copie de l'illustration de la CNIL (`sanction.svg`), sous licence CC BY-NC-ND (pas d'usage commercial, pas de modification), sur un site qui prépare une offre payante. Aucun crédit affiché.
- Photo du Conseil d'État : CC BY-SA 3.0, crédit affiché sous le collage.
