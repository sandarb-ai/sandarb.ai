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
    console.error('Sandarb requires Node.js 18+. Current:', process.version);
    process.exit(1);
  }
}

function ensureEnv() {
  const envPath = path.join(ROOT, '.env');
  const examplePath = path.join(ROOT, '.env.example');
  if (!fs.existsSync(envPath) && fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, envPath);
    console.log('Created .env from .env.example');
  }
}

function ensureDeps() {
  const nodeModules = path.join(ROOT, 'node_modules');
  if (!fs.existsSync(nodeModules)) {
    console.log('Installing dependencies...');
    const r = require('child_process').spawnSync('npm', ['install'], {
      cwd: ROOT,
      stdio: 'inherit',
      shell: true,
    });
    if (r.status !== 0) process.exit(r.status || 1);
  }
}

function runAgentDryRun() {
  const dryRun = spawn('node', ['scripts/sandarb-develop.js', '--dry-run'], {
    cwd: ROOT,
    stdio: 'ignore',
    detached: true,
  });
  dryRun.unref();
  console.log('  Agent dry run started in background → logs/punjikasthala.log');
}

function main() {
  checkNode();
  ensureEnv();
  ensureDeps();

  console.log('');
  console.log('  Sandarb - Governance for AI agents');
  console.log('  ---------------------------------');
  console.log('  UI:  http://localhost:4000');
  console.log('  API: http://localhost:4001');
  console.log('  ---------------------------------');
  runAgentDryRun();
  console.log('  Press Ctrl+C to stop.');
  console.log('');

  const child = spawn('npm', ['run', 'dev'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
  });

  child.on('error', (err) => {
    console.error('Failed to start:', err.message);
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
