const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const bcrypt = require('bcrypt');
const session = require('express-session');
const { initFirebase, admin } = require('./firebaseAdmin');
// Load environment variables ASAP so all subsequent config reads the correct values
require('dotenv').config();
if (process.env.USE_FIRESTORE && process.env.USE_FIRESTORE !== 'true') {
    console.warn('Firestore is now the only supported backend. Ignoring USE_FIRESTORE=false.');
}
process.env.USE_FIRESTORE = 'true';
const USE_FIRESTORE = true;
let firestoreData = null;
let pool = null;
try {
    firestoreData = require('./firestoreData');
    console.log('Firestore data layer enabled');
} catch (e) {
    console.error('Failed to load Firestore data layer.', e);
    throw e;
}

const app = express();
// Ensure secure cookies work behind Firebase Hosting/Functions proxy
app.set('trust proxy', 1);
const PORT = process.env.PORT || 8001;
const HOST = process.env.HOST || '0.0.0.0';
// Ensure references to serverless env don’t break after removing Vercel detection
const isVercel = false;

// Check if running on Vercel (serverless)
// Removed Vercel-specific detection

// Initialize Firebase Admin (prepares Firestore usage later)
let firebaseInitialized = false;
try {
    initFirebase();
    firebaseInitialized = true;
    console.log('Firebase Admin initialized');
} catch (e) {
    firebaseInitialized = false;
    console.warn('Firebase Admin not initialized (missing env).');
}

// Database connection pool
// Removed Postgres/Neon pool; Firestore-only

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-super-secret-key-change-this-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        // Use secure cookies in production/Functions so browser sends cookie over HTTPS
        secure: !!process.env.FUNCTION_TARGET || process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax'
    },
    name: 'sessionId'
}));

// Configure multer for file uploads (supports Cloud Functions via /tmp)
const isServerless = process.env.SKIP_LISTEN === 'true' || !!process.env.FUNCTION_TARGET || !!process.env.K_SERVICE;
// Use ephemeral storage in serverless environments
const uploadsDir = isServerless ? path.join('/tmp', 'uploads') : path.join(__dirname, 'uploads');
try {
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }
} catch (e) {
    console.warn('Failed to initialize uploads directory:', uploadsDir, e && e.message ? e.message : e);
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    },
    fileFilter: function (req, file, cb) {
        // Allow images and documents
        if (file.fieldname === 'photos') {
            if (file.mimetype.startsWith('image/')) {
                cb(null, true);
            } else {
                cb(new Error('Only image files are allowed for photos'), false);
            }
        } else if (file.fieldname === 'documents') {
            const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
            if (allowedTypes.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new Error('Only PDF, DOC, DOCX, and TXT files are allowed for documents'), false);
            }
        } else if (file.fieldname === 'files') {
            // Allow receipts and maintenance documents
            const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'image/jpeg', 'image/png', 'image/gif'];
            if (allowedTypes.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new Error('Only PDF, DOC, DOCX, TXT, and image files are allowed for receipts'), false);
            }
        } else {
            cb(new Error('Invalid field name'), false);
        }
    }
});

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files BEFORE API middleware to prevent conflicts
app.use(express.static('.'));
// Serve uploaded files
// Serve uploaded files from the correct directory (local or /tmp)
app.use('/uploads', express.static(uploadsDir));

// Handle static file requests with proper content types
app.get('*.css', (req, res) => {
    res.setHeader('Content-Type', 'text/css');
    res.sendFile(path.join(__dirname, req.path));
});

app.get('*.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(path.join(__dirname, req.path));
});

app.get('*.html', (req, res) => {
    res.sendFile(path.join(__dirname, req.path));
});

// Add cache-busting headers for API responses ONLY
app.use('/api', (req, res, next) => {
    res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    next();
});

// Verify Firebase ID token when provided and attach user
app.use('/api', async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'] || req.headers['Authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const idToken = authHeader.slice('Bearer '.length);
            if (firebaseInitialized && idToken) {
                try {
                    const decoded = await admin.auth().verifyIdToken(idToken);
                    const email = decoded.email;
                    if (email) {
                        const user = await firestoreData.getWorkerByEmail(email);
                        if (user && user.status === 'active') {
                            const normalizedUser = {
                                id: String(user.id),
                                name: user.name,
                                email: user.email,
                                roles: Array.isArray(user.roles)
                                    ? user.roles
                                    : (typeof user.roles === 'string' ? user.roles.split(',').map(r => r.trim()) : []),
                            };
                            req.user = normalizedUser;
                            // Hydrate session for compatibility
                            req.session.user = normalizedUser;
                        }
                    }
                } catch (e) {
                    // Ignore token errors
                }
            }
        }
    } catch (e) {
        // Non-fatal
    }
    next();
});

// Database initialization and API routes will use the pool defined above

// Postgres initialization removed; Firestore is the sole data backend.

// API Routes

// Get all jobs
app.get('/api/jobs', requireAuth, async (req, res) => {
    try {
        const jobs = await firestoreData.getJobs();
        const mapped = jobs.map(j => ({
            id: j.id,
            job_number: j.job_number || j.jobNumber || j.id,
            title: j.title,
            job_type: j.job_type || j.jobType,
            description: j.description,
            location_lat: (j.location && j.location.lat) || (j.coordinates && j.coordinates.lat) || null,
            location_lng: (j.location && j.location.lng) || (j.coordinates && j.coordinates.lng) || null,
            location_address: j.location_address || j.locationAddress || null,
            contact_name: j.contact_name || j.contactName || null,
            contact_phone: j.contact_phone || j.contactPhone || null,
            assigned_worker_id: j.assigned_worker_id || j.assignedWorkerId || null,
            photos: Array.isArray(j.photos) ? j.photos : [],
            created_at: j.created_at || j.createdAt || null,
            updated_at: j.updated_at || j.updatedAt || null
        }));
        return res.json(mapped);
    } catch (error) {
        console.error('Error fetching jobs:', error);
        res.status(500).json({ error: 'Failed to fetch jobs' });
    }
});

