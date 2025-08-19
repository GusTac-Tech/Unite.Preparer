// Application d'annotation de stellites
// Ce fichier charge dynamiquement Three.js et ses composants lorsque nécessaire.

// Les variables Three.js ne sont plus utilisées car nous passons à VTK.js pour la visualisation 3D
let THREE;
let OrbitControls;
let STLLoader;
let PLYLoader;

// Variables VTK.js pour la visionneuse 3D
let genericRenderWindow;
let modelActor;
let chassisActor;

async function loadThreeModules() {
  // Charge les modules Three.js si ce n'est pas déjà fait
  if (THREE && OrbitControls && STLLoader && PLYLoader) return;
  try {
    // Essayez d'utiliser les librairies déjà chargées dans la page (si elles existent en global)
    if (typeof window !== 'undefined' && window.THREE) {
      THREE = window.THREE;
      // Dans les versions non-modulaires de Three.js, les chargeurs et contrôles sont ajoutés
      // comme propriétés de THREE. Certains paquets utilisent THREE.addons pour exposer ces classes.
      OrbitControls = THREE.OrbitControls || (THREE.addons && THREE.addons.OrbitControls);
      STLLoader = THREE.STLLoader || (THREE.addons && THREE.addons.STLLoader);
      PLYLoader = THREE.PLYLoader || (THREE.addons && THREE.addons.PLYLoader);
      // S'il ne manque aucune classe, nous pouvons retourner directement
      if (THREE && OrbitControls && STLLoader && PLYLoader) return;
    }
    // Si les modules ne sont pas disponibles en global, on tente de les charger dynamiquement.
    // Priorité à la version locale dans lib/ si elle existe (copiée depuis node_modules/three).
    try {
      const threeLocal = await import('./lib/three.module.js');
      const orbitLocal = await import('./lib/OrbitControls.js');
      const stlLocal = await import('./lib/STLLoader.js');
      const plyLocal = await import('./lib/PLYLoader.js');
      THREE = threeLocal;
      OrbitControls = orbitLocal.OrbitControls;
      STLLoader = stlLocal.STLLoader;
      PLYLoader = plyLocal.PLYLoader;
      return;
    } catch (localErr) {
      // ignore and fall back to remote modules
    }
    // Si la version locale est absente, tente de charger via CDN Unpkg.
    const threeModule = await import('https://unpkg.com/three@0.149.0/build/three.module.js');
    THREE = threeModule;
    const orbitModule = await import('https://unpkg.com/three@0.149.0/examples/jsm/controls/OrbitControls.js');
    OrbitControls = orbitModule.OrbitControls;
    const stlModule = await import('https://unpkg.com/three@0.149.0/examples/jsm/loaders/STLLoader.js');
    STLLoader = stlModule.STLLoader;
    const plyModule = await import('https://unpkg.com/three@0.149.0/examples/jsm/loaders/PLYLoader.js');
    PLYLoader = plyModule.PLYLoader;
  } catch (err) {
    console.error('Erreur lors du chargement de Three.js :', err);
    alert('Impossible de charger les modules 3D. Vérifiez votre connexion internet ou l’accessibilité des modules.');
    throw err;
  }
}

// Code principal exécuté une fois le document chargé

