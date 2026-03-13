/**
 * Face verification service: AI Vision–based comparison (Gemini 2.5 Flash or similar).
 * Replaces local ML (TensorFlow/Python). No child_process, no local encoding.
 * Uses AI Gateway HTTP API; strict JSON parsing and decision logic.
 * Reads API key and gateway URL from config (loaded at startup from .env) so they are always in sync.
 */

import { config, getEnv } from '../config/index.js';

const AI_TIMEOUT_MS = () => config.faceVerificationAiTimeoutMs ?? 20000;
const CONFIDENCE_THRESHOLD = () => config.faceVerificationConfidenceThreshold ?? 75;

const REJECT_FLAGS = new Set(['multiple_faces', 'possible_spoof', 'no_face_capture', 'no_face_profile']);

const SYSTEM_PROMPT = `You are a strict face verification system. You will be given two images:
1. A stored profile photo of an employee
2. A live camera capture

Your task:
- Determine if the SAME person appears in both images.
- Focus on facial features: face shape, eyes, nose, mouth, skin tone, hair.
- Ignore differences in lighting, angle, background, clothing, accessories.
- If either image has NO face visible, respond with match=false and include "no_face_capture" or "no_face_profile" in flags.
- If MULTIPLE faces appear in the captured image, respond with match=false and include "multiple_faces" in flags.
- If you suspect a photo-of-a-photo or screen display, include "possible_spoof" in flags.

Respond with ONLY a single JSON object on one line. No markdown, no code fences, no explanation before or after.
Example: {"match": true, "confidence": 85, "reason": "Same person", "flags": []}

Threshold: confidence >= 75 means match=true. Below 75 means match=false.`;

/**
 * Strip markdown code fences and trim.
 * @param {string} content
 * @returns {string}
 */
function stripMarkdownFences(content) {
  if (typeof content !== 'string') return '';
  return content
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
}

/**
 * Extract the first complete JSON object {...} from a string (handles extra text before/after).
 * @param {string} str
 * @returns {string | null}
 */
function extractJsonObject(str) {
  if (typeof str !== 'string') return null;
  const start = str.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < str.length; i++) {
    const ch = str[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return str.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Normalize parsed object: accept match/same_person (boolean or string "true"/"false"), confidence (number or string).
 * @param {Record<string, unknown>} parsed
 * @returns {{ match: boolean, confidence: number | null, reason: string, flags: string[] }}
 */
function normalizeParsed(parsed) {
  let match = parsed.match === true || parsed.same_person === true;
  if (!match && (parsed.match === 'true' || parsed.same_person === 'true')) match = true;
  let confidence = parsed.confidence;
  if (typeof confidence !== 'number') {
    if (typeof confidence === 'string') {
      const n = Number(confidence);
      confidence = Number.isFinite(n) ? n : null;
    } else {
      confidence = null;
    }
  }
  const reason = typeof parsed.reason === 'string' ? parsed.reason : '';
  const flags = Array.isArray(parsed.flags) ? parsed.flags.map(String) : [];
  return { match, confidence, reason, flags };
}

/**
 * When Gemini returns truncated JSON (e.g. {"match": true, "confidence": 90, with no closing }),
 * extract match and confidence from the raw string so we can still accept the result.
 * @param {string} str
 * @returns {{ match: boolean, confidence: number | null, reason: string, flags: string[] } | null}
 */
function parsePartialFaceJson(str) {
  if (typeof str !== 'string' || str.length < 10) return null;
  const matchMatch = str.match(/"match"\s*:\s*(true|false)/i);
  const confMatch = str.match(/"confidence"\s*:\s*(\d+)/);
  if (!matchMatch || !confMatch) return null;
  const match = matchMatch[1].toLowerCase() === 'true';
  const confidence = parseInt(confMatch[1], 10);
  if (!Number.isFinite(confidence)) return null;
  return { match, confidence, reason: '', flags: [] };
}

/**
 * Parse AI response content into { match, confidence, reason, flags }.
 * Tolerates extra text, markdown fences, alternative keys, and truncated JSON (fallback to partial parse).
 * @param {string} content - Raw message content from AI
 * @returns {{ match?: boolean, confidence?: number, reason?: string, flags?: string[] } | null}
 */
function parseAiResponse(content) {
  if (content == null || typeof content !== 'string') return null;
  const cleaned = stripMarkdownFences(content);
  if (!cleaned) return null;

  // Remove trailing commas before } or ] (invalid JSON but some models emit it)
  const normalized = cleaned.replace(/,(\s*[}\]])/g, '$1');

  let parsed = null;
  try {
    parsed = JSON.parse(normalized);
  } catch (_) {
    const extracted = extractJsonObject(normalized);
    if (extracted) {
      try {
        parsed = JSON.parse(extracted);
      } catch (_2) {}
    }
  }
  if (!parsed || typeof parsed !== 'object') {
    // Truncated response (e.g. {"match": true, "confidence": 90, with no closing }) - extract what we have
    const partial = parsePartialFaceJson(normalized);
    if (partial) return partial;
    console.warn('[faceVerification] Unparseable AI response (first 500 chars):', String(content).slice(0, 500));
    return null;
  }
  return normalizeParsed(parsed);
}

