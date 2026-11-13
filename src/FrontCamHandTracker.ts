// =========================================================================
// Project: AetherPrism XR — Spatial Crystal Resonator
// Author: Md Shabbir Mia
// Module: Front-Camera Hand Movement & Gesture Controller (MediaPipe Vision)
// =========================================================================

import type {HandLandmarker, HandLandmarkerResult} from '@mediapipe/tasks-vision';

import {
  type HandGestureCommand,
  type HandGestureTrackerState,
  type HandLandmarkPoint,
  type HandPoseKind,
  createInitialHandGestureState,
  extractHandMetrics,
  stepHandGestureState,
} from './handTrackerMath';

export interface FrontCamCallbacks {
  readonly onHandSteer: (yawRad: number, pitchRad: number, active: boolean) => void;
  readonly onCommand: (command: HandGestureCommand) => void;
  readonly onStatus: (running: boolean, label: string) => void;
}

// Local WASM & model assets bundled in public/mediapipe/ for zero external latency
const LOCAL_WASM_ROOT = '/mediapipe/wasm';
const LOCAL_HAND_MODEL_PATH = '/mediapipe/hand_landmarker.task';
const INFERENCE_INTERVAL_MS = 42; // ~24 fps cap to keep WebGL silky smooth

const HAND_BONELINES: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

export class FrontCamHandTracker {
  private readonly callbacks: FrontCamCallbacks;

  private active = false;
  private starting = false;
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private landmarker: HandLandmarker | null = null;
  private rafId: number | null = null;
  private lastInferMs = 0;
  private lastVideoTime = -1;

  private pipContainer: HTMLDivElement | null = null;
  private pipCanvas: HTMLCanvasElement | null = null;
  private pipCtx: CanvasRenderingContext2D | null = null;
  private pipBadge: HTMLSpanElement | null = null;

  private lastPose: HandPoseKind = 'neutral';
  private gestureState: HandGestureTrackerState = createInitialHandGestureState();

  constructor(callbacks: FrontCamCallbacks) {
    this.callbacks = callbacks;
  }

  get isActive(): boolean {
    return this.active;
  }

  async toggle(): Promise<void> {
    if (this.starting) return;
    if (this.active) {
      this.stop('Front Cam off');
    } else {
      await this.start();
    }
  }

  async start(): Promise<void> {
    if (this.active || this.starting) return;
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      this.callbacks.onStatus(false, 'Camera API unavailable in this browser');
      return;
    }

