const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_jaIQ8nbrg9tJ@ep-autumn-sun-aewww56g-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
    ssl: {
        rejectUnauthorized: false
    }
});

async function fixUserStatus() {
    try {
        const email = 'kd0owk@gmail.com';
        
        // Update user status to 'active'
        const result = await pool.query(
            'UPDATE workers SET status = $1 WHERE email = $2 RETURNING id, name, email, status, roles',
            ['active', email]
        );
        
        if (result.rows.length === 0) {
            console.log(`❌ User with email ${email} not found`);
        } else {
            const user = result.rows[0];
            console.log('✅ User status updated successfully:');
            console.log(`ID: ${user.id}`);
            console.log(`Name: ${user.name}`);
            console.log(`Email: ${user.email}`);
            console.log(`Status: ${user.status}`);
            console.log(`Roles: ${JSON.stringify(user.roles)}`);
        }
    } catch (error) {
        console.error('Error updating user status:', error);
    } finally {
        await pool.end();
    }
}

fixUserStatus();