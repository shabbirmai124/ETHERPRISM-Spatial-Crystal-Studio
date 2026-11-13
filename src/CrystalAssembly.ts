// =========================================================================
// Project: AetherPrism XR — Spatial Crystal Resonator
// Author: Md Shabbir Mia
// Module: High-Detail Procedural PBR Crystal & Gimballed Orbital Assembly
// =========================================================================

import * as THREE from 'three';
import * as xb from 'xrblocks';

import {
  type CrystalState,
  RESONANCE_PRESETS,
  finiteOr,
  isValidPresetId,
  stepSpringScale,
} from './crystalState';

const PARTICLE_COUNT = 72;
const _tmpColorA = new THREE.Color();
const _tmpColorB = new THREE.Color();

function applyHighResSampling(
  texture: THREE.Texture,
  anisotropy = 16
): THREE.Texture {
  texture.anisotropy = anisotropy;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function createRadialGlowTexture(
  innerColor: string,
  midColor: string,
  size = 256
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const half = size / 2;
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0, innerColor);
    grad.addColorStop(0.28, midColor);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return applyHighResSampling(texture, 8) as THREE.CanvasTexture;
}

/**
 * Generates a 1024x1024 micro-crystalline striation texture for subtle physical
 * bump and roughness variation across crystal facets.
 */
