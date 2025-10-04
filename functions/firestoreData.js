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
  // Avoid requiring a composite index by removing orderBy from Firestore query.
  // Sort by created_at in memory to keep results stable.
  const snap = await db().collection('job_annotations')
    .where('job_id', '==', Number(jobId))
    .get();
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const toMillis = (ts) => {
    try {
      if (!ts) return 0;
      if (typeof ts === 'string') return Date.parse(ts) || 0;
      if (typeof ts.toMillis === 'function') return ts.toMillis();
      if (ts._seconds !== undefined) return ts._seconds * 1000 + (ts._nanoseconds || 0) / 1e6;
      if (ts.seconds !== undefined) return ts.seconds * 1000 + (ts.nanoseconds || 0) / 1e6;
    } catch (_) {}
    return 0;
  };
  items.sort((a, b) => toMillis(a.created_at) - toMillis(b.created_at));
  return items;
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

// Maintenance Requests (Firestore)
async function getMaintenanceRequests() {
  const snap = await db().collection('equipment_maintenance_requests').orderBy('created_at', 'desc').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getMaintenanceRequestById(id) {
  const doc = await db().collection('equipment_maintenance_requests').doc(String(id)).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function getMaintenanceRequestsForEquipment(equipmentId) {
  const snap = await db().collection('equipment_maintenance_requests').where('equipment_id', '==', Number(equipmentId)).orderBy('created_at', 'desc').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function createMaintenanceRequest(req) {
  const ref = db().collection('equipment_maintenance_requests').doc();
  const payload = {
    ...req,
    files: ensureArray(req.files, []),
    created_at: req.created_at || new Date().toISOString(),
    status: req.status || 'pending'
  };
  await ref.set(payload, { merge: true });
  return { id: ref.id, ...payload };
}

async function updateMaintenanceRequest(id, updates) {
  const ref = db().collection('equipment_maintenance_requests').doc(String(id));
  const payload = { ...updates, updated_at: new Date().toISOString() };
  await ref.set(payload, { merge: true });
  const doc = await ref.get();
  return { id: doc.id, ...doc.data() };
}

async function deleteMaintenanceRequest(id) {
  await db().collection('equipment_maintenance_requests').doc(String(id)).delete();
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
  // maintenance
  getMaintenanceRequests,
  getMaintenanceRequestById,
  getMaintenanceRequestsForEquipment,
  createMaintenanceRequest,
  updateMaintenanceRequest,
  deleteMaintenanceRequest,
};