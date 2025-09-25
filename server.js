const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const bcrypt = require('bcrypt');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8001;

// Check if running on Vercel (serverless)
const isVercel = process.env.VERCEL || process.env.NOW_REGION;

// Database connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_jaIQ8nbrg9tJ@ep-autumn-sun-aewww56g-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
    ssl: {
        rejectUnauthorized: false
    },
    // Optimize for serverless
    max: isVercel ? 1 : 10, // Limit connections in serverless environment
    idleTimeoutMillis: isVercel ? 1000 : 30000, // Shorter idle timeout for serverless
    connectionTimeoutMillis: 10000
});

// Session configuration
app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'user_sessions',
        createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET || 'your-super-secret-key-change-this-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production' || isVercel, // Enable secure cookies on Vercel/production
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax' // Important for cross-origin requests on Vercel
    },
    name: 'sessionId', // Custom session name
    proxy: true // Trust proxy headers (important for Vercel)
}));

// Configure multer for file uploads - Vercel compatible

let storage;
if (isVercel) {
    // Use memory storage for Vercel (serverless)
    storage = multer.memoryStorage();
} else {
    // Use disk storage for local development
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    storage = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, 'uploads/');
        },
        filename: function (req, file, cb) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
        }
    });
}

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
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
    origin: isVercel ? ['https://kennysinger.com', 'https://www.kennysinger.com'] : true, // Specific origins for production, allow all for development
    credentials: true // Enable credentials (cookies, authorization headers, TLS client certificates)
}));
app.use(express.json());

// Add cache-busting headers for API responses
app.use('/api', (req, res, next) => {
    res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    next();
});

app.use(express.static('.'));
// Serve uploaded files (not needed on Vercel)
if (!isVercel) {
    app.use('/uploads', express.static('uploads')); // Serve uploaded files
}

// Database initialization and API routes will use the pool defined above

