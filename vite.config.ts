import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { tanstackRouter } from '@tanstack/router-plugin/vite';

/**
 * Emits sw.js listing every built file, so the installed game works offline
 * from the first launch. The template lives in pwa/sw-template.js.
 */
function frostlinePwa(): Plugin {
  return {
    name: 'frostline-pwa',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle).map((f) => `./${f}`);
      const statics = [
        './',
        './index.html',
        './manifest.webmanifest',
        './icons/icon-192.png',
        './icons/icon-512.png',
        './icons/icon-maskable-512.png',
        './icons/apple-touch-icon.png',
        './icons/favicon-64.png',
      ];
      const template = readFileSync(new URL('./pwa/sw-template.js', import.meta.url), 'utf8');
      const source = template
        .replace('__VERSION__', Date.now().toString(36))
        .replace('__PRECACHE__', JSON.stringify([...new Set([...statics, ...files])], null, 2));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

// The router plugin must run before the React plugin so it can generate
// src/routeTree.gen.ts from the files in src/routes.
// BASE_PATH lets the same build run at a sub-path, e.g. GitHub Pages: /frostline/.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: env.BASE_PATH || '/',
    plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), frostlinePwa()],
  };
});
