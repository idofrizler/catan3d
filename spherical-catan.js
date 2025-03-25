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
    
    // Constants for geometry
    this.CORRECT_EDGE_LENGTH = 1.7525; // Edge length for the truncated icosahedron
    this.EDGE_TOLERANCE = 0.01; // Tolerance for edge length comparison
    
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
    
    // Add UI container
    this.uiContainer = document.createElement('div');
    this.uiContainer.style.position = 'absolute';
    this.uiContainer.style.top = '20px';
    this.uiContainer.style.right = '20px';
    this.uiContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    this.uiContainer.style.padding = '10px';
    this.uiContainer.style.borderRadius = '5px';
    this.uiContainer.style.color = 'white';
    this.uiContainer.style.display = 'none';
    this.container.appendChild(this.uiContainer);
    
    // Add building state
    this.buildings = {
      roads: new Map(), // edgeKey -> mesh
      settlements: new Map(), // vertexIndex -> mesh
      cities: new Map() // vertexIndex -> mesh
    };
    
    // Add player state
    this.currentPlayer = {
      color: 0x0000FF, // Blue
      resources: {
        wood: 100,
        brick: 100,
        wheat: 100,
        sheep: 100,
        ore: 100
      }
    };
    
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
    
    // Add edges, faces, and vertices visualization
    this.addEdgeVisualization();
    this.addFaceVisualization();
    this.addVertexVisualization();
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
    const TOLERANCE = this.EDGE_TOLERANCE;
    
    // Helper function to get the other vertex of an edge
    const getOtherVertex = (edge, vertex) => {
      const [v1, v2] = edge.split(',').map(Number);
      return v1 === vertex ? v2 : v1;
    };
    
    console.log('\n=== Edge Creation ===');
    console.log(`Looking for edges with length ${this.CORRECT_EDGE_LENGTH} ± ${TOLERANCE}`);
    
    // First, find all edges between hexagon vertices
    const allEdges = new Set();
    for (let i = 0; i < mergedVertices.length; i++) {
      for (let j = i + 1; j < mergedVertices.length; j++) {
        const v1 = mergedVertices[i];
        const v2 = mergedVertices[j];
        const distance = v1.distanceTo(v2);
        
        if (Math.abs(distance - this.CORRECT_EDGE_LENGTH) < TOLERANCE) {
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
    
    // Use class property instead of defining a new local constant
    const TOLERANCE = this.EDGE_TOLERANCE;
    
    // For each vertex, find its valid neighbors
    for (let i = 0; i < this.truncatedVertices.length; i++) {
      for (let j = i + 1; j < this.truncatedVertices.length; j++) {
        const v1 = this.truncatedVertices[i];
        const v2 = this.truncatedVertices[j];
        const distance = v1.distanceTo(v2);
        
        // Only create edge if vertices are the correct distance apart
        if (Math.abs(distance - this.CORRECT_EDGE_LENGTH) < TOLERANCE) {
          const edgeKey = `${Math.min(i, j)},${Math.max(i, j)}`;
          
          if (!addedEdges.has(edgeKey)) {
            // Create slightly elevated vertices to ensure edges appear above faces
            const elevationFactor = 1.005; // 0.5% higher than faces
            const elevatedV1 = v1.clone().multiplyScalar(elevationFactor);
            const elevatedV2 = v2.clone().multiplyScalar(elevationFactor);
            
            // Create a cylinder between the two points to represent the edge
            // Direction from v1 to v2
            const direction = new this.THREE.Vector3().subVectors(elevatedV2, elevatedV1);
            const length = direction.length();
            
            // Create a cylinder with small radius (thin line)
            // The cylinder's default orientation is along the Y axis
            const normalEdgeRadius = 0.03; // Normal width
            const selectedEdgeRadius = 0.06; // Width when selected
            const edgeGeometry = new this.THREE.CylinderGeometry(
              normalEdgeRadius, normalEdgeRadius, length, 8, 1
            );
            
            // Shift the cylinder so its center is at the origin and it extends along the Y axis
            edgeGeometry.translate(0, length / 2, 0);
            
            // Create the mesh with the geometry
            const edgeMaterial = new this.THREE.MeshBasicMaterial({
              color: 0xFFFFFF,
              opacity: 1.0,
              transparent: false
            });
            
            const edge = new this.THREE.Mesh(edgeGeometry, edgeMaterial);
            edge.renderOrder = 1;
            
            // Store original info for selection and highlighting
            edge.userData = {
              type: 'edge',
              v1: i,
              v2: j,
              defaultColor: 0xFFFFFF,
              isSelected: false,
              normalRadius: normalEdgeRadius,
              selectedRadius: selectedEdgeRadius
            };
            
            // Position and orient the cylinder
            // First position at v1
            edge.position.copy(elevatedV1);
            
            // Then orient along the direction from v1 to v2
            // We need to find the rotation that takes us from the Y axis to our direction vector
            const yAxis = new this.THREE.Vector3(0, 1, 0);
            direction.normalize();
            
            // Get quaternion rotation from Y axis to direction
            const quaternion = new this.THREE.Quaternion().setFromUnitVectors(yAxis, direction);
            edge.quaternion.copy(quaternion);
            
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
        
        // Clear the canvas first
        context.clearRect(0, 0, 64, 64);
        
        // Draw a circular black background
        context.beginPath();
        context.arc(32, 32, 24, 0, Math.PI * 2); // Smaller circle for more padding
        context.fillStyle = 'black';
        context.fill();
        
        // Draw the number
        context.fillStyle = 'white';
        context.font = 'bold 36px Arial'; // Larger font to fill the space
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(diceNumbers[diceIndex].toString(), 32, 32);
        
        // Create texture and material
        const texture = new this.THREE.CanvasTexture(canvas);
        const numberMaterial = new this.THREE.MeshBasicMaterial({
          map: texture,
          side: this.THREE.DoubleSide,
          transparent: true
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
    let hoveredVertex = null;
    let selectedFace = null;
    let selectedEdge = null;
    let selectedVertex = null;
    
    // Constants for colors and sizes
    const HOVER_COLOR = 0x00FF00;  // Green for hover
    const SELECTED_COLOR = 0x00FF00;  // Green for selected
    const DEFAULT_COLOR = 0xFFFFFF;  // White for default
    
    // Update mouse position
    const updateMousePosition = (event) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };
    
    // Helper function to reset hover states
    const resetHoverStates = () => {
      if (hoveredFace && (!selectedFace || hoveredFace !== selectedFace)) {
        hoveredFace = null;
      }
      if (hoveredEdge && (!selectedEdge || hoveredEdge !== selectedEdge)) {
        hoveredEdge = null;
      }
      if (hoveredVertex && (!selectedVertex || hoveredVertex !== selectedVertex)) {
        hoveredVertex = null;
      }
    };
    
    // Helper function to update edge appearance
    const updateEdgeAppearance = (edge, isSelected, isHovered) => {
      const geometry = edge.geometry;
      const height = geometry.parameters.height;
      geometry.dispose();
      
      let radius, color;
      if (isSelected) {
        radius = edge.userData.selectedRadius;
        color = SELECTED_COLOR;
      } else if (isHovered) {
        radius = edge.userData.normalRadius * 1.5;
        color = HOVER_COLOR;
      } else {
        radius = edge.userData.normalRadius;
        color = edge.userData.defaultColor;
      }
      
      const newGeometry = new this.THREE.CylinderGeometry(radius, radius, height, 8, 1);
      newGeometry.translate(0, height / 2, 0);
      edge.geometry = newGeometry;
      edge.material.color.setHex(color);
    };
    
    // Helper function to update vertex appearance
    const updateVertexAppearance = (vertex, isSelected, isHovered) => {
      const geometry = vertex.geometry;
      geometry.dispose();
      
      let radius, color;
      if (isSelected) {
        radius = vertex.userData.selectedRadius;
        color = SELECTED_COLOR;
      } else if (isHovered) {
        radius = vertex.userData.normalRadius * 1.5;
        color = HOVER_COLOR;
      } else {
        radius = vertex.userData.normalRadius;
        color = vertex.userData.defaultColor;
      }
      
      const newGeometry = new this.THREE.SphereGeometry(radius, 32, 32); // Increased segments for smoother appearance
      vertex.geometry = newGeometry;
      vertex.material.color.setHex(color);
    };
    
    // Helper function to update face appearance
    const updateFaceAppearance = (face, isSelected, isHovered) => {
      // Faces don't change appearance anymore
      // This function is kept for consistency but doesn't do anything
    };
    
    // Helper function to update edges of a face
    const updateFaceEdges = (face, isSelected, isHovered) => {
      const color = isSelected || isHovered ? HOVER_COLOR : DEFAULT_COLOR;
      const radius = isSelected ? 0.06 : (isHovered ? 0.045 : 0.03);
      
      this.edgeObjects.forEach(edge => {
        if (face.userData.vertices.includes(edge.userData.v1) && 
            face.userData.vertices.includes(edge.userData.v2)) {
          const geometry = edge.geometry;
          const height = geometry.parameters.height;
          geometry.dispose();
          
          const newGeometry = new this.THREE.CylinderGeometry(radius, radius, height, 8, 1);
          newGeometry.translate(0, height / 2, 0);
          edge.geometry = newGeometry;
          edge.material.color.setHex(color);
        }
      });
    };
    
    // Handle mouse move for hover effect
    this.container.addEventListener('mousemove', (event) => {
      updateMousePosition(event);
      
      // Cast a ray
      raycaster.setFromCamera(mouse, this.camera);
      
      // Adjust raycaster parameters to favor faces over edges and vertices
      raycaster.params.Line.threshold = 0.05;
      raycaster.params.Points.threshold = 0.1;
      
      // Check for intersections in order of priority: faces > edges > vertices
      const faceIntersects = raycaster.intersectObjects(this.faceObjects);
      const edgeIntersects = raycaster.intersectObjects(this.edgeObjects);
      const vertexIntersects = raycaster.intersectObjects(this.vertexObjects);
      
      // Reset only non-selected hover effects
          this.edgeObjects.forEach(edge => {
        if (!edge.userData.isSelected) {
                const geometry = edge.geometry;
          const height = geometry.parameters.height;
                geometry.dispose();
          const newGeometry = new this.THREE.CylinderGeometry(0.03, 0.03, height, 8, 1);
          newGeometry.translate(0, height / 2, 0);
                edge.geometry = newGeometry;
          edge.material.color.setHex(DEFAULT_COLOR);
        }
      });
      
      // Only update the hovered vertex, not all vertices
      let hoveredVertex = null;
      if (vertexIntersects.length > 0) {
        hoveredVertex = vertexIntersects[0].object;
        if (!hoveredVertex.userData.isSelected) {
          const geometry = hoveredVertex.geometry;
          geometry.dispose();
          const newGeometry = new this.THREE.SphereGeometry(0.08, 32, 32);
          hoveredVertex.geometry = newGeometry;
          hoveredVertex.material.color.setHex(HOVER_COLOR);
        }
      }
      
      // Reset any previously hovered vertex that's not selected
      this.vertexObjects.forEach(vertex => {
        if (vertex !== hoveredVertex && !vertex.userData.isSelected) {
          const geometry = vertex.geometry;
              geometry.dispose();
          const newGeometry = new this.THREE.SphereGeometry(0.08, 32, 32);
          vertex.geometry = newGeometry;
          vertex.material.color.setHex(DEFAULT_COLOR);
        }
      });
      
      // Set new hover state based on priority
      if (faceIntersects.length > 0 && 
          (!edgeIntersects.length || edgeIntersects[0].distance > faceIntersects[0].distance + 0.1) &&
          (!vertexIntersects.length || vertexIntersects[0].distance > faceIntersects[0].distance + 0.1)) {
        const face = faceIntersects[0].object;
        updateFaceEdges(face, false, true);
      } else if (edgeIntersects.length > 0 && 
                 (!vertexIntersects.length || edgeIntersects[0].distance > vertexIntersects[0].distance + 0.1)) {
        const edge = edgeIntersects[0].object;
        if (!edge.userData.isSelected) {
          const geometry = edge.geometry;
          const height = geometry.parameters.height;
          geometry.dispose();
          const newGeometry = new this.THREE.CylinderGeometry(0.045, 0.045, height, 8, 1);
          newGeometry.translate(0, height / 2, 0);
          edge.geometry = newGeometry;
          edge.material.color.setHex(HOVER_COLOR);
        }
      } else if (vertexIntersects.length > 0) {
        const vertex = vertexIntersects[0].object;
        if (!vertex.userData.isSelected) {
          const geometry = vertex.geometry;
          geometry.dispose();
          const newGeometry = new this.THREE.SphereGeometry(0.08, 16, 16);
          vertex.geometry = newGeometry;
          vertex.material.color.setHex(HOVER_COLOR);
        
        // Log vertex information
          const pos = this.truncatedVertices[vertex.userData.vertexIndex];
          console.log(`Vertex ${vertex.userData.vertexIndex}:`);
          console.log(`  Position: (${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}, ${pos.z.toFixed(3)})`);
        }
      }
    });
    
    // Handle click
    this.container.addEventListener('click', (event) => {
      updateMousePosition(event);
      
      // Cast a ray
      raycaster.setFromCamera(mouse, this.camera);
      
      // Check for intersections in order of priority
      const faceIntersects = raycaster.intersectObjects(this.faceObjects);
      const edgeIntersects = raycaster.intersectObjects(this.edgeObjects);
      const vertexIntersects = raycaster.intersectObjects(this.vertexObjects);
      
      // Reset all highlights first
        this.edgeObjects.forEach(edge => {
        edge.userData.isSelected = false;
            const geometry = edge.geometry;
            const height = geometry.parameters.height;
            geometry.dispose();
        const newGeometry = new this.THREE.CylinderGeometry(0.03, 0.03, height, 8, 1);
            newGeometry.translate(0, height / 2, 0);
            edge.geometry = newGeometry;
        edge.material.color.setHex(DEFAULT_COLOR);
      });
      
      // Reset all vertices first
      this.vertexObjects.forEach(vertex => {
        vertex.userData.isSelected = false;
        const geometry = vertex.geometry;
        geometry.dispose();
        const newGeometry = new this.THREE.SphereGeometry(0.08, 32, 32);
        vertex.geometry = newGeometry;
        vertex.material.color.setHex(DEFAULT_COLOR);
      });
      
      // Handle selection based on priority
      if (faceIntersects.length > 0 && 
          (!edgeIntersects.length || edgeIntersects[0].distance > faceIntersects[0].distance + 0.1) &&
          (!vertexIntersects.length || vertexIntersects[0].distance > faceIntersects[0].distance + 0.1)) {
        const face = faceIntersects[0].object;
        // Mark all edges of the face as selected
          this.edgeObjects.forEach(edge => {
            if (face.userData.vertices.includes(edge.userData.v1) && 
                face.userData.vertices.includes(edge.userData.v2)) {
            edge.userData.isSelected = true;
          }
        });
        updateFaceEdges(face, true, false);
        
        // Log face information
        console.log(`Face ${face.userData.faceIndex}:`);
        console.log(`  Type: ${face.userData.faceType}`);
        console.log(`  Resource: ${face.userData.resourceType}`);
        console.log(`  Vertices: [${face.userData.vertices.join(', ')}]`);
      } else if (edgeIntersects.length > 0 && 
                 (!vertexIntersects.length || edgeIntersects[0].distance > vertexIntersects[0].distance + 0.1)) {
        const edge = edgeIntersects[0].object;
        edge.userData.isSelected = true;
          const geometry = edge.geometry;
          const height = geometry.parameters.height;
          geometry.dispose();
        const newGeometry = new this.THREE.CylinderGeometry(0.06, 0.06, height, 8, 1);
          newGeometry.translate(0, height / 2, 0);
          edge.geometry = newGeometry;
        edge.material.color.setHex(HOVER_COLOR);
        
        // Show build options for edge
        const edgeKey = `${edge.userData.v1},${edge.userData.v2}`;
        this.showBuildOptions('edge', edgeKey);
      } else if (vertexIntersects.length > 0) {
        const vertex = vertexIntersects[0].object;
        vertex.userData.isSelected = true;
        const geometry = vertex.geometry;
        geometry.dispose();
        const newGeometry = new this.THREE.SphereGeometry(0.08, 32, 32);
        vertex.geometry = newGeometry;
        vertex.material.color.setHex(HOVER_COLOR);
        
        // Show build options for vertex
        this.showBuildOptions('vertex', vertex.userData.vertexIndex);
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
  buildRoad(edgeKey) {
    const edge = this.edgeObjects.find(e => 
      `${e.userData.v1},${e.userData.v2}` === edgeKey || 
      `${e.userData.v2},${e.userData.v1}` === edgeKey
    );
    
    if (edge && !this.buildings.roads.has(edgeKey)) {
      // Get the vertices of the edge
      const v1 = this.truncatedVertices[edge.userData.v1];
      const v2 = this.truncatedVertices[edge.userData.v2];
      
      // Calculate road position and direction
      const roadStart = v1.clone().multiplyScalar(1.01);  // Slightly elevated
      const roadEnd = v2.clone().multiplyScalar(1.01);    // Slightly elevated
      const roadCenter = roadStart.clone().add(roadEnd).multiplyScalar(0.5);
      const roadLength = roadStart.distanceTo(roadEnd);
      const roadDirection = roadEnd.clone().sub(roadStart).normalize();
      
      // Create road geometry - note the swapped dimensions to align with direction
      const roadGeometry = new this.THREE.BoxGeometry(0.05, roadLength, 0.1);
      const roadMaterial = new this.THREE.MeshBasicMaterial({ color: this.currentPlayer.color });
      const road = new this.THREE.Mesh(roadGeometry, roadMaterial);
      
      // Position road at center
      road.position.copy(roadCenter);
      
      // Orient road along the edge
      // We want to rotate from the Y axis (BoxGeometry's default orientation)
      // to our edge direction
      const yAxis = new this.THREE.Vector3(0, 1, 0);
      road.quaternion.setFromUnitVectors(yAxis, roadDirection);
      
      this.scene.add(road);
      this.buildings.roads.set(edgeKey, road);
      
      // Deduct resources
      this.currentPlayer.resources.wood--;
      this.currentPlayer.resources.brick--;
      
      this.hideBuildOptions();
    }
  }
  
  buildSettlement(vertexIndex) {
    if (!this.buildings.settlements.has(vertexIndex)) {
      const position = this.truncatedVertices[vertexIndex].clone().multiplyScalar(1.01); // Move very slightly outward
      const settlement = this.createSettlementVisual(vertexIndex, position);
      this.scene.add(settlement);
      this.buildings.settlements.set(vertexIndex, settlement);
      
      // Deduct resources
      this.currentPlayer.resources.wood--;
      this.currentPlayer.resources.brick--;
      this.currentPlayer.resources.wheat--;
      this.currentPlayer.resources.sheep--;
      
      this.hideBuildOptions();
    }
  }
  
  createSettlementVisual(vertexIndex, position) {
    // Simple house shape
    const houseGeometry = new this.THREE.BoxGeometry(0.15, 0.15, 0.15); // Slightly smaller
    const roofGeometry = new this.THREE.ConeGeometry(0.12, 0.15, 4);
    
    const houseMaterial = new this.THREE.MeshBasicMaterial({ color: this.currentPlayer.color });
    const roofMaterial = new this.THREE.MeshBasicMaterial({ color: 0x8B4513 }); // Brown roof
    
    const house = new this.THREE.Mesh(houseGeometry, houseMaterial);
    const roof = new this.THREE.Mesh(roofGeometry, roofMaterial);
    
    house.position.copy(position);
    roof.position.copy(position).add(new this.THREE.Vector3(0, 0.1, 0));
    
    const group = new this.THREE.Group();
    group.add(house);
    group.add(roof);
    
    return group;
  }
  
  createCityVisual(vertexIndex, position) {
    // Larger, rounder building
    const baseGeometry = new this.THREE.CylinderGeometry(0.12, 0.12, 0.2, 8); // Slightly smaller
    const roofGeometry = new this.THREE.ConeGeometry(0.15, 0.2, 8);
    
    const baseMaterial = new this.THREE.MeshBasicMaterial({ color: this.currentPlayer.color });
    const roofMaterial = new this.THREE.MeshBasicMaterial({ color: 0x8B4513 }); // Brown roof
    
    const base = new this.THREE.Mesh(baseGeometry, baseMaterial);
    const roof = new this.THREE.Mesh(roofGeometry, roofMaterial);
    
    base.position.copy(position);
    roof.position.copy(position).add(new this.THREE.Vector3(0, 0.15, 0));
    
    const group = new this.THREE.Group();
    group.add(base);
    group.add(roof);
    
    return group;
  }
  
  showBuildOptions(type, data) {
    this.uiContainer.innerHTML = '';
    this.uiContainer.style.display = 'block';
    
    switch(type) {
      case 'edge':
        const buildRoadButton = document.createElement('button');
        buildRoadButton.textContent = 'Build Road';
        buildRoadButton.onclick = () => this.buildRoad(data);
        this.uiContainer.appendChild(buildRoadButton);
        break;
        
      case 'vertex':
        const vertexIndex = data;
        if (this.buildings.settlements.has(vertexIndex)) {
          const upgradeCityButton = document.createElement('button');
          upgradeCityButton.textContent = 'Upgrade to City';
          upgradeCityButton.onclick = () => this.upgradeToCity(vertexIndex);
          this.uiContainer.appendChild(upgradeCityButton);
        } else {
          const buildSettlementButton = document.createElement('button');
          buildSettlementButton.textContent = 'Build Settlement';
          buildSettlementButton.onclick = () => this.buildSettlement(vertexIndex);
          this.uiContainer.appendChild(buildSettlementButton);
        }
        break;
    }
  }
  
  hideBuildOptions() {
    this.uiContainer.style.display = 'none';
  }
  
  upgradeToCity(vertexIndex) {
    if (this.buildings.settlements.has(vertexIndex) && !this.buildings.cities.has(vertexIndex)) {
      // Remove settlement
      const settlement = this.buildings.settlements.get(vertexIndex);
      this.scene.remove(settlement);
      this.buildings.settlements.delete(vertexIndex);
      
      // Add city
      const position = this.truncatedVertices[vertexIndex].clone().multiplyScalar(1.01); // Move very slightly outward
      const city = this.createCityVisual(vertexIndex, position);
      this.scene.add(city);
      this.buildings.cities.set(vertexIndex, city);
      
      // Deduct resources
      this.currentPlayer.resources.wheat -= 2;
      this.currentPlayer.resources.ore -= 3;
      
      this.hideBuildOptions();
    }
  }
  
  addVertexVisualization() {
    // Store vertices for interaction
    this.vertexObjects = [];
    
    // Create slightly elevated vertices to ensure they appear above faces
    const elevationFactor = 1.01; // 1% higher than faces
    
    // Create vertex spheres
    this.truncatedVertices.forEach((vertex, index) => {
      const elevatedVertex = vertex.clone().multiplyScalar(elevationFactor);
      
      // Create a small sphere for the vertex
      const vertexGeometry = new this.THREE.SphereGeometry(0.08, 32, 32);
      const vertexMaterial = new this.THREE.MeshBasicMaterial({
        color: 0xFFFFFF,
        opacity: 1.0,
        transparent: false,
        depthWrite: true,
        depthTest: true
      });
      
      const vertexMesh = new this.THREE.Mesh(vertexGeometry, vertexMaterial);
      vertexMesh.position.copy(elevatedVertex);
      vertexMesh.renderOrder = 3; // Increased render order to ensure it's above everything
      
      // Store original info for selection and highlighting
      vertexMesh.userData = {
        type: 'vertex',
        vertexIndex: index,
        defaultColor: 0xFFFFFF,
        isSelected: false,
        normalRadius: 0.08,
        selectedRadius: 0.12
      };
      
      this.scene.add(vertexMesh);
      this.vertexObjects.push(vertexMesh);
    });
  }
  
  // Add more game mechanics methods as needed
}

// Helper function to create the game
function createSphericalCatan(containerId, THREE, OrbitControls) {
  return new SphericalCatan(containerId, THREE, OrbitControls);
}

// Export the game creator function
export { createSphericalCatan };