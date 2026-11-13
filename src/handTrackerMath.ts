// =========================================================================
// Project: AetherPrism XR — Spatial Crystal Resonator
// Author: Md Shabbir Mia
// Module: Pure Front-Camera Hand Kinematics & Gesture State Machine
// =========================================================================

import {clampValue, finiteOr} from './crystalState';

export interface HandLandmarkPoint {
  readonly x: number;
  readonly y: number;
  readonly z?: number;
}

export type HandPoseKind = 'open' | 'pinch' | 'peace' | 'fist' | 'neutral';

export type HandGestureCommand = 'none' | 'pulse' | 'next_preset' | 'reverse_orbit';

export interface HandMetrics {
  readonly mirroredX: number; // 0 (left) .. 1 (right)
  readonly y: number; // 0 (top) .. 1 (bottom)
  readonly palmSize: number;
  readonly pinchRatio: number;
  readonly yawTargetRad: number;
  readonly pitchTargetRad: number;
  readonly pose: HandPoseKind;
}

export interface HandGestureTrackerState {
  readonly candidatePose: HandPoseKind;
  readonly candidateFrames: number;
  readonly activePose: HandPoseKind;
  readonly lastTriggerMs: number;
}

const STABILITY_FRAMES = 3;
const GESTURE_COOLDOWN_MS = 650;
const PINCH_START_RATIO = 0.38;
const PINCH_RELEASE_RATIO = 0.5;

function dist2D(a: HandLandmarkPoint, b: HandLandmarkPoint): number {
  const ax = finiteOr(a.x, 0);
  const ay = finiteOr(a.y, 0);
  const bx = finiteOr(b.x, 0);
  const by = finiteOr(b.y, 0);
  return Math.hypot(ax - bx, ay - by);
}

function isFingerExtended(
  wrist: HandLandmarkPoint,
  pip: HandLandmarkPoint,
  tip: HandLandmarkPoint
): boolean {
  const tipDist = dist2D(wrist, tip);
  const pipDist = dist2D(wrist, pip);
  return tipDist > pipDist * 1.12;
}

/**
 * Extracts normalized front-camera hand metrics & classifies the static pose
 * from a 21-point MediaPipe hand landmark array.
 */
export function extractHandMetrics(
  landmarks: readonly HandLandmarkPoint[],
  previousPose: HandPoseKind = 'neutral'
): HandMetrics | null {
  if (!Array.isArray(landmarks) || landmarks.length < 21) {
    return null;
  }

  const wrist = landmarks[0];
  const thumbTip = landmarks[4];
  const indexPip = landmarks[6];
  const indexTip = landmarks[8];
  const middleMcp = landmarks[9];
  const middlePip = landmarks[10];
  const middleTip = landmarks[12];
  const ringPip = landmarks[14];
  const ringTip = landmarks[16];
  const pinkyPip = landmarks[18];
  const pinkyTip = landmarks[20];

  if (
    !Number.isFinite(wrist.x) ||
    !Number.isFinite(wrist.y) ||
    !Number.isFinite(middleMcp.x) ||
    !Number.isFinite(middleMcp.y)
  ) {
    return null;
  }

  // Mirror X so moving your hand right in front of a selfie webcam steers right.
  const rawPalmX = (wrist.x + middleMcp.x) * 0.5;
  const rawPalmY = (wrist.y + middleMcp.y) * 0.5;
  const mirroredX = clampValue(1 - rawPalmX, 0, 1, 0.5);
  const y = clampValue(rawPalmY, 0, 1, 0.5);

  const palmSize = Math.max(0.04, dist2D(wrist, middleMcp));
  const pinchDist = dist2D(thumbTip, indexTip);
  const pinchRatio = clampValue(pinchDist / palmSize, 0, 5, 1);

  const indexOpen = isFingerExtended(wrist, indexPip, indexTip);
  const middleOpen = isFingerExtended(wrist, middlePip, middleTip);
  const ringOpen = isFingerExtended(wrist, ringPip, ringTip);
  const pinkyOpen = isFingerExtended(wrist, pinkyPip, pinkyTip);

  const pinchThreshold =
    previousPose === 'pinch' ? PINCH_RELEASE_RATIO : PINCH_START_RATIO;

  let pose: HandPoseKind = 'neutral';
  if (pinchRatio <= pinchThreshold) {
    pose = 'pinch';
  } else if (!indexOpen && !middleOpen && !ringOpen && !pinkyOpen) {
    pose = 'fist';
  } else if (indexOpen && middleOpen && !ringOpen && !pinkyOpen) {
    pose = 'peace';
  } else if (indexOpen && middleOpen && ringOpen && pinkyOpen) {
    pose = 'open';
  }

  // Map normalized palm center (0..1) to smooth crystal steering angles
  const yawTargetRad = clampValue((mirroredX - 0.5) * 1.9, -1.1, 1.1, 0);
  const pitchTargetRad = clampValue((y - 0.5) * -1.1, -0.65, 0.65, 0);

  return {
    mirroredX,
    y,
    palmSize,
    pinchRatio,
    yawTargetRad,
    pitchTargetRad,
    pose,
  };
}

export function createInitialHandGestureState(): HandGestureTrackerState {
  return {
    candidatePose: 'neutral',
    candidateFrames: 0,
    activePose: 'neutral',
    lastTriggerMs: -10000,
  };
}

export interface HandGestureStepResult {
  readonly state: HandGestureTrackerState;
  readonly command: HandGestureCommand;
}

/**
 * Debounces raw hand poses across frames and enforces cooldowns before emitting
 * discrete control commands.
 */
export function stepHandGestureState(
  prev: HandGestureTrackerState,
  pose: HandPoseKind,
  nowMs: number
): HandGestureStepResult {
  const safeNow = finiteOr(nowMs, 0);
  const sameCandidate = prev.candidatePose === pose;
  const candidateFrames = sameCandidate ? prev.candidateFrames + 1 : 1;

  if (candidateFrames < STABILITY_FRAMES) {
    return {
      command: 'none',
      state: {
        ...prev,
        candidatePose: pose,
        candidateFrames,
      },
    };
  }

  if (pose === prev.activePose) {
    return {
      command: 'none',
      state: {
        ...prev,
        candidatePose: pose,
        candidateFrames,
      },
    };
  }

  const cooledDown = safeNow - prev.lastTriggerMs >= GESTURE_COOLDOWN_MS;
  let command: HandGestureCommand = 'none';
  if (cooledDown) {
    if (pose === 'pinch') command = 'pulse';
    else if (pose === 'peace') command = 'next_preset';
    else if (pose === 'fist') command = 'reverse_orbit';
  }

  return {
    command,
    state: {
      candidatePose: pose,
      candidateFrames,
      activePose: pose,
      lastTriggerMs: command !== 'none' ? safeNow : prev.lastTriggerMs,
    },
  };
}
