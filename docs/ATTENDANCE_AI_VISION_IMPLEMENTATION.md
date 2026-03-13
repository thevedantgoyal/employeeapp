# Attendance Face Verification — AI Vision Implementation

This document describes the replacement of **local ML face verification** with **AI Vision–based verification** (Gemini 2.5 Flash via HTTP gateway) in the existing Node.js + Express backend. Frontend, attendance DB schema, and check-in/check-out flow are unchanged.

---

## 1. Files Removed / No Longer Used (Local ML)

| Item | Action |
|------|--------|
| **Python script** `backend/scripts/compare_faces.py` | **No longer invoked** (can be deleted or kept for reference). |
| **child_process spawn** logic | **Removed** from `faceVerificationService.js`. |
| **TensorFlow.js / face-api** usage | **Removed** (no `loadNets`, `getDescriptorFromBuffer`, `verifyWithPython`). |
| **optionalDependencies** in `backend/package.json` | **Removed**: `@tensorflow/tfjs-node`, `@vladmandic/face-api`, `canvas`. |
| **backend/models/** (face-api model files) | **No longer used** (can be deleted if present). |

Nothing else was removed. Check-in and check-out routes, JWT verification token, and response contract remain.

---

## 2. Folder / Module Structure (Unchanged)

```
backend/
├── src/
│   ├── routes/
│   │   ├── attendanceRoutes.js    ← verify-face uses new AI service
│   │   └── index.js
│   ├── services/
│   │   ├── faceVerificationService.js   ← REPLACED (AI Gateway only)
│   │   └── storageService.js
│   ├── middleware/
│   │   └── auth.js
│   └── config/
│       ├── database.js
│       └── index.js
├── scripts/
│   └── compare_faces.py          ← not used (optional delete)
└── package.json                  ← optionalDependencies removed
```

Frontend and attendance table schema are unchanged.

---

## 3. Node Route Implementation (verify-face)

The existing **POST /api/attendance/verify-face** route is unchanged in shape; only the underlying verification call and timestamp tolerance were updated.

**Flow:**

1. **JWT validation** — `router.use(authenticate)` → `req.userId` from token (never from body).
2. **Body** — `capturedImage`, `timestamp`.
3. **±30s anti-replay** — `Math.abs(now - timestamp) > 30_000` → 400.
4. **Attempt limit** — per-user failed attempts (unchanged).
5. **Profile** — `req.profile` (from auth middleware); reject if no `avatar_url`.
6. **Avatar resolution** — `getAvatarObjectPath(profile.avatar_url)` → `storageService.getFile('avatars', objectPath)` → buffer.
7. **Base64 strip** — data URL prefix stripped from `capturedImage` before decode.
8. **Verify** — `faceVerificationService.verify(capturedBuffer, referenceFile.file_data)` (no threshold arg).
9. **On failure** — 403, `result.message`, optional `confidence`.
10. **On success** — 200, `faceVerified: true`, `message`, `verificationToken` (2 min JWT), optional `confidence`.

**Security (preserved):**

- `userId` only from JWT.
- Timestamp ±30s.
- No storage of captured image.
- AI API key only in env (server-side).
- Profile lookup by JWT `userId` (IDOR-safe).

---

## 4. AI API Call (faceVerificationService.js)

**Endpoint:** `process.env.FACE_VERIFICATION_AI_GATEWAY_URL` or `https://ai.gateway.lovable.dev/v1/chat/completions`

**Auth:** `Authorization: Bearer <LOVABLE_API_KEY | FACE_VERIFICATION_AI_API_KEY>`

**Request:**

- **Method:** POST  
- **Headers:** `Content-Type: application/json`, `Authorization: Bearer <key>`  
- **Body:**
  - `model`: `google/gemini-2.5-flash` (or env)
  - `max_tokens`: 300  
  - `temperature`: 0.1  
  - `messages`: system prompt + user message with two images (profile + captured) as data URLs  

**Images:**

- Profile: `referenceFile.file_data` → `data:image/jpeg;base64,<base64>`  
- Captured: `capturedBuffer` → `data:image/jpeg;base64,<base64>`  

**Timeout:** 5s (configurable via `FACE_VERIFICATION_AI_TIMEOUT_MS`).

**Response handling:**

- 503 → throw clear “service temporarily unavailable” (no retry in current implementation).
- Non-OK → throw with status and truncated body.
- Parse `choices[0].message.content` → strip markdown fences → `JSON.parse` → `{ match, confidence, reason, flags }`.

---

## 5. Strict Decision Logic

**Reject immediately if any flag in:**

- `multiple_faces`
- `possible_spoof`
- `no_face_capture`
- `no_face_profile`

**Approve only if:**

- `match === true` **and**
- `(parsed.confidence ?? 0) >= CONFIDENCE_THRESHOLD` (default 75, env `FACE_VERIFICATION_CONFIDENCE_THRESHOLD`)

Otherwise reject with `verified: false` and appropriate message (e.g. from `reason` or flag-based message).

**Code:** `applyDecisionLogic(parsed)` in `faceVerificationService.js` implements the above.

---

## 6. Error Handling

| Scenario | HTTP | Response body |
|----------|------|----------------|
| Missing/invalid API key | 503 | `Face verification failed. Please try again.` (or message from catch) |
| AI timeout (5s) | 503 | `Face verification timed out. Please try again.` |
| AI 503 | 503 | `Face verification service temporarily unavailable. Please try again.` |
| AI non-OK | 503 | Message from server (truncated) |
| Parse failure (no valid JSON) | 503 | `Verification processing error. Could not parse AI response.` |
| Reject by flags/threshold | 403 | `faceVerified: false`, `message` (and optional `confidence`) |
| Success | 200 | `faceVerified: true`, `message`, `verificationToken`, optional `confidence` |

Route-level catch: 503 with safe message (no stack, message length capped). No captured image is stored.

---

## 7. Security Summary

- **userId** — from JWT only (`req.userId`).  
- **±30s timestamp** — anti-replay.  
- **Captured image** — not persisted.  
- **AI API key** — env only, never sent to frontend.  
- **Profile** — loaded by JWT `userId`; reject if no profile/avatar.  
- **UNIQUE(user_id, date)** — unchanged; check-in/check-out logic unchanged.

---

## 8. Backward Compatibility & Attendance Flow

- **Frontend** — unchanged; still POSTs `capturedImage` + `timestamp`, expects `faceVerified`, `message`, and on success `verificationToken`. Optional `confidence` is additive.
- **Check-in** — still requires valid 2-min JWT from verify-face; same transaction and duplicate handling.
- **Check-out** — still UPDATE by `user_id` and `CURRENT_DATE` and `check_out_time IS NULL`.
- **DB** — no schema change; `attendance` table and constraints unchanged.

Only the **face verification engine** was replaced (local ML → AI Vision over HTTP). Attendance behavior and security model remain the same.
