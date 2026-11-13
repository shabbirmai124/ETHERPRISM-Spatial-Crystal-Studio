// =========================================================================
// Project: AetherPrism XR — Spatial Crystal Resonator
// Author: Md Shabbir Mia
// Module: Pure State Machine, Resonance Presets & Harmonic Math
// =========================================================================

export const APP_BRAND_TITLE = 'AetherPrism XR';
export const APP_AUTHOR = 'Md Shabbir Mia';
export const APP_TAGLINE = 'Spatial Crystal Resonator & Harmonic Orbit Lab';

export type ResonancePresetId = 'spectrum' | 'nebula' | 'solaris' | 'cryo';

export interface ResonancePreset {
  readonly id: ResonancePresetId;
  readonly name: string;
  readonly crystalHex: number;
  readonly coreEmissiveHex: number;
  readonly ringHex: number;
  readonly ringEmissiveHex: number;
  readonly orbHex: number;
  readonly accentCss: string;
  readonly baseFrequencyHz: number;
}

export const RESONANCE_PRESETS: Readonly<Record<ResonancePresetId, ResonancePreset>> =
  Object.freeze({
    spectrum: Object.freeze({
      id: 'spectrum',
      name: 'Spectrum',
      crystalHex: 0x00d4ff,
      coreEmissiveHex: 0x38bdf8,
      ringHex: 0xa855f7,
      ringEmissiveHex: 0x581c87,
      orbHex: 0x34d399,
      accentCss: '#38bdf8',
      baseFrequencyHz: 261.63, // C4
    }),
    nebula: Object.freeze({
      id: 'nebula',
      name: 'Nebula',
      crystalHex: 0xc084fc,
      coreEmissiveHex: 0xe879f9,
      ringHex: 0x6366f1,
      ringEmissiveHex: 0x312e81,
      orbHex: 0xf472b6,
      accentCss: '#c084fc',
      baseFrequencyHz: 293.66, // D4
    }),
    solaris: Object.freeze({
      id: 'solaris',
      name: 'Solaris',
      crystalHex: 0xfbbf24,
      coreEmissiveHex: 0xf97316,
      ringHex: 0xf43f5e,
      ringEmissiveHex: 0x881337,
      orbHex: 0xfde047,
      accentCss: '#fbbf24',
      baseFrequencyHz: 329.63, // E4
    }),
    cryo: Object.freeze({
      id: 'cryo',
      name: 'Cryo',
      crystalHex: 0x67e8f9,
      coreEmissiveHex: 0x0ea5e9,
      ringHex: 0x2dd4bf,
      ringEmissiveHex: 0x115e59,
      orbHex: 0xe0f2fe,
      accentCss: '#2dd4bf',
      baseFrequencyHz: 392.0, // G4
    }),
  });

export const PRESET_ORDER: readonly ResonancePresetId[] = Object.freeze([
  'spectrum',
  'nebula',
  'solaris',
  'cryo',
]);

export const ORBIT_SPEED_MIN = 0.25;
export const ORBIT_SPEED_MAX = 3.0;
export const CRYSTAL_SCALE_MIN = 0.7;
export const CRYSTAL_SCALE_MAX = 1.5;
export const FREQUENCY_MIN_HZ = 20;
export const FREQUENCY_MAX_HZ = 8000;

export interface CrystalState {
  readonly interactionCount: number;
  readonly activePresetId: ResonancePresetId;
  readonly customHue: number | null;
  readonly orbitDirection: 1 | -1;
  readonly orbitSpeed: number;
  readonly crystalScale: number;
  readonly audioEnabled: boolean;
  readonly frequencyHz: number;
  readonly lastEventLabel: string;
}

export function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

export function clampValue(
  value: number,
  min: number,
  max: number,
  fallback = min
): number {
  const safe = finiteOr(value, fallback);
  return Math.min(max, Math.max(min, safe));
}

export function isValidPresetId(id: unknown): id is ResonancePresetId {
  return (
    typeof id === 'string' &&
    Object.prototype.hasOwnProperty.call(RESONANCE_PRESETS, id)
  );
}

// Pentatonic semitone offsets for pleasant crystalline harmonic chimes
const PENTATONIC_SEMITONES = Object.freeze([0, 2, 4, 7, 9, 12, 14, 16, 19, 24] as const);

export function computeHarmonicFrequency(
  baseHz: number,
  interactionCount: number
): number {
  const safeBase = clampValue(baseHz, FREQUENCY_MIN_HZ, FREQUENCY_MAX_HZ, 261.63);
  const safeCount = Number.isFinite(interactionCount)
    ? Math.trunc(Math.abs(interactionCount))
    : 0;
  const index = safeCount % PENTATONIC_SEMITONES.length;
  const semitones = PENTATONIC_SEMITONES[index];
  const computed = Math.round(safeBase * Math.pow(2, semitones / 12) * 10) / 10;
  return clampValue(computed, FREQUENCY_MIN_HZ, FREQUENCY_MAX_HZ, safeBase);
}

