#!/bin/bash
# Create a virtual environment and install face_recognition for the face verification fallback.
# Run from backend directory: ./scripts/setup-face-venv.sh
#
# Prerequisites (macOS): brew install cmake   (required for dlib)

set -e
cd "$(dirname "$0")/.."
VENV_DIR="venv"

if ! command -v cmake &>/dev/null; then
  echo "CMake is required to build dlib (used by face_recognition)."
  echo "Install it with: brew install cmake"
  echo "Then run this script again."
  exit 1
fi

echo "Creating virtual environment in $VENV_DIR..."
python3 -m venv "$VENV_DIR"
source "$VENV_DIR/bin/activate"

echo "Installing face_recognition (this may take a few minutes; dlib compiles from source)..."
pip install --upgrade pip
pip install face_recognition

echo "Done. The backend will use $VENV_DIR/bin/python for face verification when the Node ML stack is not available."
