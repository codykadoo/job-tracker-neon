const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_jaIQ8nbrg9tJ@ep-autumn-sun-aewww56g-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
    ssl: {
        rejectUnauthorized: false
    }
});

async function checkUser() {
    try {
        const email = 'kd0owk@gmail.com';
        
        const result = await pool.query('SELECT id, name, email, status, roles, password FROM workers WHERE email = $1', [email]);
        
        if (result.rows.length === 0) {
            console.log(`❌ User with email ${email} not found`);
        } else {
            const user = result.rows[0];
            console.log('✅ User found:');
            console.log(`ID: ${user.id}`);
            console.log(`Name: ${user.name}`);
            console.log(`Email: ${user.email}`);
            console.log(`Status: ${user.status}`);
            console.log(`Roles: ${JSON.stringify(user.roles)}`);
            console.log(`Password hash exists: ${user.password ? 'YES' : 'NO'}`);
            console.log(`Password hash length: ${user.password ? user.password.length : 0}`);
            console.log(`Password starts with $2b$: ${user.password ? user.password.startsWith('$2b$') : 'N/A'}`);
        }
    } catch (error) {
        console.error('Error checking user:', error);
    } finally {
        await pool.end();
    }
}

checkUser();