/**
 * Apply strict decision logic: reject on security flags, approve only if match and confidence >= threshold.
 * @param {{ match?: boolean, confidence?: number, reason?: string, flags?: string[] }} parsed
 * @returns {{ verified: boolean, message: string, confidence?: number }}
 */
function applyDecisionLogic(parsed) {
  const flags = parsed.flags || [];
  for (const flag of flags) {
    if (REJECT_FLAGS.has(String(flag))) {
      const messages = {
        multiple_faces: 'Multiple faces detected. Only one person should be visible.',
        possible_spoof: 'Suspected photo or screen. Please use a live camera capture.',
        no_face_capture: 'No face detected in capture. Ensure your face is clearly visible.',
        no_face_profile: 'Profile photo could not be used for comparison. Please upload a clear profile photo.',
      };
      return {
        verified: false,
        message: messages[flag] || `Verification failed: ${flag}.`,
        confidence: parsed.confidence ?? null,
      };
    }
  }

  const match = parsed.match === true;
  const confidence = parsed.confidence ?? 0;
  const verified = match && confidence >= CONFIDENCE_THRESHOLD();

  if (verified) {
    return {
      verified: true,
      message: 'Face Verified',
      confidence,
    };
  }

  const reason = parsed.reason || (match ? 'Confidence below threshold.' : 'Face does not match profile.');
  return {
    verified: false,
    message: reason.length > 200 ? 'Face Not Verified. Please retry.' : reason,
    confidence,
  };
}

/** Detect image mime type from buffer (JPEG vs PNG). */
function getMimeFromBuffer(buffer) {
  if (!buffer || buffer.length < 8) return 'image/jpeg';
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png';
  return 'image/jpeg';
}

/** Extract raw base64 and optional mime from data URL; or return as-is base64 with default mime. */
function dataUrlToBase64AndMime(dataUrl) {
  if (typeof dataUrl !== 'string') return { base64: '', mime: 'image/jpeg' };
  if (dataUrl.startsWith('data:')) {
    const semi = dataUrl.indexOf(';');
    const comma = dataUrl.indexOf(',');
    const mime = semi >= 0 && comma > semi ? dataUrl.slice(5, semi).trim() || 'image/jpeg' : 'image/jpeg';
    const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : '';
    return { base64, mime: mime.startsWith('image/') ? mime : 'image/jpeg' };
  }
  return { base64: dataUrl, mime: 'image/jpeg' };
}

/**
 * Call Google Gemini API directly (for API keys starting with AIza).
 * @param {string} profileImageDataUrl - data:image/jpeg;base64,... or base64
 * @param {string} capturedImageDataUrl - data:image/jpeg;base64,...
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<{ verified: boolean, message: string, confidence?: number }>}
 */
