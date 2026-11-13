import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CAMERA_ZOOM_MAX,
  CAMERA_ZOOM_MIN,
  CRYSTAL_SCALE_MAX,
  CRYSTAL_SCALE_MIN,
  ENVIRONMENT_SCENARIOS,
  type EnvironmentScenarioId,
  FREQUENCY_MAX_HZ,
  FREQUENCY_MIN_HZ,
  ORBIT_SPEED_MAX,
  ORBIT_SPEED_MIN,
  PRESET_ORDER,
  RESONANCE_PRESETS,
  type ResonancePresetId,
  SCENARIO_ORDER,
  clampValue,
  computeHarmonicFrequency,
  createInitialCrystalState,
  isValidPresetId,
  isValidScenarioId,
  resetCrystalState,
  selectPreset,
  selectScenario,
  setCameraZoom,
  setCrystalScale,
  setOrbitSpeed,
  stepSpringScale,
  toggleAudioEnabled,
  toggleOrbitDirection,
  triggerCrystalPulse,
} from './crystalState';

test('createInitialCrystalState initializes AetherPrism XR defaults', () => {
  const state = createInitialCrystalState();
  assert.equal(state.interactionCount, 0);
  assert.equal(state.activePresetId, 'spectrum');
  assert.equal(state.activeScenarioId, 'alpine');
  assert.equal(state.customHue, null);
  assert.equal(state.orbitDirection, 1);
  assert.equal(state.orbitSpeed, 1.0);
  assert.equal(state.crystalScale, 1.0);
  assert.equal(state.cameraZoom, 1.0);
  assert.equal(state.audioEnabled, true);
  assert.equal(state.frequencyHz, RESONANCE_PRESETS.spectrum.baseFrequencyHz);
});

test('triggerCrystalPulse increments count, reverses orbit, and computes harmonic pitch', () => {
  const initial = createInitialCrystalState();
  const first = triggerCrystalPulse(initial, 0.35);

  assert.equal(first.state.interactionCount, 1);
  assert.equal(first.state.orbitDirection, -1);
  assert.equal(first.state.customHue, 0.35);
  assert.equal(
    first.frequencyHz,
    computeHarmonicFrequency(RESONANCE_PRESETS.spectrum.baseFrequencyHz, 1)
  );

  const second = triggerCrystalPulse(first.state);
  assert.equal(second.state.interactionCount, 2);
  assert.equal(second.state.orbitDirection, 1);
  assert.ok(second.hue >= 0 && second.hue < 1);
});

test('selectPreset switches palette and clears customHue override', () => {
  const pulsed = triggerCrystalPulse(createInitialCrystalState(), 0.72).state;
  const solaris = selectPreset(pulsed, 'solaris');

  assert.equal(solaris.activePresetId, 'solaris');
  assert.equal(solaris.customHue, null);
  assert.equal(solaris.interactionCount, 1);
  assert.equal(
    solaris.frequencyHz,
    computeHarmonicFrequency(RESONANCE_PRESETS.solaris.baseFrequencyHz, 1)
  );
});

test('orbit speed, crystal scale, orbit direction, audio toggle, and reset work cleanly', () => {
  let state = createInitialCrystalState();
  state = setOrbitSpeed(state, 99);
  assert.equal(state.orbitSpeed, ORBIT_SPEED_MAX);
  state = setOrbitSpeed(state, -5);
  assert.equal(state.orbitSpeed, ORBIT_SPEED_MIN);

  state = setCrystalScale(state, 5);
  assert.equal(state.crystalScale, CRYSTAL_SCALE_MAX);
  state = setCrystalScale(state, 0.1);
  assert.equal(state.crystalScale, CRYSTAL_SCALE_MIN);

  state = setCameraZoom(state, 8.0);
  assert.equal(state.cameraZoom, CAMERA_ZOOM_MAX);
  state = setCameraZoom(state, 0.1);
  assert.equal(state.cameraZoom, CAMERA_ZOOM_MIN);
  state = setCameraZoom(state, 1.5);
  assert.equal(state.cameraZoom, 1.5);

  state = toggleOrbitDirection(state);
  assert.equal(state.orbitDirection, -1);

  state = toggleAudioEnabled(state);
  assert.equal(state.audioEnabled, false);

  const reset = resetCrystalState();
  assert.deepEqual(reset, createInitialCrystalState());
  assert.equal(reset.cameraZoom, 1.0);
});

