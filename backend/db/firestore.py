import os
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore

# Prefer GOOGLE_APPLICATION_CREDENTIALS; otherwise fall back to the key file
# in backend/, regardless of the working directory.
key_path = os.environ.get(
    "GOOGLE_APPLICATION_CREDENTIALS",
    Path(__file__).resolve().parent.parent / "steelhacks26-firebase-adminsdk-fbsvc-1cb98f9730.json",
)

if not firebase_admin._apps:
    firebase_admin.initialize_app(credentials.Certificate(str(key_path)))

db = firestore.client()
