import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js';

export class GrassScene {
  constructor() {
    this.setup();
    this.createTerrain();
    this.createGrass();
    this.addEventListeners();
    this.animate();
  }

  setup() {
    // Scene Setup
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x000000, 0.02);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 2, 0);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000000);
    document.body.appendChild(this.renderer.domElement);

    // Add OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 0.5;
    this.controls.maxDistance = 50;
    this.controls.maxPolarAngle = Math.PI * 0.8;
    this.controls.minPolarAngle = 0.1;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight.position.set(1, 10, 2);
    this.scene.add(directionalLight);

    // Add movement state
    this.moveState = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      up: false,
      down: false,
      speed: 0.1
    };

    // Add key controls
    this.addKeyControls();
  }

  addKeyControls() {
    window.addEventListener('keydown', (e) => {
      switch (e.key.toLowerCase()) {
        case 'w': this.moveState.forward = true; break;
        case 's': this.moveState.backward = true; break;
        case 'a': this.moveState.left = true; break;
        case 'd': this.moveState.right = true; break;
        case ' ': this.moveState.up = true; break; // Space to move up
        case 'shift': this.moveState.down = true; break; // Shift to move down
        case 'arrowup': this.moveState.speed *= 1.1; break; // Speed up
        case 'arrowdown': this.moveState.speed *= 0.9; break; // Slow down
      }
    });

    window.addEventListener('keyup', (e) => {
      switch (e.key.toLowerCase()) {
        case 'w': this.moveState.forward = false; break;
        case 's': this.moveState.backward = false; break;
        case 'a': this.moveState.left = false; break;
        case 'd': this.moveState.right = false; break;
        case ' ': this.moveState.up = false; break;
        case 'shift': this.moveState.down = false; break;
      }
    });
  }

  updateMovement() {
    // Get camera's direction vectors
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);

    this.camera.getWorldDirection(forward);
    right.crossVectors(up, forward).normalize();

    // Remove vertical component from forward movement
    forward.y = 0;
    forward.normalize();

    const moveVector = new THREE.Vector3(0, 0, 0);

    if (this.moveState.forward) moveVector.add(forward);
    if (this.moveState.backward) moveVector.sub(forward);
    if (this.moveState.right) moveVector.add(right);
    if (this.moveState.left) moveVector.sub(right);
    if (this.moveState.up) moveVector.add(up);
    if (this.moveState.down) moveVector.sub(up);

    // Normalize and apply speed
    if (moveVector.length() > 0) {
      moveVector.normalize().multiplyScalar(this.moveState.speed);
      this.camera.position.add(moveVector);
    }
  }

  createTerrain() {
    const simplex = new SimplexNoise();
    const terrainGeometry = new THREE.PlaneGeometry(200, 200, 200, 200);
    this.terrainPos = terrainGeometry.attributes.position;

    for (let i = 0; i < this.terrainPos.count; i++) {
      const x = this.terrainPos.getX(i);
      const z = this.terrainPos.getZ(i);
      
      // Create bowl shape
      const distanceFromCenter = Math.sqrt(x * x + z * z);
      const bowlShape = Math.pow(distanceFromCenter / 100, 2) * 15; // Quadratic bowl
      
      // Create dramatic hills
      const noise = (
        simplex.noise(x * 0.02, z * 0.02) * 6 + // Increased amplitude
        simplex.noise(x * 0.04, z * 0.04) * 4 +
        simplex.noise(x * 0.08, z * 0.08) * 2
      );
      
      // Combine bowl and hills
      this.terrainPos.setY(i, bowlShape + noise);
    }

    terrainGeometry.computeVertexNormals();
    const terrainMaterial = new THREE.MeshStandardMaterial({
      color: 0x000000,
      roughness: 0.9,
      side: THREE.DoubleSide,
    });
    const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
    terrain.rotation.x = -Math.PI / 2;
    this.scene.add(terrain);
  }

  getTerrainHeight(x, z) {
    // Convert world coordinates to terrain grid coordinates
    const gridX = (x + 50) / 100 * 100;
    const gridZ = (z + 50) / 100 * 100;
    
    // Get the four nearest grid points
    const x1 = Math.floor(gridX);
    const x2 = Math.ceil(gridX);
    const z1 = Math.floor(gridZ);
    const z2 = Math.ceil(gridZ);
    
    // Get heights at the four corners
    const h11 = this.terrainPos.getY(x1 + z1 * 101) || 0;
    const h21 = this.terrainPos.getY(x2 + z1 * 101) || 0;
    const h12 = this.terrainPos.getY(x1 + z2 * 101) || 0;
    const h22 = this.terrainPos.getY(x2 + z2 * 101) || 0;
    
    // Bilinear interpolation
    const fx = gridX - x1;
    const fz = gridZ - z1;
    
    const h1 = h11 * (1 - fx) + h21 * fx;
    const h2 = h12 * (1 - fx) + h22 * fx;
    
    return h1 * (1 - fz) + h2 * fz;
  }

  createGrass() {
    const grassCount = 1000000;
    const grassGeometry = new THREE.BufferGeometry();
    const vertices = [];
    const offsets = [];
    const indices = [];
    const opacities = [];
    const scales = [];
    const bendFactors = [];
    const segmentsPerBlade = 4;
    const bladeHeight = 0.4;

    const simplex = new SimplexNoise();

    for (let i = 0; i < grassCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 90;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      
      const y = this.getTerrainHeight(x, z);

      // No distance-based culling - we want grass everywhere
      const scale = 0.8 + Math.random() * 0.4;
      const idx = vertices.length / 3;

      // Create a line with multiple segments
      for (let j = 0; j < segmentsPerBlade; j++) {
        const t = j / (segmentsPerBlade - 1);
        vertices.push(
          x, y + (bladeHeight * scale * t), z
        );

        // Reduce bend factor
        const noiseVal = simplex.noise3d(x * 0.1, y * 0.1, z * 0.1);
        const bendFactor = Math.pow(t, 2) * (0.3 + noiseVal * 0.2);
        bendFactors.push(bendFactor);

        const bladeOffset = Math.random() * Math.PI * 2;
        offsets.push(bladeOffset);

        const opacity = 0.3 + Math.random() * 0.7;
        opacities.push(opacity);

        scales.push(scale);

        // Create line segments
        if (j > 0) {
          indices.push(idx + j - 1, idx + j);
        }
      }
    }

    grassGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    grassGeometry.setAttribute('offset', new THREE.Float32BufferAttribute(offsets, 1));
    grassGeometry.setAttribute('opacity', new THREE.Float32BufferAttribute(opacities, 1));
    grassGeometry.setAttribute('scale', new THREE.Float32BufferAttribute(scales, 1));
    grassGeometry.setAttribute('bendFactor', new THREE.Float32BufferAttribute(bendFactors, 1));
    grassGeometry.setIndex(indices);

    this.grassMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        windStrength: { value: 1.0 }
      },
      vertexShader: `
        uniform float time;
        uniform float windStrength;
        attribute float offset;
        attribute float opacity;
        attribute float scale;
        attribute float bendFactor;
        varying float vOpacity;

        // Simplex noise functions
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

        float snoise(vec2 v) {
          const vec4 C = vec4(0.211324865405187,  // (3.0-sqrt(3.0))/6.0
                              0.366025403784439,  // 0.5*(sqrt(3.0)-1.0)
                             -0.577350269189626,  // -1.0 + 2.0 * C.x
                              0.024390243902439); // 1.0 / 41.0
          vec2 i  = floor(v + dot(v, C.yy) );
          vec2 x0 = v -   i + dot(i, C.xx);
          vec2 i1;
          i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
          vec4 x12 = x0.xyxy + C.xxzz;
          x12.xy -= i1;
          i = mod289(i);
          vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
            + i.x + vec3(0.0, i1.x, 1.0 ));
          vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
          m = m*m ;
          m = m*m ;
          vec3 x = 2.0 * fract(p * C.www) - 1.0;
          vec3 h = abs(x) - 0.5;
          vec3 ox = floor(x + 0.5);
          vec3 a0 = x - ox;
          m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
          vec3 g;
          g.x  = a0.x  * x0.x  + h.x  * x0.y;
          g.yz = a0.yz * x12.xz + h.yz * x12.yw;
          return 130.0 * dot(m, g);
        }

        void main() {
          vec3 transformed = position;
          
          // Create more subtle wind effect
          float timeOffset = time * 1.0 + offset;
          vec2 noiseCoord = vec2(transformed.x * 0.03 + timeOffset, transformed.z * 0.03);
          float noise = snoise(noiseCoord) * windStrength * 0.3;
          
          // Subtler second layer of noise
          noiseCoord = vec2(transformed.x * 0.05 - timeOffset * 0.3, transformed.z * 0.05);
          noise += snoise(noiseCoord) * 0.15 * windStrength;

          // Apply gentler bending
          transformed.x += noise * bendFactor * scale;
          transformed.z += noise * 0.3 * bendFactor * scale;
          
          // Reduced vertical compression
          transformed.y -= abs(noise) * 0.05 * bendFactor * scale;
          
          vOpacity = opacity * (0.6 + 0.4 * (1.0 - abs(noise) * 0.3));
          gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
        }
      `,
      fragmentShader: `
        varying float vOpacity;

        void main() {
          gl_FragColor = vec4(1.0, 1.0, 1.0, vOpacity * 0.7);
        }
      `,
      transparent: true,
      linewidth: 1,
      depthWrite: false,
    });

    const grassMesh = new THREE.LineSegments(grassGeometry, this.grassMaterial);
    this.scene.add(grassMesh);
  }

  animate = () => {
    requestAnimationFrame(this.animate);
    
    // Update movement before controls
    this.updateMovement();
    this.controls.update();
    
    // Gentler wind variation
    this.windStrength = 0.3 + Math.sin(Date.now() * 0.0005) * 0.3;
    this.grassMaterial.uniforms.windStrength.value = this.windStrength;
    this.grassMaterial.uniforms.time.value += 0.01;
    
    this.renderer.render(this.scene, this.camera);
  }

  addEventListeners() {
    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    });
  }
} 
