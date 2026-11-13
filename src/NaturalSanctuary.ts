// =========================================================================
// Project: AetherPrism XR — Spatial Crystal Resonator
// Author: Md Shabbir Mia
// Module: Photorealistic Multi-Scenario Real-World Sanctuary (xb.Script)
// =========================================================================

import * as THREE from 'three';
import * as xb from 'xrblocks';

import {
  ENVIRONMENT_SCENARIOS,
  type EnvironmentScenarioId,
  type EnvironmentScenarioSpec,
} from './crystalState';

function applyTextureSampling(
  texture: THREE.Texture,
  repeatX: number,
  repeatY: number,
  wrapS: THREE.Wrapping,
  wrapT: THREE.Wrapping,
  srgb: boolean,
  offsetX = 0
): void {
  texture.wrapS = wrapS;
  texture.wrapT = wrapT;
  texture.repeat.set(repeatX, repeatY);
  texture.offset.set(offsetX, 0);
  texture.anisotropy = 16;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  if (srgb) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }
}

/**
 * Generates a tileable 512x512 realistic calm water normal map for natural
 * wind-brushed specular reflections over the lake/ocean surface.
 */
function createWaterNormalTexture(size = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const img = ctx.createImageData(size, size);
    const data = img.data;
    const tau = Math.PI * 2;
    for (let y = 0; y < size; y++) {
      const v = (y / size) * tau;
      for (let x = 0; x < size; x++) {
        const u = (x / size) * tau;
        const dx =
          Math.cos(u * 4 + v * 3) * 0.28 +
          Math.cos(u * 9 - v * 6) * 0.22 +
          Math.sin(u * 17 + v * 11) * 0.14;
        const dy =
          Math.sin(u * 3 + v * 5) * 0.28 +
          Math.cos(u * 8 + v * 10) * 0.22 +
          Math.cos(u * 15 - v * 14) * 0.14;
        const idx = (y * size + x) * 4;
        data[idx] = Math.round(128 + dx * 36);
        data[idx + 1] = Math.round(128 + dy * 36);
        data[idx + 2] = 250;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(22, 22);
  tex.anisotropy = 16;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Sculpts an organic, weathered river-granite boulder geometry from a dense
 * icosahedron using deterministic multi-octave harmonic displacement.
 */
function createOrganicGraniteGeometry(seed: number): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1, 3);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const n1 = Math.sin(vx * 3.1 + seed) * Math.cos(vz * 2.7 - seed * 0.6);
    const n2 = Math.sin(vy * 4.5 + vx * 2.2) * 0.5;
    const n3 = Math.cos(vz * 5.8 - vy * 3.4 + seed) * 0.25;
    const disp = 1.0 + n1 * 0.16 + n2 * 0.1 + n3 * 0.06;
    const flattenY = vy < 0 ? 0.62 : 0.78;
    pos.setXYZ(i, vx * disp, vy * disp * flattenY, vz * disp);
  }
  geo.computeVertexNormals();
  return geo;
}

export class NaturalSanctuary extends xb.Script {
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly textures: THREE.Texture[] = [];
  private readonly panoramaCache: Map<EnvironmentScenarioId, THREE.Texture> =
    new Map();
  private readonly textureLoader = new THREE.TextureLoader();
  private readonly onPanoramaReady?: (
    panoramaTexture: THREE.Texture,
    scenario: EnvironmentScenarioSpec
  ) => void;

  private activeScenarioId: EnvironmentScenarioId = 'alpine';
  private panoMat!: THREE.MeshBasicMaterial;
  private zenithCanvas!: HTMLCanvasElement;
  private zenithCtx: CanvasRenderingContext2D | null = null;
  private zenithTex!: THREE.CanvasTexture;
  private waterMat!: THREE.MeshPhysicalMaterial;
  private bollardGlowMat!: THREE.MeshStandardMaterial;
  private waterNormalTex!: THREE.CanvasTexture;
  private mistMotes!: THREE.Points;
  private elapsed = 0;
  private disposed = false;

