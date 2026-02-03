#!/usr/bin/env node
/**
 * Driver script to bring up Sandarb (UI on 4000, API on 4001).
 * Usage: node scripts/start-sandarb.js   OR   npm run sandarb
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');

function checkNode() {
  const v = process.version.slice(1).split('.').map(Number);
  if (v[0] < 18) {
    process.exit(1);
  }
}

function ensureEnv() {
  const envPath = path.join(ROOT, '.env');
  const examplePath = path.join(ROOT, '.env.example');
  if (!fs.existsSync(envPath) && fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, envPath);
  }
}

function ensureDeps() {
  const nodeModules = path.join(ROOT, 'node_modules');
  if (!fs.existsSync(nodeModules)) {
    const r = require('child_process').spawnSync('npm', ['install'], {
      cwd: ROOT,
      stdio: 'inherit',
      shell: true,
    });
    if (r.status !== 0) process.exit(r.status || 1);
  }
}

function main() {
  checkNode();
  ensureEnv();
  ensureDeps();

  const child = spawn('npm', ['run', 'dev'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
  });

  child.on('error', () => {
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    if (signal) process.exit(128 + (signal === 'SIGINT' ? 2 : signal === 'SIGTERM' ? 15 : 0));
    process.exit(code ?? 0);
  });

  process.on('SIGINT', () => child.kill('SIGINT'));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
}

main();
