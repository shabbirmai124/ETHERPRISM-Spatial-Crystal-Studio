// =========================================================================
// Project: AetherPrism XR — Spatial Crystal Resonator
// Author: Md Shabbir Mia
// Entry Point: Configures XR Blocks Options & Launches AetherPrismScene
// =========================================================================

import * as xb from 'xrblocks';

import {AetherPrismScene} from './AetherPrismScene';
import {APP_AUTHOR, APP_BRAND_TITLE, APP_TAGLINE} from './crystalState';

function renderSafeStartupFallback(message: string): void {
  const root = document.getElementById('root') ?? document.body;
  if (!root) return;

  const container = document.createElement('div');
  container.className = 'XRButtonError';
  container.setAttribute('role', 'alert');
  container.style.position = 'fixed';
  container.style.left = '50%';
  container.style.bottom = '2rem';
  container.style.transform = 'translateX(-50%)';
  container.style.maxWidth = '32rem';
  container.style.zIndex = '50';
  // Use textContent exclusively to prevent any DOM/XSS injection vectors.
  container.textContent = message;
  root.appendChild(container);
}

function shouldAutostartSimulator(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    const value = params.get('autostart');
    return value === '1' || value === 'true';
  } catch {
    return false;
  }
}

async function start(): Promise<void> {
  try {
    const options = new xb.Options();
    options.enableHands();
    options.enableGestures();
    options.enableReticles();
    options.setAppTitle(APP_BRAND_TITLE);
    options.setAppDescription(`${APP_TAGLINE} — Created for ${APP_AUTHOR}`);

    if (shouldAutostartSimulator()) {
      options.xrButton.alwaysAutostartSimulator = true;
    }

    xb.add(new AetherPrismScene());
    await xb.init(options);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Initialization failed';
    renderSafeStartupFallback(
      `${APP_BRAND_TITLE} could not initialize 3D WebXR rendering (${detail}).`
    );
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void start());
} else {
  void start();
}