// Create a new job
app.post('/api/jobs', requireAuth, upload.array('photos', 10), async (req, res) => {
    try {
        const { jobNumber, title, description, jobType, location, locationAddress, contactName, contactPhone, assignedWorkerId } = req.body;
        
        // Parse location if it's a JSON string
        let locationData;
        try {
            locationData = typeof location === 'string' ? JSON.parse(location) : location;
        } catch (parseError) {
            console.error('Error parsing location data:', parseError);
            return res.status(400).json({ error: 'Invalid location data format' });
        }
        
        // Validate location data
        if (!locationData || typeof locationData.lat !== 'number' || typeof locationData.lng !== 'number') {
            return res.status(400).json({ error: 'Location coordinates are required' });
        }
        
        // Process uploaded photos
        let photos = [];
        if (req.files && req.files.length > 0) {
            photos = req.files.map(file => ({
                filename: file.filename,
                path: isVercel ? file.filename : `uploads/${file.filename}`,
                size: file.size
            }));
        }

        // Firestore-only path
        let finalJobNumber = jobNumber;
        if (!finalJobNumber || finalJobNumber.trim() === '') {
            const pad = n => String(n).padStart(4, '0');
            finalJobNumber = `JOB-${pad(Math.floor(Date.now() / 1000) % 10000)}`; // simple time-based fallback
        }

        // Basic duplicate check in Firestore
        try {
            const existing = await firestoreData.getJobs();
            const dup = existing.find(j => (j.job_number || j.jobNumber) === finalJobNumber);
            if (dup) {
                return res.status(400).json({ error: 'Job number already exists. Please use a different job number.' });
            }
        } catch (e) {
            console.warn('Duplicate check in Firestore failed; proceeding:', e.message);
        }

        const assignedId = assignedWorkerId && assignedWorkerId !== 'null' ? String(assignedWorkerId) : null;
        const payload = {
            job_number: finalJobNumber,
            title,
            description,
            job_type: jobType,
            location: { lat: locationData.lat, lng: locationData.lng },
            location_address: locationAddress || null,
            contact_name: contactName || null,
            contact_phone: contactPhone || null,
            assigned_worker_id: assignedId,
            photos
        };
        const created = await firestoreData.createJob(payload);
        return res.status(201).json({
            id: created.id,
            job_number: created.job_number,
            title: created.title,
            description: created.description,
            job_type: created.job_type,
            location_lat: (created.location && created.location.lat) || null,
            location_lng: (created.location && created.location.lng) || null,
            location_address: created.location_address || null,
            contact_name: created.contact_name || null,
            contact_phone: created.contact_phone || null,
            assigned_worker_id: created.assigned_worker_id || null,
            photos: Array.isArray(created.photos) ? created.photos : [],
            created_at: created.created_at || null,
            updated_at: created.updated_at || null
        });
    } catch (error) {
        console.error('Error creating job:', error);
        res.status(500).json({ error: 'Failed to create job' });
    }
});

// Update a job
app.put('/api/jobs/:id', requireAuth, upload.array('photos', 10), async (req, res) => {
    console.log(`PUT /api/jobs/${req.params.id} - Request received`);
    console.log('Request body:', req.body);
    console.log('Uploaded files:', req.files ? req.files.length : 0);
    
    try {
        const { id } = req.params;
        const updates = req.body;
        // Process new uploaded photos
        let newPhotos = [];
        if (req.files && req.files.length > 0) {
            newPhotos = req.files.map(file => ({
                filename: file.filename,
                path: isVercel ? file.filename : `uploads/${file.filename}`,
                size: file.size
            }));
        }

        // Firestore-only path
        const existing = await firestoreData.getJobById(id);
        if (!existing) {
            return res.status(404).json({ error: 'Job not found' });
        }
        const existingPhotos = Array.isArray(existing.photos) ? existing.photos : [];
        const allPhotos = [...existingPhotos, ...newPhotos];

        const mapped = {};
        for (const [key, value] of Object.entries(updates)) {
            if (key === 'location') {
                mapped.location = { lat: value.lat, lng: value.lng };
            } else if (key === 'jobType') {
                mapped.job_type = value;
            } else if (key === 'locationAddress') {
                mapped.location_address = value;
            } else if (key === 'contactName') {
                mapped.contact_name = value;
            } else if (key === 'contactPhone') {
                mapped.contact_phone = value;
            } else if (key === 'assignedWorkerId' || key === 'assignedWorker') {
                mapped.assigned_worker_id = value != null ? String(value) : null;
            } else if (!['updated_at', 'id', 'lat', 'lng'].includes(key)) {
                mapped[key] = value;
            }
        }
        mapped.photos = allPhotos;

        const updated = await firestoreData.updateJob(id, mapped);
        return res.json({
            id: updated.id,
            job_number: updated.job_number || updated.jobNumber,
            title: updated.title,
            description: updated.description,
            job_type: updated.job_type || updated.jobType,
            location_lat: (updated.location && updated.location.lat) || null,
            location_lng: (updated.location && updated.location.lng) || null,
            location_address: updated.location_address || updated.locationAddress || null,
            contact_name: updated.contact_name || updated.contactName || null,
            contact_phone: updated.contact_phone || updated.contactPhone || null,
            assigned_worker_id: updated.assigned_worker_id || updated.assignedWorkerId || null,
            photos: Array.isArray(updated.photos) ? updated.photos : [],
            created_at: updated.created_at || null,
            updated_at: updated.updated_at || null
        });
    } catch (error) {
        console.error('Error updating job:', error);
        res.status(500).json({ error: 'Failed to update job' });
    }
});

// Delete a job
app.delete('/api/jobs/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await firestoreData.getJobById(id);
        if (!existing) {
            return res.status(404).json({ error: 'Job not found' });
        }
        await firestoreData.deleteJob(id);
        return res.json({ message: 'Job deleted successfully' });
    } catch (error) {
        console.error('Error deleting job:', error);
        res.status(500).json({ error: 'Failed to delete job' });
    }
});

// Annotation API Routes