// Initialize database tables
async function initializeDatabase() {
    try {
        // Create workers table first (since jobs references it)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS workers (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                phone VARCHAR(20),
                roles JSONB DEFAULT '["Apprentice"]',
                password VARCHAR(255),
                status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Add password column to existing workers table if it doesn't exist
        await pool.query(`
            ALTER TABLE workers 
            ADD COLUMN IF NOT EXISTS password VARCHAR(255)
        `);

        // Add roles column and migrate existing role data
        await pool.query(`
            ALTER TABLE workers 
            ADD COLUMN IF NOT EXISTS roles JSONB DEFAULT '["Apprentice"]'
        `);

        // Migrate existing single role to roles array (check if role column exists first)
        const roleColumnExists = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'workers' AND column_name = 'role'
        `);
        
        if (roleColumnExists.rows.length > 0) {
            await pool.query(`
                UPDATE workers 
                SET roles = CASE 
                    WHEN role IS NOT NULL THEN jsonb_build_array(role)
                    ELSE '["Apprentice"]'
                END
                WHERE roles IS NULL OR roles = 'null'::jsonb OR jsonb_typeof(roles) = 'null'
            `);
        } else {
            // If role column doesn't exist, just ensure roles has default values
            await pool.query(`
                UPDATE workers 
                SET roles = '["Apprentice"]'
                WHERE roles IS NULL OR roles = 'null'::jsonb OR jsonb_typeof(roles) = 'null'
            `);
        }

        // Remove old role column constraints and column
        await pool.query(`
            ALTER TABLE workers 
            DROP CONSTRAINT IF EXISTS workers_role_check
        `);
        
        await pool.query(`
            ALTER TABLE workers 
            DROP COLUMN IF EXISTS role
        `);

        // Fix existing workers with NULL status - set to 'active'
        await pool.query(`
            UPDATE workers 
            SET status = 'active' 
            WHERE status IS NULL
        `);

        // Create jobs table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS jobs (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                job_type VARCHAR(100) NOT NULL,
                location_lat DECIMAL(10, 8) NOT NULL,
                location_lng DECIMAL(11, 8) NOT NULL,
                location_address TEXT,
                status VARCHAR(50) DEFAULT 'pending',
                contact_name VARCHAR(255),
                contact_phone VARCHAR(20),
                assigned_worker_id INTEGER REFERENCES workers(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Add contact fields to existing jobs table if they don't exist
        await pool.query(`
            ALTER TABLE jobs 
            ADD COLUMN IF NOT EXISTS contact_name VARCHAR(255)
        `);

        await pool.query(`
            ALTER TABLE jobs 
            ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20)
        `);

        // Remove marker_color column if it exists
        await pool.query(`
            ALTER TABLE jobs 
            DROP COLUMN IF EXISTS marker_color
        `);

        // Add assigned_worker_id column to existing jobs table if it doesn't exist
        await pool.query(`
            ALTER TABLE jobs 
            ADD COLUMN IF NOT EXISTS assigned_worker_id INTEGER REFERENCES workers(id) ON DELETE SET NULL
        `);

        // Create job_annotations table for polygons, pins, and lines
        await pool.query(`
            CREATE TABLE IF NOT EXISTS job_annotations (
                id SERIAL PRIMARY KEY,
                job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
                annotation_type VARCHAR(20) NOT NULL CHECK (annotation_type IN ('polygon', 'pin', 'line')),
                name VARCHAR(255),
                description TEXT,
                coordinates JSONB NOT NULL,
                style_options JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create equipment table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS equipment (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                equipment_type VARCHAR(50) NOT NULL CHECK (equipment_type IN ('skidsteer', 'excavator', 'backhoe', 'truck', 'vac_truck', 'trailer', 'attachment', 'small_engine', 'other')),
                make VARCHAR(100),
                model VARCHAR(100),
                year INTEGER,
                serial_number VARCHAR(100),
                license_plate VARCHAR(20),
                location_lat DECIMAL(10, 8),
                location_lng DECIMAL(11, 8),
                location_address TEXT,
                job_location_lat DECIMAL(10, 8),
                job_location_lng DECIMAL(11, 8),
                job_location_address TEXT,
                assigned_job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
                status VARCHAR(50) DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'maintenance', 'out_of_service')),
                assigned_worker_id INTEGER REFERENCES workers(id) ON DELETE SET NULL,
                last_maintenance_date DATE,
                next_maintenance_date DATE,
                maintenance_notes TEXT,
                purchase_date DATE,
                purchase_price DECIMAL(10, 2),
                current_value DECIMAL(10, 2),
                fuel_type VARCHAR(50),
                hours_used INTEGER DEFAULT 0,
                mileage INTEGER DEFAULT 0,
                photos JSONB DEFAULT '[]',
                documents JSONB DEFAULT '[]',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Add vac_truck to equipment_type constraint if not already present
        await pool.query(`
            ALTER TABLE equipment 
            DROP CONSTRAINT IF EXISTS equipment_equipment_type_check
        `);
        
        await pool.query(`
            ALTER TABLE equipment 
            ADD CONSTRAINT equipment_equipment_type_check 
            CHECK (equipment_type IN ('skidsteer', 'excavator', 'backhoe', 'truck', 'vac_truck', 'trailer', 'attachment', 'small_engine', 'other'))
        `);

        // Add photos and documents columns if they don't exist
        await pool.query(`
            ALTER TABLE equipment 
            ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'
        `);

        await pool.query(`
            ALTER TABLE equipment 
            ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'
        `);

        // Add job location columns if they don't exist
        await pool.query(`
            ALTER TABLE equipment 
            ADD COLUMN IF NOT EXISTS job_location_lat DECIMAL(10, 8)
        `);

        await pool.query(`
            ALTER TABLE equipment 
            ADD COLUMN IF NOT EXISTS job_location_lng DECIMAL(11, 8)
        `);

        await pool.query(`
            ALTER TABLE equipment 
            ADD COLUMN IF NOT EXISTS job_location_address TEXT
        `);

        await pool.query(`
            ALTER TABLE equipment 
            ADD COLUMN IF NOT EXISTS assigned_job_id INTEGER
        `);

        // Add foreign key constraint for assigned_job_id if it doesn't exist
        try {
            await pool.query(`
                ALTER TABLE equipment 
                ADD CONSTRAINT fk_equipment_job 
                FOREIGN KEY (assigned_job_id) REFERENCES jobs(id) ON DELETE SET NULL
            `);
        } catch (error) {
            // Constraint might already exist, ignore error
            console.log('Job foreign key constraint already exists or jobs table not ready yet');
        }

        // Create equipment_maintenance_requests table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS equipment_maintenance_requests (
                id SERIAL PRIMARY KEY,
                equipment_id INTEGER REFERENCES equipment(id) ON DELETE CASCADE,
                request_type VARCHAR(50) NOT NULL CHECK (request_type IN ('repair', 'maintenance', 'inspection')),
                priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
                title VARCHAR(255) NOT NULL,
                description TEXT,
                requested_by_worker_id INTEGER REFERENCES workers(id) ON DELETE SET NULL,
                assigned_to_worker_id INTEGER REFERENCES workers(id) ON DELETE SET NULL,
                status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'assigned', 'in_progress', 'on_hold', 'completed', 'cancelled')),
                estimated_cost DECIMAL(10, 2),
                actual_cost DECIMAL(10, 2),
                estimated_hours INTEGER,
                actual_hours INTEGER,
                parts_needed TEXT,
                due_date DATE,
                completed_date DATE,
                approved_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Add timestamp columns to existing equipment_maintenance_requests table if they don't exist
        await pool.query(`
            ALTER TABLE equipment_maintenance_requests 
            ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP
        `);
        
        await pool.query(`
            ALTER TABLE equipment_maintenance_requests 
            ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP
        `);
        
        await pool.query(`
            ALTER TABLE equipment_maintenance_requests 
            ADD COLUMN IF NOT EXISTS started_at TIMESTAMP
        `);
        
        await pool.query(`
            ALTER TABLE equipment_maintenance_requests 
            ADD COLUMN IF NOT EXISTS hold_at TIMESTAMP
        `);
        
        await pool.query(`
            ALTER TABLE equipment_maintenance_requests 
            ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP
        `);
        
        await pool.query(`
            ALTER TABLE equipment_maintenance_requests 
            ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMP
        `);
        
        await pool.query(`
            ALTER TABLE equipment_maintenance_requests 
            ADD COLUMN IF NOT EXISTS rejection_reason TEXT
        `);
        
        await pool.query(`
            ALTER TABLE equipment_maintenance_requests 
            ADD COLUMN IF NOT EXISTS hold_reason TEXT
        `);
        
        await pool.query(`
            ALTER TABLE equipment_maintenance_requests 
            ADD COLUMN IF NOT EXISTS cancellation_reason TEXT
        `);

        // Update status constraint to include all valid status values
        await pool.query(`
            ALTER TABLE equipment_maintenance_requests 
            DROP CONSTRAINT IF EXISTS equipment_maintenance_requests_status_check
        `);
        
        await pool.query(`
            ALTER TABLE equipment_maintenance_requests 
            ADD CONSTRAINT equipment_maintenance_requests_status_check 
            CHECK (status IN ('pending', 'approved', 'rejected', 'assigned', 'in_progress', 'on_hold', 'completed', 'cancelled'))
        `);

        // Check if any users exist, if not create a default admin user
        const userCount = await pool.query('SELECT COUNT(*) FROM workers');
        if (parseInt(userCount.rows[0].count) === 0) {
            console.log('No users found, creating default admin user...');
            const defaultPassword = 'admin123';
            const hashedPassword = await bcrypt.hash(defaultPassword, 10);
            
            await pool.query(`
                INSERT INTO workers (name, email, password, roles, status)
                VALUES ($1, $2, $3, $4, $5)
            `, ['Admin User', 'admin@company.com', hashedPassword, JSON.stringify(['Admin']), 'active']);
            
            console.log('Default admin user created:');
            console.log('Email: admin@company.com');
            console.log('Password: admin123');
            console.log('Please change this password after first login!');
        }

        console.log('Database tables initialized successfully');
    } catch (error) {
        console.error('Error initializing database:', error);
    }
}