  constructor(
    onPanoramaReady?: (
      panoramaTexture: THREE.Texture,
      scenario: EnvironmentScenarioSpec
    ) => void
  ) {
    super();
    this.name = 'AetherPrism Real-World Sanctuary';
    this.xb = {pointerEvents: 'none'};
    this.onPanoramaReady = onPanoramaReady;
    this.buildRealWorldSanctuary();
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

  private markPassThrough(obj: THREE.Object3D): void {
    obj.xb = {pointerEvents: 'none'};
  }

  private loadPbrTexture(
    url: string,
    repeatX: number,
    repeatY: number
  ): THREE.Texture {
    const tex = this.textureLoader.load(url, (loaded) => {
      if (this.disposed) return;
      applyTextureSampling(
        loaded,
        repeatX,
        repeatY,
        THREE.RepeatWrapping,
        THREE.RepeatWrapping,
        true
      );
      loaded.needsUpdate = true;
    });
    applyTextureSampling(
      tex,
      repeatX,
      repeatY,
      THREE.RepeatWrapping,
      THREE.RepeatWrapping,
      true
    );
    return this.trackTex(tex);
  }

  private paintZenithGradient(spec: EnvironmentScenarioSpec): void {
    if (!this.zenithCtx) return;
    const h = this.zenithCanvas.height;
    const grad = this.zenithCtx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, spec.zenithTop);
    grad.addColorStop(0.55, spec.zenithMid);
    grad.addColorStop(1.0, spec.zenithHorizon);
    this.zenithCtx.fillStyle = grad;
    this.zenithCtx.fillRect(0, 0, this.zenithCanvas.width, h);
    this.zenithTex.needsUpdate = true;
  }

  private loadScenarioPanorama(scenarioId: EnvironmentScenarioId): void {
    const spec = ENVIRONMENT_SCENARIOS[scenarioId];
    const cached = this.panoramaCache.get(scenarioId);
    if (cached) {
      this.panoMat.map = cached;
      this.panoMat.needsUpdate = true;
      this.onPanoramaReady?.(cached, spec);
      return;
    }

    const tex = this.textureLoader.load(spec.panoramaUrl, (loaded) => {
      if (this.disposed) return;
      applyTextureSampling(
        loaded,
        2,
        1,
        THREE.MirroredRepeatWrapping,
        THREE.ClampToEdgeWrapping,
        true,
        -0.25
      );
      loaded.needsUpdate = true;
      this.panoramaCache.set(scenarioId, loaded);
      if (this.activeScenarioId === scenarioId) {
        this.panoMat.map = loaded;
        this.panoMat.needsUpdate = true;
        this.onPanoramaReady?.(loaded, spec);
      }
    });
    applyTextureSampling(
      tex,
      2,
      1,
      THREE.MirroredRepeatWrapping,
      THREE.ClampToEdgeWrapping,
      true,
      -0.25
    );
    this.panoramaCache.set(scenarioId, tex);
    this.trackTex(tex);
    // Assign loaded bitmap once onload fires; keep previous valid map until then
    if (tex.image) {
      this.panoMat.map = tex;
      this.panoMat.needsUpdate = true;
    }
  }

  setScenario(scenarioId: EnvironmentScenarioId): void {
    if (this.disposed) return;
    this.activeScenarioId = scenarioId;
    const spec = ENVIRONMENT_SCENARIOS[scenarioId];
    this.paintZenithGradient(spec);
    this.waterMat.color.setHex(spec.waterHex);
    this.bollardGlowMat.emissiveIntensity = spec.bollardEmissiveIntensity;
    this.loadScenarioPanorama(scenarioId);
  }