// Get annotations for a specific job
app.get('/api/jobs/:jobId/annotations', requireAuth, async (req, res) => {
    try {
        const { jobId } = req.params;
        const ann = await firestoreData.getAnnotationsForJob(jobId);
        const mapped = ann.map(a => ({
            id: a.id,
            job_id: a.job_id || Number(jobId),
            annotation_type: a.annotation_type || a.annotationType,
            name: a.name,
            description: a.description,
            coordinates: a.coordinates,
            style_options: a.style_options || a.styleOptions || {},
            created_at: a.created_at || a.createdAt || null,
            updated_at: a.updated_at || a.updatedAt || null
        }));
        return res.json(mapped);
    } catch (error) {
        console.error('Error fetching annotations:', error);
        res.status(500).json({ error: 'Failed to fetch annotations' });
    }
});

// Create a new annotation for a job
app.post('/api/jobs/:jobId/annotations', requireAuth, async (req, res) => {
    try {
        const { jobId } = req.params;
        const { annotationType, name, description, coordinates, styleOptions } = req.body;
        const created = await firestoreData.createAnnotation({
            job_id: Number(jobId),
            annotation_type: annotationType,
            name,
            description,
            coordinates,
            style_options: styleOptions || {}
        });
        const mapped = {
            id: created.id,
            job_id: created.job_id,
            annotation_type: created.annotation_type || created.annotationType,
            name: created.name,
            description: created.description,
            coordinates: created.coordinates,
            style_options: created.style_options || created.styleOptions || {},
            created_at: created.created_at || created.createdAt || null,
            updated_at: created.updated_at || created.updatedAt || null
        };
        res.status(201).json(mapped);
    } catch (error) {
        console.error('Error creating annotation:', error);
        res.status(500).json({ error: 'Failed to create annotation' });
    }
});

// Update an annotation
app.put('/api/annotations/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, coordinates, styleOptions } = req.body;
        const updated = await firestoreData.updateAnnotation(id, {
            name,
            description,
            coordinates,
            style_options: styleOptions || {}
        });
        const mapped = {
            id: updated.id,
            job_id: updated.job_id,
            annotation_type: updated.annotation_type || updated.annotationType,
            name: updated.name,
            description: updated.description,
            coordinates: updated.coordinates,
            style_options: updated.style_options || updated.styleOptions || {},
            created_at: updated.created_at || updated.createdAt || null,
            updated_at: updated.updated_at || updated.updatedAt || null
        };
        res.json(mapped);
    } catch (error) {
        console.error('Error updating annotation:', error);
        res.status(500).json({ error: 'Failed to update annotation' });
    }
});

// Delete an annotation
app.delete('/api/annotations/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        await firestoreData.deleteAnnotation(id);
        res.json({ message: 'Annotation deleted successfully' });
    } catch (error) {
        console.error('Error deleting annotation:', error);
        res.status(500).json({ error: 'Failed to delete annotation' });
    }
});

// Worker API Routes

// Get all workers
app.get('/api/workers', requireAuth, async (req, res) => {
    try {
        if (USE_FIRESTORE && firestoreData) {
            const workers = await firestoreData.getWorkers();
            const mapped = workers.map(w => ({
                id: w.id,
                name: w.name,
                email: w.email,
                phone: w.phone || null,
                roles: Array.isArray(w.roles) ? w.roles : (typeof w.roles === 'string' ? w.roles.split(',').map(r => r.trim()) : []),
                status: w.status || 'active',
                created_at: w.created_at || w.createdAt || null
            }));
            return res.json(mapped);
        }
        return res.status(500).json({ error: 'Firestore not available' });
    } catch (error) {
        console.error('Error fetching workers:', error);
        res.status(500).json({ error: 'Failed to fetch workers' });
    }
});

// Create a new worker
app.post('/api/workers', requireAdmin, async (req, res) => {
    try {
        const { name, email, phone, roles, status, password } = req.body;
        
        if (!name || !email) {
            return res.status(400).json({ error: 'Name and email are required' });
        }
        
        const workerRoles = Array.isArray(roles) ? roles : (roles ? [roles] : ['Apprentice']);
        
        let hashedPassword = null;
        if (password) {
            hashedPassword = await bcrypt.hash(password, 12);
        }
        
        if (USE_FIRESTORE && firestoreData) {
            const created = await firestoreData.createWorker({
                name,
                email,
                phone: phone || null,
                roles: workerRoles,
                status: status || 'active',
                password: hashedPassword || null,
            });
            const responseData = {
                id: created.id,
                name: created.name,
                email: created.email,
                phone: created.phone || null,
                roles: Array.isArray(created.roles) ? created.roles : (typeof created.roles === 'string' ? created.roles.split(',').map(r => r.trim()) : []),
                status: created.status || 'active',
                created_at: created.created_at || created.createdAt || null
            };
            return res.status(201).json(responseData);
        }
        return res.status(500).json({ error: 'Firestore not available' });
    } catch (error) {
        console.error('Error creating worker:', error);
        res.status(500).json({ error: 'Failed to create worker' });
    }
});

// Update a worker
app.put('/api/workers/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, phone, roles, status, password } = req.body;
        
        if (!name || !email) {
            return res.status(400).json({ error: 'Name and email are required' });
        }
        
        if (USE_FIRESTORE && firestoreData) {
            const updateData = { name, email, phone };
            if (roles !== undefined) {
                updateData.roles = Array.isArray(roles) ? roles : (roles ? [roles] : ['Apprentice']);
            }
            if (status !== undefined) {
                updateData.status = status;
            }
            if (password !== undefined && password !== null && password !== '') {
                updateData.password = await bcrypt.hash(password, 12);
            }
            updateData.updated_at = new Date();
            const updated = await firestoreData.updateWorker(id, updateData);
            if (!updated) {
                return res.status(404).json({ error: 'Worker not found' });
            }
            const responseData = {
                id: updated.id,
                name: updated.name,
                email: updated.email,
                phone: updated.phone || null,
                roles: Array.isArray(updated.roles) ? updated.roles : (typeof updated.roles === 'string' ? updated.roles.split(',').map(r => r.trim()) : []),
                status: updated.status || 'active',
                created_at: updated.created_at || updated.createdAt || null,
                updated_at: updated.updated_at || updated.updatedAt || null
            };
            return res.json(responseData);
        }
        return res.status(500).json({ error: 'Firestore not available' });
    } catch (error) {
        console.error('Error updating worker:', error);
        res.status(500).json({ error: 'Failed to update worker' });
    }
});

