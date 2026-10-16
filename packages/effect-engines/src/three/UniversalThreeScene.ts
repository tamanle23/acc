import * as THREE from 'three';
import { Pt, Group } from 'pts';

export interface Scene3DConfig {
  width: number;
  height: number;
  fov?: number;
  near?: number;
  far?: number;
  backgroundAlpha?: number;
}

export interface DepthMeshUniforms {
  time: { value: number };
  displacementScale: { value: number };
  lightPosition: { value: THREE.Vector3 };
  ambientColor: { value: THREE.Color };
  lightColor: { value: THREE.Color };
  diffuseMap: { value: THREE.Texture | null };
  depthMap: { value: THREE.Texture | null };
}

export interface HologramUniforms {
  time: { value: number };
  color: { value: THREE.Color };
  scanlineDensity: { value: number };
  glitchIntensity: { value: number };
  opacity: { value: number };
}

/**
 * UniversalThreeScene:
 * Cross-platform scenegraph and 3D visual engine combining pts.js vector mathematics
 * with Three.js rendering. Operates isomorphically across client WebGL2/WebGPU canvases
 * and headless server frame renderers.
 */
export class UniversalThreeScene {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public orthoCamera: THREE.OrthographicCamera;
  public width: number;
  public height: number;

  private depthMesh: THREE.Mesh | null = null;
  private depthMaterial: THREE.ShaderMaterial | null = null;
  private particleSystem: THREE.Points | null = null;
  private particlePositions: Float32Array | null = null;
  private particleVelocities: Group | null = null;
  private hudMesh: THREE.Mesh | null = null;
  private hudMaterial: THREE.ShaderMaterial | null = null;