// API Routes

// Get all jobs
app.get('/api/jobs', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM jobs ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching jobs:', error);
        res.status(500).json({ error: 'Failed to fetch jobs' });
    }
});

// Create a new job
app.post('/api/jobs', requireAuth, async (req, res) => {
    try {
        const { title, description, jobType, location, locationAddress, contactName, contactPhone, assignedWorkerId } = req.body;
        
        const result = await pool.query(
            `INSERT INTO jobs (title, description, job_type, location_lat, location_lng, location_address, contact_name, contact_phone, assigned_worker_id) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [title, description, jobType, location.lat, location.lng, locationAddress, contactName, contactPhone, assignedWorkerId || null]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating job:', error);
        res.status(500).json({ error: 'Failed to create job' });
    }
});

// Update a job
app.put('/api/jobs/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        // Build dynamic update query
        const updateFields = [];
        const values = [];
        let paramCount = 1;
        
        for (const [key, value] of Object.entries(updates)) {
            if (key === 'location') {
                updateFields.push(`location_lat = $${paramCount}`);
                values.push(value.lat);
                paramCount++;
                updateFields.push(`location_lng = $${paramCount}`);
                values.push(value.lng);
                paramCount++;
            } else if (key === 'jobType') {
                updateFields.push(`job_type = $${paramCount}`);
                values.push(value);
                paramCount++;
            } else if (key === 'locationAddress') {
                updateFields.push(`location_address = $${paramCount}`);
                values.push(value);
                paramCount++;
            } else if (key === 'contactName') {
                updateFields.push(`contact_name = $${paramCount}`);
                values.push(value);
                paramCount++;
            } else if (key === 'contactPhone') {
                updateFields.push(`contact_phone = $${paramCount}`);
                values.push(value);
                paramCount++;
            } else if (key === 'assignedWorkerId') {
                updateFields.push(`assigned_worker_id = $${paramCount}`);
                values.push(value);
                paramCount++;
            } else if (key !== 'updated_at') { // Skip updated_at if it's in the request body
                updateFields.push(`${key} = $${paramCount}`);
                values.push(value);
                paramCount++;
            }
        }
        
        // Always add updated_at at the end
        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(id);
        
        const query = `UPDATE jobs SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`;
        
        const result = await pool.query(query, values);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Job not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating job:', error);
        res.status(500).json({ error: 'Failed to update job' });
    }
});

// Delete a job
app.delete('/api/jobs/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query('DELETE FROM jobs WHERE id = $1 RETURNING *', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Job not found' });
        }
        
        res.json({ message: 'Job deleted successfully' });
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
        const result = await pool.query(
            'SELECT * FROM job_annotations WHERE job_id = $1 ORDER BY created_at ASC',
            [jobId]
        );
        res.json(result.rows);
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
        
        const result = await pool.query(
            `INSERT INTO job_annotations (job_id, annotation_type, name, description, coordinates, style_options) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [jobId, annotationType, name, description, JSON.stringify(coordinates), JSON.stringify(styleOptions || {})]
        );
        
        res.status(201).json(result.rows[0]);
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
        
        const result = await pool.query(
            `UPDATE job_annotations 
             SET name = $1, description = $2, coordinates = $3, style_options = $4, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $5 RETURNING *`,
            [name, description, JSON.stringify(coordinates), JSON.stringify(styleOptions || {}), id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Annotation not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating annotation:', error);
        res.status(500).json({ error: 'Failed to update annotation' });
    }
});

// Delete an annotation
app.delete('/api/annotations/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query('DELETE FROM job_annotations WHERE id = $1 RETURNING *', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Annotation not found' });
        }
        
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
        const result = await pool.query('SELECT id, name, email, phone, roles, status, created_at FROM workers ORDER BY created_at DESC');
        res.json(result.rows);
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
        
        // Ensure roles is an array, default to ['Apprentice']
        const workerRoles = Array.isArray(roles) ? roles : (roles ? [roles] : ['Apprentice']);
        
        // Hash password if provided
        let hashedPassword = null;
        if (password) {
            hashedPassword = await bcrypt.hash(password, 12);
        }
        
        const result = await pool.query(
            'INSERT INTO workers (name, email, phone, roles, status, password) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, phone, roles, status, created_at',
            [name, email, phone, JSON.stringify(workerRoles), status || 'active', hashedPassword]
        );
        
        // Return the created worker with the original password for display (if auto-generated)
        const responseData = { ...result.rows[0] };
        if (password && !req.body.password) {
            responseData.password = password; // Return original password for display only
        }
        
        res.status(201).json(responseData);
    } catch (error) {
        console.error('Error creating worker:', error);
        if (error.code === '23505') { // Unique constraint violation
            res.status(400).json({ error: 'Email already exists' });
        } else {
            res.status(500).json({ error: 'Failed to create worker' });
        }
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
        
        // Build dynamic query based on provided fields
        let updateFields = [];
        let values = [];
        let paramCount = 1;
        
        updateFields.push(`name = $${paramCount++}`);
        values.push(name);
        
        updateFields.push(`email = $${paramCount++}`);
        values.push(email);
        
        updateFields.push(`phone = $${paramCount++}`);
        values.push(phone);
        
        // Handle roles as array
        if (roles !== undefined) {
            const workerRoles = Array.isArray(roles) ? roles : (roles ? [roles] : ['Apprentice']);
            updateFields.push(`roles = $${paramCount++}`);
            values.push(JSON.stringify(workerRoles));
        }
        
        updateFields.push(`status = $${paramCount++}`);
        values.push(status);
        
        // Hash password if provided
        if (password !== undefined && password !== null && password !== '') {
            const hashedPassword = await bcrypt.hash(password, 12);
            updateFields.push(`password = $${paramCount++}`);
            values.push(hashedPassword);
        }
        
        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(id);
        
        const query = `UPDATE workers SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING id, name, email, phone, roles, status, created_at, updated_at`;
        
        const result = await pool.query(query, values);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Worker not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating worker:', error);
        if (error.code === '23505') { // Unique constraint violation
            res.status(400).json({ error: 'Email already exists' });
        } else {
            res.status(500).json({ error: 'Failed to update worker' });
        }
    }
});