// Get a single worker by ID
app.get('/api/workers/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        if (USE_FIRESTORE && firestoreData) {
            const w = await firestoreData.getWorkerById(id);
            if (!w) {
                return res.status(404).json({ error: 'Worker not found' });
            }
            const mapped = {
                id: w.id,
                name: w.name,
                email: w.email,
                phone: w.phone || null,
                roles: Array.isArray(w.roles)
                    ? w.roles
                    : (typeof w.roles === 'string'
                        ? w.roles.split(',').map(r => r.trim())
                        : []),
                status: w.status || 'active',
                created_at: w.created_at || w.createdAt || null
            };
            return res.json(mapped);
        }
        return res.status(500).json({ error: 'Firestore not available' });
    } catch (error) {
        console.error('Error fetching worker (Firestore):', error);
        res.status(500).json({ error: 'Failed to fetch worker' });
    }
});

// Delete a worker
app.delete('/api/workers/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        if (USE_FIRESTORE && firestoreData) {
            const existing = await firestoreData.getWorkerById(id);
            if (!existing) {
                return res.status(404).json({ error: 'Worker not found' });
            }
            await firestoreData.deleteWorker(id);
            return res.json({ message: 'Worker deleted successfully' });
        }
        return res.status(500).json({ error: 'Firestore not available' });
    } catch (error) {
        console.error('Error deleting worker:', error);
        res.status(500).json({ error: 'Failed to delete worker' });
    }
});

// Reset worker password
app.post('/api/workers/:id/reset-password', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Generate a temporary password
        const temporaryPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();
        
        // Hash the temporary password
        const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
        
        if (USE_FIRESTORE && firestoreData) {
            const existing = await firestoreData.getWorkerById(id);
            if (!existing) {
                return res.status(404).json({ error: 'Worker not found' });
            }
            await firestoreData.updateWorker(id, { password: hashedPassword });
            return res.json({ 
                message: `Password reset successfully for ${existing.name || 'worker'}`,
                temporaryPassword: temporaryPassword,
                workerId: String(id),
                workerName: existing.name || null,
                workerEmail: existing.email || null
            });
        }
        return res.status(500).json({ error: 'Firestore not available' });
    } catch (error) {
        console.error('Error resetting worker password:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

// Serve static files});

// Equipment API endpoints

// Get all equipment (Firestore)
app.get('/api/equipment', requireAuth, async (req, res) => {
    try {
        if (USE_FIRESTORE && firestoreData) {
            const equipment = await firestoreData.getEquipment();
            return res.json(equipment);
        }
        res.status(500).json({ error: 'Firestore not available' });
    } catch (error) {
        console.error('Error fetching equipment:', error);
        res.status(500).json({ error: 'Failed to fetch equipment' });
    }
});

// Get equipment by ID (Firestore)
app.get('/api/equipment/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        if (USE_FIRESTORE && firestoreData) {
            const equipment = await firestoreData.getEquipmentById(id);
            if (!equipment) {
                return res.status(404).json({ error: 'Equipment not found' });
            }
            return res.json(equipment);
        }
        res.status(500).json({ error: 'Firestore not available' });
    } catch (error) {
        console.error('Error fetching equipment:', error);
        res.status(500).json({ error: 'Failed to fetch equipment' });
    }
});

// Create new equipment
app.post('/api/equipment', requireAuth, upload.fields([{ name: 'photos', maxCount: 10 }, { name: 'documents', maxCount: 10 }]), async (req, res) => {
    try {
        console.log('Received form data:', req.body);
        console.log('Received files:', req.files);
        
        const {
            name, equipment_type, make, model, year, serial_number, license_plate,
            location_lat, location_lng, location_address, status, assigned_worker_id,
            last_maintenance_date, next_maintenance_date, maintenance_notes,
            purchase_date, purchase_price, current_value, fuel_type, hours_used, mileage
        } = req.body;

        // Validate required fields
        if (!name || !equipment_type) {
            return res.status(400).json({ error: 'Name and equipment type are required' });
        }

        // Convert empty strings to null for numeric fields
        const processNumericField = (value) => {
            return value === '' || value === undefined || value === null ? null : value;
        };

        // Process uploaded files
        const photos = req.files?.photos ? req.files.photos.map(file => ({
            filename: file.filename,
            originalname: file.originalname,
            path: file.path,
            size: file.size
        })) : [];

        const documents = req.files?.documents ? req.files.documents.map(file => ({
            filename: file.filename,
            originalname: file.originalname,
            path: file.path,
            size: file.size
        })) : [];

        if (USE_FIRESTORE && firestoreData) {
            const payload = {
                name,
                equipment_type,
                make,
                model,
                year: processNumericField(year),
                serial_number,
                license_plate,
                location_lat: processNumericField(location_lat),
                location_lng: processNumericField(location_lng),
                location_address,
                status,
                assigned_worker_id: processNumericField(assigned_worker_id),
                last_maintenance_date: last_maintenance_date || null,
                next_maintenance_date: next_maintenance_date || null,
                maintenance_notes,
                purchase_date: purchase_date || null,
                purchase_price: processNumericField(purchase_price),
                current_value: processNumericField(current_value),
                fuel_type,
                hours_used: processNumericField(hours_used),
                mileage: processNumericField(mileage),
                photos,
                documents
            };
            const created = await firestoreData.createEquipment(payload);
            return res.status(201).json(created);
        }
        return res.status(500).json({ error: 'Firestore not available' });
    } catch (error) {
        console.error('Error creating equipment:', error);
        res.status(500).json({ error: 'Failed to create equipment' });
    }
});

