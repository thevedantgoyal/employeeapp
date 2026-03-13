#!/usr/bin/env node
/**
 * Run from backend/: node scripts/check-env-path.js
 * Prints the .env path used by config and whether the key loads.
 */
import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Use backend/.env (same as app config: script is in backend/scripts/, so ../.env = backend/.env)
const backendEnvPath = path.join(__dirname, '..', '.env');

console.log('.env path (backend/.env):', backendEnvPath);
console.log('exists:', fs.existsSync(backendEnvPath));

if (fs.existsSync(backendEnvPath)) {
  const content = fs.readFileSync(backendEnvPath, 'utf8');
  const line = content.split('\n').find((row) => row.trim().startsWith('FACE_VERIFICATION_AI_API_KEY='));
  const value = line ? (line.split('=')[1] || '').trim() : '';
  console.log('key length:', value.length);
  console.log('starts with AIza:', value.startsWith('AIza'));
}

// Also load config and show what it sees
const { config } = await import('../src/config/index.js');
const k = config.faceVerificationApiKey;
console.log('config.faceVerificationApiKey length:', k.length);
console.log('config.faceVerificationApiKey starts with AIza:', k.startsWith('AIza'));