// Get a single worker by ID
app.get('/api/workers/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT id, name, email, phone, roles, status, created_at FROM workers WHERE id = $1', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Worker not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching worker:', error);
        res.status(500).json({ error: 'Failed to fetch worker' });
    }
});

// Delete a worker
app.delete('/api/workers/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query('DELETE FROM workers WHERE id = $1 RETURNING *', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Worker not found' });
        }
        
        res.json({ message: 'Worker deleted successfully' });
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
        
        // Update the worker's password in the database
        const result = await pool.query(
            'UPDATE workers SET password = $1 WHERE id = $2 RETURNING id, name, email',
            [hashedPassword, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Worker not found' });
        }
        
        const worker = result.rows[0];
        
        res.json({ 
            message: `Password reset successfully for ${worker.name}`,
            temporaryPassword: temporaryPassword,
            workerId: worker.id,
            workerName: worker.name,
            workerEmail: worker.email
        });
    } catch (error) {
        console.error('Error resetting worker password:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

// Serve static files});

// Equipment API endpoints

// Get all equipment
app.get('/api/equipment', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT e.*, 
                   w.name as assigned_worker_name,
                   j.title as assigned_job_title,
                   j.location_address as assigned_job_location
            FROM equipment e 
            LEFT JOIN workers w ON e.assigned_worker_id = w.id 
            LEFT JOIN jobs j ON e.assigned_job_id = j.id
            ORDER BY e.created_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching equipment:', error);
        res.status(500).json({ error: 'Failed to fetch equipment' });
    }
});

