# Design

La langue visuelle : jetons, typographie, modules et conventions. Ce que ça ressemble, pas comment c'est codé.

## System

- Tailwind via le plugin Vite d'Astro ; les jetons vivent dans le bloc `@theme` de `src/styles/global.css`.
- Aucune bibliothèque de composants : deux pages et un layout partagé (`src/layouts/Base.astro`).
- Aucune web font, aucun JavaScript côté client : le rendu vient du HTML et du CSS seuls.

## Tokens

- Couleurs : béton `#E7E2D7`, papier `#F4F0E8`, encre `#121212`, rouge `#C62828`, bleu `#1E4E79`, jaune `#E0A82E`, gris `#57534E`.
- Typographie : display Helvetica Neue puis sans système, graisse 700, interlettrage serré ; corps en sans système ; labels, dates et chiffres en mono.
- Formes : rayon 0 partout, bordures de blocs 2 px en encre, filets 1 px, ombres dures `4px 4px 0` et `6px 6px 0`, aucun dégradé, aucun flou.
- Règle 80/20 : béton et encre dominent ; la couleur reste un accent, sauf les en-têtes de la grille de veille.

## Modules

- En-tête : wordmark `VITRINE_` en mono, navigation encadrée, page courante en aplat encre.
- Accueil « Registre » : grand titre, bloc rouge de dernière publication, bandeau de chiffres, bloc `pipeline.log` en encre, méthode numérotée, produits en cartes avec filet rouge, bleu ou jaune.
- Veille : bascule grille / liste sans JavaScript, grille par défaut. Grille de cartes sur 3 colonnes ; liste de lecture centrée à 56rem.
- Un sélecteur compact de matières (pills, toutes actives par défaut) précède la liste et masque les publications des matières décochées, sans JavaScript. Une ligne d'explication avec un « i » rappelle le geste.
- Chaque publication porte un badge de matière rouge et son label de source.
- Chaque carte porte un en-tête coloré avec le grand jour et la source, puis un corps papier avec titre, résumé, références et « Lire ». Le cycle rouge → bleu → jaune → béton casse les colonnes uniformes ; le béton joue la fenêtre neutre.
- Les références juridiques sont des pastilles mono à filet 1 px sous le résumé : instrument + articles, jamais un texte long sur la couleur.
- La tête de veille affiche le compte des publications et la dernière date ; le sélecteur porte les matières actives en lecture seule. Le pied de page crédite Légifrance, la Cour de cassation et EUR-Lex (CC BY 4.0).
- Le texte long n'est jamais posé sur un aplat coloré : les en-têtes colorés ne portent que le jour et la source.
- Survol : translation de 2 px et ombre dure qui grandit ; ligne de veille sur papier ; le texte courant ne change jamais de couleur, seuls les contrôles de navigation inversent encre et papier.
- Aucun arrondi, aucune animation hors survol.

## Accessibility

- Contrastes mesurés : encre sur béton 14,50:1 ; gris sur béton 5,91:1 ; encre sur papier 16,48:1 ; gris sur papier 6,71:1 ; rouge sur papier 4,95:1 ; papier sur rouge 4,95:1 ; papier sur bleu 7,63:1 ; encre sur jaune 8,75:1.
- Rouge sur béton plafonne à 4,35:1 : le rouge reste réservé aux grands textes, aplats et filets ; le texte courant reste en encre ou gris.
- Focus clavier visible en contour encre de 2 px ; `aria-current` sur la navigation ; `aria-label` sur les liens de carte ; dates portées par `<time>`.
