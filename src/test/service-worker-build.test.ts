import { afterEach, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const script = resolve('scripts/build-service-worker.mjs');
const fixtures: string[] = [];
afterEach(() => fixtures.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })));

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'rooted-worker-build-'));
  fixtures.push(directory);
  return directory;
}

function assets(directory: string, output: string) {
  const root = join(directory, output);
  mkdirSync(join(root, 'assets'), { recursive: true });
  mkdirSync(join(root, 'icons'), { recursive: true });
  writeFileSync(join(root, 'assets/app.js'), 'console.log("public asset");');
  writeFileSync(join(root, 'icons/icon-192.png'), 'fixture');
  writeFileSync(join(root, 'offline.html'), '<h1>Reconnect</h1>');
  writeFileSync(join(root, 'manifest.webmanifest'), '{}');
  writeFileSync(join(root, 'rooted-push-handlers.js'), '/* push handlers */');
  return root;
}

it('generates the unified worker in Lovable dist/client, ahead of a stale Nitro output', () => {
  const directory = fixture();
  const root = assets(directory, 'dist/client');
  assets(directory, '.output/public');
  const log = execFileSync(process.execPath, [script], { cwd: directory, encoding: 'utf8' });
  expect(log).toContain('in dist/client');
  const worker = readFileSync(join(root, 'rooted-push-worker.js'), 'utf8');
  expect(worker).toContain('rooted-push-handlers.js');
  expect(worker).toContain('assets/app.js');
  expect(worker).toContain('offline.html');
}, 20_000);

it('uses Nitro output when dist/client exists without compiled assets', () => {
  const directory = fixture();
  mkdirSync(join(directory, 'dist/client'), { recursive: true });
  const root = assets(directory, '.output/public');
  const log = execFileSync(process.execPath, [script], { cwd: directory, encoding: 'utf8' });
  expect(log).toContain('in .output/public');
  expect(readFileSync(join(root, 'rooted-push-worker.js'), 'utf8')).toContain('offline.html');
}, 20_000);

it('fails clearly when neither build contains compiled assets', () => {
  const directory = fixture();
  expect(() => execFileSync(process.execPath, [script], { cwd: directory, stdio: 'pipe' }))
    .toThrow(/Compiled client assets missing/);
});