async function callGemini(profileImageDataUrl, capturedImageDataUrl, options = {}) {
  const apiKey = getApiKey();
  const model = (getEnv('FACE_VERIFICATION_GEMINI_MODEL') || 'gemini-2.5-flash').trim();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const profile = dataUrlToBase64AndMime(profileImageDataUrl);
  const captured = dataUrlToBase64AndMime(capturedImageDataUrl);

  const parts = [
    { text: `${SYSTEM_PROMPT}\n\nCompare these two images. Image 1: stored profile photo. Image 2: live camera capture. Respond with JSON only.` },
    { inlineData: { mimeType: profile.mime, data: profile.base64 } },
    { inlineData: { mimeType: captured.mime, data: captured.base64 } },
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS());
  const signal = options.signal || controller.signal;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { maxOutputTokens: 300, temperature: 0.1 },
      }),
      signal,
    });
    clearTimeout(timeoutId);

    if (res.status === 503) {
      throw new Error('Face verification service temporarily unavailable. Please try again.');
    }
    if (!res.ok) {
      const text = await res.text();
      let detail = text.slice(0, 200);
      try {
        const errJson = JSON.parse(text);
        const msg = errJson?.error?.message ?? errJson?.message;
        if (msg) detail = String(msg);
      } catch (_) {}
      if (res.status === 404) {
        throw new Error(`Face verification model not available (404). Try FACE_VERIFICATION_GEMINI_MODEL=gemini-2.5-flash in .env. ${detail}`);
      }
      throw new Error(`AI gateway error ${res.status}: ${detail}`);
    }

    const data = await res.json();
    // Gemini can return multiple parts (e.g. intro text + JSON); concatenate all part text so we never miss the JSON
    const responseParts = data?.candidates?.[0]?.content?.parts ?? [];
    const content = responseParts
      .map((p) => (p && typeof p.text === 'string' ? p.text : ''))
      .filter(Boolean)
      .join('')
      .trim() || '';
    if (!content) {
      throw new Error('Invalid AI response: no content');
    }

    const parsed = parseAiResponse(content);
    if (!parsed) {
      console.warn('[faceVerification] Raw Gemini response (first 600 chars):', content.slice(0, 600));
      throw new Error('Verification processing error. Could not parse AI response.');
    }
    return applyDecisionLogic(parsed);
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Face verification timed out. Please try again.');
    }
    throw err;
  }
}

/**
 * Call AI Gateway with two images (profile + captured) and return parsed decision.
 * Uses Google Gemini directly when API key starts with "AIza"; otherwise Lovable/OpenAI-style gateway.
 * @param {string} profileImageDataUrl - data:image/jpeg;base64,... or base64 string
 * @param {string} capturedImageDataUrl - data:image/jpeg;base64,...
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<{ verified: boolean, message: string, confidence?: number }>}
 */
function isPlaceholderKey(key) {
  if (!key || typeof key !== 'string') return true;
  const k = key.trim().toLowerCase();
  return k.startsWith('your') || k.includes('placeholder') || k === '' || k.length < 20;
}

function getApiKey() {
  const fromConfig = (config.faceVerificationApiKey || '').trim();
  if (fromConfig && !isPlaceholderKey(fromConfig)) return fromConfig;
  const ai = getEnv('FACE_VERIFICATION_AI_API_KEY');
  const lovable = getEnv('LOVABLE_API_KEY');
  if (ai.startsWith('AIza')) return ai;
  if (lovable.startsWith('sk_')) return lovable;
  return ai || lovable || '';
}