document.addEventListener('DOMContentLoaded', () => {
  const state = {
    dents: {},
    connecteur: '',
    classeKennedy: '',
    modifications: '0',
    tiges: false,
    notes: '',
    modelFile: null,
    chassisFile: null,
    viewerInitialized: false,
    labels: {},
  };

  // Les dents (FDI) seront initialisées dynamiquement lors du chargement du fichier SVG.

  // Création dynamique du schéma dentaire.
  // On insère le contenu du fichier SVG et on associe les écouteurs aux groupes de dents.
  function createDentalChart() {
    const container = document.getElementById('dental-chart');
    const svgElement = container.querySelector('svg');
    if (!svgElement) return;
    svgElement.style.width = '100%';
    svgElement.style.height = 'auto';
    // Récupère tous les groupes de dents identifiés par un id commençant par FDI
    const groups = svgElement.querySelectorAll('g[id^="FDI_"]');
    groups.forEach((group) => {
      const id = group.id;
      const match = id.match(/\d+/);
      if (!match) return;
      const fdi = match[0];
      group.dataset.fdi = fdi;
      // Initialiser l'état de la dent si nécessaire
      if (!state.dents[fdi]) {
        state.dents[fdi] = { status: 'present', comps: [] };
      }
      // Écouteurs d'événements pour les interactions
      group.addEventListener('click', (e) => {
        // Ignorer clic droit
        if (e.button === 2) return;
        e.preventDefault();
        handleToothSingleClick(group);
      });
      group.addEventListener('dblclick', (e) => {
        e.preventDefault();
        handleToothDoubleClick(group);
      });
      group.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        contextTargetFdi = fdi;
        // Mettre à jour les éléments sélectionnés dans le menu
        const currentComps = state.dents[fdi].comps;
        Array.from(contextMenu.querySelectorAll('li')).forEach((li) => {
          const compCode = li.dataset.comp;
          if (currentComps.includes(compCode)) {
            li.classList.add('selected');
          } else {
            li.classList.remove('selected');
          }
        });
        contextMenu.style.display = 'block';
        contextMenu.style.left = `${e.pageX}px`;
        contextMenu.style.top = `${e.pageY}px`;
      });
      // Crée une étiquette pour cette dent
      const label = document.createElement('div');
      label.className = 'tooth-label';
      label.dataset.fdi = fdi;
      label.textContent = '';
      container.appendChild(label);
      state.labels[fdi] = label;
    });
    // Positionner les étiquettes sous chaque dent
    requestAnimationFrame(updateLabelPositions);
    // Appliquer l'état initial (couleurs et étiquettes)
    Object.keys(state.dents).forEach((fdi) => updateToothVisual(fdi));
  }

  createDentalChart();

  // Références aux éléments du DOM
  const dentalChart = document.getElementById('dental-chart');
  const contextMenu = document.getElementById('context-menu');
  let contextTargetFdi = null;

  // Ferme le menu contextuel si l'on clique ailleurs que sur le menu
  document.addEventListener('click', (e) => {
    if (contextMenu.style.display === 'block' && !contextMenu.contains(e.target)) {
      contextMenu.style.display = 'none';
    }
  });

  // Remarque : Les interactions sur les dents sont maintenant gérées directement au niveau
  // des groupes <g> du SVG dans createDentalChart(). Les gestionnaires globaux ci-dessus ont
  // été supprimés car ils ciblaient des éléments avec la classe .tooth qui n'existent plus.

  // Gestion de la sélection d'un composant dans le menu contextuel
  contextMenu.addEventListener('click', (e) => {
    const item = e.target;
    const comp = item.dataset.comp;
    if (comp && contextTargetFdi) {
      const toothData = state.dents[contextTargetFdi];
      const idx = toothData.comps.indexOf(comp);
      if (idx === -1) {
        toothData.comps.push(comp);
        item.classList.add('selected');
      } else {
        toothData.comps.splice(idx, 1);
        item.classList.remove('selected');
      }
      updateToothVisual(contextTargetFdi);
      // ne pas fermer immédiatement le menu pour permettre plusieurs sélections
    }
  });

  // Fonction déclenchée lors d'un simple clic (marquer ou désactiver une selle)
  function handleToothSingleClick(toothElement) {
    const fdi = toothElement.dataset.fdi;
    const data = state.dents[fdi];
    // Basculer entre présent et selle
    if (data.status === 'saddle') {
      data.status = 'present';
    } else {
      // Si la dent était marquée comme manquante, on la passe en selle
      data.status = 'saddle';
    }
    updateToothVisual(fdi);
  }

  // Fonction déclenchée lors d'un double clic (marquer ou désactiver une dent manquante)
  function handleToothDoubleClick(toothElement) {
    const fdi = toothElement.dataset.fdi;
    const data = state.dents[fdi];
    // Basculer entre présent et manquante
    if (data.status === 'missing') {
      data.status = 'present';
    } else {
      data.status = 'missing';
    }
    updateToothVisual(fdi);
  }

  // Met à jour l'aspect visuel d'une dent en fonction de son état et de ses composants
  function updateToothVisual(fdi) {
    // Recherche le groupe SVG correspondant et applique les couleurs
    const group = dentalChart.querySelector(`#FDI_${fdi}`);
    if (!group) return;
    const data = state.dents[fdi];
    // Appliquer la couleur de fond sur les chemins représentant la dent (classe cls-1)
    const toothPaths = group.querySelectorAll('path.cls-1, polygon.cls-1, rect.cls-1, ellipse.cls-1, circle.cls-1');
    toothPaths.forEach((path) => {
      // Détermine la couleur de remplissage selon l'état
      let fillColor = 'none';
      if (data.status === 'saddle') {
        fillColor = '#c8e6c9'; // vert clair
      } else if (data.status === 'missing') {
        fillColor = '#f5c6cb'; // rouge clair
      }
      path.setAttribute('fill', fillColor);
      // Couleur de trait pour les dents avec composants
      if (data.comps && data.comps.length > 0) {
        path.setAttribute('stroke', '#0066cc');
      } else {
        path.setAttribute('stroke', '#1d1d1b');
      }
    });
    // Met à jour l'étiquette (état + composants)
    const labelEl = state.labels[fdi];
    if (labelEl) {
      let labelText = '';
      if (data.status === 'saddle') {
        labelText += 'SL';
      } else if (data.status === 'missing') {
        labelText += 'M';
      }
      if (data.comps && data.comps.length > 0) {
        if (labelText) labelText += ' ';
        labelText += data.comps.join(',');
      }
      labelEl.textContent = labelText;
    }
    // reposition labels after any update
    requestAnimationFrame(updateLabelPositions);
  }

  // Met à jour la position des étiquettes en fonction de la position des dents dans le SVG
  function updateLabelPositions() {
    const container = document.getElementById('dental-chart');
    const containerRect = container.getBoundingClientRect();
    const placed = [];
    // Pour chaque dent enregistrée, recalculer la position de l'étiquette
    Object.keys(state.labels).forEach((fdi) => {
      const group = container.querySelector(`#FDI_${fdi}`);
      const labelEl = state.labels[fdi];
      if (!group || !labelEl) return;
      const bbox = group.getBoundingClientRect();
      const x = bbox.left - containerRect.left + bbox.width / 2;
      let y = bbox.top - containerRect.top + bbox.height + 2;
      labelEl.style.left = `${x}px`;
      labelEl.style.top = `${y}px`;
      // éviter le chevauchement simple
      let rect = labelEl.getBoundingClientRect();
      let overlap = true;
      while (overlap) {
        overlap = false;
        for (const p of placed) {
          if (
            rect.left < p.right &&
            rect.right > p.left &&
            rect.top < p.bottom &&
            rect.bottom > p.top
          ) {
            y += rect.height + 2;
            labelEl.style.top = `${y}px`;
            rect = labelEl.getBoundingClientRect();
            overlap = true;
          }
        }
      }
      placed.push({
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
      });
    });
  }

  // Gestion des entrées de fichiers pour les modèles 3D
  document.getElementById('modelFile').addEventListener('change', (e) => {
    state.modelFile = e.target.files[0] || null;
  });
  document.getElementById('chassisFile').addEventListener('change', (e) => {
    state.chassisFile = e.target.files[0] || null;
  });

  // Mise à jour des paramètres généraux
  document.getElementById('connecteurSelect').addEventListener('change', (e) => {
    state.connecteur = e.target.value;
  });
  document.getElementById('classeKennedySelect').addEventListener('change', (e) => {
    state.classeKennedy = e.target.value;
  });
  document.getElementById('modificationsSelect').addEventListener('change', (e) => {
    state.modifications = e.target.value;
  });
  document.getElementById('tigesCheckbox').addEventListener('change', (e) => {
    state.tiges = e.target.checked;
  });
  document.getElementById('notes').addEventListener('input', (e) => {
    state.notes = e.target.value;
  });

  // Références à la modale de vision 3D et au bouton de fermeture
  const viewerModal = document.getElementById('viewerModal');
  const closeViewerBtn = document.getElementById('closeViewerBtn');
  // Initialisation de la visionneuse 3D avec VTK.js. Aucun module à charger via npm : vtk.js est chargé via CDN.
  async function initViewer() {
    if (state.viewerInitialized) return;
    // Vérifie que la bibliothèque vtk.js est disponible
    if (typeof window.vtk === 'undefined') {
      alert('vtk.js n\'est pas chargé. Assurez-vous que la balise <script src="https://unpkg.com/vtk.js"></script> est présente.');
      throw new Error('vtk.js not loaded');
    }
    // Crée une fenêtre de rendu générique liée au conteneur
    const viewerDiv = document.getElementById('viewer');
    genericRenderWindow = vtk.Rendering.Misc.vtkGenericRenderWindow.newInstance();
    genericRenderWindow.setContainer(viewerDiv);
    genericRenderWindow.resize();
    // Redimensionne la vue lors du redimensionnement de la fenêtre
    window.addEventListener('resize', () => {
      if (genericRenderWindow) {
        genericRenderWindow.resize();
      }
    });
    state.viewerInitialized = true;
  }

  // Chargement d'un fichier 3D en un acteur VTK. Renvoie une promesse résolue avec un acteur.
  async function loadFileToActor(file, rgbColor, opacity) {
    // rgbColor: tableau de 3 nombres entre 0 et 1
    const fileName = file.name.toLowerCase();
    const ext = fileName.split('.').pop();
    const buffer = await file.arrayBuffer();
    let reader;
    if (ext === 'stl') {
      reader = vtk.IO.Geometry.vtkSTLReader.newInstance();
    } else if (ext === 'ply') {
      reader = vtk.IO.Geometry.vtkPLYReader.newInstance();
    } else {
      throw new Error('Format non supporté');
    }
    // Parse the ArrayBuffer
    reader.parseAsArrayBuffer(buffer);
    const source = reader.getOutputData(0);
    const mapper = vtk.Rendering.Core.vtkMapper.newInstance();
    mapper.setInputData(source);
    const actor = vtk.Rendering.Core.vtkActor.newInstance();
    actor.setMapper(mapper);
    if (rgbColor) {
      const [r, g, b] = rgbColor;
      actor.getProperty().setColor(r, g, b);
    }
    if (typeof opacity === 'number') {
      actor.getProperty().setOpacity(opacity);
    }
    return actor;
  }

  // Charge les modèles sélectionnés dans la scène VTK
  async function loadViewerModels() {
    await initViewer();
    const renderer = genericRenderWindow.getRenderer();
    const renderWindow = genericRenderWindow.getRenderWindow();
    // Supprimer les acteurs précédents
    if (modelActor) {
      renderer.removeActor(modelActor);
      modelActor = null;
    }
    if (chassisActor) {
      renderer.removeActor(chassisActor);
      chassisActor = null;
    }
    // Charger le modèle principal
    if (state.modelFile) {
      try {
        modelActor = await loadFileToActor(state.modelFile, [0.7, 0.7, 0.7], 0.6);
        renderer.addActor(modelActor);
      } catch (err) {
        console.error(err);
        alert('Erreur lors du chargement du fichier modèle : ' + err.message);
      }
    }
    // Charger le châssis
    if (state.chassisFile) {
      try {
        chassisActor = await loadFileToActor(state.chassisFile, [0.1, 0.3, 0.8], 0.9);
        renderer.addActor(chassisActor);
      } catch (err) {
        console.error(err);
        alert('Erreur lors du chargement du fichier châssis : ' + err.message);
      }
    }
    // Ajuster la caméra pour englober les acteurs
    renderer.resetCamera();
    renderWindow.render();
  }

  // Gestion du bouton d'activation de la visionneuse
  document.getElementById('view3dBtn').addEventListener('click', () => {
    if (!state.modelFile && !state.chassisFile) {
      alert('Veuillez sélectionner au moins un fichier 3D (STL/PLY) avant de visualiser.');
      return;
    }
    viewerModal.style.display = 'block';
    if (genericRenderWindow) {
      genericRenderWindow.resize();
    }
    loadViewerModels().catch(() => {});
  });

  // Bouton de fermeture de la visionneuse
  if (closeViewerBtn) {
    closeViewerBtn.addEventListener('click', () => {
      viewerModal.style.display = 'none';
      if (genericRenderWindow) {
        const renderer = genericRenderWindow.getRenderer();
        if (modelActor) {
          renderer.removeActor(modelActor);
          modelActor = null;
        }
        if (chassisActor) {
          renderer.removeActor(chassisActor);
          chassisActor = null;
        }
        genericRenderWindow.getRenderWindow().render();
      }
    });
  }

  // Gestion de l'export JSON
  document.getElementById('exportBtn').addEventListener('click', () => {
    const result = generateResultJson();
    const jsonString = JSON.stringify(result, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.getElementById('downloadLink');
    downloadLink.href = url;
    downloadLink.download = 'cas_stellite.json';
    downloadLink.textContent = 'Télécharger le fichier JSON';
    downloadLink.style.display = 'inline-block';
    downloadLink.click();
  });

  // Crée un objet JSON décrivant le cas actuel
  function generateResultJson() {
    const dents = {};
    let hasMaxilla = false;
    let hasMandible = false;
    for (const fdi of Object.keys(state.dents)) {
      const data = state.dents[fdi];
      dents[fdi] = {
        status: data.status,
        comps: Array.from(data.comps),
      };
      const isActive = data.status !== 'present' || (data.comps && data.comps.length > 0);
      if (isActive) {
        const firstDigit = fdi.charAt(0);
        if (firstDigit === '1' || firstDigit === '2') hasMaxilla = true;
        if (firstDigit === '3' || firstDigit === '4') hasMandible = true;
      }
    }
    return {
      dents,
      global: {
        connecteur: state.connecteur || '',
        classeKennedy: state.classeKennedy || '',
        modifications: parseInt(state.modifications, 10),
        tiges: !!state.tiges,
        notes: state.notes || '',
        active_maxillaire: hasMaxilla,
        active_mandibulaire: hasMandible,
      },
    };
  }

  // Gestion du bouton pour enregistrer l'ensemble du dossier en un dataset (zip)
  document.getElementById('saveDatasetBtn').addEventListener('click', async () => {
    // Vérifier la présence d'au moins un fichier 3D
    if (!state.modelFile && !state.chassisFile) {
      alert('Veuillez sélectionner au moins un fichier 3D (modèle ou châssis) avant de sauvegarder le dataset.');
      return;
    }
    // Génération du JSON
    const result = generateResultJson();
    // Vérifie qu'il y a une arcade active
    if (!result.global.active_maxillaire && !result.global.active_mandibulaire) {
      alert('Aucune arcade active n\'a été renseignée (ajoutez une selle, une dent manquante ou un composant).');
      return;
    }
    const jsonString = JSON.stringify(result, null, 2);
    const zip = new JSZip();
    // Ajout des fichiers STL/PLY s'ils existent
    if (state.modelFile) {
      const buffer = await state.modelFile.arrayBuffer();
      zip.file('modele.data', buffer);
    }
    if (state.chassisFile) {
      const buffer = await state.chassisFile.arrayBuffer();
      zip.file('chassis.data', buffer);
    }
    zip.file('annotations.json', jsonString);
    // Détermination du nom du dataset : UTD-xx
    let counter = parseInt(localStorage.getItem('datasetCounter') || '0', 10) + 1;
    localStorage.setItem('datasetCounter', counter.toString());
    const datasetName = `UTD-${String(counter).padStart(2, '0')}`;
    const blob = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${datasetName}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
});
