// =========================================================================
// Project: AetherPrism XR — Spatial Crystal Resonator
// Author: Md Shabbir Mia
// Module: Procedural Web Audio Synthesizer (Zero External Assets)
// =========================================================================

import {
  FREQUENCY_MAX_HZ,
  FREQUENCY_MIN_HZ,
  ORBIT_SPEED_MAX,
  ORBIT_SPEED_MIN,
  clampValue,
} from './crystalState';

/**
 * Generates crystalline harmonic chimes and soft tactile clicks using the
 * browser's Web Audio API with zero external audio file dependencies.
 */
export class AudioResonator {
  private context: AudioContext | null = null;
  private enabled = true;

  setEnabled(enabled: boolean): void {
    this.enabled = Boolean(enabled);
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as {webkitAudioContext?: typeof AudioContext})
          .webkitAudioContext;
      if (!AudioCtx) return null;

      if (!this.context || this.context.state === 'closed') {
        this.context = new AudioCtx();
      }
      if (this.context.state === 'suspended') {
        void this.context.resume().catch(() => {});
      }
      return this.context;
    } catch {
      return null;
    }
  }

  /**
   * Plays a layered harmonic crystal chime when the prism is pulsed.
   */
  playCrystalChime(frequencyHz: number, speedMultiplier = 1.0): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const safeFreq = clampValue(frequencyHz, FREQUENCY_MIN_HZ, FREQUENCY_MAX_HZ, 261.63);
    const safeSpeed = clampValue(speedMultiplier, ORBIT_SPEED_MIN, ORBIT_SPEED_MAX, 1.0);

    try {
      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(0.18, now + 0.015);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.72);
      master.connect(ctx.destination);

      // Primary fundamental tone
      const fundamental = ctx.createOscillator();
      fundamental.type = 'sine';
      fundamental.frequency.setValueAtTime(safeFreq, now);

      // Shimmering fifth / octave overtone
      const overtone = ctx.createOscillator();
      overtone.type = 'triangle';
      const shimmer = 1.5 + Math.min(safeSpeed, 3) * 0.04;
      const overtoneFreq = clampValue(
        safeFreq * shimmer,
        FREQUENCY_MIN_HZ,
        FREQUENCY_MAX_HZ * 1.5,
        392.0
      );
      overtone.frequency.setValueAtTime(overtoneFreq, now);

      const overtoneGain = ctx.createGain();
      overtoneGain.gain.setValueAtTime(0.28, now);
      overtoneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      fundamental.connect(master);
      overtone.connect(overtoneGain);
      overtoneGain.connect(master);

      fundamental.onended = () => {
        fundamental.disconnect();
        master.disconnect();
      };
      overtone.onended = () => {
        overtone.disconnect();
        overtoneGain.disconnect();
      };

      fundamental.start(now);
      overtone.start(now);
      fundamental.stop(now + 0.75);
      overtone.stop(now + 0.5);
    } catch {
      // Fail safely if audio policy or device state interrupts scheduling
    }
  }

  /**
   * Plays a subtle tactile feedback click for Spatial UI interactions.
   */
  playUiClick(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1180, now);
      osc.frequency.exponentialRampToValueAtTime(640, now + 0.035);

      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };

      osc.start(now);
      osc.stop(now + 0.045);
    } catch {
      // Fail safely if audio playback is restricted
    }
  }

  dispose(): void {
    if (this.context && this.context.state !== 'closed') {
      void this.context.close().catch(() => {});
    }
    this.context = null;
  }
}