async function callAiGateway(profileImageDataUrl, capturedImageDataUrl, options = {}) {
  const apiKey = getApiKey();
  if (!apiKey || isPlaceholderKey(apiKey)) {
    throw new Error('Face verification API key not set. In backend/.env set FACE_VERIFICATION_AI_API_KEY=AIza... (Google) or LOVABLE_API_KEY=sk_... (Lovable).');
  }
  if (apiKey.startsWith('AIza')) {
    return callGemini(profileImageDataUrl, capturedImageDataUrl, options);
  }
  if (!apiKey.startsWith('sk_')) {
    throw new Error('Face verification key must be a Google key (starts with AIza) or Lovable key (starts with sk_). Check backend/.env.');
  }

  const userContent = [
    { type: 'text', text: 'Compare these two images. Image 1: stored profile photo. Image 2: live camera capture. Respond with JSON only.' },
    { type: 'image_url', image_url: { url: profileImageDataUrl.startsWith('data:') ? profileImageDataUrl : `data:image/jpeg;base64,${profileImageDataUrl}` } },
    { type: 'image_url', image_url: { url: capturedImageDataUrl.startsWith('data:') ? capturedImageDataUrl : `data:image/jpeg;base64,${capturedImageDataUrl}` } },
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS());
  const signal = options.signal || controller.signal;

  try {
    const res = await fetch(config.faceVerificationAiGatewayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.faceVerificationAiModel,
        max_tokens: 300,
        temperature: 0.1,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
      }),
      signal,
    });

    clearTimeout(timeoutId);

    if (res.status === 503) {
      throw new Error('Face verification service temporarily unavailable. Please try again.');
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AI gateway error ${res.status}: ${text.slice(0, 100)}`);
    }

    const data = await res.json();
    let content = data?.choices?.[0]?.message?.content;
    if (content == null) {
      throw new Error('Invalid AI response: no content');
    }
    // OpenAI-style API can return content as string or array of { text } parts
    if (Array.isArray(content)) {
      content = content.map((c) => (c && typeof c.text === 'string' ? c.text : '')).filter(Boolean).join('').trim();
    } else if (typeof content !== 'string') {
      content = String(content);
    }
    if (!content) {
      throw new Error('Invalid AI response: no content');
    }

    const parsed = parseAiResponse(content);
    if (!parsed) {
      console.warn('[faceVerification] Raw gateway response (first 600 chars):', content.slice(0, 600));
      throw new Error('Verification processing error. Could not parse AI response.');
    }

    return applyDecisionLogic(parsed);
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Face verification timed out. Please try again.');
    }
    throw err;
  }
}

/**
 * Buffer to data URL with correct mime (image/jpeg or image/png).
 * @param {Buffer} buffer
 * @returns {string}
 */
function bufferToDataUrl(buffer) {
  const base64 = buffer.toString('base64');
  const mime = getMimeFromBuffer(buffer);
  return `data:${mime};base64,${base64}`;
}

/**
 * Verify that the captured image matches the reference (profile) image using AI Vision.
 * Same contract as before for backward compatibility.
 *
 * @param {Buffer} capturedBuffer - JPEG/PNG buffer from request
 * @param {Buffer} referenceBuffer - JPEG/PNG buffer from profile avatar
 * @param {number} [_threshold] - Ignored (confidence threshold from env)
 * @returns {Promise<{ verified: boolean, message: string, confidence?: number }>}
 */
export async function verify(capturedBuffer, referenceBuffer, _threshold) {
  if (!capturedBuffer || capturedBuffer.length === 0) {
    return { verified: false, message: 'Face Not Verified. Please retry.' };
  }
  if (!referenceBuffer || referenceBuffer.length === 0) {
    return { verified: false, message: 'Profile photo not found. Please upload a profile photo first.' };
  }

  const profileDataUrl = bufferToDataUrl(referenceBuffer);
  const capturedDataUrl = bufferToDataUrl(capturedBuffer);

  return callAiGateway(profileDataUrl, capturedDataUrl);
}

/**
 * Whether the service is configured (API key present).
 */
export function isConfigured() {
  return !!config.faceVerificationApiKey;
}

/**
 * No-op for backward compatibility (previously returned load error from ML).
 */
export function getLoadError() {
  return null;
}