export function createInitialCrystalState(): CrystalState {
  const preset = RESONANCE_PRESETS.spectrum;
  return {
    interactionCount: 0,
    activePresetId: 'spectrum',
    customHue: null,
    orbitDirection: 1,
    orbitSpeed: 1.0,
    crystalScale: 1.0,
    audioEnabled: true,
    frequencyHz: preset.baseFrequencyHz,
    lastEventLabel: 'Ready — Pinch or click crystal to resonate',
  };
}

export interface PulseResult {
  readonly state: CrystalState;
  readonly hue: number;
  readonly frequencyHz: number;
}

export function triggerCrystalPulse(
  state: CrystalState,
  hueSeed?: number
): PulseResult {
  const safeCount =
    Number.isFinite(state.interactionCount) && state.interactionCount >= 0
      ? Math.min(Math.trunc(state.interactionCount), Number.MAX_SAFE_INTEGER - 1)
      : 0;
  const nextCount = safeCount + 1;
  const presetId = isValidPresetId(state.activePresetId)
    ? state.activePresetId
    : 'spectrum';
  const preset = RESONANCE_PRESETS[presetId];
  // Golden-ratio conjugate progression produces evenly distributed vivid hues
  const fallbackHue = (nextCount * 0.61803398875) % 1;
  const hue =
    hueSeed !== undefined && Number.isFinite(hueSeed)
      ? hueSeed >= 0
        ? hueSeed % 1
        : ((hueSeed % 1) + 1) % 1
      : fallbackHue;
  const nextDirection: 1 | -1 = state.orbitDirection === 1 ? -1 : 1;
  const frequencyHz = computeHarmonicFrequency(
    preset.baseFrequencyHz,
    nextCount
  );

  return {
    hue,
    frequencyHz,
    state: {
      ...state,
      activePresetId: presetId,
      interactionCount: nextCount,
      customHue: hue,
      orbitDirection: nextDirection,
      frequencyHz,
      lastEventLabel: `Pulse #${nextCount} • Orbit ${nextDirection === 1 ? 'CCW' : 'CW'}`,
    },
  };
}

export function selectPreset(
  state: CrystalState,
  presetId: ResonancePresetId
): CrystalState {
  if (!isValidPresetId(presetId)) {
    return state;
  }
  const preset = RESONANCE_PRESETS[presetId];
  const frequencyHz = computeHarmonicFrequency(
    preset.baseFrequencyHz,
    state.interactionCount
  );
  return {
    ...state,
    activePresetId: presetId,
    customHue: null,
    frequencyHz,
    lastEventLabel: `${preset.name} resonance active`,
  };
}

export function toggleOrbitDirection(state: CrystalState): CrystalState {
  const nextDirection: 1 | -1 = state.orbitDirection === 1 ? -1 : 1;
  return {
    ...state,
    orbitDirection: nextDirection,
    lastEventLabel: `Orbit reversed (${nextDirection === 1 ? 'CCW' : 'CW'})`,
  };
}

export function setOrbitSpeed(state: CrystalState, speed: number): CrystalState {
  const clamped =
    Math.round(
      clampValue(speed, ORBIT_SPEED_MIN, ORBIT_SPEED_MAX, state.orbitSpeed) * 100
    ) / 100;
  return {
    ...state,
    orbitSpeed: clamped,
    lastEventLabel: `Orbit flux ${clamped.toFixed(2)}x`,
  };
}

export function setCrystalScale(state: CrystalState, scale: number): CrystalState {
  const clamped =
    Math.round(
      clampValue(scale, CRYSTAL_SCALE_MIN, CRYSTAL_SCALE_MAX, state.crystalScale) *
        100
    ) / 100;
  return {
    ...state,
    crystalScale: clamped,
    lastEventLabel: `Prism scale ${clamped.toFixed(2)}x`,
  };
}

export function toggleAudioEnabled(state: CrystalState): CrystalState {
  const next = !state.audioEnabled;
  return {
    ...state,
    audioEnabled: next,
    lastEventLabel: next ? 'Harmonic audio enabled' : 'Harmonic audio muted',
  };
}

export function resetCrystalState(): CrystalState {
  return createInitialCrystalState();
}

export interface SpringStep {
  readonly value: number;
  readonly velocity: number;
}

/**
 * Advances a damped harmonic spring solver by dt seconds.
 * Produces smooth bounce without frame-rate dependency and rejects non-finite inputs.
 */
export function stepSpringScale(
  current: number,
  target: number,
  velocity: number,
  dt: number,
  stiffness = 180,
  damping = 14
): SpringStep {
  const safeTarget = clampValue(target, 0.25, 3.0, 1.0);
  const safeCurrent = clampValue(current, 0.25, 3.0, safeTarget);
  const safeVelocity = clampValue(velocity, -50, 50, 0);
  const safeDt = clampValue(dt, 0, 0.05, 0);
  const safeStiffness = clampValue(stiffness, 1, 2000, 180);
  const safeDamping = clampValue(damping, 0.1, 500, 14);

  const displacement = safeCurrent - safeTarget;
  const accel = -safeStiffness * displacement - safeDamping * safeVelocity;
  const nextVelocity = safeVelocity + accel * safeDt;
  const nextValue = safeCurrent + nextVelocity * safeDt;
  return {
    value: finiteOr(nextValue, safeTarget),
    velocity: finiteOr(nextVelocity, 0),
  };
}