  private buildRealWorldSanctuary(): void {
    const initialSpec = ENVIRONMENT_SCENARIOS[this.activeScenarioId];

    // 1. 360-Degree Photorealistic Horizon Cyclorama (supports switching across 4 scenarios)
    this.panoMat = this.trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      })
    );

    const cycloramaGeo = this.trackGeo(
      new THREE.CylinderGeometry(115, 115, 128, 72, 1, true)
    );
    const cycloramaMesh = new THREE.Mesh(cycloramaGeo, this.panoMat);
    cycloramaMesh.position.y = 8.5;
    cycloramaMesh.rotation.y = Math.PI * 0.5;
    cycloramaMesh.renderOrder = -10;
    this.markPassThrough(cycloramaMesh);
    this.add(cycloramaMesh);

    // Smooth upper sky dome cap blending seamlessly into the active horizon sky
    this.zenithCanvas = document.createElement('canvas');
    this.zenithCanvas.width = 512;
    this.zenithCanvas.height = 512;
    this.zenithCtx = this.zenithCanvas.getContext('2d');
    this.zenithTex = this.trackTex(new THREE.CanvasTexture(this.zenithCanvas));
    this.zenithTex.colorSpace = THREE.SRGBColorSpace;
    this.zenithTex.anisotropy = 8;
    this.paintZenithGradient(initialSpec);

    const skyCapGeo = this.trackGeo(
      new THREE.SphereGeometry(118, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.45)
    );
    const skyCapMat = this.trackMat(
      new THREE.MeshBasicMaterial({
        map: this.zenithTex,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      })
    );
    const skyCapMesh = new THREE.Mesh(skyCapGeo, skyCapMat);
    skyCapMesh.position.y = 12;
    skyCapMesh.renderOrder = -11;
    this.markPassThrough(skyCapMesh);
    this.add(skyCapMesh);

    // 2. Expansive Mirror-Calm Physical Water Surface (108m radius)
    this.waterNormalTex = this.trackTex(createWaterNormalTexture(512));
    const waterGeo = this.trackGeo(new THREE.CircleGeometry(108, 96));
    waterGeo.rotateX(-Math.PI / 2);
    this.waterMat = this.trackMat(
      new THREE.MeshPhysicalMaterial({
        color: initialSpec.waterHex,
        roughness: 0.08,
        metalness: 0.34,
        normalMap: this.waterNormalTex,
        normalScale: new THREE.Vector2(0.16, 0.16),
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
        envMapIntensity: 2.1,
      })
    );
    const lakeMesh = new THREE.Mesh(waterGeo, this.waterMat);
    lakeMesh.position.y = -0.22;
    lakeMesh.receiveShadow = true;
    this.markPassThrough(lakeMesh);
    this.add(lakeMesh);

    // 3. Honed Slate Architectural Pavilion Terrace
    const stoneTex = this.loadPbrTexture('/assets/env/slate_stone_terrace.jpg', 5, 5);
    const terraceGeo = this.trackGeo(new THREE.BoxGeometry(9.6, 0.18, 7.6));
    const terraceMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        map: stoneTex,
        color: 0xe6e4df,
        roughness: 0.78,
        metalness: 0.06,
        envMapIntensity: 1.05,
      })
    );
    const terraceMesh = new THREE.Mesh(terraceGeo, terraceMat);
    terraceMesh.position.set(0, -0.095, -1.3);
    terraceMesh.receiveShadow = true;
    this.markPassThrough(terraceMesh);
    this.add(terraceMesh);

    // Dark anodized bronze perimeter trim around terrace
    const bronzeMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x262930,
        roughness: 0.3,
        metalness: 0.86,
        envMapIntensity: 1.4,
      })
    );
    const edgeFrameGeo = this.trackGeo(new THREE.BoxGeometry(9.72, 0.19, 7.72));
    const edgeFrame = new THREE.Mesh(edgeFrameGeo, bronzeMat);
    edgeFrame.position.set(0, -0.105, -1.3);
    this.markPassThrough(edgeFrame);
    this.add(edgeFrame);

    // 4. Cantilevered Oiled Burmese Teak Overlook Pier
    const teakTex = this.loadPbrTexture('/assets/env/teak_wood_deck.jpg', 2, 4);
    const pierGeo = this.trackGeo(new THREE.BoxGeometry(3.1, 0.08, 4.4));
    const pierMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        map: teakTex,
        color: 0xf2ebe0,
        roughness: 0.66,
        metalness: 0.04,
        envMapIntensity: 1.0,
      })
    );
    const pierMesh = new THREE.Mesh(pierGeo, pierMat);
    pierMesh.position.set(0, -0.032, -6.2);
    pierMesh.receiveShadow = true;
    this.markPassThrough(pierMesh);
    this.add(pierMesh);

    const pierRimGeo = this.trackGeo(new THREE.BoxGeometry(3.2, 0.09, 4.5));
    const pierRim = new THREE.Mesh(pierRimGeo, bronzeMat);
    pierRim.position.set(0, -0.042, -6.2);
    this.markPassThrough(pierRim);
    this.add(pierRim);

    // 5. Frameless Tempered Glass Balustrades
    this.buildGlassBalustrades(bronzeMat);

    // 6. Architectural 2700K Pathway Bollards
    this.buildArchitecturalBollards(bronzeMat, initialSpec.bollardEmissiveIntensity);

    // 7. Displaced Mossy Shoreline Granite Boulders
    this.buildGraniteShoreBoulders();

    // 8. Fine Floating Sunbeam Dust Motes
    this.buildSubtleSunDust();

    // 9. Load initial Alpine scenario texture immediately
    this.loadScenarioPanorama(this.activeScenarioId);
  }

  private buildGlassBalustrades(bronzeMat: THREE.Material): void {
    const glassMat = this.trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xdbeafe,
        transparent: true,
        opacity: 0.14,
        roughness: 0.05,
        metalness: 0.05,
        clearcoat: 1.0,
        envMapIntensity: 1.8,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );

    const postGeo = this.trackGeo(new THREE.BoxGeometry(0.045, 0.92, 0.045));
    const topRailFrontGeo = this.trackGeo(new THREE.BoxGeometry(3.14, 0.032, 0.05));
    const glassFrontGeo = this.trackGeo(new THREE.PlaneGeometry(3.04, 0.84));

    const frontRail = new THREE.Mesh(topRailFrontGeo, bronzeMat);
    frontRail.position.set(0, 0.92, -8.38);
    const frontGlass = new THREE.Mesh(glassFrontGeo, glassMat);
    frontGlass.position.set(0, 0.45, -8.38);
    this.markPassThrough(frontRail);
    this.markPassThrough(frontGlass);
    this.add(frontRail, frontGlass);

    for (const px of [-1.54, 0, 1.54]) {
      const post = new THREE.Mesh(postGeo, bronzeMat);
      post.position.set(px, 0.46, -8.38);
      this.markPassThrough(post);
      this.add(post);
    }

    const wingGlassGeo = this.trackGeo(new THREE.PlaneGeometry(3.1, 0.84));
    const wingRailGeo = this.trackGeo(new THREE.BoxGeometry(3.2, 0.032, 0.05));
    for (const side of [-1, 1]) {
      const cx = side * 3.18;
      const rail = new THREE.Mesh(wingRailGeo, bronzeMat);
      rail.position.set(cx, 0.9, -5.06);
      const glass = new THREE.Mesh(wingGlassGeo, glassMat);
      glass.position.set(cx, 0.44, -5.06);
      this.markPassThrough(rail);
      this.markPassThrough(glass);
      this.add(rail, glass);

      for (const offset of [-1.55, 1.55]) {
        const post = new THREE.Mesh(postGeo, bronzeMat);
        post.position.set(cx + offset, 0.45, -5.06);
        this.markPassThrough(post);
        this.add(post);
      }
    }
  }

  private buildArchitecturalBollards(
    bronzeMat: THREE.Material,
    initialIntensity: number
  ): void {
    const bodyGeo = this.trackGeo(new THREE.CylinderGeometry(0.055, 0.06, 0.52, 20));
    const glowBandGeo = this.trackGeo(
      new THREE.CylinderGeometry(0.052, 0.052, 0.08, 20)
    );
    this.bollardGlowMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffedd5,
        emissive: 0xf59e0b,
        emissiveIntensity: initialIntensity,
        roughness: 0.3,
      })
    );

    const coords = [
      {x: -1.45, z: -4.2},
      {x: 1.45, z: -4.2},
      {x: -4.3, z: -1.2},
      {x: 4.3, z: -1.2},
    ];
    for (const c of coords) {
      const body = new THREE.Mesh(bodyGeo, bronzeMat);
      body.position.set(c.x, 0.25, c.z);
      const glow = new THREE.Mesh(glowBandGeo, this.bollardGlowMat);
      glow.position.set(c.x, 0.44, c.z);
      this.markPassThrough(body);
      this.markPassThrough(glow);
      this.add(body, glow);
    }
  }

  private buildGraniteShoreBoulders(): void {
    const graniteTex = this.loadPbrTexture('/assets/env/moss_granite_rock.jpg', 2, 2);
    const boulderMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        map: graniteTex,
        color: 0xd6d3cd,
        roughness: 0.9,
        metalness: 0.04,
        envMapIntensity: 0.85,
      })
    );

    const clusters = [
      {x: -5.4, z: -6.8, s: 1.35, seed: 1.2},
      {x: -6.8, z: -8.2, s: 1.85, seed: 2.7},
      {x: -4.6, z: -9.4, s: 0.95, seed: 4.1},
      {x: 5.8, z: -7.1, s: 1.45, seed: 5.5},
      {x: 7.4, z: -8.8, s: 2.05, seed: 6.9},
      {x: 4.9, z: -9.6, s: 0.9, seed: 8.3},
      {x: -8.5, z: -3.2, s: 1.5, seed: 9.4},
      {x: 8.6, z: -2.9, s: 1.65, seed: 11.1},
    ];

    for (const spec of clusters) {
      const geo = this.trackGeo(createOrganicGraniteGeometry(spec.seed));
      const rock = new THREE.Mesh(geo, boulderMat);
      rock.position.set(spec.x, -0.26, spec.z);
      rock.scale.set(spec.s * 1.15, spec.s * 0.72, spec.s * 0.95);
      rock.rotation.y = spec.seed;
      this.markPassThrough(rock);
      this.add(rock);
    }
  }

  private buildSubtleSunDust(): void {
    const count = 48;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = ((i * 137.5) * Math.PI) / 180;
      const radius = 2.6 + ((i * 41) % 100) * 0.08;
      const height = 0.55 + ((i * 23) % 100) * 0.025;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = height;
      positions[i * 3 + 2] = Math.sin(angle) * radius - 2.0;
    }
    const geo = this.trackGeo(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = this.trackMat(
      new THREE.PointsMaterial({
        color: 0xfffbeb,
        size: 0.024,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.mistMotes = new THREE.Points(geo, mat);
    this.markPassThrough(this.mistMotes);
    this.add(this.mistMotes);
  }

  override update(): void {
    if (this.disposed) return;
    const rawDt = xb.getDeltaTime();
    const dt =
      Number.isFinite(rawDt) && rawDt > 0 ? Math.min(rawDt, 0.05) : 1 / 60;
    this.elapsed += dt;

    this.waterNormalTex.offset.x = (this.elapsed * 0.006) % 1;
    this.waterNormalTex.offset.y = (this.elapsed * 0.004) % 1;
    this.mistMotes.rotation.y = this.elapsed * 0.012;
  }

  override dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.panoramaCache.clear();
    for (const geo of this.geometries) geo.dispose();
    for (const mat of this.materials) mat.dispose();
    for (const tex of this.textures) tex.dispose();
    this.geometries.length = 0;
    this.materials.length = 0;
    this.textures.length = 0;
    super.dispose();
  }
}