// Update equipment
app.put('/api/equipment/:id', requireAuth, upload.fields([{ name: 'photos', maxCount: 10 }, { name: 'documents', maxCount: 10 }]), async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        
        // Convert empty strings to null for numeric fields
        const processNumericField = (value) => {
            return value === '' || value === undefined || value === null ? null : value;
        };
        
        // Process numeric fields
        const numericFields = ['year', 'location_lat', 'location_lng', 'assigned_worker_id', 'purchase_price', 'current_value', 'hours_used', 'mileage'];
        numericFields.forEach(field => {
            if (updateData[field] !== undefined) {
                updateData[field] = processNumericField(updateData[field]);
            }
        });
        
        // Process date fields
        const dateFields = ['last_maintenance_date', 'next_maintenance_date', 'purchase_date'];
        dateFields.forEach(field => {
            if (updateData[field] === '') {
                updateData[field] = null;
            }
        });
        
        if (USE_FIRESTORE && firestoreData) {
            // Merge uploaded files into existing arrays
            if (req.files?.photos || req.files?.documents) {
                const existing = await firestoreData.getEquipmentById(id);
                if (!existing) {
                    return res.status(404).json({ error: 'Equipment not found' });
                }
                const existingPhotos = Array.isArray(existing.photos) ? existing.photos : [];
                const existingDocuments = Array.isArray(existing.documents) ? existing.documents : [];
                if (req.files?.photos) {
                    const newPhotos = req.files.photos.map(file => ({
                        filename: file.filename,
                        originalname: file.originalname,
                        path: file.path,
                        size: file.size
                    }));
                    updateData.photos = [...existingPhotos, ...newPhotos];
                }
                if (req.files?.documents) {
                    const newDocuments = req.files.documents.map(file => ({
                        filename: file.filename,
                        originalname: file.originalname,
                        path: file.path,
                        size: file.size
                    }));
                    updateData.documents = [...existingDocuments, ...newDocuments];
                }
            }
            const updated = await firestoreData.updateEquipment(id, updateData);
            return res.json(updated);
        }
        return res.status(500).json({ error: 'Firestore not available' });
    } catch (error) {
        console.error('Error updating equipment:', error);
        res.status(500).json({ error: 'Failed to update equipment' });
    }
});

// Delete equipment
app.delete('/api/equipment/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        if (USE_FIRESTORE && firestoreData) {
            const existing = await firestoreData.getEquipmentById(id);
            if (!existing) {
                return res.status(404).json({ error: 'Equipment not found' });
            }
            await firestoreData.deleteEquipment(id);
            return res.json({ message: 'Equipment deleted successfully' });
        }
        return res.status(500).json({ error: 'Firestore not available' });
    } catch (error) {
        console.error('Error deleting equipment:', error);
        res.status(500).json({ error: 'Failed to delete equipment' });
    }
});

// Get all maintenance requests
app.get('/api/maintenance-requests', requireAuth, async (req, res) => {
    try {
        if (USE_FIRESTORE && firestoreData) {
            const requests = await firestoreData.getMaintenanceRequests();
            return res.json(requests);
        }
        return res.status(500).json({ error: 'Firestore not available' });
    } catch (error) {
        console.error('Error fetching all maintenance requests:', error);
        res.status(500).json({ error: 'Failed to fetch maintenance requests' });
    }
});

// Create new maintenance request (general endpoint)
app.post('/api/maintenance-requests', requireAuth, async (req, res) => {
    try {
        const {
            equipment_id, type, priority, title, description, assigned_worker_id,
            estimated_cost, estimated_hours, parts_needed, due_date, status
        } = req.body;

        if (USE_FIRESTORE && firestoreData) {
            const created = await firestoreData.createMaintenanceRequest({
                equipment_id,
                request_type: type,
                priority,
                title,
                description,
                assigned_to_worker_id: assigned_worker_id || null,
                estimated_cost: estimated_cost || null,
                estimated_hours: estimated_hours || null,
                parts_needed: parts_needed || null,
                due_date: due_date || null,
                status: status || 'pending',
                created_at: new Date()
            });
            return res.status(201).json(created);
        }
        return res.status(500).json({ error: 'Firestore not available' });
    } catch (error) {
        console.error('Error creating maintenance request:', error);
        res.status(500).json({ error: 'Failed to create maintenance request' });
    }
});

// Get single maintenance request by ID
app.get('/api/maintenance-requests/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        if (USE_FIRESTORE && firestoreData) {
            const reqDoc = await firestoreData.getMaintenanceRequestById(id);
            if (!reqDoc) {
                return res.status(404).json({ error: 'Maintenance request not found' });
            }
            return res.json(reqDoc);
        }
        return res.status(500).json({ error: 'Firestore not available' });
    } catch (error) {
        console.error('Error fetching maintenance request:', error);
        res.status(500).json({ error: 'Failed to fetch maintenance request' });
    }
});

app.get('/api/equipment/:equipmentId/maintenance-requests', requireAuth, async (req, res) => {
    try {
        const { equipmentId } = req.params;
        if (USE_FIRESTORE && firestoreData) {
            const requests = await firestoreData.getMaintenanceRequestsByEquipmentId(equipmentId);
            return res.json(requests || []);
        }
        return res.status(500).json({ error: 'Firestore not available' });
    } catch (error) {
        console.error('Error fetching maintenance requests:', error);
        res.status(500).json({ error: 'Failed to fetch maintenance requests' });
    }
});

// Get maintenance history for equipment (new endpoint)
app.get('/api/equipment/:equipmentId/maintenance', requireAuth, async (req, res) => {
    try {
        const { equipmentId } = req.params;
        if (USE_FIRESTORE && firestoreData) {
            const reqs = await firestoreData.getMaintenanceRequestsByEquipmentId(equipmentId);
            const maintenanceHistory = (reqs || []).map(row => ({
                id: row.id,
                type: row.request_type || row.type,
                title: row.title || `${row.request_type || row.type || 'Maintenance'} Request`,
                description: row.description,
                status: row.status,
                priority: row.priority,
                assignedWorker: row.assigned_to_name || 'Unassigned',
                requestDate: row.created_at ? (typeof row.created_at === 'string' ? row.created_at.split('T')[0] : new Date(row.created_at).toISOString().split('T')[0]) : null,
                completedDate: row.completed_date ? (typeof row.completed_date === 'string' ? row.completed_date.split('T')[0] : new Date(row.completed_date).toISOString().split('T')[0]) : null,
                scheduledDate: row.due_date ? (typeof row.due_date === 'string' ? row.due_date.split('T')[0] : new Date(row.due_date).toISOString().split('T')[0]) : null,
                cost: row.actual_cost || row.estimated_cost || 0,
                notes: row.description || ''
            }));
            return res.json(maintenanceHistory);
        }
        return res.status(500).json({ error: 'Firestore not available' });
    } catch (error) {
        console.error('Error fetching maintenance history:', error);
        res.status(500).json({ error: 'Failed to fetch maintenance history' });
    }
});

