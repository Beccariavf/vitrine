# Paramètres de la veille

Outil local pour choisir les matières publiées. Il n'est pas déployé et le site public ne charge
aucun script.

## Utilisation

1. Ouvrir l'outil dans Chrome :

   ```bash
   open tools/parametres.html
   ```

2. Cliquer sur **Charger themes.json** et choisir `veille/themes.json`.
3. Cocher ou décocher les matières.
4. Cliquer sur **Enregistrer themes.json** et enregistrer sur `veille/themes.json`.
5. Reconstruire le site :

   ```bash
   npm run build
   ```

La collecte n'est pas nécessaire pour changer la sélection : le site filtre au build. Relancer
`npm run veille` seulement pour récupérer de nouvelles publications.

## Ce que fait l'outil

- Il lit et écrit le même fichier que le pipeline et le site, `veille/themes.json`.
- Il valide la forme : cinq matières, identifiants uniques, libellé, description, textes,
  termes, requêtes, sources et booléen `active`.
- Il conserve tout le contenu, y compris `queries` ; il ne change que les cases.

## Effet sur la publication

Les matières actives décident de ce que le site rend. Désactiver une matière la masque au
prochain build ; les entrées et le snapshot brut restent dans le dépôt. Réactiver la matière la
fait revenir sans nouvelle collecte.
