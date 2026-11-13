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
import {SpatialHudCard} from './SpatialHudCard';
import {createStatusOverlay} from './StatusOverlay';
import {
  type CrystalState,
  PRESET_ORDER,
  type ResonancePresetId,
  createInitialCrystalState,
  isValidPresetId,
  resetCrystalState,
  selectPreset,
  setCrystalScale,
  setOrbitSpeed,
  toggleAudioEnabled,
  toggleOrbitDirection,
  triggerCrystalPulse,
} from './crystalState';

export class AetherPrismScene extends xb.Script {
  private state: CrystalState = createInitialCrystalState();
  private readonly audio = new AudioResonator();
  private readonly crystal: CrystalAssembly;
  private readonly hudCard: SpatialHudCard;
  private readonly statusOverlay: xb.UIOverlay;

  private envTexture: THREE.Texture | null = null;
  private rendererCanvas: HTMLCanvasElement | null = null;
  private contextLost = false;
  private frameCounter = 0;
  private uiValidated = false;
  private resizeRevalidateTimer: ReturnType<typeof setTimeout> | null = null;

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
    if (typeof document !== 'undefined') {
      document.body.dataset.webglContext = 'lost';
    }
  };

  private readonly handleContextRestored = () => {
    this.contextLost = false;
    this.audio.setEnabled(this.state.audioEnabled);
    this.uiValidated = false;
    this.frameCounter = 0;
    if (typeof document !== 'undefined') {
      document.body.dataset.webglContext = 'active';
    }
  };

  constructor() {
    super();
    this.name = 'AetherPrism Scene';

    this.crystal = new CrystalAssembly(() => this.handlePulse());
    this.hudCard = new SpatialHudCard({
      onPulse: () => this.handlePulse(),
      onReverseOrbit: () => this.handleReverseOrbit(),
      onSelectPreset: (presetId) => this.handleSelectPreset(presetId),
      onOrbitSpeedChange: (speed) => this.handleOrbitSpeedChange(speed),
      onCrystalScaleChange: (scale) => this.handleCrystalScaleChange(scale),
      onToggleAudio: () => this.handleToggleAudio(),
      onReset: () => this.handleReset(),
    });
    this.statusOverlay = createStatusOverlay();
  }

  override init(): void {
    this.setupLightingAndEnvironment();
    this.bindRendererContextListeners();

    this.add(this.crystal);
    this.add(this.hudCard);
    this.add(this.statusOverlay);

    this.syncEverything();

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleWindowKeyDown);
      window.addEventListener('resize', this.handleWindowResize);
    }
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

    // Generate studio reflections via RoomEnvironment so metallic bezels and
    // physical crystal surfaces reflect rich specular highlights.
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

    // 3-point warm/cool studio rig
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x0f172a, 1.9);
    this.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.4);
    keyLight.position.set(2.4, 4.0, 2.6);
    this.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.7);
    rimLight.position.set(-2.4, 2.0, -2.5);
    this.add(rimLight);
  }

  override onSimulatorStarted(): void {
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
      this.isOwnedTarget(event.target, this.statusOverlay)
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
      document.body.dataset.orbit = this.state.orbitDirection === 1 ? 'CCW' : 'CW';
      document.body.dataset.speed = this.state.orbitSpeed.toFixed(2);
      document.body.dataset.scale = this.state.crystalScale.toFixed(2);
      document.body.dataset.audio = this.state.audioEnabled ? 'on' : 'off';
    }
  }

  override update(): void {
    if (this.contextLost) return;
    this.frameCounter += 1;

    // Wait until UIKit commits finite Yoga layout bounds before latching validation,
    // avoiding transient startup false negatives while still catching real issues.
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
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.handleWindowKeyDown);
      window.removeEventListener('resize', this.handleWindowResize);
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
    if (this.envTexture) {
      this.envTexture.dispose();
      this.envTexture = null;
    }
    this.audio.dispose();
    super.dispose();
  }
}