// Create maintenance request
app.post('/api/equipment/:equipmentId/maintenance-requests', requireAuth, async (req, res) => {
    try {
        const { equipmentId } = req.params;
        const {
            request_type, priority, title, description, requested_by_worker_id,
            assigned_to_worker_id, estimated_cost, estimated_hours, parts_needed, due_date
        } = req.body;

        if (USE_FIRESTORE && firestoreData) {
            const created = await firestoreData.createMaintenanceRequest({
                equipment_id: equipmentId,
                request_type,
                priority,
                title,
                description,
                requested_by_worker_id: requested_by_worker_id || null,
                assigned_to_worker_id: assigned_to_worker_id || null,
                estimated_cost: estimated_cost || null,
                estimated_hours: estimated_hours || null,
                parts_needed: parts_needed || null,
                due_date: due_date || null,
                status: 'pending',
                created_at: new Date()
            });
            return res.status(201).json(created);
        }
        return res.status(500).json({ error: 'Firestore not available' });
    } catch (error) {
        console.error('Error creating maintenance request:', error);
        res.status(500).json({ error: 'Failed to create maintenance request' });
    }
});

// Create new maintenance log (new endpoint)
app.post('/api/maintenance', requireAuth, async (req, res) => {
    try {
        const {
            equipmentId, type, title, description, priority,
            assignedWorker, scheduledDate, estimatedCost
        } = req.body;

        let assignedWorkerId = null;
        if (assignedWorker && USE_FIRESTORE && firestoreData) {
            const workers = await firestoreData.getWorkers();
            const match = (workers || []).find(w => (w.name || '').trim() === assignedWorker.trim());
            if (match) assignedWorkerId = match.id;
        }

        if (USE_FIRESTORE && firestoreData) {
            const created = await firestoreData.createMaintenanceRequest({
                equipment_id: equipmentId,
                request_type: type,
                priority,
                title,
                description,
                assigned_to_worker_id: assignedWorkerId || null,
                estimated_cost: estimatedCost || null,
                due_date: scheduledDate || null,
                status: 'pending',
                created_at: new Date()
            });
            return res.status(201).json(created);
        }
        return res.status(500).json({ error: 'Firestore not available' });
    } catch (error) {
        console.error('Error creating maintenance log:', error);
        res.status(500).json({ error: 'Failed to create maintenance log' });
    }
});

// Update maintenance status (new endpoint)
app.put('/api/maintenance/:id/status', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (USE_FIRESTORE && firestoreData) {
            const updated = await firestoreData.updateMaintenanceRequest(id, {
                status,
                updated_at: new Date()
            });
            if (!updated) {
                return res.status(404).json({ error: 'Maintenance request not found' });
            }
            return res.json(updated);
        }
        return res.status(500).json({ error: 'Firestore not available' });
    } catch (error) {
        console.error('Error updating maintenance status:', error);
        res.status(500).json({ error: 'Failed to update maintenance status' });
    }
});

// Complete maintenance work (new endpoint)
app.put('/api/maintenance/:id/complete', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { notes, cost } = req.body;

        if (USE_FIRESTORE && firestoreData) {
            const existing = await firestoreData.getMaintenanceRequestById(id);
            if (!existing) {
                return res.status(404).json({ error: 'Maintenance request not found' });
            }
            const newDescription = notes && notes.trim()
                ? `${existing.description || ''}\n\nCompletion Notes: ${notes.trim()}`
                : (existing.description || '');
            const updated = await firestoreData.updateMaintenanceRequest(id, {
                status: 'completed',
                completed_date: new Date(),
                description: newDescription,
                actual_cost: cost || existing.actual_cost || null,
                updated_at: new Date()
            });
            return res.json(updated);
        }
        return res.status(500).json({ error: 'Firestore not available' });
    } catch (error) {
        console.error('Error completing maintenance work:', error);
        res.status(500).json({ error: 'Failed to complete maintenance work' });
    }
});

// Update maintenance request (existing endpoint)
app.put('/api/maintenance-requests/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body || {};
        
        if (USE_FIRESTORE && firestoreData) {
            updateData.updated_at = new Date();
            const updated = await firestoreData.updateMaintenanceRequest(id, updateData);
            if (!updated) {
                return res.status(404).json({ error: 'Maintenance request not found' });
            }
            return res.json(updated);
        }
        return res.status(500).json({ error: 'Firestore not available' });
    } catch (error) {
        console.error('Error updating maintenance request:', error);
        res.status(500).json({ error: 'Failed to update maintenance request' });
    }
});

// Delete maintenance request
app.delete('/api/maintenance-requests/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        if (USE_FIRESTORE && firestoreData) {
            const existing = await firestoreData.getMaintenanceRequestById(id);
            if (!existing) {
                return res.status(404).json({ error: 'Maintenance request not found' });
            }
            await firestoreData.deleteMaintenanceRequest(id);
            return res.json({ message: 'Maintenance request deleted successfully', deletedRequest: existing });
        }
        return res.status(500).json({ error: 'Firestore not available' });
    } catch (error) {
        console.error('Error deleting maintenance request:', error);
        res.status(500).json({ error: 'Failed to delete maintenance request' });
    }
});

