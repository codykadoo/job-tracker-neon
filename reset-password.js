const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_jaIQ8nbrg9tJ@ep-autumn-sun-aewww56g-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
    ssl: {
        rejectUnauthorized: false
    }
});

async function resetAdminPassword() {
    try {
        const email = 'kd0owk@gmail.com';
        const newPassword = 'admin123';
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        const result = await pool.query(`
            UPDATE workers 
            SET password = $1 
            WHERE email = $2
        `, [hashedPassword, email]);
        
        if (result.rowCount > 0) {
            console.log(`Password reset successfully for ${email}`);
            console.log(`New password: ${newPassword}`);
        } else {
            console.log(`User with email ${email} not found`);
        }
    } catch (error) {
        console.error('Error resetting password:', error);
    } finally {
        await pool.end();
    }
}

resetAdminPassword();