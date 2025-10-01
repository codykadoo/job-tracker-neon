const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function resetPassword() {
  try {
    const email = 'kd0owk@gmail.com';
    const newPassword = 'password123'; // Simple password for testing
    
    console.log(`Resetting password for ${email}...`);
    
    // Hash the new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    console.log('New password hash generated');
    
    // Update the password in the database
    const result = await pool.query(
      'UPDATE workers SET password = $1 WHERE email = $2',
      [hashedPassword, email]
    );
    
    if (result.rowCount > 0) {
      console.log('✅ Password updated successfully!');
      console.log(`You can now login with:`);
      console.log(`Email: ${email}`);
      console.log(`Password: ${newPassword}`);
    } else {
      console.log('❌ No user found with that email');
    }
    
  } catch (error) {
    console.error('Error resetting password:', error);
  } finally {
    await pool.end();
  }
}

resetPassword();