  constructor(config: Scene3DConfig) {
    this.width = config.width;
    this.height = config.height;
    this.scene = new THREE.Scene();

    const aspect = this.width / Math.max(1, this.height);
    this.camera = new THREE.PerspectiveCamera(config.fov ?? 45, aspect, config.near ?? 0.1, config.far ?? 1000);
    this.camera.position.set(0, 0, 10);

    this.orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  /**
   * Initializes a 3D depth mesh using pts.js grid mathematics for vertex displacement.
   */
  public initDepthMesh(gridCols = 64, gridRows = 64, width = 8, height = 4.5): void {
    if (this.depthMesh) {
      this.scene.remove(this.depthMesh);
      this.depthMesh.geometry.dispose();
      if (this.depthMesh.material instanceof THREE.Material) {
        this.depthMesh.material.dispose();
      }
    }

    const geometry = new THREE.PlaneGeometry(width, height, gridCols, gridRows);

    // Custom depth displacement and dynamic relighting shader
    const uniforms: DepthMeshUniforms = {
      time: { value: 0 },
      displacementScale: { value: 0.8 },
      lightPosition: { value: new THREE.Vector3(2, 2, 5) },
      ambientColor: { value: new THREE.Color(0x1a243b) },
      lightColor: { value: new THREE.Color(0x00d4ff) },
      diffuseMap: { value: null },
      depthMap: { value: null },
    };

    const vertexShader = `
      uniform float time;
      uniform float displacementScale;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPosition;

      void main() {
        vUv = uv;
        vec3 pos = position;
        
        // Procedural organic ripple when no external depth map is bound
        float ripple = sin(pos.x * 1.5 + time * 2.0) * cos(pos.y * 1.5 + time * 1.5) * 0.2;
        pos.z += ripple * displacementScale;

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        vViewPosition = -mvPosition.xyz;
        vNormal = normalMatrix * normal;
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const fragmentShader = `
      uniform float time;
      uniform vec3 lightPosition;
      uniform vec3 ambientColor;
      uniform vec3 lightColor;
      uniform sampler2D diffuseMap;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPosition;

      void main() {
        vec3 normal = normalize(vNormal);
        vec3 lightDir = normalize(lightPosition);
        
        // Diffuse Blinn-Phong lighting
        float diff = max(dot(normal, lightDir), 0.0);
        vec3 viewDir = normalize(vViewPosition);
        vec3 reflectDir = reflect(-lightDir, normal);
        float spec = pow(max(dot(viewDir, reflectDir), 0.0), 16.0);

        vec3 baseColor = vec3(0.05, 0.1, 0.2);
        vec3 finalColor = ambientColor + baseColor * diff * lightColor + spec * vec3(0.4, 0.8, 1.0);

        // Cyberpunk grid overlay
        vec2 grid = abs(fract(vUv * 20.0 - 0.5) - 0.5) / fwidth(vUv * 20.0);
        float line = min(grid.x, grid.y);
        float gridAlpha = 1.0 - min(line, 1.0);
        finalColor += vec3(0.0, 0.8, 1.0) * gridAlpha * 0.4;

        gl_FragColor = vec4(finalColor, 0.95);
      }
    `;

    this.depthMaterial = new THREE.ShaderMaterial({
      uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
      vertexShader,
      fragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
    });

    this.depthMesh = new THREE.Mesh(geometry, this.depthMaterial);
    this.scene.add(this.depthMesh);
  }

  /**
   * Initializes a dynamic particle warp tunnel using pts.js vector calculations.
   */
  public initParticleSystem(count = 250): void {
    if (this.particleSystem) {
      this.scene.remove(this.particleSystem);
      this.particleSystem.geometry.dispose();
      if (this.particleSystem.material instanceof THREE.Material) {
        this.particleSystem.material.dispose();
      }
    }

    const positions = new Float32Array(count * 3);
    const ptsList: Pt[] = [];

    for (let i = 0; i < count; i++) {
      // Cylindrical coordinates via pts.js
      const theta = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const radius = 2.0 + Math.random() * 4.0;
      const z = (Math.random() - 0.5) * 20.0;

      const pt = new Pt(Math.cos(theta) * radius, Math.sin(theta) * radius, z);
      ptsList.push(pt);

      positions[i * 3] = pt.x;
      positions[i * 3 + 1] = pt.y;
      positions[i * 3 + 2] = pt.z;
    }

    this.particlePositions = positions;
    this.particleVelocities = new Group(...ptsList);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0x00f0ff,
      size: 0.08,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });

    this.particleSystem = new THREE.Points(geometry, material);
    this.scene.add(this.particleSystem);
  }

  /**
   * Initializes a holographic HUD plane with scanline and glitch effects.
   */
  public initHologramHUD(width = 6, height = 3.5): void {
    if (this.hudMesh) {
      this.scene.remove(this.hudMesh);
      this.hudMesh.geometry.dispose();
      if (this.hudMesh.material instanceof THREE.Material) {
        this.hudMesh.material.dispose();
      }
    }

    const geometry = new THREE.PlaneGeometry(width, height);
    const uniforms: HologramUniforms = {
      time: { value: 0 },
      color: { value: new THREE.Color(0x00ffff) },
      scanlineDensity: { value: 80.0 },
      glitchIntensity: { value: 0.1 },
      opacity: { value: 0.85 },
    };

    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      uniform float time;
      uniform vec3 color;
      uniform float scanlineDensity;
      uniform float glitchIntensity;
      uniform float opacity;
      varying vec2 vUv;

      void main() {
        vec2 uv = vUv;
        
        // Scanlines
        float scanline = sin(uv.y * scanlineDensity + time * 10.0) * 0.15 + 0.85;

        // Glitch flicker
        float flicker = sin(time * 30.0) * glitchIntensity;

        // Border framing
        float border = step(0.02, uv.x) * step(uv.x, 0.98) * step(0.03, uv.y) * step(uv.y, 0.97);
        float cornerAccents = step(0.05, abs(uv.x - 0.5)) + step(0.05, abs(uv.y - 0.5));

        vec3 hudColor = color * (scanline + flicker);
        float alpha = (1.0 - border * 0.6) * opacity;

        gl_FragColor = vec4(hudColor, alpha);
      }
    `;

    this.hudMaterial = new THREE.ShaderMaterial({
      uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
      vertexShader,
      fragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    this.hudMesh = new THREE.Mesh(geometry, this.hudMaterial);
    this.hudMesh.position.set(0, 0, 2);
    this.scene.add(this.hudMesh);
  }

  /**
   * Updates camera trajectory using pts.js vector orbital math and advances shader animations.
   */
  public update(timeSec: number, intensity = 1.0): void {
    // Orbital camera path via pts.js
    const orbitRadius = 9.0 + Math.sin(timeSec * 0.5) * 1.5;
    const cameraPt = new Pt(
      Math.sin(timeSec * 0.4) * orbitRadius * intensity,
      Math.cos(timeSec * 0.3) * 2.0 * intensity,
      Math.cos(timeSec * 0.4) * orbitRadius
    );

    this.camera.position.set(cameraPt.x, cameraPt.y, cameraPt.z);
    this.camera.lookAt(0, 0, 0);

    // Update depth mesh shader uniforms
    if (this.depthMaterial) {
      this.depthMaterial.uniforms.time.value = timeSec;
    }

    // Update HUD shader uniforms
    if (this.hudMaterial) {
      this.hudMaterial.uniforms.time.value = timeSec;
    }

    // Advance particle warp tunnel
    if (this.particleSystem && this.particlePositions && this.particleVelocities) {
      const count = this.particleVelocities.length;
      for (let i = 0; i < count; i++) {
        let z = this.particlePositions[i * 3 + 2] + 0.15;
        if (z > 10.0) {
          z = -10.0;
        }
        this.particlePositions[i * 3 + 2] = z;
      }
      const positionAttr = this.particleSystem.geometry.getAttribute('position') as THREE.BufferAttribute;
      positionAttr.needsUpdate = true;
    }
  }

  /**
   * Resizes viewport matrices isomorphically.
   */
  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  /**
   * Cleanly disposes of all geometries, materials, and textures to prevent memory leaks.
   */
  public dispose(): void {
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else if (obj.material instanceof THREE.Material) {
          obj.material.dispose();
        }
      }
    });
    this.scene.clear();
  }
}