// Upload files for maintenance request
app.post('/api/maintenance-requests/:id/upload', requireAuth, upload.array('files', 10), async (req, res) => {
    try {
        const { id } = req.params;
        const { description } = req.body;
        
        // Check if maintenance request exists (Firestore)
        if (USE_FIRESTORE && firestoreData) {
            const existing = await firestoreData.getMaintenanceRequestById(id);
            if (!existing) {
                return res.status(404).json({ error: 'Maintenance request not found' });
            }
        }
        
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }
        
        const uploadedFiles = [];
        
        for (const file of req.files) {
            let fileData;
            
            if (isVercel) {
                // In serverless environment, files are in memory
                fileData = {
                    filename: file.originalname,
                    originalName: file.originalname,
                    buffer: file.buffer, // File data in memory
                    size: file.size,
                    mimetype: file.mimetype,
                    uploadDate: new Date(),
                    description: description || null
                };
                
                // Note: In production, you would typically upload to cloud storage (AWS S3, etc.)
                // For now, we'll just return the file information
                uploadedFiles.push({
                    filename: file.originalname,
                    originalName: file.originalname,
                    size: file.size,
                    url: null, // No URL in serverless without cloud storage
                    uploadDate: fileData.uploadDate,
                    description: description,
                    note: 'File stored in memory - implement cloud storage for production'
                });
            } else {
                // Local development with disk storage
                fileData = {
                    filename: file.filename,
                    originalName: file.originalname,
                    path: file.path,
                    size: file.size,
                    mimetype: file.mimetype,
                    uploadDate: new Date(),
                    description: description || null
                };
                
                uploadedFiles.push({
                    filename: file.filename,
                    originalName: file.originalname,
                    size: file.size,
                    url: `/uploads/${file.filename}`,
                    uploadDate: fileData.uploadDate,
                    description: description
                });
            }
        }
        
        // Persist uploaded file metadata to Firestore if available
        if (USE_FIRESTORE && firestoreData) {
            try {
                const existing = await firestoreData.getMaintenanceRequestById(id);
                if (existing) {
                    const existingFiles = Array.isArray(existing.files) ? existing.files : [];
                    const filesForDoc = uploadedFiles.map(f => ({
                        filename: f.filename,
                        originalname: f.originalName,
                        url: f.url,
                        size: f.size,
                        uploaded_at: f.uploadDate,
                        description: f.description || null,
                    }));
                    await firestoreData.updateMaintenanceRequest(id, {
                        files: [...existingFiles, ...filesForDoc],
                    });
                }
            } catch (e) {
                console.warn('Failed to persist uploaded files to Firestore:', e.message || e);
            }
        }
        
        res.json({
            message: 'Files uploaded successfully',
            files: uploadedFiles,
            requestId: id,
            environment: isVercel ? 'serverless' : 'local'
        });
        
    } catch (error) {
        console.error('Error uploading files:', error);
        res.status(500).json({ error: 'Failed to upload files' });
    }
});

// Job-Equipment relationship endpoints
app.get('/api/jobs/:jobId/equipment', requireAuth, async (req, res) => {
    try {
        const { jobId } = req.params;
        if (USE_FIRESTORE && firestoreData) {
            const equipment = await firestoreData.getEquipment();
            const filtered = equipment.filter(e => {
                const assigned = e.assigned_job_id ?? e.assignedJobId;
                return assigned != null && String(assigned) === String(jobId);
            });
            return res.json(filtered);
        }
        res.status(500).json({ error: 'Firestore not available' });
    } catch (error) {
        console.error('Error fetching job equipment:', error);
        res.status(500).json({ error: 'Failed to fetch job equipment' });
    }
});

app.post('/api/jobs/:jobId/equipment', requireAuth, async (req, res) => {
    try {
        const { jobId } = req.params;
        const { equipmentId } = req.body;
        if (USE_FIRESTORE && firestoreData) {
            await firestoreData.updateEquipment(equipmentId, {
                assigned_job_id: Number(jobId),
                status: 'in_use'
            });
            return res.json({ success: true });
        }
        res.status(500).json({ error: 'Firestore not available' });
    } catch (error) {
        console.error('Error assigning equipment to job:', error);
        res.status(500).json({ error: 'Failed to assign equipment to job' });
    }
});

app.delete('/api/jobs/:jobId/equipment/:equipmentId', requireAuth, async (req, res) => {
    try {
        const { equipmentId } = req.params;
        if (USE_FIRESTORE && firestoreData) {
            await firestoreData.updateEquipment(equipmentId, {
                assigned_job_id: null,
                status: 'available',
                job_location_lat: null,
                job_location_lng: null,
                job_location_address: null
            });
            return res.json({ success: true });
        }
        res.status(500).json({ error: 'Firestore not available' });
    } catch (error) {
        console.error('Error removing equipment from job:', error);
        res.status(500).json({ error: 'Failed to remove equipment from job' });
    }
});

app.put('/api/equipment/:equipmentId/job-location', requireAuth, async (req, res) => {
    try {
        const { equipmentId } = req.params;
        const { latitude, longitude, address } = req.body;
        
        if (!latitude || !longitude) {
            return res.status(400).json({ error: 'Latitude and longitude are required' });
        }
        if (USE_FIRESTORE && firestoreData) {
            await firestoreData.updateEquipment(equipmentId, {
                job_location_lat: Number(latitude),
                job_location_lng: Number(longitude),
                job_location_address: address || null
            });
            return res.json({ message: 'Equipment location updated successfully' });
        }
        res.status(500).json({ error: 'Firestore not available' });
    } catch (error) {
        console.error('Error updating equipment location:', error);
        res.status(500).json({ error: 'Failed to update equipment location' });
    }
});

