// =========================================================================
// Project: AetherPrism XR — Spatial Crystal Resonator
// Author: Md Shabbir Mia
// Module: Semantic XR Blocks Spatial Control Card (xb.UICard)
// =========================================================================

import * as xb from 'xrblocks';

import {
  APP_AUTHOR,
  APP_BRAND_TITLE,
  CRYSTAL_SCALE_MAX,
  CRYSTAL_SCALE_MIN,
  type CrystalState,
  ENVIRONMENT_SCENARIOS,
  type EnvironmentScenarioId,
  ORBIT_SPEED_MAX,
  ORBIT_SPEED_MIN,
  PRESET_ORDER,
  RESONANCE_PRESETS,
  type ResonancePresetId,
  SCENARIO_ORDER,
} from './crystalState';

export interface SpatialHudCallbacks {
  onPulse: () => void;
  onReverseOrbit: () => void;
  onSelectPreset: (presetId: ResonancePresetId) => void;
  onSelectScenario: (scenarioId: EnvironmentScenarioId) => void;
  onTogglePassthrough: () => void;
  onOrbitSpeedChange: (speed: number) => void;
  onCrystalScaleChange: (scale: number) => void;
  onZoomDelta: (delta: number) => void;
  onToggleAudio: () => void;
  onToggleFrontCam: () => void;
  onReset: () => void;
}

export class SpatialHudCard extends xb.UICard {
  private readonly countValueText: xb.UIText;
  private readonly modeValueText: xb.UIText;
  private readonly pitchValueText: xb.UIText;
  private readonly orbitValueText: xb.UIText;
  private readonly statusText: xb.UIText;
  private readonly speedValueText: xb.UIText;
  private readonly scaleValueText: xb.UIText;
  private readonly zoomValueText: xb.UIText;
  private readonly speedSlider: xb.UISlider;
  private readonly scaleSlider: xb.UISlider;
  private readonly audioButton: xb.UIButton;
  private readonly camButton: xb.UIButton;
  private readonly roomButton: xb.UIButton;
  private readonly presetButtons: Map<ResonancePresetId, xb.UIButton> =
    new Map();
  private readonly scenarioButtons: Map<EnvironmentScenarioId, xb.UIButton> =
    new Map();

  private statusOverride: string | null = null;
  private sanctuaryEnabled = true;

  constructor(callbacks: SpatialHudCallbacks) {
    const countValueText = new xb.UIText({
      text: '0',
      style: {fontSize: 22, fontWeight: 'bold', color: '#38bdf8'},
    });
    const modeValueText = new xb.UIText({
      text: 'Spectrum',
      style: {fontSize: 19, fontWeight: 'bold', color: '#f8fafc'},
    });
    const pitchValueText = new xb.UIText({
      text: '261.6 Hz',
      style: {fontSize: 19, fontWeight: 'bold', color: '#c084fc'},
    });
    const orbitValueText = new xb.UIText({
      text: 'CCW',
      style: {fontSize: 19, fontWeight: 'bold', color: '#34d399'},
    });
    const statusText = new xb.UIText({
      text: 'Ready — Switch scene, drag crystal to move, or scroll to zoom',
      style: {
        width: '100%',
        fontSize: 15,
        lineHeight: 1.28,
        opacity: 0.94,
        textAlign: 'center',
        color: '#bae6fd',
      },
    });
    const speedValueText = new xb.UIText({
      text: '1.00x',
      style: {fontSize: 17, fontWeight: 'bold', color: '#f1f5f9'},
    });
    const scaleValueText = new xb.UIText({
      text: '1.00x',
      style: {fontSize: 17, fontWeight: 'bold', color: '#f1f5f9'},
    });
    const zoomValueText = new xb.UIText({
      text: 'Zoom 1.00x',
      style: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#bae6fd',
        textAlign: 'center',
      },
    });

    const speedSlider = new xb.UISlider({
      ariaLabel: 'Orbit flux speed',
      min: ORBIT_SPEED_MIN,
      max: ORBIT_SPEED_MAX,
      step: 0.05,
      value: 1.0,
      style: {width: '100%', height: 34},
      onInput: (val) => callbacks.onOrbitSpeedChange(val),
    });

