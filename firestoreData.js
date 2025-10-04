const { getFirestore } = require('./firebaseAdmin');

const db = () => getFirestore();

function ensureArray(val, fallback = []) {
  if (val === null || val === undefined) return fallback;
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return fallback; }
  }
  return fallback;
}

async function getWorkers() {
  const snap = await db().collection('workers').orderBy('created_at', 'desc').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getWorkerById(id) {
  const doc = await db().collection('workers').doc(String(id)).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function getWorkerByEmail(email) {
  const snap = await db().collection('workers').where('email', '==', email).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
}

async function createWorker(worker) {
  const ref = db().collection('workers').doc();
  const payload = { ...worker, created_at: worker.created_at || new Date().toISOString() };
  await ref.set(payload, { merge: true });
  return { id: ref.id, ...payload };
}

async function updateWorker(id, updates) {
  const ref = db().collection('workers').doc(String(id));
  await ref.set({ ...updates, updated_at: new Date().toISOString() }, { merge: true });
  const doc = await ref.get();
  return { id: doc.id, ...doc.data() };
}

async function deleteWorker(id) {
  await db().collection('workers').doc(String(id)).delete();
}

async function getJobs() {
  const snap = await db().collection('jobs').orderBy('created_at', 'desc').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getJobById(id) {
  const doc = await db().collection('jobs').doc(String(id)).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function createJob(job) {
  const ref = db().collection('jobs').doc();
  const payload = {
    ...job,
    photos: ensureArray(job.photos, []),
    created_at: job.created_at || new Date().toISOString(),
  };
  await ref.set(payload, { merge: true });
  return { id: ref.id, ...payload };
}

async function updateJob(id, updates) {
  const ref = db().collection('jobs').doc(String(id));
  const payload = { ...updates, updated_at: new Date().toISOString() };
  await ref.set(payload, { merge: true });
  const doc = await ref.get();
  return { id: doc.id, ...doc.data() };
}

async function deleteJob(id) {
  await db().collection('jobs').doc(String(id)).delete();
}

async function getAnnotationsForJob(jobId) {
  const snap = await db().collection('job_annotations').where('job_id', '==', Number(jobId)).orderBy('created_at', 'asc').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function createAnnotation(annotation) {
  const ref = db().collection('job_annotations').doc();
  const payload = { ...annotation, created_at: annotation.created_at || new Date().toISOString() };
  await ref.set(payload, { merge: true });
  return { id: ref.id, ...payload };
}

async function updateAnnotation(id, updates) {
  const ref = db().collection('job_annotations').doc(String(id));
  await ref.set({ ...updates, updated_at: new Date().toISOString() }, { merge: true });
  const doc = await ref.get();
  return { id: doc.id, ...doc.data() };
}

async function deleteAnnotation(id) {
  await db().collection('job_annotations').doc(String(id)).delete();
}

async function getEquipment() {
  const snap = await db().collection('equipment').orderBy('created_at', 'desc').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getEquipmentById(id) {
  const doc = await db().collection('equipment').doc(String(id)).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function createEquipment(equipment) {
  const ref = db().collection('equipment').doc();
  const payload = {
    ...equipment,
    photos: ensureArray(equipment.photos, []),
    documents: ensureArray(equipment.documents, []),
    created_at: equipment.created_at || new Date().toISOString(),
  };
  await ref.set(payload, { merge: true });
  return { id: ref.id, ...payload };
}

async function updateEquipment(id, updates) {
  const ref = db().collection('equipment').doc(String(id));
  await ref.set({ ...updates, updated_at: new Date().toISOString() }, { merge: true });
  const doc = await ref.get();
  return { id: doc.id, ...doc.data() };
}

async function deleteEquipment(id) {
  await db().collection('equipment').doc(String(id)).delete();
}

module.exports = {
  // workers
  getWorkers,
  getWorkerById,
  getWorkerByEmail,
  createWorker,
  updateWorker,
  deleteWorker,
  // jobs
  getJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  // annotations
  getAnnotationsForJob,
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
  // equipment
  getEquipment,
  getEquipmentById,
  createEquipment,
  updateEquipment,
  deleteEquipment,
};