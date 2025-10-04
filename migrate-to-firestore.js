// Migrate data from Postgres (Neon) to Firebase Firestore
// Usage: node migrate-to-firestore.js

require('dotenv').config();
const { Pool } = require('pg');
const { initFirebase, getFirestore } = require('./firebaseAdmin');

async function run() {
  // Initialize Firebase Admin
  try {
    initFirebase();
  } catch (e) {
    console.error('Firebase initialization failed. Ensure FIREBASE_* env vars are set in .env');
    console.error(e);
    process.exit(1);
  }
  const db = getFirestore();

  // Connect to Postgres
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  async function migrateTable(tableName, collectionName, rowTransform = (r) => r) {
    console.log(`\nMigrating ${tableName} -> ${collectionName}`);
    const res = await pool.query(`SELECT * FROM ${tableName}`);
    console.log(`Found ${res.rows.length} rows`);
    for (const row of res.rows) {
      const id = String(row.id);
      const doc = rowTransform({ ...row });
      await db.collection(collectionName).doc(id).set(doc, { merge: true });
    }
    console.log(`Completed ${tableName}`);
  }

  // Helpers to parse JSONB fields when returned as strings
  function ensureObject(val, fallback = {}) {
    if (val === null || val === undefined) return fallback;
    if (typeof val === 'object') return val;
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch { return fallback; }
    }
    return fallback;
  }

  function ensureArray(val, fallback = []) {
    const obj = ensureObject(val, fallback);
    return Array.isArray(obj) ? obj : fallback;
  }

  try {
    // workers
    await migrateTable('workers', 'workers', (r) => {
      r.roles = ensureArray(r.roles, ['Apprentice']);
      return r;
    });

    // jobs
    await migrateTable('jobs', 'jobs', (r) => {
      r.photos = ensureArray(r.photos, []);
      // Normalize location to a nested object as well for convenience
      r.location = {
        lat: r.location_lat != null ? Number(r.location_lat) : null,
        lng: r.location_lng != null ? Number(r.location_lng) : null,
        address: r.location_address || null,
      };
      return r;
    });

    // job_annotations
    await migrateTable('job_annotations', 'job_annotations', (r) => {
      r.coordinates = ensureObject(r.coordinates, {});
      r.style_options = ensureObject(r.style_options, {});
      return r;
    });

    // equipment
    await migrateTable('equipment', 'equipment', (r) => {
      r.photos = ensureArray(r.photos, []);
      r.documents = ensureArray(r.documents, []);
      r.job_location = {
        lat: r.job_location_lat != null ? Number(r.job_location_lat) : null,
        lng: r.job_location_lng != null ? Number(r.job_location_lng) : null,
        address: r.job_location_address || null,
      };
      return r;
    });

    // equipment_maintenance_requests
    await migrateTable('equipment_maintenance_requests', 'equipment_maintenance_requests', (r) => {
      // Simple passthrough; fields like parts_needed may be text
      return r;
    });

    console.log('\nAll migrations completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();