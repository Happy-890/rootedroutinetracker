// Workbox's Rollup plugins need the direct estree-walker 2.x CommonJS build dependency.
import { generateSW } from 'workbox-build';
import { readFile, access } from 'node:fs/promises';
// Lovable emits dist/client; the local Nitro preset emits .output/public.
// Check the compiled assets, not just a possibly empty parent directory.
const candidates = ['dist/client', '.output/public'];
let output;
for (const candidate of candidates) {
  try {
    await access(`${candidate}/assets`);
    output = candidate;
    break;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
if (!output) throw new Error(`Compiled client assets missing: checked ${candidates.join(', ')}. Run Vite before generating the worker.`);
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
console.log(`Unified notification/offline worker generated in ${output} with ${count} public assets.`);
