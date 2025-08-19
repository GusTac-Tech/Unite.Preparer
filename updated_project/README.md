# Application d'annotation de stellites

Cette application permet d’annoter des cas cliniques de prothèse dentaire partielle (stellites) et de générer des fichiers JSON structurés pour l’entraînement d’un modèle d’IA.

## Installation des modules 3D

La visionneuse 3D utilise la bibliothèque **Three.js**. Pour que la visualisation fonctionne en local, installez les dépendances suivantes via NPM :

```bash
npm install three@^0.149.0
```

Une fois installée, les modules `three`, `@examples/jsm/controls/OrbitControls.js`, `@examples/jsm/loaders/STLLoader.js` et `@examples/jsm/loaders/PLYLoader.js` seront disponibles. L’application charge ces fichiers dynamiquement à partir des sources en ligne ou via l’installation locale.

Si vous préférez embarquer les modules dans le répertoire de l’application plutôt que de les charger à la volée, copiez les fichiers suivants depuis `node_modules/three/examples/jsm` vers un dossier `lib` :

```
cp node_modules/three/build/three.module.js lib/
cp node_modules/three/examples/jsm/controls/OrbitControls.js lib/
cp node_modules/three/examples/jsm/loaders/STLLoader.js lib/
cp node_modules/three/examples/jsm/loaders/PLYLoader.js lib/
```

Ensuite, modifiez les imports dans `app.js` en remplaçant les URL vers `unpkg.com` par des chemins relatifs :

```javascript
const threeModule = await import('./lib/three.module.js');
const orbitModule = await import('./lib/OrbitControls.js');
const stlModule   = await import('./lib/STLLoader.js');
const plyModule   = await import('./lib/PLYLoader.js');
```

Cette approche garantit que la visionneuse fonctionne même sans connexion internet.

Si l’import en ligne échoue (absence de connexion, restrictions réseau), assurez‑vous que les modules sont présents dans `node_modules/three` et que l’application y a accès.

## Préparation du fichier `Arcades.svg`

Le fichier `Arcades.svg` sert de fond interactif pour représenter les arcades dentaires. Actuellement, il ne contient pas d’attributs `id` ou de groupes identifiables autour des formes représentant chaque dent : les numéros FDI sont dessinés comme des tracés vectoriels intégrés à l’image.  

Pour permettre une interaction directe (sélection, double‑clic, coloration de la dent elle‑même), il est nécessaire que chaque dent soit identifiable dans le SVG. Voici deux solutions possibles :

1. **Modifier manuellement le SVG** : ouvrez `Arcades.svg` dans un éditeur d’images vectorielles (par ex. Inkscape) et regroupez chaque dent dans un élément `<g>` auquel vous attribuerez l’identifiant du numéro FDI correspondant. Par exemple :

   ```xml
   <g id="18">
     … chemins décrivant la dent 18 et son numéro …
   </g>
   <g id="17">
     …
   </g>
   ```

   Une fois ces identifiants en place, vous pouvez adapter `app.js` pour sélectionner chaque dent par `document.getElementById('18')` et modifier ses attributs (ex. `fill` ou `stroke`) lors d’un clic ou d’un double‑clic. Le script fournira alors une expérience sans superposition.

2. **Fournir une version annotée** : si vous ne souhaitez pas modifier le SVG vous‑même, fournissez‑moi un fichier `Arcades.svg` dans lequel chaque dent est déjà entourée d’un `<g id="FDI">` comme décrit ci‑dessus. Je pourrai alors ajouter le code nécessaire pour rendre le SVG interactif et coloriser les dents directement.

Sans ces identifiants, l’application actuelle utilise des éléments de superposition positionnés par coordonnées pour simuler les interactions. Cela fonctionne, mais ne permet pas de colorier la dent elle‑même.

## Notes sur les archives ZIP

Lors de l’enregistrement d’un dataset (`UTD‑xx.zip`), le fichier zip contient les fichiers STL/PLY d’origine ainsi que le fichier `annotations.json`. Sur Windows, certains antivirus marquent les fichiers STL/PLY comme potentiellement dangereux et peuvent bloquer leur extraction. Pour éviter ces alertes, renommez les fichiers 3D à l’intérieur de l’archive avec une extension neutre comme `.bin` ou `.data` avant de les distribuer, puis restaurez l’extension `.stl` ou `.ply` après extraction.