// Get equipment by ID
app.get('/api/equipment/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            SELECT e.*, w.name as assigned_worker_name 
            FROM equipment e 
            LEFT JOIN workers w ON e.assigned_worker_id = w.id 
            WHERE e.id = $1
        `, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Equipment not found' });
        }
        
        res.json(result.rows[0]);
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

        const result = await pool.query(`
            INSERT INTO equipment (
                name, equipment_type, make, model, year, serial_number, license_plate,
                location_lat, location_lng, location_address, status, assigned_worker_id,
                last_maintenance_date, next_maintenance_date, maintenance_notes,
                purchase_date, purchase_price, current_value, fuel_type, hours_used, mileage,
                photos, documents
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
            RETURNING *
        `, [
            name, equipment_type, make, model, processNumericField(year), serial_number, license_plate,
            processNumericField(location_lat), processNumericField(location_lng), location_address, status, processNumericField(assigned_worker_id),
            last_maintenance_date || null, next_maintenance_date || null, maintenance_notes,
            purchase_date || null, processNumericField(purchase_price), processNumericField(current_value), fuel_type, processNumericField(hours_used), processNumericField(mileage),
            JSON.stringify(photos), JSON.stringify(documents)
        ]);

        res.status(201).json(result.rows[0]);
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
        
        // Process uploaded files if any
        if (req.files?.photos || req.files?.documents) {
            // Get existing files first
            const existingResult = await pool.query('SELECT photos, documents FROM equipment WHERE id = $1', [id]);
            if (existingResult.rows.length === 0) {
                return res.status(404).json({ error: 'Equipment not found' });
            }
            
            const existingPhotos = existingResult.rows[0].photos || [];
            const existingDocuments = existingResult.rows[0].documents || [];
            
            // Add new photos
            if (req.files?.photos) {
                const newPhotos = req.files.photos.map(file => ({
                    filename: file.filename,
                    originalname: file.originalname,
                    path: file.path,
                    size: file.size
                }));
                updateData.photos = JSON.stringify([...existingPhotos, ...newPhotos]);
            }
            
            // Add new documents
            if (req.files?.documents) {
                const newDocuments = req.files.documents.map(file => ({
                    filename: file.filename,
                    originalname: file.originalname,
                    path: file.path,
                    size: file.size
                }));
                updateData.documents = JSON.stringify([...existingDocuments, ...newDocuments]);
            }
        }
        
        const updateFields = [];
        const values = [];
        let paramCount = 1;
        
        for (const [key, value] of Object.entries(updateData)) {
            if (value !== undefined && key !== 'id') {
                updateFields.push(`${key} = $${paramCount}`);
                values.push(value);
                paramCount++;
            }
        }
        
        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        
        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(id);
        
        const query = `UPDATE equipment SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`;
        
        const result = await pool.query(query, values);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Equipment not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating equipment:', error);
        res.status(500).json({ error: 'Failed to update equipment' });
    }
});

// Delete equipment
app.delete('/api/equipment/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query('DELETE FROM equipment WHERE id = $1 RETURNING *', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Equipment not found' });
        }
        
        res.json({ message: 'Equipment deleted successfully' });
    } catch (error) {
        console.error('Error deleting equipment:', error);
        res.status(500).json({ error: 'Failed to delete equipment' });
    }
});

// Get all maintenance requests
app.get('/api/maintenance-requests', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT mr.*, 
                   e.name as equipment_name,
                   e.equipment_type as equipment_type,
                   rb.name as requested_by_name,
                   at.name as assigned_to_name
            FROM equipment_maintenance_requests mr
            JOIN equipment e ON mr.equipment_id = e.id
            LEFT JOIN workers rb ON mr.requested_by_worker_id = rb.id
            LEFT JOIN workers at ON mr.assigned_to_worker_id = at.id
            ORDER BY mr.created_at DESC
        `);
        
        res.json(result.rows);
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

        // Map 'type' from frontend to 'request_type' for database
        const result = await pool.query(`
            INSERT INTO equipment_maintenance_requests (
                equipment_id, request_type, priority, title, description,
                assigned_to_worker_id, estimated_cost, estimated_hours, 
                parts_needed, due_date, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
        `, [
            equipment_id, type, priority, title, description,  // 'type' maps to 'request_type'
            assigned_worker_id, estimated_cost, estimated_hours,
            parts_needed, due_date, status || 'pending'
        ]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating maintenance request:', error);
        res.status(500).json({ error: 'Failed to create maintenance request' });
    }
});