test('stepSpringScale converges toward target scale cleanly', () => {
  let value = 1.4;
  let velocity = 0;
  for (let i = 0; i < 120; i++) {
    const next = stepSpringScale(value, 1.0, velocity, 1 / 60);
    value = next.value;
    velocity = next.velocity;
  }
  assert.ok(Math.abs(value - 1.0) < 0.005);
  assert.ok(Math.abs(velocity) < 0.05);
});

test('security and fault-tolerance: rejects NaN, Infinity, invalid preset IDs, and frozen config tampering', () => {
  assert.equal(clampValue(Number.NaN, 0.5, 2.0, 1.0), 1.0);
  assert.equal(clampValue(Number.POSITIVE_INFINITY, 0.5, 2.0, 1.0), 1.0);
  assert.equal(clampValue(Number.NEGATIVE_INFINITY, 0.5, 2.0, 1.0), 1.0);

  const initial = createInitialCrystalState();
  assert.equal(setOrbitSpeed(initial, Number.NaN).orbitSpeed, initial.orbitSpeed);
  assert.equal(setCrystalScale(initial, Number.NaN).crystalScale, initial.crystalScale);
  assert.equal(setCameraZoom(initial, Number.NaN).cameraZoom, initial.cameraZoom);

  // Reject prototype pollution / arbitrary keys
  assert.equal(isValidPresetId('__proto__'), false);
  assert.equal(isValidPresetId('constructor'), false);
  assert.equal(isValidPresetId('toString'), false);
  assert.equal(isValidPresetId('spectrum'), true);
  assert.equal(isValidScenarioId('__proto__'), false);
  assert.equal(isValidScenarioId('bamboo'), true);
  const unchanged = selectPreset(initial, '__proto__' as ResonancePresetId);
  assert.deepEqual(unchanged, initial);
  const unchangedScenario = selectScenario(
    initial,
    'constructor' as EnvironmentScenarioId
  );
  assert.deepEqual(unchangedScenario, initial);

  const coastal = selectScenario(initial, 'coastal');
  assert.equal(coastal.activeScenarioId, 'coastal');
  const aurora = selectScenario(coastal, 'aurora');
  assert.equal(aurora.activeScenarioId, 'aurora');

  // Harmonic frequency remains finite and bounded
  const freqNaN = computeHarmonicFrequency(Number.NaN, Number.NaN);
  assert.ok(freqNaN >= FREQUENCY_MIN_HZ && freqNaN <= FREQUENCY_MAX_HZ);
  const freqHigh = computeHarmonicFrequency(999999, 100);
  assert.equal(freqHigh, FREQUENCY_MAX_HZ);

  // Pulse rejects NaN hueSeed cleanly
  const pulseNaN = triggerCrystalPulse(initial, Number.NaN);
  assert.ok(Number.isFinite(pulseNaN.hue) && pulseNaN.hue >= 0 && pulseNaN.hue < 1);

  // Spring solver recovers cleanly from NaN / extreme dt
  const recovered = stepSpringScale(Number.NaN, 1.0, Number.POSITIVE_INFINITY, Number.NaN);
  assert.ok(Number.isFinite(recovered.value));
  assert.ok(Number.isFinite(recovered.velocity));

  // Configuration tables are immutable
  assert.equal(Object.isFrozen(RESONANCE_PRESETS), true);
  assert.equal(Object.isFrozen(RESONANCE_PRESETS.spectrum), true);
  assert.equal(Object.isFrozen(PRESET_ORDER), true);
  assert.equal(Object.isFrozen(ENVIRONMENT_SCENARIOS), true);
  assert.equal(Object.isFrozen(ENVIRONMENT_SCENARIOS.aurora), true);
  assert.equal(Object.isFrozen(SCENARIO_ORDER), true);
});
