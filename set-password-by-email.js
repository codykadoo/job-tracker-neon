const bcrypt = require('bcrypt');
require('dotenv').config();

const { initFirebase, getFirestore } = require('./firebaseAdmin');

async function setPasswordByEmail(email, newPassword) {
  try {
    initFirebase();
    const db = getFirestore();

    console.log(`Looking up worker by email: ${email}`);
    const snap = await db.collection('workers').where('email', '==', email).limit(1).get();
    if (snap.empty) {
      console.error(`No worker found with email ${email}`);
      process.exitCode = 1;
      return;
    }

    const doc = snap.docs[0];
    const workerId = doc.id;
    const workerData = doc.data();

    console.log(`Found worker ${workerData.name || ''} (id: ${workerId}). Hashing password...`);
    const hashed = await bcrypt.hash(newPassword, 10);

    await db.collection('workers').doc(workerId).set({
      password: hashed,
      updated_at: new Date().toISOString()
    }, { merge: true });

    console.log('✅ Password updated successfully.');
    console.log(`Email: ${email}`);
    console.log(`New password: ${newPassword}`);
  } catch (err) {
    console.error('Error setting password:', err);
    process.exitCode = 1;
  }
}

// Run with default values matching the request
setPasswordByEmail('kd0owk@gmail.com', 'password1');