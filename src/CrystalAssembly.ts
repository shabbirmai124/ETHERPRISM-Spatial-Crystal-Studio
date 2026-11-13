// =========================================================================
// Project: AetherPrism XR — Spatial Crystal Resonator
// Author: Md Shabbir Mia
// Module: Multi-Part Procedural 3D Crystal & Orbital Resonator Assembly
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

const PARTICLE_COUNT = 56;
const _tmpColorA = new THREE.Color();
const _tmpColorB = new THREE.Color();

function createRadialGlowTexture(
  innerColor: string,
  midColor: string,
  size = 128
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const half = size / 2;
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0, innerColor);
    grad.addColorStop(0.35, midColor);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createEmitterRingTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const half = size / 2;
    ctx.clearRect(0, 0, size, size);

    const radial = ctx.createRadialGradient(half, half, 8, half, half, half);
    radial.addColorStop(0, 'rgba(56, 189, 248, 0.36)');
    radial.addColorStop(0.55, 'rgba(168, 85, 247, 0.14)');
    radial.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = 'rgba(125, 211, 252, 0.55)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(half, half, half * 0.62, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(192, 132, 252, 0.42)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 10]);
    ctx.beginPath();
    ctx.arc(half, half, half * 0.82, 0, Math.PI * 2);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
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
  private innerCoreMat!: THREE.MeshStandardMaterial;
  private spireMat!: THREE.MeshStandardMaterial;
  private trimMetalMat!: THREE.MeshStandardMaterial;
  private primaryRingMat!: THREE.MeshStandardMaterial;
  private secondaryRingMat!: THREE.MeshStandardMaterial;
  private orbMat!: THREE.MeshStandardMaterial;
  private emitterMat!: THREE.MeshBasicMaterial;
  private particleMat!: THREE.PointsMaterial;

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

  constructor(onCrystalPulse?: () => void) {
    super();
    this.name = 'AetherPrism Crystal Assembly';
    this.onCrystalPulse = onCrystalPulse;
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
    this.anchorGroup.position.set(-0.42, 1.44, -1.32);
    this.add(this.anchorGroup);

    // 1. Floating projection reticle base beneath the crystal
    const emitterTex = this.trackTex(createEmitterRingTexture(256));
    this.emitterMat = this.trackMat(
      new THREE.MeshBasicMaterial({
        map: emitterTex,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      })
    );
    const emitterGeo = this.trackGeo(new THREE.CircleGeometry(0.46, 48));
    this.emitterDisc = new THREE.Mesh(emitterGeo, this.emitterMat);
    this.emitterDisc.rotation.x = -Math.PI / 2;
    this.emitterDisc.position.set(0, -0.52, 0);
    this.emitterDisc.xb = {pointerEvents: 'none'};
    this.anchorGroup.add(this.emitterDisc);

    // 2. Central crystal cluster (interactive target)
    this.anchorGroup.add(this.crystalCluster);

    // Inner glowing plasma octahedron
    this.innerCoreMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x38bdf8,
        emissiveIntensity: 1.6,
        roughness: 0.15,
        metalness: 0.1,
      })
    );
    const innerGeo = this.trackGeo(new THREE.OctahedronGeometry(0.105, 0));
    const innerMesh = new THREE.Mesh(innerGeo, this.innerCoreMat);
    this.crystalCluster.add(innerMesh);

    // Faceted outer prismatic crystal shell
    this.outerCrystalMat = this.trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0x00d4ff,
        emissive: 0x0284c7,
        emissiveIntensity: 0.25,
        roughness: 0.12,
        metalness: 0.18,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
        iridescence: 0.9,
        iridescenceIOR: 1.35,
        transparent: true,
        opacity: 0.88,
        flatShading: true,
      })
    );
    const outerGeo = this.trackGeo(new THREE.IcosahedronGeometry(0.21, 0));
    const outerMesh = new THREE.Mesh(outerGeo, this.outerCrystalMat);
    outerMesh.castShadow = true;
    this.crystalCluster.add(outerMesh);

    // Brushed titanium collars and equatorial gyro bezel
    this.trimMetalMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.34,
        metalness: 0.88,
      })
    );
    const bezelGeo = this.trackGeo(new THREE.TorusGeometry(0.245, 0.011, 14, 48));
    const bezelMesh = new THREE.Mesh(bezelGeo, this.trimMetalMat);
    bezelMesh.rotation.x = Math.PI / 2;
    this.crystalCluster.add(bezelMesh);

    // Upper and lower lathe-profiled crystal crowns + metallic collars
    this.spireMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x7dd3fc,
        emissive: 0x0369a1,
        emissiveIntensity: 0.45,
        roughness: 0.18,
        metalness: 0.35,
        flatShading: true,
      })
    );

    const spirePoints = [
      new THREE.Vector2(0.001, 0.09),
      new THREE.Vector2(0.052, 0.025),
      new THREE.Vector2(0.042, 0),
      new THREE.Vector2(0.001, 0),
    ];
    const spireGeo = this.trackGeo(new THREE.LatheGeometry(spirePoints, 6));
    const collarGeo = this.trackGeo(
      new THREE.CylinderGeometry(0.052, 0.062, 0.022, 12)
    );

    const topCollar = new THREE.Mesh(collarGeo, this.trimMetalMat);
    topCollar.position.y = 0.215;
    const topSpire = new THREE.Mesh(spireGeo, this.spireMat);
    topSpire.position.y = 0.226;

    const bottomCollar = new THREE.Mesh(collarGeo, this.trimMetalMat);
    bottomCollar.position.y = -0.215;
    const bottomSpire = new THREE.Mesh(spireGeo, this.spireMat);
    bottomSpire.rotation.x = Math.PI;
    bottomSpire.position.y = -0.226;

    this.crystalCluster.add(topCollar, topSpire, bottomCollar, bottomSpire);

    // 3. Primary tilted orbital energy ring + dual gimballed satellite orbs
    this.primaryRingMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xa855f7,
        emissive: 0x581c87,
        emissiveIntensity: 0.75,
        roughness: 0.25,
        metalness: 0.72,
      })
    );
    const primaryRingGeo = this.trackGeo(
      new THREE.TorusGeometry(0.41, 0.013, 16, 72)
    );
    const primaryRingMesh = new THREE.Mesh(primaryRingGeo, this.primaryRingMat);
    this.primaryRingGroup.rotation.set(Math.PI / 3, 0.2, 0);
    this.primaryRingGroup.add(primaryRingMesh);
    this.anchorGroup.add(this.primaryRingGroup);

    // Satellite nodes with metallic gimbal rings
    this.orbMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x34d399,
        emissive: 0x059669,
        emissiveIntensity: 0.9,
        roughness: 0.16,
        metalness: 0.25,
      })
    );
    const orbGeo = this.trackGeo(new THREE.SphereGeometry(0.036, 20, 20));
    const satRingGeo = this.trackGeo(
      new THREE.TorusGeometry(0.052, 0.0055, 10, 28)
    );

    for (const sign of [1, -1]) {
      const satGroup = new THREE.Group();
      satGroup.position.set(0.41 * sign, 0, 0);
      const orb = new THREE.Mesh(orbGeo, this.orbMat);
      const satRing = new THREE.Mesh(satRingGeo, this.trimMetalMat);
      satRing.rotation.x = Math.PI / 2.4;
      satGroup.add(orb, satRing);
      this.primaryRingGroup.add(satGroup);
    }

    // 4. Secondary counter-rotating harmonic ring
    this.secondaryRingMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.5,
        roughness: 0.3,
        metalness: 0.8,
      })
    );
    const secondaryRingGeo = this.trackGeo(
      new THREE.TorusGeometry(0.33, 0.0065, 12, 64)
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
      const radius = 0.28 + ((i * 37) % 100) * 0.0032;
      const height = (((i * 53) % 100) / 100 - 0.5) * 0.44;
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
      createRadialGlowTexture('rgba(255,255,255,1)', 'rgba(125,211,252,0.5)', 64)
    );
    this.particleMat = this.trackMat(
      new THREE.PointsMaterial({
        size: 0.026,
        map: particleTex,
        color: 0xbae6fd,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.particles = new THREE.Points(particleGeo, this.particleMat);
    this.particles.xb = {pointerEvents: 'none'};
    this.anchorGroup.add(this.particles);
  }

  private disposed = false;

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

  override onHoverEnter(event: xb.HoverEvent): void {
    this.isHovered = true;
    event.stopPropagation();
  }

  override onHoverExit(event: xb.HoverEvent): void {
    this.isHovered = false;
    event.stopPropagation();
  }

  override onObjectSelectStart(event: xb.SelectEvent): void {
    this.springScale = 0.91;
    event.stopPropagation();
  }

  override onObjectSelectEnd(event: xb.SelectEndEvent): void {
    if (event.completed) {
      this.onCrystalPulse?.();
    }
    event.stopPropagation();
  }

  override update(): void {
    if (this.disposed) return;
    const rawDt = xb.getDeltaTime();
    const dt = Number.isFinite(rawDt) && rawDt > 0 ? Math.min(rawDt, 0.05) : 1 / 60;
    this.elapsed += dt;

    // Gentle floating levitation
    this.anchorGroup.position.y = 1.44 + Math.sin(this.elapsed * 1.7) * 0.038;

    // Continuous multi-axis crystal & ring kinematics scaled by dt
    const speedFactor = this.orbitSpeed * this.orbitDirection;
    this.crystalCluster.rotation.y += dt * 0.85 * speedFactor;
    this.crystalCluster.rotation.x = Math.sin(this.elapsed * 0.9) * 0.14;

    this.primaryRingGroup.rotation.z += dt * 1.35 * speedFactor;
    this.secondaryRingGroup.rotation.z -= dt * 0.95 * speedFactor;
    this.particles.rotation.y += dt * 0.32 * speedFactor;
    this.emitterDisc.rotation.z -= dt * 0.25 * speedFactor;

    // Damped spring scale animation
    const hoverBoost = this.isHovered ? 1.05 : 1.0;
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

    this.primaryRingMat.color.lerp(this.targetRingColor, colorLerp);
    this.primaryRingMat.emissive.lerp(this.targetRingEmissive, colorLerp);
    this.secondaryRingMat.color.lerp(this.targetCrystalColor, colorLerp);
    this.secondaryRingMat.emissive.lerp(this.targetCoreEmissive, colorLerp);

    this.orbMat.color.lerp(this.targetOrbColor, colorLerp);
    _tmpColorA.copy(this.targetOrbColor).multiplyScalar(0.55);
    this.orbMat.emissive.lerp(_tmpColorA, colorLerp);

    _tmpColorB.copy(this.targetCoreEmissive).lerp(this.targetCrystalColor, 0.5);
    this.particleMat.color.lerp(_tmpColorB, colorLerp);

    // Decay pulse flash smoothly
    this.pulseFlash = Math.max(0, this.pulseFlash - dt * 2.4);
    const hoverGlow = this.isHovered ? 0.28 : 0;
    this.innerCoreMat.emissiveIntensity = 1.5 + this.pulseFlash * 2.2 + hoverGlow;
    this.outerCrystalMat.emissiveIntensity =
      0.24 + this.pulseFlash * 0.65 + hoverGlow * 0.5;
    this.emitterMat.opacity = 0.62 + this.pulseFlash * 0.35;
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