    this.starting = true;
    this.callbacks.onStatus(false, 'Starting front camera & hand AI...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: {ideal: 640},
          height: {ideal: 480},
        },
        audio: false,
      });

      this.stream = stream;

      const video = document.createElement('video');
      video.playsInline = true;
      video.muted = true;
      video.autoplay = true;
      video.srcObject = stream;
      await video.play();
      this.video = video;

      if (!this.landmarker) {
        const visionPkg = await import('@mediapipe/tasks-vision');
        const fileset = await visionPkg.FilesetResolver.forVisionTasks(
          LOCAL_WASM_ROOT
        );
        this.landmarker = await visionPkg.HandLandmarker.createFromOptions(
          fileset,
          {
            baseOptions: {
              modelAssetPath: LOCAL_HAND_MODEL_PATH,
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numHands: 1,
            minHandDetectionConfidence: 0.55,
            minHandPresenceConfidence: 0.55,
            minTrackingConfidence: 0.5,
          }
        ).catch(async () => {
          // Graceful CPU fallback when WebGL delegate is unavailable
          return visionPkg.HandLandmarker.createFromOptions(fileset, {
            baseOptions: {
              modelAssetPath: LOCAL_HAND_MODEL_PATH,
              delegate: 'CPU',
            },
            runningMode: 'VIDEO',
            numHands: 1,
            minHandDetectionConfidence: 0.55,
            minHandPresenceConfidence: 0.55,
            minTrackingConfidence: 0.5,
          });
        });
      }

      this.active = true;
      this.gestureState = createInitialHandGestureState();
      this.lastPose = 'neutral';
      this.mountPipPreview();
      this.callbacks.onStatus(
        true,
        'Front Cam active — Move hand to tilt • Pinch: Pulse • Peace: Preset • Fist: Reverse'
      );
      this.scheduleLoop();
    } catch (error) {
      this.cleanupStreamOnly();
      const errName = error instanceof Error ? error.name : '';
      let message = 'Front camera failed to start';
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        message = 'Camera permission denied — using Mouse/XR';
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        message = 'No front camera detected — using Mouse/XR';
      } else if (errName === 'NotReadableError') {
        message = 'Camera is busy in another app';
      }
      this.callbacks.onStatus(false, message);
    } finally {
      this.starting = false;
    }
  }

  stop(reason = 'Front Cam stopped'): void {
    this.active = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.cleanupStreamOnly();
    this.unmountPipPreview();
    this.callbacks.onHandSteer(0, 0, false);
    this.callbacks.onStatus(false, reason);
  }

  private cleanupStreamOnly(): void {
    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
      this.video = null;
    }
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }
    this.lastVideoTime = -1;
  }

  private mountPipPreview(): void {
    if (typeof document === 'undefined' || this.pipContainer) return;

    const container = document.createElement('div');
    container.id = 'aetherprism-handcam-pip';
    container.style.position = 'fixed';
    container.style.right = '18px';
    container.style.bottom = '18px';
    container.style.width = '224px';
    container.style.borderRadius = '14px';
    container.style.overflow = 'hidden';
    container.style.background = 'rgba(10, 15, 28, 0.88)';
    container.style.border = '1px solid rgba(56, 189, 248, 0.45)';
    container.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.45)';
    container.style.zIndex = '25';
    container.style.backdropFilter = 'blur(8px)';

    const topBar = document.createElement('div');
    topBar.style.display = 'flex';
    topBar.style.justifyContent = 'space-between';
    topBar.style.alignItems = 'center';
    topBar.style.padding = '6px 10px';
    topBar.style.fontSize = '11px';
    topBar.style.fontWeight = '600';
    topBar.style.color = '#e0f2fe';
    topBar.style.borderBottom = '1px solid rgba(148, 163, 184, 0.2)';

    const title = document.createElement('span');
    title.textContent = 'Front Cam Hand Tracking';

    const badge = document.createElement('span');
    badge.textContent = 'SCANNING';
    badge.style.color = '#38bdf8';
    badge.style.fontSize = '10px';

    topBar.appendChild(title);
    topBar.appendChild(badge);

    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 216;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = 'auto';

    container.appendChild(topBar);
    container.appendChild(canvas);
    document.body.appendChild(container);

    this.pipContainer = container;
    this.pipCanvas = canvas;
    this.pipCtx = canvas.getContext('2d');
    this.pipBadge = badge;
  }

  private unmountPipPreview(): void {
    if (this.pipContainer) {
      this.pipContainer.remove();
      this.pipContainer = null;
    }
    this.pipCanvas = null;
    this.pipCtx = null;
    this.pipBadge = null;
  }

  private scheduleLoop(): void {
    if (!this.active) return;
    this.rafId = requestAnimationFrame((nowMs) => {
      this.processFrame(nowMs);
      this.scheduleLoop();
    });
  }

  private processFrame(nowMs: number): void {
    if (!this.active || !this.video || !this.landmarker) return;
    if (this.video.readyState < 2) return;
    if (nowMs - this.lastInferMs < INFERENCE_INTERVAL_MS) return;
    this.lastInferMs = nowMs;

    const videoTime = this.video.currentTime;
    if (videoTime === this.lastVideoTime) return;
    this.lastVideoTime = videoTime;

    let result: HandLandmarkerResult;
    try {
      result = this.landmarker.detectForVideo(this.video, nowMs);
    } catch {
      return;
    }

    const rawLandmarks = result.landmarks?.[0] as HandLandmarkPoint[] | undefined;
    if (rawLandmarks && rawLandmarks.length >= 21) {
      const metrics = extractHandMetrics(rawLandmarks, this.lastPose);
      if (metrics) {
        this.lastPose = metrics.pose;
        this.callbacks.onHandSteer(
          metrics.yawTargetRad,
          metrics.pitchTargetRad,
          true
        );

        const step = stepHandGestureState(this.gestureState, metrics.pose, nowMs);
        this.gestureState = step.state;
        if (step.command !== 'none') {
          this.callbacks.onCommand(step.command);
        }

        if (this.pipBadge) {
          this.pipBadge.textContent = metrics.pose.toUpperCase();
          this.pipBadge.style.color =
            metrics.pose === 'pinch'
              ? '#f472b6'
              : metrics.pose === 'peace'
                ? '#c084fc'
                : metrics.pose === 'fist'
                  ? '#fbbf24'
                  : '#34d399';
        }
        this.drawPipFrame(rawLandmarks);
        return;
      }
    }

    this.callbacks.onHandSteer(0, 0, false);
    if (this.pipBadge) {
      this.pipBadge.textContent = 'NO HAND';
      this.pipBadge.style.color = '#94a3b8';
    }
    this.drawPipFrame(null);
  }

  private drawPipFrame(landmarks: readonly HandLandmarkPoint[] | null): void {
    const ctx = this.pipCtx;
    const canvas = this.pipCanvas;
    const video = this.video;
    if (!ctx || !canvas || !video) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.save();
    // Mirror horizontally like a natural selfie mirror
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();

    if (!landmarks) return;

    // Draw bone lines in mirrored canvas coordinates
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.2;
    for (const [aIdx, bIdx] of HAND_BONELINES) {
      const a = landmarks[aIdx];
      const b = landmarks[bIdx];
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo((1 - a.x) * w, a.y * h);
      ctx.lineTo((1 - b.x) * w, b.y * h);
      ctx.stroke();
    }

    // Draw joints cleanly (highlight thumb tip & index tip)
    for (let i = 0; i < landmarks.length; i++) {
      const pt = landmarks[i];
      const x = (1 - pt.x) * w;
      const y = pt.y * h;
      const isPinchJoint = i === 4 || i === 8;
      ctx.fillStyle = isPinchJoint ? '#f472b6' : '#f8fafc';
      ctx.beginPath();
      ctx.arc(x, y, isPinchJoint ? 4.2 : 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  dispose(): void {
    this.stop('Front Cam closed');
    if (this.landmarker) {
      try {
        this.landmarker.close();
      } catch {
        // Ignore teardown error
      }
      this.landmarker = null;
    }
  }
}