function createCrystalMicroFacetTexture(size = 1024): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'rgb(128, 128, 128)';
    ctx.fillRect(0, 0, size, size);

    // Fine deterministic crystalline growth lines
    for (let i = 0; i < 160; i++) {
      const y = (i / 160) * size;
      const shade = 112 + ((i * 29) % 36);
      ctx.strokeStyle = `rgba(${shade}, ${shade}, ${shade}, 0.25)`;
      ctx.lineWidth = 1 + (i % 3);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y + ((i % 2 === 0 ? 1 : -1) * 18));
      ctx.stroke();
    }

    // Subtle geometric lattice gleams
    for (let i = 0; i < 42; i++) {
      const x = ((i * 173) % size);
      const y = ((i * 251) % size);
      const radius = 32 + ((i * 19) % 64);
      const grad = ctx.createRadialGradient(x, y, 2, x, y, radius);
      grad.addColorStop(0, 'rgba(220, 220, 220, 0.14)');
      grad.addColorStop(1, 'rgba(128, 128, 128, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return applyHighResSampling(texture, 16) as THREE.CanvasTexture;
}

/**
 * Generates a high-resolution 1024x1024 calibrated holographic emitter pedestal
 * texture with crisp degree ticks and concentric telemetry rings.
 */
function createEmitterRingTexture(size = 1024): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const half = size / 2;
    ctx.clearRect(0, 0, size, size);

    const radial = ctx.createRadialGradient(half, half, 12, half, half, half);
    radial.addColorStop(0, 'rgba(56, 189, 248, 0.42)');
    radial.addColorStop(0.45, 'rgba(168, 85, 247, 0.16)');
    radial.addColorStop(0.85, 'rgba(14, 165, 233, 0.05)');
    radial.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, size, size);

    // Primary calibrated ring
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.68)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(half, half, half * 0.62, 0, Math.PI * 2);
    ctx.stroke();

    // Inner precision ring
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.42)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(half, half, half * 0.44, 0, Math.PI * 2);
    ctx.stroke();

    // Outer segmented telemetry track
    ctx.strokeStyle = 'rgba(192, 132, 252, 0.5)';
    ctx.lineWidth = 3;
    ctx.setLineDash([22, 18]);
    ctx.beginPath();
    ctx.arc(half, half, half * 0.82, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Calibrated radial compass ticks
    for (let deg = 0; deg < 360; deg += 15) {
      const rad = (deg * Math.PI) / 180;
      const major = deg % 45 === 0;
      const rIn = half * (major ? 0.65 : 0.69);
      const rOut = half * (major ? 0.77 : 0.74);
      ctx.strokeStyle = major
        ? 'rgba(186, 230, 253, 0.75)'
        : 'rgba(125, 211, 252, 0.35)';
      ctx.lineWidth = major ? 3 : 1.5;
      ctx.beginPath();
      ctx.moveTo(half + Math.cos(rad) * rIn, half + Math.sin(rad) * rIn);
      ctx.lineTo(half + Math.cos(rad) * rOut, half + Math.sin(rad) * rOut);
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return applyHighResSampling(texture, 16) as THREE.CanvasTexture;
}

export class CrystalAssembly extends xb.Script {
  private readonly onCrystalPulse?: () => void;

  private readonly anchorGroup = new THREE.Group();
  private readonly crystalCluster = new THREE.Group();
  private readonly primaryRingGroup = new THREE.Group();
  private readonly secondaryRingGroup = new THREE.Group();

  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly textures: THREE.Texture[] = [];

  private outerCrystalMat!: THREE.MeshPhysicalMaterial;
  private facetEdgeMat!: THREE.LineBasicMaterial;
  private latticeEdgeMat!: THREE.LineBasicMaterial;
  private innerCoreMat!: THREE.MeshStandardMaterial;
  private coreHaloMat!: THREE.SpriteMaterial;
  private spireMat!: THREE.MeshPhysicalMaterial;
  private trimMetalMat!: THREE.MeshStandardMaterial;
  private channelGlowMat!: THREE.MeshStandardMaterial;
  private primaryRingMat!: THREE.MeshPhysicalMaterial;
  private primaryFilamentMat!: THREE.MeshStandardMaterial;
  private secondaryRingMat!: THREE.MeshPhysicalMaterial;
  private orbMat!: THREE.MeshStandardMaterial;
  private orbHaloMat!: THREE.SpriteMaterial;
  private emitterMat!: THREE.MeshBasicMaterial;
  private beamMat!: THREE.MeshBasicMaterial;
  private particleMat!: THREE.PointsMaterial;
  private crystalLight!: THREE.PointLight;

  private emitterDisc!: THREE.Mesh;
  private particles!: THREE.Points;

  private targetCrystalColor = new THREE.Color(0x00d4ff);
  private targetCoreEmissive = new THREE.Color(0x38bdf8);
  private targetRingColor = new THREE.Color(0xa855f7);
  private targetRingEmissive = new THREE.Color(0x581c87);
  private targetOrbColor = new THREE.Color(0x34d399);

  private orbitDirection: 1 | -1 = 1;
  private orbitSpeed = 1.0;
  private baseScale = 1.0;

  private springScale = 1.0;
  private springVelocity = 0.0;
  private pulseFlash = 0.0;
  private isHovered = false;
  private elapsed = 0;
  private disposed = false;
  private readonly dragStartPos = new THREE.Vector3();

  // Front-camera hand movement steering targets
  private handSteerActive = false;
  private targetHandYaw = 0;
  private targetHandPitch = 0;
  private currentHandYaw = 0;
  private currentHandPitch = 0;

  constructor(onCrystalPulse?: () => void) {
    super();
    this.name = 'AetherPrism Crystal Assembly';
    this.onCrystalPulse = onCrystalPulse;
    this.xb = {
      manipulation: {
        actions: {
          translate: true,
          scale: {minScale: 0.65, maxScale: 1.85},
        },
        handle: {action: xb.ManipulationAction.Translate},
      },
    };
    this.buildAssembly();
  }

  private trackGeo<T extends THREE.BufferGeometry>(geo: T): T {
    this.geometries.push(geo);
    return geo;
  }

  private trackMat<T extends THREE.Material>(mat: T): T {
    this.materials.push(mat);
    return mat;
  }

  private trackTex<T extends THREE.Texture>(tex: T): T {
    this.textures.push(tex);
    return tex;
  }

  private buildAssembly(): void {
    // Positioned symmetrically left of center so SpatialHudCard sits cleanly at right;
    // keeping origin at the crystal center ensures 3D grab-translate & scale pivot cleanly.
    this.position.set(-0.46, 1.40, -1.28);
    this.add(this.anchorGroup);

    // Dynamic internal point light that illuminates metallic bezels & orbital moons
    this.crystalLight = new THREE.PointLight(0x38bdf8, 1.8, 3.0, 2.0);
    this.crystalLight.position.set(0, 0, 0);
    this.anchorGroup.add(this.crystalLight);

    // 1. Calibrated 1024px holographic projection pedestal + subtle upward light cone
    const emitterTex = this.trackTex(createEmitterRingTexture(1024));
    this.emitterMat = this.trackMat(
      new THREE.MeshBasicMaterial({
        map: emitterTex,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      })
    );
    const emitterGeo = this.trackGeo(new THREE.CircleGeometry(0.48, 64));
    this.emitterDisc = new THREE.Mesh(emitterGeo, this.emitterMat);
    this.emitterDisc.rotation.x = -Math.PI / 2;
    this.emitterDisc.position.set(0, -0.54, 0);
    this.emitterDisc.xb = {pointerEvents: 'none'};
    this.anchorGroup.add(this.emitterDisc);

    this.beamMat = this.trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.055,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      })
    );
    const beamGeo = this.trackGeo(
      new THREE.CylinderGeometry(0.18, 0.41, 0.44, 48, 1, true)
    );
    const beamMesh = new THREE.Mesh(beamGeo, this.beamMat);
    beamMesh.position.set(0, -0.32, 0);
    beamMesh.xb = {pointerEvents: 'none'};
    this.anchorGroup.add(beamMesh);

    // 2. Central crystal cluster (interactive raycast target)
    this.anchorGroup.add(this.crystalCluster);

    // Inner incandescent plasma core + internal lattice cage + optical halo sprite
    this.innerCoreMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x38bdf8,
        emissiveIntensity: 2.0,
        roughness: 0.1,
        metalness: 0.05,
      })
    );
    const innerGeo = this.trackGeo(new THREE.OctahedronGeometry(0.105, 1));
    const innerMesh = new THREE.Mesh(innerGeo, this.innerCoreMat);
    this.crystalCluster.add(innerMesh);

    const latticeEdgesGeo = this.trackGeo(
      new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.16, 0))
    );
    this.latticeEdgeMat = this.trackMat(
      new THREE.LineBasicMaterial({
        color: 0xe0f2fe,
        transparent: true,
        opacity: 0.55,
      })
    );
    const latticeWire = new THREE.LineSegments(latticeEdgesGeo, this.latticeEdgeMat);
    latticeWire.xb = {pointerEvents: 'none'};
    this.crystalCluster.add(latticeWire);

    const coreHaloTex = this.trackTex(
      createRadialGlowTexture(
        'rgba(255, 255, 255, 0.92)',
        'rgba(56, 189, 248, 0.36)',
        256
      )
    );
    this.coreHaloMat = this.trackMat(
      new THREE.SpriteMaterial({
        map: coreHaloTex,
        color: 0xbae6fd,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    const coreHalo = new THREE.Sprite(this.coreHaloMat);
    coreHalo.scale.setScalar(0.58);
    coreHalo.xb = {pointerEvents: 'none'};
    this.crystalCluster.add(coreHalo);

    // Faceted optical crystal shell with procedural micro-striation relief
    const microFacetTex = this.trackTex(createCrystalMicroFacetTexture(1024));
    this.outerCrystalMat = this.trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0x00d4ff,
        emissive: 0x0284c7,
        emissiveIntensity: 0.22,
        roughness: 0.07,
        metalness: 0.05,
        bumpMap: microFacetTex,
        bumpScale: 0.007,
        roughnessMap: microFacetTex,
        clearcoat: 1.0,
        clearcoatRoughness: 0.03,
        iridescence: 1.0,
        iridescenceIOR: 1.46,
        iridescenceThicknessRange: [150, 560],
        ior: 1.54,
        reflectivity: 1.0,
        specularIntensity: 1.0,
        envMapIntensity: 2.4,
        sheen: 0.45,
        transparent: true,
        opacity: 0.78,
        flatShading: true,
      })
    );
    const outerGeo = this.trackGeo(new THREE.IcosahedronGeometry(0.22, 0));
    const outerMesh = new THREE.Mesh(outerGeo, this.outerCrystalMat);
    outerMesh.castShadow = true;
    this.crystalCluster.add(outerMesh);

    const outerEdgeGeo = this.trackGeo(new THREE.EdgesGeometry(outerGeo));
    this.facetEdgeMat = this.trackMat(
      new THREE.LineBasicMaterial({
        color: 0xe0f2fe,
        transparent: true,
        opacity: 0.48,
      })
    );
    const outerEdgeLines = new THREE.LineSegments(outerEdgeGeo, this.facetEdgeMat);
    outerEdgeLines.xb = {pointerEvents: 'none'};
    this.crystalCluster.add(outerEdgeLines);

    // Brushed aerospace titanium hardware + recessed equatorial glow channel
    this.trimMetalMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.24,
        metalness: 0.92,
        envMapIntensity: 1.9,
      })
    );
    this.channelGlowMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x38bdf8,
        emissiveIntensity: 1.4,
        roughness: 0.2,
      })
    );

    const bezelProfile = [
      new THREE.Vector2(0.238, -0.013),
      new THREE.Vector2(0.258, -0.011),
      new THREE.Vector2(0.264, -0.005),
      new THREE.Vector2(0.254, 0.0),
      new THREE.Vector2(0.264, 0.005),
      new THREE.Vector2(0.258, 0.011),
      new THREE.Vector2(0.238, 0.013),
    ];
    const bezelGeo = this.trackGeo(new THREE.LatheGeometry(bezelProfile, 64));
    const bezelMesh = new THREE.Mesh(bezelGeo, this.trimMetalMat);
    this.crystalCluster.add(bezelMesh);

    const eqGlowGeo = this.trackGeo(new THREE.TorusGeometry(0.256, 0.0032, 12, 72));
    const eqGlowMesh = new THREE.Mesh(eqGlowGeo, this.channelGlowMat);
    eqGlowMesh.rotation.x = Math.PI / 2;
    this.crystalCluster.add(eqGlowMesh);

    // Four cardinal machined titanium clamps along the equatorial gyro bezel
    const clampGeo = this.trackGeo(new THREE.BoxGeometry(0.026, 0.03, 0.022));
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const clamp = new THREE.Mesh(clampGeo, this.trimMetalMat);
      clamp.position.set(Math.cos(angle) * 0.254, 0, Math.sin(angle) * 0.254);
      clamp.rotation.y = -angle;
      this.crystalCluster.add(clamp);
    }

    // Upper & lower machined collars + faceted quartz crystal spires
    this.spireMat = this.trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0x7dd3fc,
        emissive: 0x0369a1,
        emissiveIntensity: 0.42,
        roughness: 0.09,
        metalness: 0.12,
        clearcoat: 1.0,
        iridescence: 0.85,
        envMapIntensity: 2.0,
        flatShading: true,
        transparent: true,
        opacity: 0.9,
      })
    );

    const spirePoints = [
      new THREE.Vector2(0.001, 0.098),
      new THREE.Vector2(0.054, 0.028),
      new THREE.Vector2(0.045, 0),
      new THREE.Vector2(0.001, 0),
    ];
    const spireGeo = this.trackGeo(new THREE.LatheGeometry(spirePoints, 6));

    const collarProfile = [
      new THREE.Vector2(0.044, -0.012),
      new THREE.Vector2(0.066, -0.012),
      new THREE.Vector2(0.068, 0.0),
      new THREE.Vector2(0.054, 0.014),
      new THREE.Vector2(0.044, 0.014),
    ];
    const collarGeo = this.trackGeo(new THREE.LatheGeometry(collarProfile, 24));
    const polarRingGeo = this.trackGeo(new THREE.TorusGeometry(0.06, 0.003, 10, 32));

    for (const sign of [1, -1]) {
      const collar = new THREE.Mesh(collarGeo, this.trimMetalMat);
      collar.position.y = 0.222 * sign;
      if (sign === -1) collar.rotation.x = Math.PI;

      const polarRing = new THREE.Mesh(polarRingGeo, this.channelGlowMat);
      polarRing.rotation.x = Math.PI / 2;
      polarRing.position.y = 0.222 * sign;

      const spire = new THREE.Mesh(spireGeo, this.spireMat);
      spire.position.y = 0.236 * sign;
      if (sign === -1) spire.rotation.x = Math.PI;

      this.crystalCluster.add(collar, polarRing, spire);
    }

    // 3. Primary tilted orbital energy track + plasma filament + gimballed moons
    this.primaryRingMat = this.trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xa855f7,
        emissive: 0x581c87,
        emissiveIntensity: 0.65,
        roughness: 0.18,
        metalness: 0.78,
        clearcoat: 0.9,
        envMapIntensity: 1.8,
      })
    );
    const primaryRingGeo = this.trackGeo(
      new THREE.TorusGeometry(0.43, 0.012, 24, 96)
    );
    const primaryRingMesh = new THREE.Mesh(primaryRingGeo, this.primaryRingMat);

    this.primaryFilamentMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xe879f9,
        emissiveIntensity: 1.5,
      })
    );
    const primaryFilamentGeo = this.trackGeo(
      new THREE.TorusGeometry(0.415, 0.003, 12, 96)
    );
    const primaryFilament = new THREE.Mesh(
      primaryFilamentGeo,
      this.primaryFilamentMat
    );

    this.primaryRingGroup.rotation.set(Math.PI / 3, 0.2, 0);
    this.primaryRingGroup.add(primaryRingMesh, primaryFilament);
    this.anchorGroup.add(this.primaryRingGroup);

    // Gimballed quantum satellite nodes
    this.orbMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x34d399,
        emissive: 0x059669,
        emissiveIntensity: 1.25,
        roughness: 0.12,
        metalness: 0.25,
      })
    );
    this.orbHaloMat = this.trackMat(
      new THREE.SpriteMaterial({
        map: coreHaloTex,
        color: 0x6ee7b7,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );

    const orbGeo = this.trackGeo(new THREE.SphereGeometry(0.034, 28, 28));
    const satRingGeo = this.trackGeo(
      new THREE.TorusGeometry(0.052, 0.0045, 14, 36)
    );

    for (const sign of [1, -1]) {
      const satGroup = new THREE.Group();
      satGroup.position.set(0.43 * sign, 0, 0);
      const orb = new THREE.Mesh(orbGeo, this.orbMat);
      const satRingA = new THREE.Mesh(satRingGeo, this.trimMetalMat);
      satRingA.rotation.x = Math.PI / 2.4;
      const satRingB = new THREE.Mesh(satRingGeo, this.trimMetalMat);
      satRingB.rotation.y = Math.PI / 2.4;
      const orbHalo = new THREE.Sprite(this.orbHaloMat);
      orbHalo.scale.setScalar(0.18);
      orbHalo.xb = {pointerEvents: 'none'};
      satGroup.add(orb, satRingA, satRingB, orbHalo);
      this.primaryRingGroup.add(satGroup);
    }

    // 4. Secondary counter-rotating harmonic ring
    this.secondaryRingMat = this.trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.55,
        roughness: 0.2,
        metalness: 0.85,
        clearcoat: 0.8,
        envMapIntensity: 1.8,
      })
    );
    const secondaryRingGeo = this.trackGeo(
      new THREE.TorusGeometry(0.34, 0.006, 18, 84)
    );
    const secondaryRingMesh = new THREE.Mesh(
      secondaryRingGeo,
      this.secondaryRingMat
    );
    this.secondaryRingGroup.rotation.set(-Math.PI / 3.4, -0.35, 0);
    this.secondaryRingGroup.add(secondaryRingMesh);
    this.anchorGroup.add(this.secondaryRingGroup);

    // 5. Orbital starlight dust particles (zero-allocation static buffer)
    const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
      const radius = 0.29 + ((i * 37) % 100) * 0.0034;
      const height = (((i * 53) % 100) / 100 - 0.5) * 0.48;
      particlePositions[i * 3] = Math.cos(angle) * radius;
      particlePositions[i * 3 + 1] = height;
      particlePositions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    const particleGeo = this.trackGeo(new THREE.BufferGeometry());
    particleGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(particlePositions, 3)
    );
    const particleTex = this.trackTex(
      createRadialGlowTexture(
        'rgba(255,255,255,1)',
        'rgba(125,211,252,0.55)',
        128
      )
    );
    this.particleMat = this.trackMat(
      new THREE.PointsMaterial({
        size: 0.025,
        map: particleTex,
        color: 0xbae6fd,
        transparent: true,
        opacity: 0.82,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.particles = new THREE.Points(particleGeo, this.particleMat);
    this.particles.xb = {pointerEvents: 'none'};
    this.anchorGroup.add(this.particles);
  }

  /**
   * Steers crystal orientation smoothly from front-camera hand position.
   */
  setHandSteering(yawRad: number, pitchRad: number, active: boolean): void {
    this.handSteerActive = active;
    this.targetHandYaw = active ? finiteOr(yawRad, 0) : 0;
    this.targetHandPitch = active ? finiteOr(pitchRad, 0) : 0;
  }

  /**
   * Synchronizes visual targets with the pure CrystalState.
   */
  applyState(state: CrystalState): void {
    const presetId = isValidPresetId(state.activePresetId)
      ? state.activePresetId
      : 'spectrum';
    const preset = RESONANCE_PRESETS[presetId];
    this.orbitDirection = state.orbitDirection === -1 ? -1 : 1;
    this.orbitSpeed = finiteOr(state.orbitSpeed, 1.0);
    this.baseScale = finiteOr(state.crystalScale, 1.0);

    if (state.customHue !== null && Number.isFinite(state.customHue)) {
      const hue = ((state.customHue % 1) + 1) % 1;
      this.targetCrystalColor.setHSL(hue, 0.85, 0.56);
      this.targetCoreEmissive.setHSL(hue, 0.92, 0.6);
      this.targetRingColor.setHSL((hue + 0.28) % 1, 0.8, 0.62);
      this.targetRingEmissive.setHSL((hue + 0.28) % 1, 0.85, 0.28);
      this.targetOrbColor.setHSL((hue + 0.55) % 1, 0.82, 0.58);
    } else {
      this.targetCrystalColor.setHex(preset.crystalHex);
      this.targetCoreEmissive.setHex(preset.coreEmissiveHex);
      this.targetRingColor.setHex(preset.ringHex);
      this.targetRingEmissive.setHex(preset.ringEmissiveHex);
      this.targetOrbColor.setHex(preset.orbHex);
    }
  }

  /**
   * Triggers a spring scale impulse and luminous core flash.
   */
  triggerPulseImpulse(): void {
    this.springScale = 1.36;
    this.springVelocity = 2.4;
    this.pulseFlash = 1.0;
  }

  /**
   * Restores the crystal assembly to its initial 3D spatial position and scale.
   */
  resetPosition(): void {
    this.position.set(-0.46, 1.40, -1.28);
    this.scale.setScalar(1);
    this.setHandSteering(0, 0, false);
  }

  override onHoverEnter(event: xb.HoverEvent): void {
    this.isHovered = true;
    event.stopPropagation();
  }

  override onHoverExit(event: xb.HoverEvent): void {
    this.isHovered = false;
    event.stopPropagation();
  }

  override onObjectSelectStart(event: xb.SelectEvent): void {
    this.dragStartPos.copy(this.position);
    this.springScale = 0.92;
    event.stopPropagation();
  }

  override onObjectSelectEnd(event: xb.SelectEndEvent): void {
    const movedDistance = this.position.distanceTo(this.dragStartPos);
    if (event.completed && movedDistance < 0.025) {
      this.onCrystalPulse?.();
    }
    event.stopPropagation();
  }

  override update(): void {
    if (this.disposed) return;
    const rawDt = xb.getDeltaTime();
    const dt =
      Number.isFinite(rawDt) && rawDt > 0 ? Math.min(rawDt, 0.05) : 1 / 60;
    this.elapsed += dt;

    // Gentle floating levitation around the local anchor origin
    this.anchorGroup.position.y = Math.sin(this.elapsed * 1.7) * 0.035;

    // Smoothly interpolate front-camera hand steering tilt/yaw
    const steerLerp = 1 - Math.exp(-10 * dt);
    this.currentHandYaw +=
      (this.targetHandYaw - this.currentHandYaw) * steerLerp;
    this.currentHandPitch +=
      (this.targetHandPitch - this.currentHandPitch) * steerLerp;

    this.anchorGroup.rotation.y = this.currentHandYaw;
    this.anchorGroup.rotation.x = this.currentHandPitch;

    // Continuous multi-axis crystal & ring kinematics scaled by dt
    const speedFactor = this.orbitSpeed * this.orbitDirection;
    this.crystalCluster.rotation.y += dt * 0.85 * speedFactor;
    this.crystalCluster.rotation.x = Math.sin(this.elapsed * 0.9) * 0.12;

    this.primaryRingGroup.rotation.z += dt * 1.35 * speedFactor;
    this.secondaryRingGroup.rotation.z -= dt * 0.95 * speedFactor;
    this.particles.rotation.y += dt * 0.32 * speedFactor;
    this.emitterDisc.rotation.z -= dt * 0.25 * speedFactor;

    // Damped spring scale animation
    const hoverBoost = this.isHovered || this.handSteerActive ? 1.05 : 1.0;
    const step = stepSpringScale(
      this.springScale,
      hoverBoost,
      this.springVelocity,
      dt
    );
    this.springScale = step.value;
    this.springVelocity = step.velocity;
    this.anchorGroup.scale.setScalar(this.baseScale);
    this.crystalCluster.scale.setScalar(Math.max(0.5, this.springScale));

    // Smooth color & emissive interpolation (zero allocations)
    const colorLerp = 1 - Math.exp(-8 * dt);
    this.outerCrystalMat.color.lerp(this.targetCrystalColor, colorLerp);
    this.outerCrystalMat.emissive.lerp(this.targetCoreEmissive, colorLerp);
    this.spireMat.color.lerp(this.targetCrystalColor, colorLerp);
    this.spireMat.emissive.lerp(this.targetCoreEmissive, colorLerp);
    this.innerCoreMat.emissive.lerp(this.targetCoreEmissive, colorLerp);
    this.channelGlowMat.emissive.lerp(this.targetCoreEmissive, colorLerp);
    this.coreHaloMat.color.lerp(this.targetCoreEmissive, colorLerp);
    this.beamMat.color.lerp(this.targetCoreEmissive, colorLerp);
    this.crystalLight.color.lerp(this.targetCoreEmissive, colorLerp);

    this.primaryRingMat.color.lerp(this.targetRingColor, colorLerp);
    this.primaryRingMat.emissive.lerp(this.targetRingEmissive, colorLerp);
    this.primaryFilamentMat.emissive.lerp(this.targetRingColor, colorLerp);
    this.secondaryRingMat.color.lerp(this.targetCrystalColor, colorLerp);
    this.secondaryRingMat.emissive.lerp(this.targetCoreEmissive, colorLerp);

    this.orbMat.color.lerp(this.targetOrbColor, colorLerp);
    _tmpColorA.copy(this.targetOrbColor).multiplyScalar(0.55);
    this.orbMat.emissive.lerp(_tmpColorA, colorLerp);
    this.orbHaloMat.color.lerp(this.targetOrbColor, colorLerp);

    _tmpColorB.copy(this.targetCoreEmissive).lerp(this.targetCrystalColor, 0.5);
    this.particleMat.color.lerp(_tmpColorB, colorLerp);

    // Decay pulse flash smoothly
    this.pulseFlash = Math.max(0, this.pulseFlash - dt * 2.4);
    const hoverGlow = this.isHovered || this.handSteerActive ? 0.32 : 0;
    this.innerCoreMat.emissiveIntensity =
      1.85 + this.pulseFlash * 2.4 + hoverGlow;
    this.outerCrystalMat.emissiveIntensity =
      0.2 + this.pulseFlash * 0.65 + hoverGlow * 0.45;
    this.emitterMat.opacity = 0.68 + this.pulseFlash * 0.3;
    this.coreHaloMat.opacity = 0.58 + this.pulseFlash * 0.35;
    this.crystalLight.intensity = 1.6 + this.pulseFlash * 3.0 + hoverGlow;
  }

  override dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const geo of this.geometries) geo.dispose();
    for (const mat of this.materials) mat.dispose();
    for (const tex of this.textures) tex.dispose();
    this.geometries.length = 0;
    this.materials.length = 0;
    this.textures.length = 0;
    super.dispose();
  }
}
