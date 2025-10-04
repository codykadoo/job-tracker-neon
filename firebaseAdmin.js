const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin SDK using environment variables
// Supports multiline private keys by replacing escaped newlines (\n) with actual newlines
function initFirebase() {
  if (admin.apps.length === 0) {
    // Prefer JSON service account file if available, otherwise fallback to env vars
    const explicitPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    const candidates = [
      explicitPath,
      path.join(process.cwd(), 'serviceAccountKey.json'),
      path.join(process.cwd(), 'jobmapper-1b4f2-firebase-adminsdk-fbsvc-4842fb74a8.json'),
    ].filter(Boolean);

    let serviceAccount = null;
    for (const p of candidates) {
      try {
        if (p && fs.existsSync(p)) {
          serviceAccount = require(p);
          break;
        }
      } catch (_) {}
    }

    if (serviceAccount && serviceAccount.client_email && serviceAccount.private_key) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      if (serviceAccount) {
        console.warn('Service account file is missing client_email/private_key; falling back to env vars.');
      }
      const privateKey = process.env.FIREBASE_PRIVATE_KEY
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        : undefined;

      if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && privateKey) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey,
          }),
        });
      } else {
        // Final fallback: rely on Application Default Credentials (Functions, Cloud Run, or local ADC)
        // This enables seamless initialization in Firebase-hosted environments without bundling secrets.
        admin.initializeApp();
      }
    }
  }
  return admin;
}

function getFirestore() {
  return admin.firestore();
}

module.exports = {
  admin,
  initFirebase,
  getFirestore,
};