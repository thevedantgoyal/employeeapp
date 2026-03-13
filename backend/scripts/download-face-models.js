/**
 * Download face-api.js models into backend/models for face verification.
 * Run once: node scripts/download-face-models.js
 * Base URL: https://raw.githubusercontent.com/vladmandic/face-api/master/model
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODEL_DIR = path.resolve(__dirname, '../models');
const BASE = 'https://raw.githubusercontent.com/vladmandic/face-api/master/model';

const FILES = [
  'ssd_mobilenetv1_model-weights_manifest.json',
  'ssd_mobilenetv1_model.bin',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model.bin',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model.bin',
];

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  if (!fs.existsSync(MODEL_DIR)) {
    fs.mkdirSync(MODEL_DIR, { recursive: true });
  }
  for (const file of FILES) {
    const url = `${BASE}/${file}`;
    const dest = path.join(MODEL_DIR, file);
    process.stdout.write(`Downloading ${file}... `);
    try {
      const buf = await download(url);
      fs.writeFileSync(dest, buf);
      console.log('OK');
    } catch (e) {
      console.log('FAIL:', e.message);
    }
  }
  console.log('Done. Models are in backend/models');
}

main();