    const scaleSlider = new xb.UISlider({
      ariaLabel: 'Crystal prism scale',
      min: CRYSTAL_SCALE_MIN,
      max: CRYSTAL_SCALE_MAX,
      step: 0.05,
      value: 1.0,
      style: {width: '100%', height: 34},
      onInput: (val) => callbacks.onCrystalScaleChange(val),
    });

    const audioButton = new xb.UIButton({
      label: 'Audio On',
      icon: 'volume_up',
      ariaLabel: 'Toggle harmonic audio',
      style: {
        flexGrow: 1,
        flexBasis: 0,
        height: 42,
        paddingLeft: 8,
        paddingRight: 8,
        fontSize: 15,
      },
      onClick: () => callbacks.onToggleAudio(),
    });

    const camButton = new xb.UIButton({
      label: 'Front Cam',
      icon: 'videocam',
      ariaLabel: 'Toggle front camera hand movement control',
      style: {
        flexGrow: 1.15,
        flexBasis: 0,
        height: 42,
        paddingLeft: 8,
        paddingRight: 8,
        fontSize: 15,
      },
      onClick: () => callbacks.onToggleFrontCam(),
    });

    const presetButtons = new Map<ResonancePresetId, xb.UIButton>();
    const presetRow = new xb.UIPanel({
      style: {width: '100%', flexDirection: 'row', gap: 6},
      children: PRESET_ORDER.map((presetId) => {
        const preset = RESONANCE_PRESETS[presetId];
        const btn = new xb.UIButton({
          label: preset.name,
          ariaLabel: `Activate ${preset.name} resonance preset`,
          style: {
            flexGrow: 1,
            flexBasis: 0,
            height: 40,
            paddingLeft: 6,
            paddingRight: 6,
            fontSize: 15,
          },
          onClick: () => callbacks.onSelectPreset(presetId),
        });
        presetButtons.set(presetId, btn);
        return btn;
      }),
    });

    const scenarioButtons = new Map<EnvironmentScenarioId, xb.UIButton>();
    const roomButton = new xb.UIButton({
      label: 'AR Room',
      ariaLabel: 'Toggle simulator room passthrough environment',
      style: {
        flexGrow: 1.05,
        flexBasis: 0,
        height: 38,
        paddingLeft: 6,
        paddingRight: 6,
        fontSize: 14,
      },
      onClick: () => callbacks.onTogglePassthrough(),
    });

    const scenarioRow = new xb.UIPanel({
      style: {width: '100%', flexDirection: 'row', gap: 6},
      children: [
        ...SCENARIO_ORDER.map((scenarioId) => {
          const spec = ENVIRONMENT_SCENARIOS[scenarioId];
          const btn = new xb.UIButton({
            label: spec.label,
            ariaLabel: `Switch real-world environment to ${spec.title}`,
            style: {
              flexGrow: 1,
              flexBasis: 0,
              height: 38,
              paddingLeft: 6,
              paddingRight: 6,
              fontSize: 14,
            },
            onClick: () => callbacks.onSelectScenario(scenarioId),
          });
          scenarioButtons.set(scenarioId, btn);
          return btn;
        }),
        roomButton,
      ],
    });

