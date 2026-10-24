/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cspPlugin, preloadAppPlugin, serviceWorkerPlugin } from './build/plugins.ts';

export default defineConfig({
  base: '/demo-visite-3d/',
  plugins: [react(), cspPlugin(), preloadAppPlugin(), serviceWorkerPlugin((f) => !/(-960|-1100|-1600)\.webp$|og\.jpg$|robots\.txt$/.test(f))],
  // three.js is one chunk of about 900 kB (275 kB gzipped), loaded only when the tour starts
  build: { target: 'es2022', sourcemap: false, assetsInlineLimit: 0, chunkSizeWarningLimit: 1000 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    // unit coverage is measured on the logic; the UI is covered by the Playwright tests
    coverage: {
      provider: 'v8',
      include: ['src/domain/**', 'src/state/**', 'src/pdf/**', 'src/shared/i18n.tsx'],
      reporter: ['text', 'json-summary', 'html'],
      thresholds: { lines: 90, functions: 85, branches: 80 },
    },
  },
});
