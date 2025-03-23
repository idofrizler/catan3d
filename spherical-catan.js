// Spherical Catan - Three.js Implementation

// Main game class
class SphericalCatan {
  constructor(containerId, THREE, OrbitControls) {
    // Game state
    this.players = [];
    this.currentPlayer = 0;
    this.gamePhase = 'setup'; // setup, main, end
    this.resourceTypes = ['wood', 'brick', 'wheat', 'sheep', 'ore', 'desert'];
    this.diceValues = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];
    
    // Store THREE reference
    this.THREE = THREE;
    
    // 3D scene setup
    this.container = document.getElementById(containerId);
    this.scene = new this.THREE.Scene();
    this.camera = new this.THREE.PerspectiveCamera(
      75, 
      this.container.clientWidth / this.container.clientHeight, 
      0.1, 
      1000
    );
    this.camera.position.z = 10;
    
    this.renderer = new this.THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.container.appendChild(this.renderer.domElement);
    
    // Add orbit controls for easy navigation
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    
    // Lighting
    const ambientLight = new this.THREE.AmbientLight(0xffffff, 1.0);
    this.scene.add(ambientLight);
    
    const directionalLight = new this.THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(10, 10, 10);
    this.scene.add(directionalLight);
    
    // Add a second directional light from the opposite direction
    const directionalLight2 = new this.THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight2.position.set(-10, -10, -10);
    this.scene.add(directionalLight2);
    
    // Game board
    this.board = null;
    this.tiles = [];
    this.edges = [];
    this.vertices = [];
    
    // Initialize the game
    this.init();
    
