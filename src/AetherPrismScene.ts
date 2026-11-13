// =========================================================================
// Project: AetherPrism XR — Spatial Crystal Resonator
// Author: Md Shabbir Mia
// Module: Main XR Blocks Scene Orchestrator (xb.Script)
// =========================================================================

import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import * as xb from 'xrblocks';

import {AudioResonator} from './AudioResonator';
import {CrystalAssembly} from './CrystalAssembly';
import {FrontCamHandTracker} from './FrontCamHandTracker';
import {NaturalSanctuary} from './NaturalSanctuary';
import {SpatialHudCard} from './SpatialHudCard';
import {createStatusOverlay} from './StatusOverlay';
import {
  type CrystalState,
  ENVIRONMENT_SCENARIOS,
  type EnvironmentScenarioId,
  type EnvironmentScenarioSpec,
  PRESET_ORDER,
  type ResonancePresetId,
  SCENARIO_ORDER,
  createInitialCrystalState,
  isValidPresetId,
  isValidScenarioId,
  resetCrystalState,
  selectPreset,
  selectScenario,
  setCameraZoom,
  setCrystalScale,
  setOrbitSpeed,
  toggleAudioEnabled,
  toggleOrbitDirection,
  triggerCrystalPulse,
} from './crystalState';
import type {HandGestureCommand} from './handTrackerMath';

function readInitialSceneParam(): EnvironmentScenarioId | 'room' | null {
  if (typeof window === 'undefined') return null;
  try {
    const param = new URLSearchParams(window.location.search).get('scene');
    if (param === 'room' || param === 'passthrough') return 'room';
    if (isValidScenarioId(param)) return param;
  } catch {
    // Ignore malformed query strings
  }
  return null;
}

export class AetherPrismScene extends xb.Script {
  private state: CrystalState = createInitialCrystalState();
  private readonly audio = new AudioResonator();
  private readonly crystal: CrystalAssembly;
  private readonly hudCard: SpatialHudCard;
  private readonly statusOverlay: xb.UIOverlay;
  private readonly frontCamTracker: FrontCamHandTracker;
  private readonly sanctuary: NaturalSanctuary;

  private envTexture: THREE.Texture | null = null;
  private hemiLight!: THREE.HemisphereLight;
  private sunLight!: THREE.DirectionalLight;
  private sanctuaryFog = new THREE.FogExp2(0xd9e1e6, 0.004);
  private sanctuaryEnabled = true;
  private lastSimulatorEnvIndex: number | null = null;
  private lastSimulatorEnvPath: string | null = null;
  private rendererCanvas: HTMLCanvasElement | null = null;
  private contextLost = false;
  private frameCounter = 0;
  private uiValidated = false;
  private environmentEnhanced = false;
  private resizeRevalidateTimer: ReturnType<typeof setTimeout> | null = null;
  private currentCameraZoom = 1.0;

