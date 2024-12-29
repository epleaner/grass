import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FlyControls } from 'three/examples/jsm/controls/FlyControls.js';
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js';

export class GrassScene {
  constructor() {
    this.chunkSize = 800;
    this.chunksInView = 2;
    this.chunks = new Map();
    this.lastChunkPosition = { x: 0, z: 0 };
    
    this.maxViewDistance = 2000;
    
    this.setup();
    this.createInitialChunks();
    this.addEventListeners();
    this.animate();
  }

  getChunkKey(chunkX, chunkZ) {
    return `${chunkX},${chunkZ}`;
  }

  createChunk(chunkX, chunkZ) {
    const chunkCenterX = chunkX * this.chunkSize;
    const chunkCenterZ = chunkZ * this.chunkSize;
    const distanceToCamera = Math.sqrt(
      Math.pow(chunkCenterX - this.camera.position.x, 2) +
      Math.pow(chunkCenterZ - this.camera.position.z, 2)
    );

    if (distanceToCamera > this.maxViewDistance) {
      return;
    }

    const chunk = {
      terrain: this.createTerrain(chunkX * this.chunkSize, chunkZ * this.chunkSize),
      grass: this.createGrass(chunkX * this.chunkSize, chunkZ * this.chunkSize),
      position: { x: chunkX, z: chunkZ }
    };
    this.chunks.set(this.getChunkKey(chunkX, chunkZ), chunk);
    this.scene.add(chunk.terrain);
    this.scene.add(chunk.grass);
  }

  removeChunk(chunkX, chunkZ) {
    const key = this.getChunkKey(chunkX, chunkZ);
    const chunk = this.chunks.get(key);
    if (chunk) {
      this.scene.remove(chunk.terrain);
      this.scene.remove(chunk.grass);
      this.chunks.delete(key);
    }
  }

  createInitialChunks() {
    const radius = Math.floor(this.chunksInView / 2);
    for (let x = -radius; x <= radius; x++) {
      for (let z = -radius; z <= radius; z++) {
        this.createChunk(x, z);
      }
    }
  }

  updateChunks() {
    const currentChunkX = Math.floor(this.camera.position.x / this.chunkSize);
    const currentChunkZ = Math.floor(this.camera.position.z / this.chunkSize);

    if (currentChunkX !== this.lastChunkPosition.x || 
        currentChunkZ !== this.lastChunkPosition.z) {
      
      const radius = Math.floor(this.chunksInView / 2);
      const newChunks = new Set();

      for (let x = currentChunkX - radius; x <= currentChunkX + radius; x++) {
        for (let z = currentChunkZ - radius; z <= currentChunkZ + radius; z++) {
          const distanceToCamera = Math.sqrt(
            Math.pow(x * this.chunkSize - this.camera.position.x, 2) +
            Math.pow(z * this.chunkSize - this.camera.position.z, 2)
          );

          if (distanceToCamera <= this.maxViewDistance) {
            const key = this.getChunkKey(x, z);
            newChunks.add(key);
            if (!this.chunks.has(key)) {
              this.createChunk(x, z);
            }
          }
        }
      }

      for (const [key, chunk] of this.chunks.entries()) {
        if (!newChunks.has(key)) {
          const [x, z] = key.split(',').map(Number);
          this.removeChunk(x, z);
        }
      }

      this.lastChunkPosition = { x: currentChunkX, z: currentChunkZ };
    }
  }

