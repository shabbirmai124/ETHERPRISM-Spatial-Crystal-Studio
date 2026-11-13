// =========================================================================
// Project: AetherPrism XR — Spatial Crystal Resonator
// Author: Md Shabbir Mia
// Module: Dismissible Top View-Space Status Overlay (xb.UIOverlay)
// =========================================================================

import * as xb from 'xrblocks';
import {APP_AUTHOR, APP_BRAND_TITLE} from './crystalState';

export function createStatusOverlay(onDismiss: () => void): xb.UIOverlay {
  const textColumn = new xb.UIPanel({
    pointerEvents: 'none',
    style: {
      flexGrow: 1,
      flexBasis: 0,
      minWidth: 0,
      flexDirection: 'column',
      gap: 3,
    },
    children: [
      new xb.UIText({
        text: `${APP_BRAND_TITLE}  •  ${APP_AUTHOR}`,
        pointerEvents: 'none',
        style: {
          width: '100%',
          fontSize: 18,
          fontWeight: 'bold',
          textAlign: 'center',
          color: '#ffffff',
        },
      }),
      new xb.UIText({
        text: 'Click Crystal: Pulse  •  Drag Crystal: Move  •  Scroll/+/-: Zoom  •  E: Scene  •  C: Cam',
        pointerEvents: 'none',
        style: {
          width: '100%',
          fontSize: 13,
          opacity: 0.92,
          textAlign: 'center',
          color: '#e2e8f0',
        },
      }),
    ],
  });

  const dismissButton = new xb.UIButton({
    icon: 'close',
    ariaLabel: 'Dismiss status banner',
    style: {
      width: 36,
      height: 36,
      borderRadius: 18,
      padding: 0,
      paddingLeft: 0,
      paddingRight: 0,
      paddingTop: 0,
      paddingBottom: 0,
      flexShrink: 0,
      backgroundColor: 'rgba(255, 255, 255, 0.14)',
      ':hover': {backgroundColor: 'rgba(248, 113, 113, 0.45)'},
      ':active': {backgroundColor: 'rgba(239, 68, 68, 0.65)'},
    },
    onClick: () => onDismiss(),
  });

  const overlay = new xb.UIOverlay({
    style: {
      width: 720,
      position: 'absolute',
      top: 18,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      paddingLeft: 20,
      paddingRight: 16,
    },
    children: [textColumn, dismissButton],
  });
  overlay.name = 'AetherPrism Status Overlay';
  return overlay;
}
