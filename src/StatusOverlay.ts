// =========================================================================
// Project: AetherPrism XR — Spatial Crystal Resonator
// Author: Md Shabbir Mia
// Module: Bottom View-Space Overlay (xb.UIOverlay)
// =========================================================================

import * as xb from 'xrblocks';
import {APP_AUTHOR, APP_BRAND_TITLE} from './crystalState';

export function createStatusOverlay(): xb.UIOverlay {
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
          fontSize: 17,
          fontWeight: 'bold',
          textAlign: 'center',
          color: '#f8fafc',
        },
      }),
      new xb.UIText({
        text: 'Pinch or click crystal to pulse  •  Drag card edge to move  •  Space: Pulse  •  R: Reverse',
        pointerEvents: 'none',
        style: {
          width: '100%',
          fontSize: 13,
          opacity: 0.85,
          textAlign: 'center',
          color: '#cbd5e1',
        },
      }),
    ],
  });

  const exitButton = new xb.UIExitButton({
    style: {
      position: 'relative',
      top: 0,
      left: 0,
      flexShrink: 0,
    },
  });

  const overlay = new xb.UIOverlay({
    style: {
      width: 680,
      position: 'absolute',
      left: '50%',
      top: 24,
      transform: {translateX: '-50%'},
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      paddingLeft: 18,
      paddingRight: 16,
    },
    children: [textColumn, exitButton],
  });
  overlay.name = 'AetherPrism Status Overlay';
  return overlay;
}