app.get('/api/equipment/:equipmentId/maintenance-requests', requireAuth, async (req, res) => {
    try {
        const { equipmentId } = req.params;
        const result = await pool.query(`
            SELECT mr.*, 
                   e.name as equipment_name,
                   rb.name as requested_by_name,
                   at.name as assigned_to_name
            FROM equipment_maintenance_requests mr
            JOIN equipment e ON mr.equipment_id = e.id
            LEFT JOIN workers rb ON mr.requested_by_worker_id = rb.id
            LEFT JOIN workers at ON mr.assigned_to_worker_id = at.id
            WHERE mr.equipment_id = $1
            ORDER BY mr.created_at DESC
        `, [equipmentId]);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching maintenance requests:', error);
        res.status(500).json({ error: 'Failed to fetch maintenance requests' });
    }
});

// Get maintenance history for equipment (new endpoint)
app.get('/api/equipment/:equipmentId/maintenance', requireAuth, async (req, res) => {
    try {
        const { equipmentId } = req.params;
        const result = await pool.query(`
            SELECT mr.*, 
                   e.name as equipment_name,
                   rb.name as requested_by_name,
                   at.name as assigned_to_name
            FROM equipment_maintenance_requests mr
            JOIN equipment e ON mr.equipment_id = e.id
            LEFT JOIN workers rb ON mr.requested_by_worker_id = rb.id
            LEFT JOIN workers at ON mr.assigned_to_worker_id = at.id
            WHERE mr.equipment_id = $1
            ORDER BY mr.created_at DESC
        `, [equipmentId]);
        
        // Transform data to match frontend expectations
        const maintenanceHistory = result.rows.map(row => ({
            id: row.id,
            type: row.request_type,
            title: row.title || `${row.request_type} Request`,
            description: row.description,
            status: row.status,
            priority: row.priority,
            assignedWorker: row.assigned_to_name || 'Unassigned',
            requestDate: row.created_at ? row.created_at.toISOString().split('T')[0] : null,
            completedDate: row.completed_date ? row.completed_date.toISOString().split('T')[0] : null,
            scheduledDate: row.due_date ? row.due_date.toISOString().split('T')[0] : null,
            cost: row.actual_cost || row.estimated_cost || 0,
            notes: row.description || ''
        }));
        
        res.json(maintenanceHistory);
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

        const result = await pool.query(`
            INSERT INTO equipment_maintenance_requests (
                equipment_id, request_type, priority, title, description,
                requested_by_worker_id, assigned_to_worker_id, estimated_cost,
                estimated_hours, parts_needed, due_date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
        `, [
            equipmentId, request_type, priority, title, description,
            requested_by_worker_id, assigned_to_worker_id, estimated_cost,
            estimated_hours, parts_needed, due_date
        ]);

        res.status(201).json(result.rows[0]);
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

        // Find worker ID by name
        let assignedWorkerId = null;
        if (assignedWorker) {
            const workerResult = await pool.query('SELECT id FROM workers WHERE name = $1', [assignedWorker]);
            if (workerResult.rows.length > 0) {
                assignedWorkerId = workerResult.rows[0].id;
            }
        }

        const result = await pool.query(`
            INSERT INTO equipment_maintenance_requests (
                equipment_id, request_type, priority, title, description,
                assigned_to_worker_id, estimated_cost, due_date, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
            RETURNING *
        `, [
            equipmentId, type, priority, title, description,
            assignedWorkerId, estimatedCost, scheduledDate
        ]);

        res.status(201).json(result.rows[0]);
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

        const result = await pool.query(`
            UPDATE equipment_maintenance_requests 
            SET status = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2 
            RETURNING *
        `, [status, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Maintenance request not found' });
        }

        res.json(result.rows[0]);
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

        const result = await pool.query(`
            UPDATE equipment_maintenance_requests 
            SET status = 'completed', 
                completed_date = CURRENT_DATE,
                description = CASE 
                    WHEN $1 IS NOT NULL AND $1 != '' THEN CONCAT(COALESCE(description, ''), '\n\nCompletion Notes: ', $1)
                    ELSE description 
                END,
                actual_cost = $2,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $3 
            RETURNING *
        `, [notes, cost, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Maintenance request not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error completing maintenance work:', error);
        res.status(500).json({ error: 'Failed to complete maintenance work' });
    }
});

// Update maintenance request (existing endpoint)
app.put('/api/maintenance-requests/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        
        const updateFields = [];
        const values = [];
        let paramCount = 1;
        
        for (const [key, value] of Object.entries(updateData)) {
            if (value !== undefined && key !== 'id') {
                updateFields.push(`${key} = $${paramCount}`);
                values.push(value);
                paramCount++;
            }
        }
        
        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        
        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(id);
        
        const query = `UPDATE equipment_maintenance_requests SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`;
        
        const result = await pool.query(query, values);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Maintenance request not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating maintenance request:', error);
        res.status(500).json({ error: 'Failed to update maintenance request' });
    }
});

// Delete maintenance request
app.delete('/api/maintenance-requests/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query('DELETE FROM equipment_maintenance_requests WHERE id = $1 RETURNING *', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Maintenance request not found' });
        }
        
        res.json({ message: 'Maintenance request deleted successfully', deletedRequest: result.rows[0] });
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
        
        // Check if maintenance request exists
        const requestCheck = await pool.query('SELECT id FROM equipment_maintenance_requests WHERE id = $1', [id]);
        if (requestCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Maintenance request not found' });
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
        const result = await pool.query(
            'SELECT * FROM equipment WHERE assigned_job_id = $1',
            [jobId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching job equipment:', error);
        res.status(500).json({ error: 'Failed to fetch job equipment' });
    }
});

