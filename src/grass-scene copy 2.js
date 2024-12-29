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
    this.camera.position.set(0, 5, 12);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000000);
    document.body.appendChild(this.renderer.domElement);

    // Add OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 0.5;
    this.controls.maxDistance = 30;
    this.controls.maxPolarAngle = Math.PI / 1.5;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight.position.set(1, 10, 2);
    this.scene.add(directionalLight);
  }

  createTerrain() {
    // Terrain Generation code...
    const simplex = new SimplexNoise();
    const terrainGeometry = new THREE.PlaneGeometry(100, 100, 100, 100);
    this.terrainPos = terrainGeometry.attributes.position;

    for (let i = 0; i < this.terrainPos.count; i++) {
      const x = this.terrainPos.getX(i);
      const z = this.terrainPos.getZ(i);
      
      // Add radial falloff for hills in all directions
      const distanceFromCenter = Math.sqrt(x * x + z * z);
      const radialFalloff = 1.0 - Math.min(distanceFromCenter / 50, 1);
      
      const noise = (
        simplex.noise(x * 0.02, z * 0.02) * 4 +
        simplex.noise(x * 0.05, z * 0.05) * 2 +
        simplex.noise(x * 0.1, z * 0.1)
      ) * radialFalloff; // Apply falloff to noise
      
      this.terrainPos.setY(i, noise);
    }

    terrainGeometry.computeVertexNormals();
    const terrainMaterial = new THREE.MeshStandardMaterial({
      color: 0x000000,
      roughness: 0.9,
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
    const grassCount = 500000;
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
      const x = Math.random() * 80 - 40;
      const z = Math.random() * 80 - 40;
      const y = this.getTerrainHeight(x, z);

      // Distance from center affects density
      const distanceFromCenter = Math.sqrt(x * x + z * z);
      if (Math.random() > (1 - distanceFromCenter / 120)) continue;

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
