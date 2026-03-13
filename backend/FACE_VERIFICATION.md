# Face Verification (Attendance)

Attendance check-in/check-out uses real face matching against the employee's stored profile photo. When you click **Capture and verify**, the current photo is compared with the profile photo saved during **Complete your profile**. If it matches → verification OK (attendance continues); if not → verification not OK (retry, attendance not marked).

## Setup (choose one)

### Option A: Node.js (TensorFlow.js + face-api)

1. Install optional deps (recommended on Node 18 LTS; can fail on Node 20+ or paths with spaces):
   ```bash
   npm install @tensorflow/tfjs-node @vladmandic/face-api
   ```
2. Download face-api models:
   ```bash
   node scripts/download-face-models.js
   ```
   This creates `backend/models/`. If deps or models are missing, the backend tries the **Python fallback** (Option B).

### Option B: Python fallback (no Node native addons)

If `@tensorflow/tfjs-node` does not install on your system (e.g. Node 25, path with spaces), the backend automatically uses a Python script for face matching.

**Recommended (macOS / Homebrew Python):** Use a virtual environment so you don’t hit “externally-managed-environment”.

1. Install CMake (required to build the `dlib` dependency):
   ```bash
   brew install cmake
   ```
2. Create the venv and install face_recognition:
   ```bash
   cd backend
   chmod +x scripts/setup-face-venv.sh
   ./scripts/setup-face-venv.sh
   ```

This creates `backend/venv`, installs `face_recognition` inside it, and the backend will use `venv/bin/python` automatically.

**Alternative (if you already have a venv or global install):** Set the Python executable in `.env`:
```
FACE_VERIFICATION_PYTHON=/path/to/venv/bin/python
```
or
```
FACE_VERIFICATION_PYTHON=python3
```

The script used is `backend/scripts/compare_faces.py`. It expects two image paths and outputs JSON `{"match": true|false, "error": null|"message"}`. No need to run it manually; the Node service calls it when the TensorFlow path is unavailable.

## Configuration (.env)

| Variable | Default | Description |
|----------|---------|-------------|
| `FACE_VERIFICATION_THRESHOLD` | 0.6 | Max descriptor distance for a match (lower = stricter). Used by both Node and Python. |
| `FACE_VERIFICATION_MAX_RETRIES` | 3 | Max failed attempts per user per window |
| `FACE_VERIFICATION_WINDOW_MS` | 900000 | Window in ms (15 min) after which attempt count resets |
| `FACE_VERIFICATION_STRICT` | false | If true, when neither Node ML nor Python fallback is available, the API returns `faceVerified: false`. If false, check-in is allowed (verification skipped). |
| `FACE_VERIFICATION_PYTHON` | python3 | Command to run the Python compare script (e.g. `python3` or `py -3`). |

## Flow

1. User opens attendance and clicks Check-In (or Check-Out).
2. Frontend opens camera, captures face image, sends base64 + timestamp to `POST /api/attendance/verify-face`.
3. Backend: validates timestamp (replay protection), enforces retry limit, loads profile avatar from storage (no public URL exposure), runs face comparison.
4. If similarity ≥ threshold → `faceVerified: true` → flow continues to location verification and then attendance is saved.
5. If not → `faceVerified: false`, message e.g. "Face Not Verified. Please retry."; frontend shows Retry, attendance is not marked.

## Security

- Timestamp must be within 2 minutes (replay protection).
- User can only verify against their own profile (avatar for `req.userId`).
- Profile image is read from secure storage (not exposed publicly for comparison).
- Retry limit and failure logging are enforced.