app.post('/api/jobs/:jobId/equipment', requireAuth, async (req, res) => {
    try {
        const { jobId } = req.params;
        const { equipmentId } = req.body;
        
        // Update equipment to assign it to the job and set status to in_use
        await pool.query(
            'UPDATE equipment SET assigned_job_id = $1, status = $2 WHERE id = $3',
            [jobId, 'in_use', equipmentId]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error assigning equipment to job:', error);
        res.status(500).json({ error: 'Failed to assign equipment to job' });
    }
});

app.delete('/api/jobs/:jobId/equipment/:equipmentId', requireAuth, async (req, res) => {
    try {
        const { equipmentId } = req.params;
        
        // Remove equipment from job and set status back to available
        await pool.query(
            'UPDATE equipment SET assigned_job_id = NULL, status = $1, job_location_lat = NULL, job_location_lng = NULL, job_location_address = NULL WHERE id = $2',
            ['available', equipmentId]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error removing equipment from job:', error);
        res.status(500).json({ error: 'Failed to remove equipment from job' });
    }
});

app.put('/api/equipment/:equipmentId/job-location', requireAuth, async (req, res) => {
    try {
        const { equipmentId } = req.params;
        const { latitude, longitude } = req.body;
        
        if (!latitude || !longitude) {
            return res.status(400).json({ error: 'Latitude and longitude are required' });
        }
        
        await pool.query(
            'UPDATE equipment SET job_latitude = $1, job_longitude = $2 WHERE id = $3',
            [latitude, longitude, equipmentId]
        );
        
        res.json({ message: 'Equipment location updated successfully' });
    } catch (error) {
        console.error('Error updating equipment location:', error);
        res.status(500).json({ error: 'Failed to update equipment location' });
    }
});

// Authentication middleware
function requireAuth(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    next();
}

// Admin middleware
function requireAdmin(req, res, next) {
    if (!req.session.user || !req.session.user.roles.includes('Admin')) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

// Authentication Routes

// Login route
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }
        
        // Find user by email
        const result = await pool.query('SELECT * FROM workers WHERE email = $1 AND status = $2', [email, 'active']);
        
        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }
        
        const user = result.rows[0];
        
        // Check if user has a password set
        if (!user.password) {
            return res.status(401).json({ message: 'Account not activated. Please contact administrator.' });
        }
        
        // Compare password
        const isValidPassword = await bcrypt.compare(password, user.password);
        
        if (!isValidPassword) {
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
        res.clearCookie('connect.sid');
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

        // Get current user from database
        const userResult = await pool.query(
            'SELECT password FROM workers WHERE id = $1 AND status = $2',
            [userId, 'active']
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = userResult.rows[0];

        // Verify current password
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }

        // Hash new password
        const saltRounds = 10;
        const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

        // Update password in database
        await pool.query(
            'UPDATE workers SET password = $1 WHERE id = $2',
            [hashedNewPassword, userId]
        );

        res.json({ message: 'Password changed successfully' });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get current user
app.get('/api/auth/me', requireAuth, (req, res) => {
    res.json(req.session.user);
});

// Static file handlers (moved after API routes)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Handle static file requests
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

// Start server (only in non-serverless environments)
if (!isVercel) {
    app.listen(PORT, async () => {
        console.log(`Server running on http://localhost:${PORT}`);
        await initializeDatabase();
    });
} else {
    // Initialize database for serverless environment
    initializeDatabase().catch(console.error);
}

module.exports = app;