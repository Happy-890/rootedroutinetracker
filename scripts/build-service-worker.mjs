// Workbox's Rollup plugins need the direct estree-walker 2.x CommonJS build dependency.
import { generateSW } from 'workbox-build';
import { readFile, access } from 'node:fs/promises';
const output = '.output/public';
await access(`${output}/assets`);
const { count, warnings } = await generateSW({
  globDirectory: output,
  globPatterns: ['assets/**/*.{js,css,png,woff2}', 'icons/*.png', 'offline.html', 'manifest.webmanifest', 'rooted-push-handlers.js'],
  swDest: `${output}/rooted-push-worker.js`,
  importScripts: ['/rooted-push-handlers.js'],
  cleanupOutdatedCaches: true,
  skipWaiting: true,
  clientsClaim: true,
  inlineWorkboxRuntime: true,
  navigateFallback: null,
});
if (warnings.length) throw new Error(warnings.join('\n'));
const worker = await readFile(`${output}/rooted-push-worker.js`, 'utf8');
if (!worker.includes('rooted-push-handlers.js') || !worker.includes('offline.html')) throw new Error('Incomplete unified worker');
console.log(`Unified notification/offline worker generated with ${count} public assets.`);
