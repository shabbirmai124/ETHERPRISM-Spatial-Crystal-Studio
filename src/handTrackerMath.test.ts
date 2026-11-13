import test from 'node:test';
import assert from 'node:assert/strict';

import {
  type HandLandmarkPoint,
  createInitialHandGestureState,
  extractHandMetrics,
  stepHandGestureState,
} from './handTrackerMath';

function makeBaseHand(): HandLandmarkPoint[] {
  // 21 landmarks centered at (0.5, 0.5) with wrist at (0.5, 0.7), middle MCP at (0.5, 0.5)
  const pts: HandLandmarkPoint[] = Array.from({length: 21}, () => ({x: 0.5, y: 0.5}));
  pts[0] = {x: 0.5, y: 0.7}; // Wrist
  pts[9] = {x: 0.5, y: 0.5}; // Middle MCP (palmSize = 0.2)

  // Open fingers by default (tips well above PIPs from wrist)
  pts[4] = {x: 0.34, y: 0.42}; // Thumb tip far from index tip
  pts[6] = {x: 0.44, y: 0.42};
  pts[8] = {x: 0.44, y: 0.24}; // Index tip
  pts[10] = {x: 0.5, y: 0.4};
  pts[12] = {x: 0.5, y: 0.22}; // Middle tip
  pts[14] = {x: 0.56, y: 0.42};
  pts[16] = {x: 0.56, y: 0.25}; // Ring tip
  pts[18] = {x: 0.62, y: 0.46};
  pts[20] = {x: 0.62, y: 0.32}; // Pinky tip
  return pts;
}

test('extractHandMetrics classifies open palm, pinch, peace, and fist accurately', () => {
  const openHand = makeBaseHand();
  const openMetrics = extractHandMetrics(openHand);
  assert.ok(openMetrics);
  assert.equal(openMetrics.pose, 'open');
  assert.ok(Math.abs(openMetrics.mirroredX - 0.5) < 0.01);

  // Pinch: bring thumb tip next to index tip
  const pinchHand = makeBaseHand();
  pinchHand[4] = {x: 0.445, y: 0.245};
  const pinchMetrics = extractHandMetrics(pinchHand);
  assert.ok(pinchMetrics);
  assert.equal(pinchMetrics.pose, 'pinch');

  // Peace: fold ring and pinky close to wrist
  const peaceHand = makeBaseHand();
  peaceHand[14] = {x: 0.56, y: 0.52};
  peaceHand[16] = {x: 0.56, y: 0.6};
  peaceHand[18] = {x: 0.62, y: 0.54};
  peaceHand[20] = {x: 0.62, y: 0.61};
  const peaceMetrics = extractHandMetrics(peaceHand);
  assert.ok(peaceMetrics);
  assert.equal(peaceMetrics.pose, 'peace');

  // Fist: fold all 4 fingers close to wrist
  const fistHand = makeBaseHand();
  fistHand[6] = {x: 0.44, y: 0.52};
  fistHand[8] = {x: 0.44, y: 0.61};
  fistHand[10] = {x: 0.5, y: 0.52};
  fistHand[12] = {x: 0.5, y: 0.61};
  fistHand[14] = {x: 0.56, y: 0.52};
  fistHand[16] = {x: 0.56, y: 0.61};
  fistHand[18] = {x: 0.62, y: 0.54};
  fistHand[20] = {x: 0.62, y: 0.62};
  const fistMetrics = extractHandMetrics(fistHand);
  assert.ok(fistMetrics);
  assert.equal(fistMetrics.pose, 'fist');
});

test('extractHandMetrics rejects malformed arrays and NaN coordinates safely', () => {
  assert.equal(extractHandMetrics([]), null);
  const bad = makeBaseHand();
  bad[0] = {x: Number.NaN, y: 0.5};
  assert.equal(extractHandMetrics(bad), null);
});

test('stepHandGestureState requires stability frames and respects cooldown', () => {
  let state = createInitialHandGestureState();

  // Frames 1 and 2 should not trigger
  let res = stepHandGestureState(state, 'pinch', 1000);
  assert.equal(res.command, 'none');
  res = stepHandGestureState(res.state, 'pinch', 1030);
  assert.equal(res.command, 'none');

  // Frame 3 stabilizes pinch -> triggers pulse
  res = stepHandGestureState(res.state, 'pinch', 1060);
  assert.equal(res.command, 'pulse');
  state = res.state;

  // Immediate transition to peace within cooldown should not fire command
  for (let i = 0; i < 3; i++) {
    res = stepHandGestureState(state, 'peace', 1200 + i * 20);
    state = res.state;
  }
  assert.equal(res.command, 'none');

  // Transition to open then fist after cooldown -> triggers reverse_orbit
  for (let i = 0; i < 3; i++) {
    res = stepHandGestureState(state, 'open', 1900 + i * 20);
    state = res.state;
  }
  for (let i = 0; i < 3; i++) {
    res = stepHandGestureState(state, 'fist', 2000 + i * 20);
    state = res.state;
  }
  assert.equal(res.command, 'reverse_orbit');
});
