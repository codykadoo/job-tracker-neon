const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_jaIQ8nbrg9tJ@ep-autumn-sun-aewww56g-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
    ssl: {
        rejectUnauthorized: false
    }
});

async function createAdminUser() {
    try {
        // Check if any users exist
        const userCount = await pool.query('SELECT COUNT(*) FROM workers');
        console.log(`Found ${userCount.rows[0].count} users in database`);
        
        if (parseInt(userCount.rows[0].count) === 0) {
            console.log('No users found, creating default admin user...');
            const defaultPassword = 'admin123';
            const hashedPassword = await bcrypt.hash(defaultPassword, 10);
            
            await pool.query(`
                INSERT INTO workers (name, email, password, roles, status)
                VALUES ($1, $2, $3, $4, $5)
            `, ['Admin User', 'admin@company.com', hashedPassword, JSON.stringify(['Admin']), 'active']);
            
            console.log('Default admin user created successfully!');
            console.log('Email: admin@company.com');
            console.log('Password: admin123');
            console.log('Please change this password after first login!');
        } else {
            console.log('Users already exist in database');
            // Show existing users
            const users = await pool.query('SELECT id, name, email, roles FROM workers');
            console.log('Existing users:');
            users.rows.forEach(user => {
                console.log(`- ${user.name} (${user.email}) - Roles: ${JSON.stringify(user.roles)}`);
            });
        }
    } catch (error) {
        console.error('Error creating admin user:', error);
    } finally {
        await pool.end();
    }
}

createAdminUser();