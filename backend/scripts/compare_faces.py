#!/usr/bin/env python3
"""
Compare two face images. Used by Node faceVerificationService when tfjs-node is not available.
Usage: python3 compare_faces.py <reference_image_path> <captured_image_path>
Output: single line JSON {"match": true|false, "error": null|"message"}
Requires: pip install face_recognition
"""
import json
import sys

def main():
    if len(sys.argv) != 3:
        print(json.dumps({"match": False, "error": "Usage: compare_faces.py <ref_path> <cap_path>"}))
        sys.exit(1)
    ref_path = sys.argv[1]
    cap_path = sys.argv[2]
    try:
        import face_recognition
    except ImportError:
        print(json.dumps({"match": False, "error": "face_recognition not installed"}))
        sys.exit(0)

    try:
        ref_image = face_recognition.load_image_file(ref_path)
        cap_image = face_recognition.load_image_file(cap_path)
    except Exception as e:
        print(json.dumps({"match": False, "error": f"Failed to load images: {e}"}))
        sys.exit(0)

    ref_encodings = face_recognition.face_encodings(ref_image)
    cap_encodings = face_recognition.face_encodings(cap_image)

    if len(ref_encodings) != 1:
        print(json.dumps({"match": False, "error": "Reference image must have exactly one face"}))
        sys.exit(0)
    if len(cap_encodings) != 1:
        print(json.dumps({"match": False, "error": "Captured image must have exactly one face"}))
        sys.exit(0)

    tolerance = 0.6
    try:
        tol_env = __import__("os").environ.get("FACE_VERIFICATION_THRESHOLD")
        if tol_env is not None:
            tolerance = float(tol_env)
    except (TypeError, ValueError):
        pass

    results = face_recognition.compare_faces([ref_encodings[0]], cap_encodings[0], tolerance=tolerance)
    match = bool(results and results[0])
    print(json.dumps({"match": match, "error": None}))

if __name__ == "__main__":
    main()
