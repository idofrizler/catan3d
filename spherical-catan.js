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
  
  createBoard() {
    const radius = 5;
    const geometry = new this.THREE.IcosahedronGeometry(radius);
    
    // Store original vertices before truncation
    const originalVertices = [];
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      originalVertices.push(new this.THREE.Vector3(
        positions.getX(i),
        positions.getY(i),
        positions.getZ(i)
      ));
    }
    
    // Truncate the icosahedron to create pentagons and hexagons
    this.truncateIcosahedron(geometry);
    
    // Create points to visualize vertices
    const pointsMaterial = new this.THREE.PointsMaterial({ 
      color: 0xffffff,
      size: 0.2,
      sizeAttenuation: true
    });
    
    this.board = new this.THREE.Points(geometry, pointsMaterial);
    this.scene.add(this.board);
    
    // Store vertices for later use
    this.truncatedVertices = [];
    const newPositions = geometry.attributes.position;
    for (let i = 0; i < newPositions.count; i++) {
      this.truncatedVertices.push(new this.THREE.Vector3(
        newPositions.getX(i),
        newPositions.getY(i),
        newPositions.getZ(i)
      ));
    }
    
    // Add edges and faces visualization
    this.addEdgeVisualization();
    this.addFaceVisualization();
  }
  
  mergeCloseVertices(vertices, tolerance = 0.001) {
    const mergedVertices = [];
    const vertexMap = new Map(); // Maps original index to merged index
    
    for (let i = 0; i < vertices.length; i++) {
      const v1 = vertices[i];
      let foundMatch = false;
      
      // Check if this vertex is close to any existing merged vertex
      for (let j = 0; j < mergedVertices.length; j++) {
        const v2 = mergedVertices[j];
        if (v1.distanceTo(v2) < tolerance) {
          vertexMap.set(i, j);
          foundMatch = true;
          break;
        }
      }
      
      // If no match found, add as new vertex
      if (!foundMatch) {
        vertexMap.set(i, mergedVertices.length);
        mergedVertices.push(v1.clone());
      }
    }
    
    return {
      vertices: mergedVertices,
      vertexMap: vertexMap
    };
  }
  
  truncateIcosahedron(geometry) {
    // Get the original vertices and faces
    const positions = geometry.attributes.position;
    const originalVertices = [];
    const originalFaces = [];
    
    // Store original vertices
    for (let i = 0; i < positions.count; i++) {
      originalVertices.push(new this.THREE.Vector3(
        positions.getX(i),
        positions.getY(i),
        positions.getZ(i)
      ));
    }
    
    // Create indices for the original icosahedron faces
    // Each face is a triangle with 3 vertices
    for (let i = 0; i < positions.count; i += 3) {
      originalFaces.push([i, i + 1, i + 2]);
    }
    
    // Create new vertices for the truncated icosahedron
    const newVertices = [];
    const newFaces = [];
    
    // First pass: create hexagons from original faces
    for (let i = 0; i < originalFaces.length; i++) {
      const face = originalFaces[i];
      const v1 = originalVertices[face[0]];
      const v2 = originalVertices[face[1]];
      const v3 = originalVertices[face[2]];
      
      const hexagonVertices = [
        this.truncatePoint(v1, v2, 0.33333),
        this.truncatePoint(v2, v1, 0.33333),
        this.truncatePoint(v2, v3, 0.33333),
        this.truncatePoint(v3, v2, 0.33333),
        this.truncatePoint(v3, v1, 0.33333),
        this.truncatePoint(v1, v3, 0.33333)
      ];
      
      const hexagonIndices = hexagonVertices.map(v => {
        const index = newVertices.length;
        newVertices.push(v);
        return index;
      });
      
      newFaces.push({
        type: 'hexagon',
        vertices: hexagonIndices,
        indices: this.createPolygonIndices(hexagonIndices)
      });
    }
    
    console.log('=== Hexagon Creation ===');
    console.log(`Created ${newFaces.length} hexagons`);
    console.log(`Total hexagon vertices before merging: ${newVertices.length}`);
    
    // Merge close vertices
    const { vertices: mergedVertices, vertexMap } = this.mergeCloseVertices(newVertices);
    console.log(`Total vertices after merging: ${mergedVertices.length}`);
    
    // Update face indices to use merged vertices
    newFaces.forEach(face => {
      face.vertices = face.vertices.map(v => vertexMap.get(v));
      face.indices = this.createPolygonIndices(face.vertices);
    });
    
    // Second pass: create edges between hexagon vertices
    const edges = new Set();
    const CORRECT_EDGE_LENGTH = 1.7525; // Length of edge in truncated icosahedron
    const TOLERANCE = 0.01;
    
    // Helper function to get the other vertex of an edge
    const getOtherVertex = (edge, vertex) => {
      const [v1, v2] = edge.split(',').map(Number);
      return v1 === vertex ? v2 : v1;
    };
    
    console.log('\n=== Edge Creation ===');
    console.log(`Looking for edges with length ${CORRECT_EDGE_LENGTH} ± ${TOLERANCE}`);
    
    // First, find all edges between hexagon vertices
    const allEdges = new Set();
    for (let i = 0; i < mergedVertices.length; i++) {
      for (let j = i + 1; j < mergedVertices.length; j++) {
        const v1 = mergedVertices[i];
        const v2 = mergedVertices[j];
        const distance = v1.distanceTo(v2);
        
        if (Math.abs(distance - CORRECT_EDGE_LENGTH) < TOLERANCE) {
          const edgeKey = `${Math.min(i, j)},${Math.max(i, j)}`;
          allEdges.add(edgeKey);
        }
      }
    }
    
    console.log(`Found ${allEdges.size} total edges between hexagon vertices`);
    
    // Find edges that are shared between hexagons
    const sharedEdges = new Set();
    for (const edge of allEdges) {
      const [v1, v2] = edge.split(',').map(Number);
      let sharedCount = 0;
      
      // Count how many hexagons share this edge
      for (const face of newFaces) {
        if (face.type === 'hexagon') {
          const vertices = face.vertices;
          // Check if both vertices of the edge are in this hexagon
          if (vertices.includes(v1) && vertices.includes(v2)) {
            sharedCount++;
          }
        }
      }
      
      // If edge is shared by two hexagons, add it to shared edges
      if (sharedCount === 2) {
        sharedEdges.add(edge);
      }
    }
    
    console.log(`Found ${sharedEdges.size} edges shared between hexagons`);
    
    // The remaining edges should form our pentagons
    const pentagonEdges = new Set([...allEdges].filter(edge => !sharedEdges.has(edge)));
    console.log(`Found ${pentagonEdges.size} edges for pentagons`);
    
    // Group pentagon edges by vertex
    const vertexEdges = new Map();
    for (const edge of pentagonEdges) {
      const [v1, v2] = edge.split(',').map(Number);
      
      // Add edge to v1's list
      if (!vertexEdges.has(v1)) vertexEdges.set(v1, new Set());
      vertexEdges.get(v1).add(edge);
      
      // Add edge to v2's list
      if (!vertexEdges.has(v2)) vertexEdges.set(v2, new Set());
      vertexEdges.get(v2).add(edge);
    }
    
    // Find cycles of 5 edges to form pentagons
    const processedEdges = new Set();
    let pentagonCount = 0;
    
    // Try to find cycles starting from each edge
    for (const startEdge of pentagonEdges) {
      if (processedEdges.has(startEdge)) continue;
      
      const [startV1, startV2] = startEdge.split(',').map(Number);
      const cycle = [startEdge];
      let currentVertex = startV2;
      let foundCycle = false;
      
      // Try to find a cycle of 5 edges
      while (cycle.length < 5) {
        const connectedEdges = vertexEdges.get(currentVertex);
        if (!connectedEdges) break;
        
        let nextEdge = null;
        // Find an unprocessed edge that connects to current vertex
        for (const edge of connectedEdges) {
          if (!processedEdges.has(edge) && !cycle.includes(edge)) {
            nextEdge = edge;
            break;
          }
        }
        
        if (!nextEdge) break;
        
        cycle.push(nextEdge);
        currentVertex = getOtherVertex(nextEdge, currentVertex);
        
        // If we've reached the start vertex, we found a cycle
        if (currentVertex === startV1) {
          foundCycle = true;
          break;
        }
      }
      
      // If we found a cycle of 5 edges, create a pentagon
      if (foundCycle && cycle.length === 5) {
        console.log(`\n=== Found pentagon! ===`);
        console.log(`Edges: ${cycle.join(' -> ')}`);
        
        pentagonCount++;
        
        // Create vertices for the pentagon
        const faceVertices = [];
        currentVertex = startV1;
        
        // Add vertices in order around the cycle
        for (const edge of cycle) {
          faceVertices.push(currentVertex);
          currentVertex = getOtherVertex(edge, currentVertex);
          processedEdges.add(edge);
        }
        
        newFaces.push({
          type: 'pentagon',
          vertices: faceVertices,
          indices: this.createPolygonIndices(faceVertices)
        });
      }
    }
    
    console.log('\n=== Final Results ===');
    console.log(`Found ${pentagonCount} pentagons`);
    console.log('Processed edges:', Array.from(processedEdges).join('\n'));
    
    // Update the geometry with merged vertices
    const newPositions = new Float32Array(mergedVertices.length * 3);
    for (let i = 0; i < mergedVertices.length; i++) {
      newPositions[i * 3] = mergedVertices[i].x;
      newPositions[i * 3 + 1] = mergedVertices[i].y;
      newPositions[i * 3 + 2] = mergedVertices[i].z;
    }
    
    // Create indices for all faces
    const allIndices = [];
    newFaces.forEach(face => {
      allIndices.push(...face.indices);
    });
    
    geometry.setAttribute('position', new this.THREE.BufferAttribute(newPositions, 3));
    geometry.setIndex(allIndices);
    geometry.computeVertexNormals();
    
    // Store vertices and faces for later use
    this.truncatedVertices = mergedVertices;
    this.faces = newFaces;
    
    // Log counts for debugging
    console.log(`Created ${newFaces.filter(f => f.type === 'pentagon').length} pentagons`);
    console.log(`Created ${newFaces.filter(f => f.type === 'hexagon').length} hexagons`);
    console.log(`Total faces: ${newFaces.length}`);
  }
  
  createPolygonIndices(vertices) {
    const indices = [];
    // Create triangles for the polygon using fan triangulation
    for (let i = 1; i < vertices.length - 1; i++) {
      indices.push(vertices[0], vertices[i], vertices[i + 1]);
    }
    // Add the final triangle to close the polygon
    indices.push(vertices[0], vertices[vertices.length - 1], vertices[1]);
    return indices;
  }
  
  findNeighbors(vertices, vertex) {
    const neighbors = [];
    const EDGE_LENGTH = 4; // Length of icosahedron edge
    const TOLERANCE = 0.1;
    
    for (const v of vertices) {
      if (v !== vertex) {
        const distance = v.distanceTo(vertex);
        if (Math.abs(distance - EDGE_LENGTH) < TOLERANCE) {
          neighbors.push(v);
        }
      }
    }
    
    // Sort neighbors clockwise around the vertex
    if (neighbors.length >= 5) {
      const normal = vertex.clone().normalize();
      const firstNeighbor = neighbors[0];
      const tangent = firstNeighbor.clone().sub(vertex).normalize();
      const bitangent = normal.clone().cross(tangent);
      
      neighbors.sort((a, b) => {
        const aDir = a.clone().sub(vertex);
        const bDir = b.clone().sub(vertex);
        const aAngle = Math.atan2(aDir.dot(bitangent), aDir.dot(tangent));
        const bAngle = Math.atan2(bDir.dot(bitangent), bDir.dot(tangent));
        return aAngle - bAngle;
      });
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
            
            // Add vertex labels
            const label1 = this.createVertexLabel(i, v1);
            const label2 = this.createVertexLabel(j, v2);
            edge.add(label1);
            edge.add(label2);
            
            this.scene.add(edge);
            this.edgeObjects.push(edge);
            addedEdges.add(edgeKey);
          }
        }
      }
    }
  }
  
  createVertexLabel(vertexIndex, position) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 64;
    canvas.height = 64;
    
    // Clear the canvas
    context.clearRect(0, 0, 64, 64);
    
    // Draw a white circle with black border
    context.beginPath();
    context.arc(32, 32, 24, 0, Math.PI * 2);
    context.fillStyle = 'white';
    context.fill();
    context.strokeStyle = 'black';
    context.lineWidth = 2;
    context.stroke();
    
    // Draw the vertex index
    context.fillStyle = 'black';
    context.font = 'bold 24px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(vertexIndex.toString(), 32, 32);
    
    const texture = new this.THREE.CanvasTexture(canvas);
    const material = new this.THREE.SpriteMaterial({ 
      map: texture,
      transparent: true,
      depthTest: false
    });
    
    const sprite = new this.THREE.Sprite(material);
    sprite.scale.set(0.3, 0.3, 1);
    sprite.position.copy(position.normalize().multiplyScalar(5.2));
    sprite.visible = false; // Hidden by default
    
    return sprite;
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
    
    // Create resource distribution for all 32 tiles (12 pentagons + 20 hexagons)
    const allResources = [
      // 6 of each resource (30 resource tiles total)
      'wheat', 'wheat', 'wheat', 'wheat', 'wheat', 'wheat',
      'wood', 'wood', 'wood', 'wood', 'wood', 'wood',
      'sheep', 'sheep', 'sheep', 'sheep', 'sheep', 'sheep',
      'ore', 'ore', 'ore', 'ore', 'ore', 'ore',
      'brick', 'brick', 'brick', 'brick', 'brick', 'brick',
      // 2 deserts
      'desert', 'desert'
    ];
    this.shuffle(allResources);
    
    // Create dice number distribution (3 of each number 2-12, excluding 7)
    const diceNumbers = [];
    for (let num = 2; num <= 12; num++) {
      if (num !== 7) {
        for (let i = 0; i < 3; i++) {
          diceNumbers.push(num);
        }
      }
    }
    this.shuffle(diceNumbers);
    
    let tileCount = 0;
    let diceIndex = 0;
    this.faceObjects = [];  // Store faces for interaction
    
    // Create meshes for each face using the pre-identified faces
    this.faces.forEach((face, faceIndex) => {
      const vertices = face.vertices.map(i => this.truncatedVertices[i]);
      
      // Calculate center
      const center = new this.THREE.Vector3();
      vertices.forEach(v => center.add(v.clone())); // Clone vertices before adding
      center.divideScalar(vertices.length);
      
      // Create geometry
      const geometry = new this.THREE.BufferGeometry();
      
      // Create positions array with center and vertices
      const positions = [];
      
      // Add center point
      positions.push(center.x, center.y, center.z);
      
      // Add all vertices
      vertices.forEach(vertex => {
        positions.push(vertex.x, vertex.y, vertex.z);
      });
      
      // Create indices for triangle fan
      const indices = [];
      for (let i = 1; i <= vertices.length; i++) {
        indices.push(0); // Center point
        indices.push(i); // Current vertex
        indices.push(i % vertices.length + 1); // Next vertex (wrapping around)
      }
      
      geometry.setAttribute('position', new this.THREE.Float32BufferAttribute(positions, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      
      // Assign resource type from shuffled resources
      const resourceType = allResources[tileCount];
      const color = resourceColors[resourceType];
      
      if (!color) {
        console.error('Invalid resource type:', resourceType);
      }
      
      const material = new this.THREE.MeshPhongMaterial({
        color: color || 0x808080, // Fallback to gray if color is undefined
        side: this.THREE.DoubleSide,
        shininess: face.type === 'pentagon' ? 30 : 10
      });
      
      const mesh = new this.THREE.Mesh(geometry, material);
      mesh.userData = {
        type: 'face',
        faceIndex: faceIndex,
        faceType: face.type,
        resourceType: resourceType,
        defaultColor: color || 0x808080,
        isSelected: false,
        vertices: face.vertices,
        vertexCount: vertices.length
      };
      
      this.scene.add(mesh);
      this.faceObjects.push(mesh);
      
      // Add dice number if not a desert
      if (resourceType !== 'desert') {
        // Create a plane geometry for the number
        const numberGeometry = new this.THREE.PlaneGeometry(0.8, 0.8);
        
        // Create canvas for the number
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 64;
        canvas.height = 64;
        
        // Draw the number with a black background
        context.fillStyle = 'black';
        context.fillRect(0, 0, 64, 64);
        context.fillStyle = 'white';
        context.font = 'bold 48px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(diceNumbers[diceIndex].toString(), 32, 32);
        
        // Create texture and material
        const texture = new this.THREE.CanvasTexture(canvas);
        const numberMaterial = new this.THREE.MeshBasicMaterial({
          map: texture,
          side: this.THREE.DoubleSide
        });
        
        // Create mesh for the number
        const numberMesh = new this.THREE.Mesh(numberGeometry, numberMaterial);
        numberMesh.position.copy(center.normalize().multiplyScalar(4.1)); // Move very slightly outward
        
        // Make the number face outward and fix mirroring
        numberMesh.lookAt(new this.THREE.Vector3(0, 0, 0));
        numberMesh.rotateY(Math.PI); // Fix mirroring by rotating 180 degrees
        
        this.scene.add(numberMesh);
        mesh.userData.diceValue = diceNumbers[diceIndex];
        diceIndex++;
      }
      
      // Log face creation for debugging
      console.log(`Created ${face.type} face ${faceIndex} with resource ${resourceType} (color: ${color ? color.toString(16) : 'undefined'})`);
      tileCount++;
    });
    
    // Verify counts
    console.log(`Created ${tileCount} total tiles`);
    console.log(`Total faces: ${this.faceObjects.length}`);
    console.log(`Assigned ${diceIndex} dice numbers`);
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
        // Reset edges of previous face
        this.edgeObjects.forEach(edge => {
          if (hoveredFace.userData.vertices.includes(edge.userData.v1) && 
              hoveredFace.userData.vertices.includes(edge.userData.v2)) {
            if (!hoveredFace.userData.isSelected) {
              edge.material.linewidth = 2;
            }
          }
        });
        hoveredFace = null;
      }
      
      // Check for edge intersections
      const edgeIntersects = raycaster.intersectObjects(this.edgeObjects);
      
      // Reset previous edge hover state
      if (hoveredEdge && (!edgeIntersects.length || edgeIntersects[0].object !== hoveredEdge)) {
        if (!hoveredEdge.userData.isSelected) {
          hoveredEdge.material.color.setHex(hoveredEdge.userData.defaultColor);
          hoveredEdge.material.linewidth = 2;
        }
        // Hide vertex labels
        hoveredEdge.children.forEach(child => {
          if (child instanceof this.THREE.Sprite) {
            child.visible = false;
          }
        });
        hoveredEdge = null;
      }
      
      // Set new hover state - prioritize faces unless very close to an edge
      if (faceIntersects.length > 0 && 
          (!edgeIntersects.length || edgeIntersects[0].distance > faceIntersects[0].distance + 0.1)) {
        const face = faceIntersects[0].object;
        hoveredFace = face;
        
        // Highlight edges of the hovered face
        this.edgeObjects.forEach(edge => {
          if (face.userData.vertices.includes(edge.userData.v1) && 
              face.userData.vertices.includes(edge.userData.v2)) {
            if (!edge.userData.isSelected) {
              edge.material.linewidth = 3;
            }
          }
        });
      } else if (edgeIntersects.length > 0) {
        const edge = edgeIntersects[0].object;
        if (!edge.userData.isSelected) {
          edge.material.color.setHex(0x00FF00); // Hover color: green
          edge.material.linewidth = 3;
        }
        // Show vertex labels
        edge.children.forEach(child => {
          if (child instanceof this.THREE.Sprite) {
            child.visible = true;
          }
        });
        hoveredEdge = edge;
        
        // Log vertex information
        console.log(`Edge ${edge.userData.v1}-${edge.userData.v2}`);
        console.log(`Vertex ${edge.userData.v1} position:`, this.truncatedVertices[edge.userData.v1]);
        console.log(`Vertex ${edge.userData.v2} position:`, this.truncatedVertices[edge.userData.v2]);
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
        
        // Reset all other faces' edges
        this.edgeObjects.forEach(edge => {
          if (!face.userData.vertices.includes(edge.userData.v1) || 
              !face.userData.vertices.includes(edge.userData.v2)) {
            edge.material.linewidth = 2;
            edge.userData.isSelected = false;
          }
        });
        
        // Toggle selected state
        face.userData.isSelected = !face.userData.isSelected;
        
        // Highlight edges of the selected face
        this.edgeObjects.forEach(edge => {
          if (face.userData.vertices.includes(edge.userData.v1) && 
              face.userData.vertices.includes(edge.userData.v2)) {
            edge.material.linewidth = face.userData.isSelected ? 4 : 2;
            edge.userData.isSelected = face.userData.isSelected;
          }
        });
        
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