// Authentication middleware
function requireAuth(req, res, next) {
    if (process.env.RELAX_AUTH === 'true') {
        if (!req.session.user) {
            req.session.user = {
                id: 'dev-user',
                name: 'Developer',
                email: 'dev@example.com',
                roles: ['Admin']
            };
        }
        return next();
    }
    if (!req.session.user && !req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    next();
}

// Admin middleware
function requireAdmin(req, res, next) {
    if (process.env.RELAX_AUTH === 'true') {
        if (!req.session.user) {
            req.session.user = {
                id: 'dev-user',
                name: 'Developer',
                email: 'dev@example.com',
                roles: ['Admin']
            };
        }
        return next();
    }
    if (!req.session.user || !req.session.user.roles.includes('Admin')) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

// Authentication Routes

// Login route
app.post('/api/auth/login', async (req, res) => {
    try {
        console.log('Login attempt:', { email: req.body.email, hasPassword: !!req.body.password });
        
        const { email, password } = req.body;
        
        if (!email || !password) {
            console.log('Missing email or password');
            return res.status(400).json({ message: 'Email and password are required' });
        }
        
        // Find user by email (Firestore only)
        console.log('Searching for user with email:', email);
        const user = await firestoreData.getWorkerByEmail(email);
        if (!user || user.status !== 'active') {
            console.log('No active user found with email in Firestore:', email);
            return res.status(401).json({ message: 'Invalid email or password' });
        }
        console.log('Found user:', { id: user.id, name: user.name, email: user.email, hasPassword: !!user.password });
        
        // Check if user has a password set
        if (!user.password) {
            console.log('User has no password set');
            return res.status(401).json({ message: 'Account not activated. Please contact administrator.' });
        }
        
        // Compare password
        console.log('Comparing passwords...');
        const isValidPassword = await bcrypt.compare(password, user.password);
        console.log('Password comparison result:', isValidPassword);
        
        if (!isValidPassword) {
            console.log('Invalid password for user:', email);
            return res.status(401).json({ message: 'Invalid email or password' });
        }
        
        // Create session
        let roles = [];
        if (user.roles) {
            if (Array.isArray(user.roles)) {
                // Already an array
                roles = user.roles;
            } else if (typeof user.roles === 'string') {
                // Check if it's a JSON string or comma-separated string
                try {
                    roles = JSON.parse(user.roles);
                } catch (e) {
                    // It's a comma-separated string
                    roles = user.roles.split(',').map(role => role.trim());
                }
            }
        }
        
        req.session.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            roles: roles
        };
        
        console.log('Login successful for user:', email);
        res.json({
            message: 'Login successful',
            user: req.session.user
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Logout route
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ message: 'Failed to logout' });
        }
        // Ensure we clear the actual session cookie name configured above
        res.clearCookie('sessionId');
        res.json({ message: 'Logout successful' });
    });
});

// Change password route
app.post('/api/auth/change-password', requireAuth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.session.user.id;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Current password and new password are required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'New password must be at least 6 characters long' });
        }

        // Get current user from Firestore
        const user = await firestoreData.getWorkerById(userId);
        if (!user || user.status !== 'active') {
            return res.status(404).json({ message: 'User not found' });
        }

        // Verify current password
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }

        // Hash new password
        const saltRounds = 10;
        const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

        // Update password in Firestore
        await firestoreData.updateWorker(userId, { password: hashedNewPassword });

        res.json({ message: 'Password changed successfully' });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get current user
app.get('/api/auth/me', (req, res) => {
    if (process.env.RELAX_AUTH === 'true') {
        if (!req.session.user) {
            req.session.user = {
                id: 'dev-user',
                name: 'Developer',
                email: 'dev@example.com',
                roles: ['Admin']
            };
        }
        return res.json(req.session.user);
    }
    const currentUser = req.session.user || req.user;
    if (!currentUser) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    res.json(currentUser);
});

// Serve Google Maps API key (public endpoint, no auth required)
app.get('/api/config/maps-key', (req, res) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyDRxdtu-96ZkGt_bY5So4WBv7UHnJS4T-I'; // Fallback for development
    console.log('Serving Google Maps API key:', apiKey ? 'Key provided' : 'No key configured');
    res.json({
        apiKey: apiKey
    });
});



// Static file handlers (moved after API routes)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
if (process.env.SKIP_LISTEN === 'true') {
    console.log('SKIP_LISTEN=true; Express server initialized without binding to a port.');
} else {
    app.listen(PORT, HOST, () => {
        const displayHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
        console.log(`Server running on http://${displayHost}:${PORT}`);
    });
}

module.exports = app;
// Firebase Authentication token exchange: create server session from ID token
app.post('/api/auth/firebase', async (req, res) => {
    try {
        const { idToken } = req.body || {};
        if (!idToken) {
            return res.status(400).json({ message: 'Missing Firebase ID token' });
        }
        if (!firebaseInitialized) {
            return res.status(500).json({ message: 'Firebase not initialized' });
        }
        // Verify the ID token using Firebase Admin
        let decoded;
        try {
            decoded = await admin.auth().verifyIdToken(idToken);
        } catch (e) {
            return res.status(401).json({ message: 'Invalid Firebase token' });
        }

        const email = decoded.email;
        if (!email) {
            return res.status(400).json({ message: 'Email missing in Firebase token' });
        }

        // Find corresponding user in Firestore workers
        const user = await firestoreData.getWorkerByEmail(email);
        if (!user || user.status !== 'active') {
            return res.status(401).json({ message: 'User not found or inactive' });
        }

        // Create session
        req.session.user = {
            id: String(user.id),
            name: user.name,
            email: user.email,
            roles: Array.isArray(user.roles) ? user.roles : (typeof user.roles === 'string' ? user.roles.split(',').map(r => r.trim()) : []),
        };

        return res.json({ message: 'Login successful', user: req.session.user });
    } catch (error) {
        console.error('Firebase auth exchange error:', error);
        res.status(500).json({ message: 'Failed to authenticate with Firebase' });
    }
});

// Developer aid: generate a password reset link via Firebase Admin
// This endpoint is intended for development/testing. It requires either:
// - An authenticated Admin user (session roles includes 'Admin'); or
// - The environment variable ALLOW_PUBLIC_RESET_LINK set to 'true'.
app.post('/api/auth/generate-reset-link', async (req, res) => {
    try {
        const email = (req.body && req.body.email) ? String(req.body.email).trim() : '';
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }
        if (!firebaseInitialized) {
            return res.status(500).json({ message: 'Firebase not initialized' });
        }

        const allowPublic = process.env.ALLOW_PUBLIC_RESET_LINK === 'true';
        const user = req.session && req.session.user ? req.session.user : req.user;
        const isAdmin = user && Array.isArray(user.roles) && user.roles.includes('Admin');
        if (!allowPublic && !isAdmin) {
            return res.status(403).json({ message: 'Forbidden: Admin required' });
        }

        // Optionally specify continue URL for the reset flow
        const actionCodeSettings = {};
        if (process.env.RESET_CONTINUE_URL) {
            actionCodeSettings.url = process.env.RESET_CONTINUE_URL;
        }

        let link;
        try {
            link = await admin.auth().generatePasswordResetLink(email, actionCodeSettings);
        } catch (e) {
            console.error('Error generating password reset link:', e);
            return res.status(500).json({ message: 'Failed to generate reset link' });
        }

        return res.json({ link });
    } catch (error) {
        console.error('Generate reset link error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