    // Start animation loop
    this.animate();
  }
  
  init() {
    this.createBoard();
    this.setupEventListeners();
  }
  
  truncateIcosahedron(geometry) {
    // Get the original vertices and faces
    const positions = geometry.attributes.position;
    const originalVertices = [];
    for (let i = 0; i < positions.count; i++) {
      originalVertices.push(new this.THREE.Vector3(
        positions.getX(i),
        positions.getY(i),
        positions.getZ(i)
      ));
    }
    
    // Create new vertices for the truncated icosahedron
    const newVertices = [];
    const newFaces = [];
    
    // For each original vertex, create a pentagon
    for (let i = 0; i < originalVertices.length; i++) {
      const vertex = originalVertices[i];
      const neighbors = this.findNeighbors(originalVertices, vertex);
      
      // Create pentagon vertices by truncating at 1/3 of the distance
      const pentagonVertices = neighbors.map(neighbor => {
        const direction = neighbor.clone().sub(vertex);
        const distance = direction.length();
        const truncatedPoint = vertex.clone().add(
          direction.normalize().multiplyScalar(distance * 0.33)
        );
        return truncatedPoint;
      });
      
      // Add pentagon face
      const pentagonIndices = pentagonVertices.map(v => newVertices.length + newVertices.push(v) - 1);
      newFaces.push({
        type: 'pentagon',
        vertices: pentagonIndices,
        indices: this.createPolygonIndices(pentagonIndices)
      });
    }
    
    // For each original face, create a hexagon
    const originalFaces = [];
    for (let i = 0; i < positions.count; i += 3) {
      originalFaces.push({
        a: i,
        b: i + 1,
        c: i + 2
      });
    }
    
    for (const face of originalFaces) {
      const v1 = originalVertices[face.a];
      const v2 = originalVertices[face.b];
      const v3 = originalVertices[face.c];
      
      // Create hexagon vertices by truncating at 1/3 of the distance
      const hexagonVertices = [
        this.truncatePoint(v1, v2, 0.33),
        this.truncatePoint(v2, v1, 0.33),
        this.truncatePoint(v2, v3, 0.33),
        this.truncatePoint(v3, v2, 0.33),
        this.truncatePoint(v3, v1, 0.33),
        this.truncatePoint(v1, v3, 0.33)
      ];
      
      // Add hexagon face
      const hexagonIndices = hexagonVertices.map(v => newVertices.length + newVertices.push(v) - 1);
      newFaces.push({
        type: 'hexagon',
        vertices: hexagonIndices,
        indices: this.createPolygonIndices(hexagonIndices)
      });
    }
    
    // Update the geometry with new vertices and faces
    const newPositions = new Float32Array(newVertices.length * 3);
    for (let i = 0; i < newVertices.length; i++) {
      newPositions[i * 3] = newVertices[i].x;
      newPositions[i * 3 + 1] = newVertices[i].y;
      newPositions[i * 3 + 2] = newVertices[i].z;
    }
    
    // Create indices for all faces
    const allIndices = [];
    newFaces.forEach(face => {
      allIndices.push(...face.indices);
    });
    
    geometry.setAttribute('position', new this.THREE.BufferAttribute(newPositions, 3));
    geometry.setIndex(allIndices);
    geometry.computeVertexNormals();
    
    // Store face information for later use
    this.faces = newFaces;
  }
  
  createPolygonIndices(vertices) {
    const indices = [];
    // Create triangles for the polygon
    for (let i = 1; i < vertices.length - 1; i++) {
      indices.push(vertices[0], vertices[i], vertices[i + 1]);
    }
    return indices;
  }
  
  findNeighbors(vertices, vertex) {
    const neighbors = [];
    for (const v of vertices) {
      if (v !== vertex) {
        const distance = v.distanceTo(vertex);
        // Use a more precise threshold for finding neighbors
        if (distance < 5.5) { // Adjusted threshold for icosahedron
          neighbors.push(v);
        }
      }
    }
    return neighbors;
  }
  
  truncatePoint(v1, v2, ratio = 0.33) {
    const direction = v2.clone().sub(v1);
    const distance = direction.length();
    return v1.clone().add(
      direction.normalize().multiplyScalar(distance * ratio)
    );
  }
  
  createBoard() {
    const radius = 5;
    const geometry = new this.THREE.BufferGeometry();
    
    // Define the vertices of a regular icosahedron
    const t = (1 + Math.sqrt(5)) / 2; // Golden ratio
    const icosahedronVertices = [
      [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
      [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
      [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]
    ].map(([x, y, z]) => new this.THREE.Vector3(x, y, z).normalize().multiplyScalar(radius));
    
    // Define the edges of the icosahedron
    const icosahedronEdges = [
      [0,1], [0,5], [0,7], [0,10], [0,11],
      [1,5], [1,7], [1,8], [1,9],
      [2,3], [2,4], [2,6], [2,10], [2,11],
      [3,4], [3,6], [3,8], [3,9],
      [4,5], [4,9], [4,11],
      [5,9], [5,11],
      [6,7], [6,8], [6,10],
      [7,8], [7,10],
      [8,9],
      [10,11]
    ];
    
    // Define the faces of the icosahedron
    const icosahedronFaces = [
      [0,1,5], [0,5,11], [0,11,10], [0,10,7], [0,7,1],
      [1,7,8], [1,8,9], [1,9,5],
      [2,3,4], [2,4,11], [2,11,10], [2,10,6], [2,6,3],
      [3,6,8], [3,8,9], [3,9,4],
      [4,9,5], [4,5,11],
      [6,10,7], [6,7,8]
    ];
    
    // Calculate all 60 vertices of the truncated icosahedron
    const truncatedVertices = [];
    const edgeToVertices = new Map(); // Map to store which vertices belong to which edge
    
    // For each edge of the icosahedron, create two vertices
    icosahedronEdges.forEach(([v1Index, v2Index], edgeIndex) => {
      const v1 = icosahedronVertices[v1Index];
      const v2 = icosahedronVertices[v2Index];
      
      // Create two vertices at 1/3 and 2/3 along each edge
      const vertex1 = v1.clone().lerp(v2, 1/3).normalize().multiplyScalar(radius);
      const vertex2 = v1.clone().lerp(v2, 2/3).normalize().multiplyScalar(radius);
      
      const vertexIndex1 = truncatedVertices.length;
      const vertexIndex2 = vertexIndex1 + 1;
      truncatedVertices.push(vertex1, vertex2);
      
      // Store the mapping of original edge to new vertices
      edgeToVertices.set(`${v1Index},${v2Index}`, [vertexIndex1, vertexIndex2]);
      edgeToVertices.set(`${v2Index},${v1Index}`, [vertexIndex2, vertexIndex1]);
    });
    
    // Identify pentagon and hexagon faces
    this.faces = [];
    
    // Create pentagon faces (one around each original vertex)
    icosahedronVertices.forEach((vertex, vertexIndex) => {
      // Find all edges connected to this vertex
      const connectedEdges = icosahedronEdges.filter(([v1, v2]) => v1 === vertexIndex || v2 === vertexIndex);
      
      // Skip if we don't have enough connected edges
      if (connectedEdges.length < 5) return;
      
      // Get the vertices that form the pentagon in the correct order
      const pentagonVertices = [];
      const orderedEdges = [];
      
      // Start with the first edge
      let currentEdge = connectedEdges[0];
      let currentVertex = currentEdge[vertexIndex === currentEdge[0] ? 1 : 0];
      orderedEdges.push(currentEdge);
      
      // Find the sequence of edges that form the pentagon
      while (orderedEdges.length < 5) {
        // Find the next edge that shares currentVertex
        const nextEdge = connectedEdges.find(edge => {
          if (orderedEdges.includes(edge)) return false;
          return edge[0] === currentVertex || edge[1] === currentVertex;
        });
        
        if (!nextEdge) break;
        
        orderedEdges.push(nextEdge);
        currentVertex = nextEdge[0] === currentVertex ? nextEdge[1] : nextEdge[0];
      }
      
      // Only proceed if we found all 5 edges
      if (orderedEdges.length === 5) {
        // Add vertices in order
        orderedEdges.forEach((edge, i) => {
          const edgeKey = `${Math.min(edge[0], edge[1])},${Math.max(edge[0], edge[1])}`;
          const vertexPair = edgeToVertices.get(edgeKey);
          
          // For each edge, add the vertex that's closer to the center vertex
          if (edge[0] === vertexIndex) {
            pentagonVertices.push(vertexPair[0]);
          } else {
            pentagonVertices.push(vertexPair[1]);
          }
        });
        
        // Add pentagon face if we found all vertices
        if (pentagonVertices.length === 5) {
          this.faces.push({
            type: 'pentagon',
            vertices: pentagonVertices
          });
        }
      }
    });
    
    // Create hexagon faces (one for each original face)
    icosahedronFaces.forEach(face => {
      const [v1, v2, v3] = face;
      const hexagonVertices = [];
      
      // Get the vertices from each edge of the face
      const edge1Vertices = edgeToVertices.get(`${v1},${v2}`);
      const edge2Vertices = edgeToVertices.get(`${v2},${v3}`);
      const edge3Vertices = edgeToVertices.get(`${v3},${v1}`);
      
      hexagonVertices.push(
        edge1Vertices[0], edge1Vertices[1],
        edge2Vertices[0], edge2Vertices[1],
        edge3Vertices[0], edge3Vertices[1]
      );
      
      // Add hexagon face
      this.faces.push({
        type: 'hexagon',
        vertices: hexagonVertices
      });
    });
    
    // Convert vertices to buffer attribute
    const positionArray = new Float32Array(truncatedVertices.length * 3);
    truncatedVertices.forEach((vertex, i) => {
      positionArray[i * 3] = vertex.x;
      positionArray[i * 3 + 1] = vertex.y;
      positionArray[i * 3 + 2] = vertex.z;
    });
    
    // Set up the geometry with vertices
    geometry.setAttribute('position', new this.THREE.BufferAttribute(positionArray, 3));
    
    // Create points to visualize vertices
    const pointsMaterial = new this.THREE.PointsMaterial({ 
      color: 0xffffff,
      size: 0.2,
      sizeAttenuation: true
    });
    
    this.board = new this.THREE.Points(geometry, pointsMaterial);
    this.scene.add(this.board);
    
    // Store vertices for later use
    this.truncatedVertices = truncatedVertices;
    
    // Add edges and faces visualization
    this.addEdgeVisualization();
    this.addFaceVisualization();
  }
  
  addEdgeVisualization() {
    // Create a Set to store edges we've already added (to avoid duplicates)
    const addedEdges = new Set();
    
    // Store edges for interaction
    this.edgeObjects = [];
    
    // The correct edge length for a truncated icosahedron (with radius 5)
    const CORRECT_EDGE_LENGTH = 2.018;
    const TOLERANCE = 0.01; // Allow for small floating point differences
    
    // For each vertex, find its valid neighbors
    for (let i = 0; i < this.truncatedVertices.length; i++) {
      for (let j = i + 1; j < this.truncatedVertices.length; j++) {
        const v1 = this.truncatedVertices[i];
        const v2 = this.truncatedVertices[j];
        const distance = v1.distanceTo(v2);
        
        // Only create edge if vertices are the correct distance apart
        if (Math.abs(distance - CORRECT_EDGE_LENGTH) < TOLERANCE) {
          const edgeKey = `${Math.min(i, j)},${Math.max(i, j)}`;
          
          if (!addedEdges.has(edgeKey)) {
            const edgeGeometry = new this.THREE.BufferGeometry().setFromPoints([v1, v2]);
            const edgeMaterial = new this.THREE.LineBasicMaterial({ 
              color: 0xFFFFFF,
              linewidth: 2,
              opacity: 0.8,
              transparent: true
            });
            
            const edge = new this.THREE.Line(edgeGeometry, edgeMaterial);
            edge.userData = {
              type: 'edge',
              v1: i,
              v2: j,
              defaultColor: 0xFFFFFF,
              isSelected: false
            };
            
            this.scene.add(edge);
            this.edgeObjects.push(edge);
            addedEdges.add(edgeKey);
          }
        }
      }
    }
  }
  
  addFaceVisualization() {
    // Define Catan resource colors
    const resourceColors = {
      wheat: 0xFFEB3B,    // Yellow for fields
      wood: 0x33691E,     // Dark green for forest
      sheep: 0x81C784,    // Light green for pastures
      ore: 0x757575,      // Gray for mountains
      brick: 0xD32F2F,    // Red for hills
      desert: 0xD2B48C    // Tan for desert
    };
    
    // Shuffle resource assignments
    const resourceTypes = [
      'wheat', 'wheat', 'wheat', 'wheat',
      'wood', 'wood', 'wood', 'wood',
      'sheep', 'sheep', 'sheep', 'sheep',
      'ore', 'ore', 'ore',
      'brick', 'brick', 'brick',
      'desert'
    ];
    this.shuffle(resourceTypes);
    
    let hexagonCount = 0;
    this.faceObjects = [];  // Store faces for interaction
    
    // Create meshes for each face using the pre-identified faces
    this.faces.forEach((face, faceIndex) => {
      const vertices = face.vertices.map(i => this.truncatedVertices[i]);
      
      // Calculate center
      const center = new this.THREE.Vector3();
      vertices.forEach(v => center.add(v));
      center.divideScalar(vertices.length);
      
      // Create geometry
      const geometry = new this.THREE.BufferGeometry();
      
      // Create triangles using fan triangulation from center
      const positions = new Float32Array((vertices.length + 2) * 3);
      
      // Add center
      positions[0] = center.x;
      positions[1] = center.y;
      positions[2] = center.z;
      
      // Add vertices
      vertices.forEach((vertex, i) => {
        positions[(i + 1) * 3] = vertex.x;
        positions[(i + 1) * 3 + 1] = vertex.y;
        positions[(i + 1) * 3 + 2] = vertex.z;
      });
      
      // Add first vertex again to close the fan
      positions[(vertices.length + 1) * 3] = vertices[0].x;
      positions[(vertices.length + 1) * 3 + 1] = vertices[0].y;
      positions[(vertices.length + 1) * 3 + 2] = vertices[0].z;
      
      // Create indices for triangle fan
      const indices = [];
      for (let i = 1; i <= vertices.length; i++) {
        indices.push(0, i, i + 1);
      }
      
      geometry.setAttribute('position', new this.THREE.BufferAttribute(positions, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      
      // Assign resource type and color
      let resourceType;
      if (face.type === 'pentagon') {
        // Pentagons are always desert
        resourceType = 'desert';
      } else {
        // Hexagons get other resources
        if (hexagonCount < resourceTypes.length) {
          resourceType = resourceTypes[hexagonCount];
          hexagonCount++;
        } else {
          resourceType = 'desert'; // Fallback
        }
      }
      
      const material = new this.THREE.MeshPhongMaterial({
        color: resourceColors[resourceType],
        transparent: true,
        opacity: 0.7,
        side: this.THREE.DoubleSide
      });
      
      const mesh = new this.THREE.Mesh(geometry, material);
      mesh.userData = {
        type: 'face',
        faceIndex: faceIndex,
        faceType: face.type,
        resourceType: resourceType,
        defaultColor: resourceColors[resourceType],
        isSelected: false,
        vertices: face.vertices
      };
      
      this.scene.add(mesh);
      this.faceObjects.push(mesh);
    });
  }
  
  addDiceValueIndicators() {
    // Add dice value indicators as sprites
    this.faces.forEach((face, index) => {
      if (face.diceValue !== 7) {
        // Calculate the center of the face
        const center = new this.THREE.Vector3();
        face.vertices.forEach(vertexIndex => {
          const position = this.board.geometry.attributes.position;
          center.add(new this.THREE.Vector3(
            position.getX(vertexIndex),
            position.getY(vertexIndex),
            position.getZ(vertexIndex)
          ));
        });
        center.divideScalar(face.vertices.length);
        
        // Create text sprite
        const textCanvas = document.createElement('canvas');
        const context = textCanvas.getContext('2d');
        textCanvas.width = 64;
        textCanvas.height = 64;
        
        // Draw the number
        context.fillStyle = 'white';
        context.font = 'bold 48px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(face.diceValue.toString(), 32, 32);
        
        // Create sprite
        const textTexture = new this.THREE.CanvasTexture(textCanvas);
        const textMaterial = new this.THREE.SpriteMaterial({ 
          map: textTexture,
          transparent: true,
          depthTest: false
        });
        const textSprite = new this.THREE.Sprite(textMaterial);
        textSprite.scale.set(0.5, 0.5, 1);
        textSprite.position.copy(center.normalize().multiplyScalar(5.1));
        
        // Make the sprite face outward
        textSprite.lookAt(new this.THREE.Vector3(0, 0, 0));
        
        this.scene.add(textSprite);
      }
    });
  }
  
  createTiles() {
    // No longer needed as we're using face materials
  }
  
  createTileVisual() {
    // No longer needed as we're using face materials
  }
  
  setupEventListeners() {
    const raycaster = new this.THREE.Raycaster();
    const mouse = new this.THREE.Vector2();
    let hoveredEdge = null;
    let hoveredFace = null;
    
    // Update mouse position
    const updateMousePosition = (event) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };
    
    // Handle mouse move for hover effect
    this.container.addEventListener('mousemove', (event) => {
      updateMousePosition(event);
      
      // Cast a ray
      raycaster.setFromCamera(mouse, this.camera);
      
      // Adjust raycaster parameters to favor faces over edges
      raycaster.params.Line.threshold = 0.05; // Make edge detection more precise/difficult
      
      // Check for face intersections first
      const faceIntersects = raycaster.intersectObjects(this.faceObjects);
      
      // Reset previous face hover state
      if (hoveredFace && (!faceIntersects.length || faceIntersects[0].object !== hoveredFace)) {
        if (!hoveredFace.userData.isSelected) {
          hoveredFace.material.color.setHex(hoveredFace.userData.defaultColor);
          hoveredFace.material.opacity = 0.7;
        }
        hoveredFace = null;
      }
      
      // Check for edge intersections
      const edgeIntersects = raycaster.intersectObjects(this.edgeObjects);
      
      // Reset previous edge hover state
      if (hoveredEdge && (!edgeIntersects.length || edgeIntersects[0].object !== hoveredEdge)) {
        if (!hoveredEdge.userData.isSelected) {
          hoveredEdge.material.color.setHex(hoveredEdge.userData.defaultColor);
        }
        hoveredEdge.material.linewidth = 2;
        hoveredEdge = null;
      }
      
      // Set new hover state - prioritize faces unless very close to an edge
      if (faceIntersects.length > 0 && 
          (!edgeIntersects.length || edgeIntersects[0].distance > faceIntersects[0].distance + 0.1)) {
        const face = faceIntersects[0].object;
        if (!face.userData.isSelected) {
          face.material.color.setHex(0x00FF00); // Hover color: green
          face.material.opacity = 0.9;
        }
        hoveredFace = face;
      } else if (edgeIntersects.length > 0) {
        const edge = edgeIntersects[0].object;
        if (!edge.userData.isSelected) {
          edge.material.color.setHex(0x00FF00); // Hover color: green
        }
        edge.material.linewidth = 3;
        hoveredEdge = edge;
      }
    });
    
    // Handle click - similar changes to prioritize faces
    this.container.addEventListener('click', (event) => {
      updateMousePosition(event);
      
      // Cast a ray
      raycaster.setFromCamera(mouse, this.camera);
      
      // Check for face intersections first
      const faceIntersects = raycaster.intersectObjects(this.faceObjects);
      const edgeIntersects = raycaster.intersectObjects(this.edgeObjects);
      
      // Prioritize faces unless very close to an edge
      if (faceIntersects.length > 0 && 
          (!edgeIntersects.length || edgeIntersects[0].distance > faceIntersects[0].distance + 0.1)) {
        const face = faceIntersects[0].object;
        
        // Reset all other faces
        this.faceObjects.forEach(f => {
          if (f !== face) {
            f.material.color.setHex(f.userData.defaultColor);
            f.material.opacity = 0.7;
            f.userData.isSelected = false;
          }
        });
        
        // Toggle selected state
        face.userData.isSelected = !face.userData.isSelected;
        face.material.color.setHex(face.userData.isSelected ? 0xFF0000 : face.userData.defaultColor);
        face.material.opacity = face.userData.isSelected ? 0.9 : 0.7;
        
        // Log face information
        console.log(`Face ${face.userData.faceIndex}:`);
        console.log(`  Type: ${face.userData.faceType}`);
        console.log(`  Resource: ${face.userData.resourceType}`);
        console.log(`  Vertices: [${face.userData.vertices.join(', ')}]`);
      } else if (edgeIntersects.length > 0) {
        const edge = edgeIntersects[0].object;
        
        // Reset all other edges
        this.edgeObjects.forEach(e => {
          if (e !== edge) {
            e.material.color.setHex(e.userData.defaultColor);
            e.userData.isSelected = false;
          }
        });
        
        // Toggle selected state
        edge.userData.isSelected = !edge.userData.isSelected;
        edge.material.color.setHex(edge.userData.isSelected ? 0xFF0000 : edge.userData.defaultColor);
        
        // Log edge information
        const v1 = edge.userData.v1;
        const v2 = edge.userData.v2;
        const pos1 = this.truncatedVertices[v1];
        const pos2 = this.truncatedVertices[v2];
        console.log(`Edge ${v1}-${v2}:`);
        console.log(`  v1(${pos1.x.toFixed(3)}, ${pos1.y.toFixed(3)}, ${pos1.z.toFixed(3)})`);
        console.log(`  v2(${pos2.x.toFixed(3)}, ${pos2.y.toFixed(3)}, ${pos2.z.toFixed(3)})`);
        console.log(`  distance: ${pos1.distanceTo(pos2).toFixed(3)}`);
      }
    });
  }
  
  handleTileClick(tileIndex) {
    console.log(`Clicked on tile ${tileIndex}:`, this.tiles[tileIndex]);
    // Implement game logic for tile interactions
  }
  
  animate() {
    requestAnimationFrame(this.animate.bind(this));
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
  
  // Helper methods
  shuffle(array) {
    let currentIndex = array.length, randomIndex;
    
    // While there remain elements to shuffle
    while (currentIndex !== 0) {
      // Pick a remaining element
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
      
      // And swap it with the current element
      [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    
    return array;
  }
  
  // Game mechanics methods
  rollDice() {
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    return die1 + die2;
  }
  
  distributeResources(diceValue) {
    // Find all tiles with the rolled dice value
    const matchingTiles = this.tiles.filter(tile => tile.diceValue === diceValue);
    
    // For each matching tile, give resources to players with adjacent settlements/cities
    matchingTiles.forEach(tile => {
      // Find all vertices connected to this tile
      const tileVertices = this.vertices.filter(v => v.tiles.includes(tile.index));
      
      // For each vertex with a settlement/city, give resources to the owner
      tileVertices.forEach(vertex => {
        if (vertex.owner !== null && vertex.level > 0) {
          const player = this.players[vertex.owner];
          const resourceAmount = vertex.level; // 1 for settlement, 2 for city
          
          player.resources[tile.resourceType] += resourceAmount;
        }
      });
    });
  }
  
  // Methods for building roads, settlements, cities, etc.
  buildRoad(edgeKey, playerId) {
    const edge = this.edges.find(e => e.key === edgeKey);
    if (edge && edge.owner === null) {
      // Check if player has required resources
      const player = this.players[playerId];
      if (player.resources.wood >= 1 && player.resources.brick >= 1) {
        // Check if player has a connected road or settlement
        // Logic here would be more complex in a full implementation
        
        // Deduct resources
        player.resources.wood -= 1;
        player.resources.brick -= 1;
        
        // Assign ownership
        edge.owner = playerId;
        
        // Create visual representation
        this.createRoadVisual(edge, playerId);
        
        return true;
      }
    }
    return false;
  }
  
  createRoadVisual(edge, playerId) {
    // Create a visual for the road on the edge
    const positions = this.board.geometry.attributes.position;
    const start = new this.THREE.Vector3(
      positions.getX(edge.vertices[0]),
      positions.getY(edge.vertices[0]),
      positions.getZ(edge.vertices[0])
    ).normalize().multiplyScalar(5.1);
    
    const end = new this.THREE.Vector3(
      positions.getX(edge.vertices[1]),
      positions.getY(edge.vertices[1]),
      positions.getZ(edge.vertices[1])
    ).normalize().multiplyScalar(5.1);
    
    const roadGeometry = new this.THREE.BufferGeometry().setFromPoints([start, end]);
    const roadMaterial = new this.THREE.LineBasicMaterial({ 
      color: this.getPlayerColor(playerId),
      linewidth: 3 
    });
    
    const road = new this.THREE.Line(roadGeometry, roadMaterial);
    this.scene.add(road);
  }
  
  buildSettlement(vertexIndex, playerId) {
    const vertex = this.vertices.find(v => v.index === vertexIndex);
    
    if (vertex && vertex.owner === null) {
      // Check if player has required resources
      const player = this.players[playerId];
      if (player.resources.wood >= 1 && player.resources.brick >= 1 && 
          player.resources.wheat >= 1 && player.resources.sheep >= 1) {
        
        // Check if there are no adjacent settlements (distance rule)
        // This would be more complex in a full implementation
        
        // Deduct resources
        player.resources.wood -= 1;
        player.resources.brick -= 1;
        player.resources.wheat -= 1;
        player.resources.sheep -= 1;
        
        // Assign ownership
        vertex.owner = playerId;
        vertex.level = 1;
        
        // Create visual representation
        this.createSettlementVisual(vertex, playerId);
        
        return true;
      }
    }
    return false;
  }
  
  createSettlementVisual(vertex, playerId) {
    // Create a visual for the settlement at the vertex
    const positions = this.board.geometry.attributes.position;
    const position = new this.THREE.Vector3(
      positions.getX(vertex.index),
      positions.getY(vertex.index),
      positions.getZ(vertex.index)
    ).normalize().multiplyScalar(5.3);
    
    const settlementGeometry = new this.THREE.BoxGeometry(0.2, 0.2, 0.2);
    const settlementMaterial = new this.THREE.MeshLambertMaterial({ color: this.getPlayerColor(playerId) });
    const settlement = new this.THREE.Mesh(settlementGeometry, settlementMaterial);
    
    settlement.position.copy(position);
    this.scene.add(settlement);
  }
  
  getPlayerColor(playerId) {
    const colors = [0xFF0000, 0x0000FF, 0x00FF00, 0xFFFF00];
    return colors[playerId % colors.length];
  }
  
  // Add more game mechanics methods as needed
}

// Helper function to create the game
function createSphericalCatan(containerId, THREE, OrbitControls) {
  return new SphericalCatan(containerId, THREE, OrbitControls);
}

// Export the game creator function
export { createSphericalCatan };