  setup() {
    // Scene Setup
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x000000, 0.0015);

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      1,
      2500
    );
    this.camera.position.set(0, 100, 150);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000000);
    document.body.appendChild(this.renderer.domElement);

    // Configure FlyControls with modified movement
    this.flyControls = new FlyControls(this.camera, this.renderer.domElement);
    this.flyControls.movementSpeed = 50;
    this.flyControls.domElement = this.renderer.domElement;
    this.flyControls.rollSpeed = 0.5;
    this.flyControls.autoForward = false;
    this.flyControls.dragToLook = false;

    // Initialize moveState if it doesn't exist
    this.flyControls.moveState = this.flyControls.moveState || {};
    
    // Disable A/D strafing in FlyControls
    this.flyControls.moveState.left = 0;
    this.flyControls.moveState.right = 0;
    this.flyControls.moveRight = 0;
    
    // Add custom rotation control
    this.rotationSpeed = 1.0;
    this.keyState = {
      a: false,
      d: false
    };

    // Add key listeners
    window.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'a') this.keyState.a = true;
      if (e.key.toLowerCase() === 'd') this.keyState.d = true;
    });

    window.addEventListener('keyup', (e) => {
      if (e.key.toLowerCase() === 'a') this.keyState.a = false;
      if (e.key.toLowerCase() === 'd') this.keyState.d = false;
    });
    
    // Initialize clock for delta time
    this.clock = new THREE.Clock();

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight.position.set(1, 10, 2);
    this.scene.add(directionalLight);
  }

  createTerrain(offsetX = 0, offsetZ = 0) {
    const simplex = new SimplexNoise();
    const blendNoise = new SimplexNoise();
    const terrainGeometry = new THREE.PlaneGeometry(
      this.chunkSize, 
      this.chunkSize, 
      100, 
      100
    );
    const positions = terrainGeometry.attributes.position;

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i) + offsetX;
      const z = positions.getZ(i) + offsetZ;
      
      const distanceFromCenter = Math.sqrt(x * x + z * z);
      const angle = Math.atan2(z, x);

      // Create bowl shape that curves up dramatically at edges
      const bowlBase = Math.pow(distanceFromCenter / 150, 3) * 80;

      // Create more distinct regions with sharper transitions
      const blend = {
        bowl: Math.max(0, Math.pow(blendNoise.noise(x * 0.02, z * 0.02), 2)),
        waves: Math.max(0, Math.pow(blendNoise.noise(x * 0.02 + 100, z * 0.02), 2)),
        crater: Math.max(0, Math.pow(blendNoise.noise(x * 0.02 + 200, z * 0.02), 2)),
        spiral: Math.max(0, Math.pow(blendNoise.noise(x * 0.02 + 300, z * 0.02), 2)),
        ridges: Math.max(0, Math.pow(blendNoise.noise(x * 0.02 + 400, z * 0.02), 2))
      };

      // Normalize blend values
      const totalBlend = Object.values(blend).reduce((a, b) => a + b, 0);
      Object.keys(blend).forEach(key => {
        blend[key] /= totalBlend;
      });

      // Calculate heights for each pattern
      const heights = {
        bowl: (() => {
          const noise = (
            simplex.noise(x * 0.04, z * 0.04) * 8 +
            simplex.noise(x * 0.08, z * 0.08) * 4
          );
          return bowlBase + noise;
        })(),

        waves: (() => {
          const waves = Math.sin(distanceFromCenter * 0.2) * 12;
          const waveNoise = simplex.noise(x * 0.05, z * 0.05) * 3;
          return bowlBase * 0.7 + waves + waveNoise; // Add to bowl base
        })(),

        crater: (() => {
          const crater1 = Math.exp(-Math.pow(distanceFromCenter - 40, 2) / 300) * 20;
          const crater2 = Math.exp(-Math.pow(distanceFromCenter - 80, 2) / 500) * 15;
          const craterNoise = simplex.noise(x * 0.06, z * 0.06) * 4;
          return bowlBase * 0.8 + Math.max(crater1, crater2) + craterNoise; // Add to bowl base
        })(),

        spiral: (() => {
          const spiralHeight = Math.sin(angle * 5 + distanceFromCenter * 0.1) * 15;
          const spiralNoise = simplex.noise(x * 0.05, z * 0.05) * 5;
          return bowlBase * 0.9 + spiralHeight + spiralNoise; // Add to bowl base
        })(),

        ridges: (() => {
          const ridgeBase = simplex.noise(x * 0.03, z * 0.03);
          const ridges = Math.abs(ridgeBase);
          return bowlBase * 0.85 + Math.pow(ridges, 1.5) * 30; // Add to bowl base
        })()
      };

      // Blend patterns with added variation
      let finalHeight = 0;
      Object.keys(heights).forEach(pattern => {
        finalHeight += heights[pattern] * blend[pattern];
      });

      // Add varying detail noise based on height
      const detailNoise = (
        simplex.noise(x * 0.2, z * 0.2) * 2 +
        simplex.noise(x * 0.4, z * 0.4)
      );
      finalHeight += detailNoise * (1 + Math.abs(finalHeight) * 0.1);

      // Ensure minimum height at edges
      const edgeHeight = Math.pow(distanceFromCenter / 200, 2) * 100;
      finalHeight = Math.max(finalHeight, edgeHeight);

      positions.setY(i, finalHeight);
    }

    terrainGeometry.computeVertexNormals();
    const terrain = new THREE.Mesh(
      terrainGeometry,
      new THREE.MeshStandardMaterial({
        color: 0x000000,
        roughness: 0.9,
        side: THREE.DoubleSide,
      })
    );
    terrain.rotation.x = -Math.PI / 2;
    terrain.position.set(offsetX, 0, offsetZ);
    return terrain;
  }

  getTerrainHeight(x, z) {
    const simplex = new SimplexNoise();
    const blendNoise = new SimplexNoise();
    
    const distanceFromCenter = Math.sqrt(x * x + z * z);
    const angle = Math.atan2(z, x);

    // Create bowl shape that curves up dramatically at edges
    const bowlBase = Math.pow(distanceFromCenter / 150, 3) * 80;

    // Get blend values
    const blend = {
      bowl: Math.max(0, Math.pow(blendNoise.noise(x * 0.02, z * 0.02), 2)),
      waves: Math.max(0, Math.pow(blendNoise.noise(x * 0.02 + 100, z * 0.02), 2)),
      crater: Math.max(0, Math.pow(blendNoise.noise(x * 0.02 + 200, z * 0.02), 2)),
      spiral: Math.max(0, Math.pow(blendNoise.noise(x * 0.02 + 300, z * 0.02), 2)),
      ridges: Math.max(0, Math.pow(blendNoise.noise(x * 0.02 + 400, z * 0.02), 2))
    };

    // Normalize blend values
    const totalBlend = Object.values(blend).reduce((a, b) => a + b, 0);
    Object.keys(blend).forEach(key => {
      blend[key] /= totalBlend;
    });

    // Calculate heights using the same patterns as createTerrain
    const heights = {
      bowl: (() => {
        const noise = (
          simplex.noise(x * 0.04, z * 0.04) * 8 +
          simplex.noise(x * 0.08, z * 0.08) * 4
        );
        return bowlBase + noise;
      })(),

      waves: (() => {
        const waves = Math.sin(distanceFromCenter * 0.2) * 12;
        const waveNoise = simplex.noise(x * 0.05, z * 0.05) * 3;
        return bowlBase * 0.7 + waves + waveNoise;
      })(),

      crater: (() => {
        const crater1 = Math.exp(-Math.pow(distanceFromCenter - 40, 2) / 300) * 20;
        const crater2 = Math.exp(-Math.pow(distanceFromCenter - 80, 2) / 500) * 15;
        const craterNoise = simplex.noise(x * 0.06, z * 0.06) * 4;
        return bowlBase * 0.8 + Math.max(crater1, crater2) + craterNoise;
      })(),

      spiral: (() => {
        const spiralHeight = Math.sin(angle * 5 + distanceFromCenter * 0.1) * 15;
        const spiralNoise = simplex.noise(x * 0.05, z * 0.05) * 5;
        return bowlBase * 0.9 + spiralHeight + spiralNoise;
      })(),

      ridges: (() => {
        const ridgeBase = simplex.noise(x * 0.03, z * 0.03);
        const ridges = Math.abs(ridgeBase);
        return bowlBase * 0.85 + Math.pow(ridges, 1.5) * 30;
      })()
    };

    // Calculate final height
    let finalHeight = 0;
    Object.keys(heights).forEach(pattern => {
      finalHeight += heights[pattern] * blend[pattern];
    });

    // Add detail noise
    const detailNoise = (
      simplex.noise(x * 0.2, z * 0.2) * 2 +
      simplex.noise(x * 0.4, z * 0.4)
    );
    finalHeight += detailNoise * (1 + Math.abs(finalHeight) * 0.1);

    // Ensure minimum height at edges
    const edgeHeight = Math.pow(distanceFromCenter / 200, 2) * 100;
    finalHeight = Math.max(finalHeight, edgeHeight);

    return finalHeight;
  }

  createGrass(offsetX = 0, offsetZ = 0) {
    const grassCount = 50000;
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
      const localX = Math.random() * this.chunkSize - this.chunkSize / 2;
      const localZ = Math.random() * this.chunkSize - this.chunkSize / 2;
      const x = localX + offsetX;
      const z = localZ + offsetZ;
      
      const y = this.getTerrainHeight(x, z);

      // Vary grass height based on terrain height
      const heightScale = 0.6 + Math.abs(Math.sin(y * 0.5)) * 0.4;
      const scale = (0.8 + Math.random() * 0.4) * heightScale;

      // Create blade segments
      for (let j = 0; j < segmentsPerBlade; j++) {
        const t = j / (segmentsPerBlade - 1);
        vertices.push(
          x, y + (bladeHeight * scale * t), z
        );

        const noiseVal = simplex.noise(x * 0.1, z * 0.1);
        const bendFactor = Math.pow(t, 2) * (0.3 + noiseVal * 0.2);
        bendFactors.push(bendFactor);

        const bladeOffset = Math.random() * Math.PI * 2;
        offsets.push(bladeOffset);

        const opacity = 0.3 + Math.random() * 0.7;
        opacities.push(opacity);

        scales.push(scale);

        if (j > 0) {
          indices.push(vertices.length / 3 - 2, vertices.length / 3 - 1);
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
    grassMesh.position.set(0, 0, 0);
    return grassMesh;
  }

  animate = () => {
    requestAnimationFrame(this.animate);
    
    const delta = this.clock.getDelta();
    
    // Update chunks based on camera position
    this.updateChunks();
    
    // Handle rotation
    if (this.keyState.a) {
      this.camera.rotateY(this.rotationSpeed * delta);
    }
    if (this.keyState.d) {
      this.camera.rotateY(-this.rotationSpeed * delta);
    }

    this.flyControls.update(delta);
    
    // Update wind for all grass chunks
    const windStrength = 0.3 + Math.sin(Date.now() * 0.0005) * 0.3;
    for (const chunk of this.chunks.values()) {
      if (chunk.grass.material.uniforms) {
        chunk.grass.material.uniforms.windStrength.value = windStrength;
        chunk.grass.material.uniforms.time.value += 0.01;
      }
    }
    
    this.renderer.render(this.scene, this.camera);
  }

  addEventListeners() {
    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    });
  }

  switchTerrain(pattern) {
    this.scene.remove(this.terrain);
    this.createTerrain(pattern);
  }
} 
