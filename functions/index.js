// Firebase Functions wrapper for existing Express app
const functions = require('firebase-functions');

// Ensure the Express app does not bind to a port when required
process.env.SKIP_LISTEN = 'true';

// Import the existing Express app from the project root
const app = require('../server.js');

// Export as an HTTPS function. This will handle all /api/** routes via Hosting rewrite.
exports.api = functions.https.onRequest(app);