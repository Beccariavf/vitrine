# Paramètres de la veille

Outil local pour choisir les tags publiés. Il n'est pas déployé et le site public ne charge
aucun script.

## Utilisation

1. Ouvrir l'outil dans Chrome :

   ```bash
   open tools/parametres.html
   ```

2. Cliquer sur **Charger tags.json** et choisir `veille/tags.json`.
3. Cocher ou décocher les tags.
4. Cliquer sur **Enregistrer tags.json** et enregistrer sur `veille/tags.json`.
5. Relancer la collecte et le site :

   ```bash
   npm run veille
   npm run build
   ```

## Ce que fait l'outil

- Il lit et écrit le même fichier que le pipeline, `veille/tags.json`.
- Il valide la forme : quatre tags, identifiants uniques, libellés et motifs non vides,
  booléen `active`.
- Il conserve les motifs et les libellés ; il ne change que les cases.
- Il utilise l'API File System Access de Chrome. Si elle n'est pas disponible, l'outil
  télécharge `tags.json` ; il faut alors le placer dans `veille/`.

## Effet sur la publication

Les tags actifs décident de ce que la passe écrit dans `data/entries/`. Désactiver RGPD
retire les arrêts RGPD à la passe suivante ; réactiver le tag les fait revenir. Le snapshot
brut du flux reste dans `data/raw/`, même quand un arrêt n'est plus publié.

Le site affiche les tags actifs en lecture seule ; il ne filtre pas une deuxième fois.
