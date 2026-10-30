# Brief — Refonte visuelle brutaliste

## Intention

Un avocat en droit du numérique qui prouve sa maîtrise technique. Le site doit inspirer la **rigueur**, pas la startup. Brutalisme **atténué** : angles, bordures franches, ombres dures, grille visible, couleur en accent — jamais en ambiance.

Référence : `ai-driven-dev.fr`. On emprunte sa **structure** (wordmark terminal, chiffres, blocs de preuve, sections numérotées), pas son volume marketing.

## Palette « Cité Radieuse »

| Rôle | Hex | Usage |
| --- | --- | --- |
| Béton | `#E7E2D7` | fond général |
| Papier | `#F4F0E8` | surfaces, cartes |
| Encre | `#121212` | texte, bordures |
| Rouge | `#C62828` | veille, accents, liens |
| Bleu | `#1E4E79` | MCP |
| Jaune | `#E0A82E` | plugin |

Règle : **80 % béton/encre, 20 % couleur**. Un seul aplat coloré par section.

## Typographie

- **Display** : `Helvetica Neue, Helvetica, Arial, sans-serif`, graisse 700, interlettrage `-0.02em`, tailles 56 / 40 / 28 px.
- **Texte** : sans système, 16 px, interligne 1.6.
- **Labels, dates, chiffres** : `ui-monospace, SFMono-Regular, Menlo, monospace`, 11-12 px, majuscules, interlettrage `0.12em`.
- **On abandonne le serif** : il adoucit ce qu'on veut anguleux.

## Formes

- `border-radius: 0` partout.
- Bordures `2px` en encre sur les cartes, boutons et blocs.
- Ombre dure `4px 4px 0 #121212`, sans flou. Survol : `6px 6px 0` + translation `(-2px, -2px)`.
- Séparateurs `1px` en encre à 15 %.
- Aucun dégradé, aucun flou, aucune animation au-delà du survol.

## Grille et composition

- Largeur de lecture : **1024-1120 px** pour l'accueil, **900 px** pour la veille.
- Grille 12 colonnes sur desktop ; hero asymétrique **8/4** avec un bloc couleur.
- Chaque section porte un label mono numéroté : `01 / COLLECTE`.
- Les rangées de la veille sont numérotées.
- Mobile : une colonne, les bordures restent.

## Pages

### Accueil

- En-tête : wordmark `VITRINE_` en mono, nav carrée.
- Hero : grand display, un bloc couleur (rouge) avec un chiffre ou une date, CTA carré.
- Bandeau de chiffres : 4 cellules bordées.
- Bloc `pipeline.log` : fond encre, texte papier, les deux commandes et leurs sorties.
- Trois produits en blocs colorés (rouge / bleu / jaune), bordés, ombre dure.
- Pied de page en mono.

### Veille

- En-tête : `VEILLE_`, nombre d'actualités, dernière publication.
- Liste en tableau : numéro · date · titre · source, séparateurs 1 px.
- Résumés sur deux lignes, filtre de redondance conservé.
- Survol de rangée : fond rouge très clair, pas de texte coloré.
- Lisibilité d'abord : le texte reste encre sur béton.

## Contraintes

- Aucune web font, aucune requête réseau au build, aucun JavaScript.
- Contraste AA sur tous les textes.
- 0 €, rendu statique.
- On conserve les données, le filtre de redondance et la CI.

## Critères de réussite

- Deux variantes de la page d'accueil, capturées en screenshot.
- Variante choisie, appliquée aux deux pages.
- `npm test`, `npm run build` et la CI verts.
- `aidd_docs/memory/design.md` rempli avec la décision finale.

## Hors périmètre

Nouvelles pages, réécriture des textes, mode sombre, animations, images, polices distantes.
