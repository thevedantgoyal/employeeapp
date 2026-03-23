import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '../..');
// Resolve .env path from this file's location (same as how Node resolves this module)
const backendEnvPath = fileURLToPath(new URL('../../.env', import.meta.url));
const cwdEnvPath = path.join(process.cwd(), '.env');

// Load .env.example first (placeholders)
dotenv.config({ path: path.join(backendRoot, '.env.example'), override: false });
function loadEnvFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const parsed = dotenv.parse(fs.readFileSync(filePath, 'utf8'));
      for (const [k, v] of Object.entries(parsed)) {
        if (v !== undefined && String(v).trim() !== '') process.env[k.trim()] = String(v).trim();
      }
    }
  } catch (_) {}
}
loadEnvFile(cwdEnvPath);
loadEnvFile(backendEnvPath);
dotenv.config({ path: cwdEnvPath, override: false });

// Read env var by key; handles keys with trailing \r (CRLF in .env)
export function getEnv(key) {
  const v = process.env[key];
  if (v != null) return v.trim();
  for (const [k, val] of Object.entries(process.env)) {
    if (k.trim() === key && val) return val.trim();
  }
  return '';
}

function readFaceKeyFromEnvFile() {
  try {
    if (!fs.existsSync(backendEnvPath)) return '';
    const parsed = dotenv.parse(fs.readFileSync(backendEnvPath, 'utf8'));
    for (const [k, v] of Object.entries(parsed)) {
      if (k.trim() === 'FACE_VERIFICATION_AI_API_KEY' && v && String(v).trim().startsWith('AIza')) {
        return String(v).trim();
      }
    }
  } catch (_) {}
  return '';
}

function getFaceVerificationApiKey() {
  let ai = getEnv('FACE_VERIFICATION_AI_API_KEY');
  const lovable = getEnv('LOVABLE_API_KEY');
  if (!ai.startsWith('AIza')) ai = readFaceKeyFromEnvFile();
  if (ai.startsWith('AIza')) return ai;
  if (lovable.startsWith('sk_')) return lovable;
  return ai || lovable || '';
}

function getCorsOrigins() {
  const fromEnv = getEnv('CORS_ORIGIN') || getEnv('CORS_ORIGINS');
  if (fromEnv) return fromEnv.split(',').map((o) => o.trim()).filter(Boolean);
  // Browser Origin values (frontend URLs), not the API host — see cors({ credentials: true }) in index.js
  return [
    'https://connectplus-employee.onrender.com',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://localhost:8080',
  ];
}

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  apiPrefix: process.env.API_PREFIX || '/api',
  corsOrigins: getCorsOrigins(),
  jwt: {
    get secret() {
      const raw = process.env.JWT_SECRET;
      const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production';
      if (isProduction) {
        if (!raw || !String(raw).trim()) {
          throw new Error('JWT_SECRET must be set in production. Set it in .env or environment.');
        }
        return raw.trim();
      }
      return raw?.trim() || 'change-me-in-production-min-32-chars';
    },
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },
  firstAdminSetupCode: process.env.FIRST_ADMIN_SETUP_CODE || 'FIRST_ADMIN_SETUP_2024',
  fileBaseUrl: process.env.FILE_BASE_URL || '',
  // Face verification — read at access time so .env is always respected (prefer AIza for Gemini)
  get faceVerificationApiKey() {
    return getFaceVerificationApiKey();
  },
  faceVerificationAiGatewayUrl: process.env.FACE_VERIFICATION_AI_GATEWAY_URL || 'https://ai.gateway.lovable.dev/v1/chat/completions',
  faceVerificationAiModel: process.env.FACE_VERIFICATION_AI_MODEL || 'google/gemini-2.5-flash',
  faceVerificationAiTimeoutMs: parseInt(process.env.FACE_VERIFICATION_AI_TIMEOUT_MS || '20000', 10),
  faceVerificationConfidenceThreshold: parseInt(process.env.FACE_VERIFICATION_CONFIDENCE_THRESHOLD || '75', 10),

  // Microsoft Azure AD (Entra ID) SSO
  // Register this app in Azure Portal:
  // portal.azure.com → Azure Active Directory → App registrations → New registration
  // Add redirect URI (e.g. https://yourapp.com/auth, http://localhost:5173/auth for SPA)
  // Copy Application (client) ID and Directory (tenant) ID to .env
  azure: {
    clientId: getEnv('AZURE_CLIENT_ID') || '',
    tenantId: getEnv('AZURE_TENANT_ID') || 'common',
  },
};
