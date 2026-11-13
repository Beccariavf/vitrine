# Design

La langue visuelle : jetons, typographie, modules et conventions. Ce que ça ressemble, pas comment c'est codé.

## System

- Tailwind via le plugin Vite d'Astro ; les jetons vivent dans le bloc `@theme` de `src/styles/global.css`.
- Aucune bibliothèque de composants : les pages, un layout partagé (`src/layouts/Base.astro`) et des composants maison (`src/components/Demo.astro`, `src/components/Legende.astro`).
- Une seule police servie : Archivo Variable (`@fontsource-variable/archivo` épinglé à `5.3.0`, licence OFL-1.1, axes `wdth` 62–125 % et `wght` 100–900), auto-hébergée et importée par `src/layouts/Base.astro` (`wdth.css`) ; aucune requête tierce, `font-display: swap`. Le corps reste en police système. Aucun JavaScript côté client : le rendu vient du HTML et du CSS seuls.

## Tokens

- Couleurs : béton `#E7E2D7`, papier `#F4F0E8`, encre `#121212`, rouge `#C62828`, bleu `#1E4E79`, jaune `#E0A82E`, vert `#2F6B4F` (Cité radieuse), gris `#57534E` ; socle sombre réservé au pied de page : béton sombre `#2B2A27` et pierre `#B8B2A7` pour son texte secondaire.
- Typographie : display Archivo Variable, repli Helvetica Neue puis sans système ; `h1` condensé (`font-stretch` 72 %), graisse 850, interlettrage -0,035em, interligne 0,95, taille plafonnée en mobile par les classes de page, mots longs coupés plutôt que débordants ; `h2`–`h4` en largeur 88 %, graisse 700 ; corps en sans système ; labels, dates et chiffres en mono.
- Formes : rayon 0 partout, bordures de blocs 2 px en encre, filets 1 px, ombres dures `4px 4px 0` et `6px 6px 0`, aucun dégradé, aucun flou.
- Règle 80/20 : béton et encre dominent ; la couleur reste un accent, sauf les en-têtes de la grille de veille.
- Une couleur = une famille de source, la même partout (`src/lib/familles.ts`, `familleDeSource`) : bleu textes (RGPD, AI Act, LIL) ; rouge autorités françaises (CNIL, ANSSI, ARCEP, ARCOM) ; vert Union européenne (CEPD, CJUE, Commission, DMA) ; jaune juridictions françaises (Conseil d'État, Cour de cassation) ; béton et encre pour une source inconnue (« autre »). Texte papier sur bleu, rouge et vert, encre sur jaune et béton.
- La couleur ne porte jamais seule le sens : une légende (`components/Legende.astro`, pastilles carrées à filet encre et libellés mono) nomme les quatre familles, une seule par page, et chaque source garde son libellé texte.

## Modules

- En-tête : wordmark « VITRINE » en police de titre condensée (72 %, graisse 850), nom provisoire, navigation encadrée (« Connecteur » puis « Veille »), page courante en aplat encre et `aria-current="page"`.
- Accueil réorganisé autour du connecteur : hero (promesse « Une IA juridique qui cite ses sources. », sous-titre au vouvoiement, bouton encre « Découvrir le connecteur » vers `/connecteur`, lien secondaire « Consulter la veille »), démo compacte dans la grille du hero quand elle existe (à droite en `lg`, sous le texte en mobile ; sans démo, aucun emplacement vide), bandeau papier « Sources du connecteur » qui liste les collections de `data/corpus/` (lues par `src/lib/corpus.ts`) en pastilles mono à filet 1 px, avec un lien « Dates par collection » vers la couverture de `/connecteur` (une date globale masquerait les collections plus anciennes ; bandeau omis sans collection), puis « Dernières publications » : les trois plus récentes de la veille en rangées compactes (jour en mono, source, titre lié en nouvel onglet) et le lien « Toute la veille ». Chaque publication porte une pastille carrée de la couleur de sa famille devant son libellé de source, et la légende des familles suit la liste. Ni chiffres non mesurés, ni `pipeline.log`, ni cartes produits.
- Connecteur (`/connecteur`, `src/pages/connecteur.astro`) : statut « En préparation » en mono, titre et sous-titre au vouvoiement ; démo complète si elle existe ; trois étapes numérotées (ajouter le connecteur, poser vos questions, chaque réponse cite sa source officielle) ; tableau papier de couverture (collection, documents, « À jour au » ou « texte consolidé » pour RGPD et AI Act) suivi d'une ligne sur le hors-périmètre ; bloc `pipeline.log` en encre avec `npm run corpus:sync` et `npm run mcp`, sans chiffre ; transparence (code et corpus ouverts, lien GitHub) ; action « Consulter la veille » et mention d'aide à la recherche. Aucune offre ni prix.
- Démo avant / après (`src/components/Demo.astro`, données lues par `src/lib/demo.ts`) : une capture réelle, jamais fictive, rendue seulement si `src/demo/demo.json` existe. En-tête papier avec la question, la date de capture et le modèle en mono ; réponse avec connecteur sur papier à filet rouge gauche, suivie des sources en pastilles mono à filet 1 px liées au texte officiel. Variante compacte dans le hero de l'accueil (question, réponse avec connecteur, sources) ; variante complète en deux colonnes (sans / avec) et mention « Capture réelle, non retouchée. ». Le texte des réponses reste sur papier, garde ses retours à la ligne et se coupe n'importe où plutôt que de déborder.
- Pied de page signé sur toutes les pages : « Valentin Fouich · Juriste en droit du numérique », la mention « Outil d'aide à la recherche, ne remplace pas l'analyse d'un professionnel du droit », les crédits de sources et le lien GitHub.
- Veille : bascule grille / liste sans JavaScript, grille par défaut. Grille de cartes sur 3 colonnes ; liste de lecture centrée à 56rem.
- Un sélecteur compact de cinq matières (pills, toutes actives par défaut) précède la liste et masque les publications des matières décochées, sans JavaScript. Une ligne d'explication avec un « i » rappelle le geste. À 375 px, une media query réduit padding, taille et interlettrage pour tenir sur deux lignes.
- Chaque publication porte un badge de matière rouge et son label de source.
- Chaque carte porte un en-tête coloré avec le grand jour et la source, puis un corps papier avec titre, résumé, références et « Lire ». L'en-tête prend la couleur de la famille de sa source (`data-source`, `data-famille`) ; la légende des familles se tient sous la tête de veille.
- La carte n'est pas un lien unique : le titre, « Lire » et chaque pastille de référence sont des liens distincts, tous ouverts dans un nouvel onglet (`target="_blank"`, `rel="noopener"`) pour ne pas quitter la veille. L'en-tête et les matières ne sont pas cliquables.
- Les références juridiques sont des pastilles mono à filet 1 px sous le résumé : libellé court de l'instrument puis articles (`RGPD · art. 5`, `LIL · art. 82`, `CPCE · art. L. 34-5`), jamais un texte long sur la couleur. Le libellé complet de l'instrument est porté par `title`, au survol. Une pastille connue ouvre son texte officiel ; un instrument inconnu reste un texte, avec son libellé entier. Une décision de la Cour de cassation sans référence n'est pas publiée.
- La tête de veille affiche le compte des publications et la dernière date ; le sélecteur porte les matières actives en lecture seule. Le pied de page crédite Légifrance, la Cour de cassation et EUR-Lex (CC BY 4.0).
- Le texte long n'est jamais posé sur un aplat coloré : les en-têtes colorés ne portent que le jour et la source.
- Survol : translation de 2 px et ombre dure qui grandit ; ligne de veille sur papier ; le texte courant ne change jamais de couleur, seuls les contrôles de navigation inversent encre et papier.
- Aucun arrondi, aucune animation hors survol.

## Accessibility

- Contrastes mesurés, verrouillés par `tests/contrastes.test.ts` (lit les jetons de `global.css`) : encre sur béton 14,50:1 ; gris sur béton 5,91:1 ; encre sur papier 16,48:1 ; gris sur papier 6,71:1 ; rouge sur papier 4,95:1 ; papier sur rouge 4,95:1 ; papier sur bleu 7,63:1 ; papier sur vert 5,54:1 ; encre sur jaune 8,75:1 ; sur béton sombre : papier 12,63:1, jaune 6,70:1, pierre 6,81:1.
- Interdits sur béton sombre : gris (1,88:1) et rouge (2,55:1).
- Rouge sur béton plafonne à 4,35:1 : le rouge reste réservé aux grands textes, aplats et filets ; le texte courant reste en encre ou gris.
- Focus clavier visible en contour encre de 2 px ; `aria-current` sur la navigation ; `aria-label` sur les liens de carte ; dates portées par `<time>`.