  private readonly handleWindowWheel = (event: WheelEvent) => {
    if (this.contextLost) return;
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLSelectElement ||
      (event.target instanceof HTMLElement &&
        Boolean(event.target.closest('.simulator-settings, #XRButtonWrapper')))
    ) {
      return;
    }
    if (!Number.isFinite(event.deltaY) || Math.abs(event.deltaY) < 0.5) return;
    const step = event.deltaY < 0 ? 0.12 : -0.12;
    this.handleZoomDelta(step);
  };

  private readonly handleWindowKeyDown = (event: KeyboardEvent) => {
    if (event.repeat) return;
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      (event.target instanceof HTMLElement && event.target.isContentEditable)
    ) {
      return;
    }

    switch (event.code) {
      case 'Space':
        event.preventDefault();
        this.handlePulse();
        break;
      case 'KeyR':
        this.handleReverseOrbit();
        break;
      case 'KeyM':
        this.handleToggleAudio();
        break;
      case 'KeyC':
        void this.handleToggleFrontCam();
        break;
      case 'KeyE':
        this.handleCycleScenario();
        break;
      case 'KeyP':
        this.handleTogglePassthrough();
        break;
      case 'KeyB':
        this.handleToggleBanner();
        break;
      case 'Equal':
      case 'NumpadAdd':
        event.preventDefault();
        this.handleZoomDelta(0.15);
        break;
      case 'Minus':
      case 'NumpadSubtract':
        event.preventDefault();
        this.handleZoomDelta(-0.15);
        break;
      case 'Digit1':
      case 'Digit2':
      case 'Digit3':
      case 'Digit4': {
        const index = Number(event.code.replace('Digit', '')) - 1;
        const presetId = PRESET_ORDER[index];
        if (presetId) this.handleSelectPreset(presetId);
        break;
      }
      case 'Digit0':
        this.handleReset();
        break;
    }
  };

  private readonly handleWindowResize = () => {
    this.applyCrispRendererQuality();
    this.uiValidated = false;
    this.frameCounter = 0;
    if (this.resizeRevalidateTimer) {
      clearTimeout(this.resizeRevalidateTimer);
    }
    this.resizeRevalidateTimer = setTimeout(() => {
      this.uiValidated = false;
    }, 120);
  };

  private readonly handleContextLost = (event: Event) => {
    event.preventDefault();
    this.contextLost = true;
    this.audio.setEnabled(false);
    this.frontCamTracker.stop('Front Cam paused (WebGL context lost)');
    if (typeof document !== 'undefined') {
      document.body.dataset.webglContext = 'lost';
    }
  };

  private readonly handleContextRestored = () => {
    this.contextLost = false;
    this.audio.setEnabled(this.state.audioEnabled);
    this.applyCrispRendererQuality();
    this.uiValidated = false;
    this.frameCounter = 0;
    if (typeof document !== 'undefined') {
      document.body.dataset.webglContext = 'active';
    }
  };

  constructor() {
    super();
    this.name = 'AetherPrism Scene';

    const initialSceneParam = readInitialSceneParam();
    if (initialSceneParam === 'room') {
      this.sanctuaryEnabled = false;
    } else if (initialSceneParam) {
      this.state = selectScenario(this.state, initialSceneParam);
    }

    this.crystal = new CrystalAssembly(() => this.handlePulse());
    this.hudCard = new SpatialHudCard({
      onPulse: () => this.handlePulse(),
      onReverseOrbit: () => this.handleReverseOrbit(),
      onSelectPreset: (presetId) => this.handleSelectPreset(presetId),
      onSelectScenario: (scenarioId) => this.handleSelectScenario(scenarioId),
      onTogglePassthrough: () => this.handleTogglePassthrough(),
      onOrbitSpeedChange: (speed) => this.handleOrbitSpeedChange(speed),
      onCrystalScaleChange: (scale) => this.handleCrystalScaleChange(scale),
      onZoomDelta: (delta) => this.handleZoomDelta(delta),
      onToggleAudio: () => this.handleToggleAudio(),
      onToggleFrontCam: () => void this.handleToggleFrontCam(),
      onReset: () => this.handleReset(),
    });
    this.statusOverlay = createStatusOverlay(() => this.handleDismissBanner());
    this.sanctuary = new NaturalSanctuary((panoramaTexture, scenarioSpec) => {
      this.applyScenarioAtmosphere(scenarioSpec);
      this.applyPanoramaEnvironmentLight(panoramaTexture);
    });
    this.frontCamTracker = new FrontCamHandTracker({
      onHandSteer: (yawRad, pitchRad, detected) => {
        this.crystal.setHandSteering(yawRad, pitchRad, detected);
      },
      onCommand: (command) => this.handleHandCommand(command),
      onStatus: (running, label) => {
        this.hudCard.setFrontCamState(running, label);
        if (typeof document !== 'undefined') {
          document.body.dataset.handCam = running ? 'active' : 'off';
          document.body.dataset.handCamStatus = label;
        }
      },
    });
  }

  override init(): void {
    this.applyCrispRendererQuality();
    this.setupLightingAndEnvironment();
    this.bindRendererContextListeners();

    this.add(this.sanctuary);
    this.add(this.crystal);
    this.add(this.hudCard);
    this.add(this.statusOverlay);

    if (this.state.activeScenarioId !== 'alpine') {
      this.sanctuary.setScenario(this.state.activeScenarioId);
      this.applyScenarioAtmosphere(
        ENVIRONMENT_SCENARIOS[this.state.activeScenarioId]
      );
    }
    this.applySanctuaryVisibility();
    this.syncEverything();

    if (typeof document !== 'undefined') {
      document.body.dataset.handCam = 'off';
      document.body.dataset.bannerVisible = 'true';
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleWindowKeyDown);
      window.addEventListener('resize', this.handleWindowResize);
      window.addEventListener('wheel', this.handleWindowWheel, {passive: true});
    }
  }

  private applyCrispRendererQuality(): void {
    const renderer = xb.core.renderer;
    if (!renderer || typeof window === 'undefined') return;

    try {
      let isSoftwareRenderer = false;
      if ('getContext' in renderer && typeof renderer.getContext === 'function') {
        const gl = (renderer as THREE.WebGLRenderer).getContext() as
          | WebGLRenderingContext
          | WebGL2RenderingContext
          | null;
        if (gl && typeof gl.getParameter === 'function') {
          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
          const gpuName = debugInfo
            ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) ?? '')
            : String(gl.getParameter(gl.RENDERER) ?? '');
          isSoftwareRenderer =
            /swiftshader|llvmpipe|software|angle.*swiftshader/i.test(gpuName);
        }
      }

      const nativeDpr = window.devicePixelRatio || 1;
      // 4K-capable super-crisp DPR on hardware GPUs; 1.0x on CPU SwiftShader for responsiveness
      const targetDpr = isSoftwareRenderer
        ? 1
        : Math.min(Math.max(nativeDpr, 2), 3);

      if ('setPixelRatio' in renderer && typeof renderer.setPixelRatio === 'function') {
        renderer.setPixelRatio(targetDpr);
      }
      if ('toneMapping' in renderer) {
        (renderer as THREE.WebGLRenderer).toneMapping = THREE.ACESFilmicToneMapping;
        (renderer as THREE.WebGLRenderer).toneMappingExposure = 1.06;
      }
    } catch {
      // Ignore if renderer is presenting active XR session
    }
  }

  private upgradeEnvironmentTextures(): void {
    if (this.environmentEnhanced) return;
    const renderer = xb.core.renderer;
    const maxAniso =
      renderer && 'capabilities' in renderer
        ? Math.min(
            16,
            (renderer as THREE.WebGLRenderer).capabilities.getMaxAnisotropy()
          )
        : 8;

    const enhanceScene = (root: THREE.Object3D | undefined) => {
      if (!root) return;
      root.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.material) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
          const std = mat as THREE.MeshStandardMaterial;
          const maps = [
            std.map,
            std.normalMap,
            std.roughnessMap,
            std.metalnessMap,
            std.bumpMap,
            std.emissiveMap,
          ];
          for (const tex of maps) {
            if (!tex || !tex.image) continue;
            tex.anisotropy = Math.max(tex.anisotropy || 1, maxAniso);
            tex.minFilter = THREE.LinearMipmapLinearFilter;
            tex.magFilter = THREE.LinearFilter;
            tex.needsUpdate = true;
          }
        }
      });
    };

    enhanceScene(xb.core.scene);
    enhanceScene(xb.core.simulator?.simulatorScene);
    this.environmentEnhanced = true;
  }

  private bindRendererContextListeners(): void {
    const domElement = xb.core.renderer?.domElement;
    if (!domElement || typeof HTMLCanvasElement === 'undefined') return;
    if (!(domElement instanceof HTMLCanvasElement)) return;

    this.rendererCanvas = domElement;
    domElement.addEventListener('webglcontextlost', this.handleContextLost);
    domElement.addEventListener('webglcontextrestored', this.handleContextRestored);
    if (typeof document !== 'undefined') {
      document.body.dataset.webglContext = 'active';
    }
  }

  private setupLightingAndEnvironment(): void {
    const renderer = xb.core.renderer;
    const scene = xb.core.scene;

    if (renderer && 'compile' in renderer && scene && !scene.environment) {
      try {
        const pmrem = new THREE.PMREMGenerator(renderer as THREE.WebGLRenderer);
        const roomEnv = new RoomEnvironment();
        this.envTexture = pmrem.fromScene(roomEnv, 0.04).texture;
        scene.environment = this.envTexture;
        roomEnv.dispose();
        pmrem.dispose();
      } catch {
        // Fallback gracefully if renderer backend does not support PMREM
      }
    }

    const initialSpec = ENVIRONMENT_SCENARIOS[this.state.activeScenarioId];
    this.hemiLight = new THREE.HemisphereLight(
      initialSpec.hemiSkyHex,
      initialSpec.hemiGroundHex,
      initialSpec.hemiIntensity
    );
    this.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(
      initialSpec.sunHex,
      initialSpec.sunIntensity
    );
    this.sunLight.position.set(-4.5, 6.2, -5.5);
    this.add(this.sunLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.45);
    rimLight.position.set(3.2, 2.4, 2.8);
    this.add(rimLight);

    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.75);
    fillLight.position.set(0.0, -2.0, 2.5);
    this.add(fillLight);
  }

  private applyScenarioAtmosphere(spec: EnvironmentScenarioSpec): void {
    this.sanctuaryFog.color.setHex(spec.fogHex);
    this.sanctuaryFog.density = spec.fogDensity;
    if (this.hemiLight) {
      this.hemiLight.color.setHex(spec.hemiSkyHex);
      this.hemiLight.groundColor.setHex(spec.hemiGroundHex);
      this.hemiLight.intensity = spec.hemiIntensity;
    }
    if (this.sunLight) {
      this.sunLight.color.setHex(spec.sunHex);
      this.sunLight.intensity = spec.sunIntensity;
    }
  }

  private applyPanoramaEnvironmentLight(panoramaTexture: THREE.Texture): void {
    const renderer = xb.core.renderer;
    const scene = xb.core.scene;
    if (!renderer || !('compile' in renderer) || !scene || !panoramaTexture.image) {
      return;
    }
    try {
      const cloned = panoramaTexture.clone();
      cloned.mapping = THREE.EquirectangularReflectionMapping;
      cloned.wrapS = THREE.RepeatWrapping;
      cloned.wrapT = THREE.ClampToEdgeWrapping;
      cloned.repeat.set(1, 1);
      cloned.offset.set(0, 0);
      cloned.needsUpdate = true;

      const pmrem = new THREE.PMREMGenerator(renderer as THREE.WebGLRenderer);
      pmrem.compileEquirectangularShader();
      const nextEnv = pmrem.fromEquirectangular(cloned).texture;
      pmrem.dispose();
      cloned.dispose();

      if (this.envTexture) {
        this.envTexture.dispose();
      }
      this.envTexture = nextEnv;
      scene.environment = nextEnv;
    } catch {
      // Retain RoomEnvironment fallback if equirectangular PMREM fails
    }
  }

  handleDismissBanner(): void {
    if (this.contextLost) return;
    this.statusOverlay.visible = false;
    this.audio.playUiClick();
    if (typeof document !== 'undefined') {
      document.body.dataset.bannerVisible = 'false';
    }
  }

  handleToggleBanner(): void {
    if (this.contextLost) return;
    this.statusOverlay.visible = !this.statusOverlay.visible;
    this.audio.playUiClick();
    if (typeof document !== 'undefined') {
      document.body.dataset.bannerVisible = String(this.statusOverlay.visible);
    }
  }

  private applySanctuaryVisibility(): void {
    this.sanctuary.visible = this.sanctuaryEnabled;
    this.hudCard.setSanctuaryMode(this.sanctuaryEnabled);
    const simRoomRoot = xb.core.simulator?.simulatorScene?.environmentRoot;
    if (simRoomRoot) {
      simRoomRoot.visible = !this.sanctuaryEnabled;
    }
    const scene = xb.core.scene;
    if (scene) {
      scene.fog = this.sanctuaryEnabled ? this.sanctuaryFog : null;
    }
    if (typeof document !== 'undefined') {
      document.body.dataset.environment = this.sanctuaryEnabled
        ? this.state.activeScenarioId
        : 'ar-room';
    }
  }

  handleSelectScenario(scenarioId: EnvironmentScenarioId): void {
    if (this.contextLost || !isValidScenarioId(scenarioId)) return;
    this.state = selectScenario(this.state, scenarioId);
    this.sanctuaryEnabled = true;
    const spec = ENVIRONMENT_SCENARIOS[scenarioId];
    this.sanctuary.setScenario(scenarioId);
    this.applyScenarioAtmosphere(spec);
    this.applySanctuaryVisibility();
    this.audio.playUiClick();
    this.syncEverything();
  }

  handleCycleScenario(): void {
    if (this.contextLost) return;
    if (!this.sanctuaryEnabled) {
      this.handleSelectScenario(this.state.activeScenarioId);
      return;
    }
    const idx = SCENARIO_ORDER.indexOf(this.state.activeScenarioId);
    const nextScenario = SCENARIO_ORDER[(idx + 1) % SCENARIO_ORDER.length];
    if (nextScenario) this.handleSelectScenario(nextScenario);
  }

  handleTogglePassthrough(): void {
    if (this.contextLost) return;
    this.sanctuaryEnabled = !this.sanctuaryEnabled;
    this.applySanctuaryVisibility();
    this.audio.playUiClick();
    this.syncEverything();
  }

  override onSimulatorStarted(): void {
    this.applyCrispRendererQuality();
    this.environmentEnhanced = false;
    this.upgradeEnvironmentTextures();
    this.lastSimulatorEnvIndex =
      xb.core.simulator?.options?.activeEnvironmentIndex ?? 0;
    this.lastSimulatorEnvPath =
      xb.core.simulator?.activeEnvironment?.manifestPath ?? null;
    this.applySanctuaryVisibility();
    this.uiValidated = false;
    this.frameCounter = 0;
    if (typeof document !== 'undefined') {
      document.body.dataset.sessionMode = 'simulator';
    }
  }

  override onXRSessionStarted(): void {
    this.uiValidated = false;
    this.frameCounter = 0;
    if (typeof document !== 'undefined') {
      document.body.dataset.sessionMode = 'xr';
    }
  }

  override onSelectEnd(event: xb.SelectEndEvent): void {
    if (!event.completed) return;
    if (
      this.isOwnedTarget(event.target, this.crystal) ||
      this.isOwnedTarget(event.target, this.hudCard) ||
      this.isOwnedTarget(event.target, this.statusOverlay) ||
      this.isOwnedTarget(event.target, this.sanctuary)
    ) {
      return;
    }
    this.handlePulse();
  }

  private isOwnedTarget(
    target: THREE.Object3D | undefined,
    root: THREE.Object3D
  ): boolean {
    let cursor: THREE.Object3D | null | undefined = target;
    let depth = 0;
    while (cursor && depth < 64) {
      if (cursor === root) return true;
      cursor = cursor.parent;
      depth += 1;
    }
    return false;
  }

  private handleHandCommand(command: HandGestureCommand): void {
    switch (command) {
      case 'pulse':
        this.handlePulse();
        break;
      case 'next_preset': {
        const idx = PRESET_ORDER.indexOf(this.state.activePresetId);
        const nextPreset = PRESET_ORDER[(idx + 1) % PRESET_ORDER.length];
        if (nextPreset) this.handleSelectPreset(nextPreset);
        break;
      }
      case 'reverse_orbit':
        this.handleReverseOrbit();
        break;
    }
  }

  async handleToggleFrontCam(): Promise<void> {
    if (this.contextLost) return;
    this.audio.playUiClick();
    await this.frontCamTracker.toggle();
  }

  handlePulse(): void {
    if (this.contextLost) return;
    const result = triggerCrystalPulse(this.state);
    this.state = result.state;
    this.crystal.triggerPulseImpulse();
    this.audio.playCrystalChime(result.frequencyHz, this.state.orbitSpeed);
    this.syncEverything();
  }

  handleReverseOrbit(): void {
    if (this.contextLost) return;
    this.state = toggleOrbitDirection(this.state);
    this.audio.playUiClick();
    this.syncEverything();
  }

  handleSelectPreset(presetId: ResonancePresetId): void {
    if (this.contextLost || !isValidPresetId(presetId)) return;
    this.state = selectPreset(this.state, presetId);
    this.crystal.triggerPulseImpulse();
    this.audio.playCrystalChime(this.state.frequencyHz, this.state.orbitSpeed);
    this.syncEverything();
  }

  handleOrbitSpeedChange(speed: number): void {
    if (this.contextLost || !Number.isFinite(speed)) return;
    this.state = setOrbitSpeed(this.state, speed);
    this.syncEverything();
  }

  handleCrystalScaleChange(scale: number): void {
    if (this.contextLost || !Number.isFinite(scale)) return;
    this.state = setCrystalScale(this.state, scale);
    this.syncEverything();
  }

  handleZoomDelta(delta: number): void {
    if (this.contextLost || !Number.isFinite(delta)) return;
    this.state = setCameraZoom(this.state, this.state.cameraZoom + delta);
    this.audio.playUiClick();
    this.syncEverything();
  }

  handleToggleAudio(): void {
    if (this.contextLost) return;
    this.state = toggleAudioEnabled(this.state);
    this.audio.setEnabled(this.state.audioEnabled);
    if (this.state.audioEnabled) {
      this.audio.playUiClick();
    }
    this.syncEverything();
  }

  handleReset(): void {
    if (this.contextLost) return;
    this.state = resetCrystalState();
    this.sanctuaryEnabled = true;
    this.sanctuary.setScenario(this.state.activeScenarioId);
    this.applyScenarioAtmosphere(
      ENVIRONMENT_SCENARIOS[this.state.activeScenarioId]
    );
    this.applySanctuaryVisibility();
    this.crystal.resetPosition();
    this.audio.setEnabled(this.state.audioEnabled);
    this.audio.playUiClick();
    this.crystal.triggerPulseImpulse();
    this.syncEverything();
  }

  private syncEverything(): void {
    this.crystal.applyState(this.state);
    this.hudCard.syncState(this.state);

    if (typeof document !== 'undefined') {
      document.body.dataset.app = 'aetherprism-xr';
      document.body.dataset.pulses = String(this.state.interactionCount);
      document.body.dataset.preset = this.state.activePresetId;
      document.body.dataset.environment = this.sanctuaryEnabled
        ? this.state.activeScenarioId
        : 'ar-room';
      document.body.dataset.orbit = this.state.orbitDirection === 1 ? 'CCW' : 'CW';
      document.body.dataset.speed = this.state.orbitSpeed.toFixed(2);
      document.body.dataset.scale = this.state.crystalScale.toFixed(2);
      document.body.dataset.zoom = this.state.cameraZoom.toFixed(2);
      document.body.dataset.audio = this.state.audioEnabled ? 'on' : 'off';
    }
  }

  override update(): void {
    if (this.contextLost) return;
    this.frameCounter += 1;

    // Detect if the user changed the AR Simulation Environment dropdown in Simulator Settings
    // (e.g. switched between Living Room / Office / Daytime Loft) and reveal the room cleanly.
    const sim = xb.core.simulator;
    const simEnvIdx = sim?.options?.activeEnvironmentIndex;
    const simEnvPath = sim?.activeEnvironment?.manifestPath ?? null;
    const envIndexChanged =
      typeof simEnvIdx === 'number' &&
      this.lastSimulatorEnvIndex !== null &&
      simEnvIdx !== this.lastSimulatorEnvIndex;
    const envPathChanged =
      simEnvPath !== null &&
      this.lastSimulatorEnvPath !== null &&
      simEnvPath !== this.lastSimulatorEnvPath;

    if (envIndexChanged || envPathChanged) {
      this.lastSimulatorEnvIndex =
        typeof simEnvIdx === 'number' ? simEnvIdx : this.lastSimulatorEnvIndex;
      this.lastSimulatorEnvPath = simEnvPath;
      this.sanctuaryEnabled = false;
      this.environmentEnhanced = false;
      this.applySanctuaryVisibility();
      this.syncEverything();
    } else {
      if (this.lastSimulatorEnvPath === null && simEnvPath !== null) {
        this.lastSimulatorEnvPath = simEnvPath;
      }
      const simRoomRoot = sim?.simulatorScene?.environmentRoot;
      if (simRoomRoot && simRoomRoot.visible !== !this.sanctuaryEnabled) {
        simRoomRoot.visible = !this.sanctuaryEnabled;
      }
    }

    // Smooth optical zoom in desktop simulator mode (disabled during WebXR HMD sessions)
    const renderer = xb.core.renderer;
    const camera = xb.core.camera;
    const isPresenting =
      renderer && 'xr' in renderer ? Boolean(renderer.xr?.isPresenting) : false;
    if (!isPresenting && camera instanceof THREE.PerspectiveCamera) {
      const rawDt = xb.getDeltaTime();
      const dt =
        Number.isFinite(rawDt) && rawDt > 0 ? Math.min(rawDt, 0.05) : 1 / 60;
      const lerpFactor = 1 - Math.exp(-12 * dt);
      this.currentCameraZoom +=
        (this.state.cameraZoom - this.currentCameraZoom) * lerpFactor;
      if (Math.abs(camera.zoom - this.currentCameraZoom) > 0.0005) {
        camera.zoom = this.currentCameraZoom;
        camera.updateProjectionMatrix();
      }
    }

    if (!this.environmentEnhanced && this.frameCounter >= 25) {
      this.upgradeEnvironmentTextures();
    }

    if (!this.uiValidated && this.frameCounter >= 12) {
      try {
        const cardReport = xb.ui.validate(this.hudCard);
        const overlayReport = xb.ui.validate(this.statusOverlay);
        if (cardReport.ready && overlayReport.ready) {
          const issues = [...cardReport.issues, ...overlayReport.issues];
          const hasPendingLayout = issues.some((i) => i.code === 'invalid-layout');
          if (hasPendingLayout && this.frameCounter < 120) {
            return;
          }
          this.uiValidated = true;
          const ok = cardReport.ok && overlayReport.ok;
          if (typeof document !== 'undefined') {
            document.body.dataset.uiValid = String(ok);
            document.body.dataset.uiIssues = JSON.stringify(
              issues.map((i) => `${i.code}:${i.severity}:${i.message}`)
            );
          }
          if (!ok) {
            console.warn('AetherPrism Spatial UI validation issues:', issues);
          }
        }
      } catch {
        // Ignore transient validation error if UI tree is mid-update
      }
    }
  }

  override dispose(): void {
    if (this.resizeRevalidateTimer) {
      clearTimeout(this.resizeRevalidateTimer);
      this.resizeRevalidateTimer = null;
    }
    this.frontCamTracker.dispose();
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.handleWindowKeyDown);
      window.removeEventListener('resize', this.handleWindowResize);
      window.removeEventListener('wheel', this.handleWindowWheel);
    }
    if (this.rendererCanvas) {
      this.rendererCanvas.removeEventListener(
        'webglcontextlost',
        this.handleContextLost
      );
      this.rendererCanvas.removeEventListener(
        'webglcontextrestored',
        this.handleContextRestored
      );
      this.rendererCanvas = null;
    }
    if (xb.core.scene && xb.core.scene.fog === this.sanctuaryFog) {
      xb.core.scene.fog = null;
    }
    if (this.envTexture) {
      this.envTexture.dispose();
      this.envTexture = null;
    }
    this.audio.dispose();
    super.dispose();
  }
}
