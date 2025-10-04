// Firebase Functions wrapper for existing Express app
const functions = require('firebase-functions');

// Ensure the Express app does not bind to a port when required
process.env.SKIP_LISTEN = 'true';

// Import the existing Express app. In local dev we load from project root,
// but in deployed Functions we may copy the app into the functions directory.
let app;
try {
  app = require('../server.js');
} catch (e) {
  app = require('./server.js');
}

// Export as an HTTPS function. This will handle all /api/** routes via Hosting rewrite.
exports.api = functions.https.onRequest(app);