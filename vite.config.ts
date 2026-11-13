import {defineConfig} from 'vite';

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), xr-spatial-tracking=(self)',
};

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    headers: SECURITY_HEADERS,
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    headers: SECURITY_HEADERS,
  },
  build: {
    sourcemap: false,
    target: 'es2022',
  },
});