    const header = new xb.UIPanel({
      style: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      },
      children: [
        new xb.UIIcon({
          icon: 'diamond',
          style: {width: 40, height: 40, color: '#38bdf8'},
        }),
        new xb.UIPanel({
          style: {
            flexGrow: 1,
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 2,
          },
          children: [
            new xb.UIText({
              text: APP_BRAND_TITLE,
              style: {fontSize: 28, fontWeight: 'bold', color: '#ffffff'},
            }),
            new xb.UIText({
              text: `Spatial Resonator • ${APP_AUTHOR}`,
              style: {fontSize: 15, opacity: 0.88, color: '#cbd5e1'},
            }),
          ],
        }),
      ],
    });

    const telemetryGrid = new xb.UIPanel({
      style: {
        width: '100%',
        flexDirection: 'row',
        gap: 8,
      },
      children: [
        SpatialHudCard.createMetricTile('PULSES', countValueText),
        SpatialHudCard.createMetricTile('MODE', modeValueText),
        SpatialHudCard.createMetricTile('PITCH', pitchValueText),
        SpatialHudCard.createMetricTile('ORBIT', orbitValueText),
      ],
    });

    const primaryActions = new xb.UIPanel({
      style: {width: '100%', flexDirection: 'row', gap: 8},
      children: [
        new xb.UIButton({
          label: 'Pulse Crystal',
          icon: 'bolt',
          ariaLabel: 'Pulse Crystal',
          style: {flexGrow: 1.25, flexBasis: 0, height: 42, fontSize: 16},
          onClick: () => callbacks.onPulse(),
        }),
        new xb.UIButton({
          label: 'Reverse',
          icon: 'sync',
          ariaLabel: 'Reverse orbit direction',
          style: {flexGrow: 1, flexBasis: 0, height: 42, fontSize: 16},
          onClick: () => callbacks.onReverseOrbit(),
        }),
      ],
    });

    const zoomActions = new xb.UIPanel({
      style: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      },
      children: [
        new xb.UIButton({
          label: 'Zoom -',
          icon: 'zoom_out',
          ariaLabel: 'Zoom out view',
          style: {
            flexGrow: 1,
            flexBasis: 0,
            height: 38,
            paddingLeft: 8,
            paddingRight: 8,
            fontSize: 15,
          },
          onClick: () => callbacks.onZoomDelta(-0.2),
        }),
        new xb.UIPanel({
          style: {
            flexGrow: 0.85,
            flexBasis: 0,
            minWidth: 0,
            height: 38,
            justifyContent: 'center',
            alignItems: 'center',
            borderRadius: 12,
            backgroundColor: 'rgba(15, 23, 42, 0.62)',
          },
          children: [zoomValueText],
        }),
        new xb.UIButton({
          label: 'Zoom +',
          icon: 'zoom_in',
          ariaLabel: 'Zoom in view',
          style: {
            flexGrow: 1,
            flexBasis: 0,
            height: 38,
            paddingLeft: 8,
            paddingRight: 8,
            fontSize: 15,
          },
          onClick: () => callbacks.onZoomDelta(0.2),
        }),
      ],
    });

    const secondaryActions = new xb.UIPanel({
      style: {width: '100%', flexDirection: 'row', gap: 8},
      children: [
        camButton,
        audioButton,
        new xb.UIButton({
          label: 'Reset',
          icon: 'restart_alt',
          ariaLabel: 'Reset spatial resonator',
          style: {
            flexGrow: 0.9,
            flexBasis: 0,
            height: 42,
            paddingLeft: 8,
            paddingRight: 8,
            fontSize: 15,
          },
          onClick: () => callbacks.onReset(),
        }),
      ],
    });

    super({
      size: {width: 0.8, height: 'auto'},
      manipulation: true,
      edge: true,
      style: {
        flexDirection: 'column',
        gap: 10,
        padding: 18,
        paddingBottom: 20,
      },
      children: [
        header,
        telemetryGrid,
        new xb.UIText({
          text: 'RESONANCE SPECTRUM',
          style: {
            width: '100%',
            fontSize: 13,
            fontWeight: 'bold',
            opacity: 0.78,
          },
        }),
        presetRow,
        new xb.UIText({
          text: 'REAL-WORLD ENVIRONMENT',
          style: {
            width: '100%',
            fontSize: 13,
            fontWeight: 'bold',
            opacity: 0.78,
          },
        }),
        scenarioRow,
        new xb.UIPanel({
          style: {
            width: '100%',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          },
          children: [
            new xb.UIText({text: 'Orbit Flux Speed', style: {fontSize: 16}}),
            speedValueText,
          ],
        }),
        speedSlider,
        new xb.UIPanel({
          style: {
            width: '100%',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          },
          children: [
            new xb.UIText({text: 'Crystal Scale', style: {fontSize: 16}}),
            scaleValueText,
          ],
        }),
        scaleSlider,
        primaryActions,
        zoomActions,
        secondaryActions,
        statusText,
      ],
    });

    this.name = 'AetherPrism Spatial Control Card';
    this.position.set(0.46, 1.40, -1.16);
    this.rotation.y = -0.22;

    this.countValueText = countValueText;
    this.modeValueText = modeValueText;
    this.pitchValueText = pitchValueText;
    this.orbitValueText = orbitValueText;
    this.statusText = statusText;
    this.speedValueText = speedValueText;
    this.scaleValueText = scaleValueText;
    this.zoomValueText = zoomValueText;
    this.speedSlider = speedSlider;
    this.scaleSlider = scaleSlider;
    this.audioButton = audioButton;
    this.camButton = camButton;
    this.roomButton = roomButton;
    this.presetButtons = presetButtons;
    this.scenarioButtons = scenarioButtons;
  }

  private static createMetricTile(
    label: string,
    valueNode: xb.UIText
  ): xb.UIPanel {
    return new xb.UIPanel({
      style: {
        flexGrow: 1,
        flexBasis: 0,
        minWidth: 0,
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        padding: 8,
        borderRadius: 12,
        backgroundColor: 'rgba(15, 23, 42, 0.62)',
      },
      children: [
        new xb.UIText({
          text: label,
          style: {fontSize: 12, fontWeight: 'bold', opacity: 0.78},
        }),
        valueNode,
      ],
    });
  }

  setFrontCamState(running: boolean, statusMessage?: string): void {
    this.camButton.label = running ? 'Cam Active' : 'Front Cam';
    this.camButton.icon = running ? 'pan_tool' : 'videocam';
    this.camButton.style.backgroundColor = running
      ? 'rgba(52, 211, 153, 0.36)'
      : 'rgba(255, 255, 255, 0.08)';
    if (statusMessage) {
      this.statusOverride = running ? statusMessage : null;
      this.statusText.text = statusMessage;
    }
  }

  setSanctuaryMode(enabled: boolean): void {
    this.sanctuaryEnabled = enabled;
  }

  syncState(state: CrystalState): void {
    const preset = RESONANCE_PRESETS[state.activePresetId];
    this.countValueText.text = String(state.interactionCount);
    this.modeValueText.text = preset.name;
    this.modeValueText.style.color = preset.accentCss;
    this.pitchValueText.text = `${state.frequencyHz.toFixed(1)} Hz`;
    this.orbitValueText.text = state.orbitDirection === 1 ? 'CCW' : 'CW';
    this.orbitValueText.style.color =
      state.orbitDirection === 1 ? '#34d399' : '#f472b6';
    this.statusText.text = this.statusOverride ?? state.lastEventLabel;

    this.speedValueText.text = `${state.orbitSpeed.toFixed(2)}x`;
    this.scaleValueText.text = `${state.crystalScale.toFixed(2)}x`;
    this.zoomValueText.text = `Zoom ${state.cameraZoom.toFixed(2)}x`;
    if (Math.abs(this.speedSlider.value - state.orbitSpeed) > 0.001) {
      this.speedSlider.value = state.orbitSpeed;
    }
    if (Math.abs(this.scaleSlider.value - state.crystalScale) > 0.001) {
      this.scaleSlider.value = state.crystalScale;
    }

    this.audioButton.label = state.audioEnabled ? 'Audio On' : 'Muted';
    this.audioButton.icon = state.audioEnabled ? 'volume_up' : 'volume_off';

    for (const [id, button] of this.presetButtons.entries()) {
      const isActive = id === state.activePresetId;
      button.style.backgroundColor = isActive
        ? 'rgba(56, 189, 248, 0.35)'
        : 'rgba(255, 255, 255, 0.08)';
    }

    for (const [id, button] of this.scenarioButtons.entries()) {
      const isActive = this.sanctuaryEnabled && id === state.activeScenarioId;
      button.style.backgroundColor = isActive
        ? 'rgba(16, 185, 129, 0.38)'
        : 'rgba(255, 255, 255, 0.08)';
    }
    this.roomButton.style.backgroundColor = !this.sanctuaryEnabled
      ? 'rgba(245, 158, 11, 0.38)'
      : 'rgba(255, 255, 255, 0.08)';
  }
}
