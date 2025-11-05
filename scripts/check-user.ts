import { sql } from '@vercel/postgres';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local explicitly
config({ path: resolve(process.cwd(), '.env.local') });

async function checkUser() {
  try {
    console.log('Checking users in database...\n');

    const result = await sql`
      SELECT id, email, name, created_at
      FROM users
      ORDER BY created_at DESC
    `;

    if (result.rows.length === 0) {
      console.log('❌ No users found in database');
      console.log('\nYou need to register a user first:');
      console.log('POST http://localhost:3000/api/auth/register');
      console.log('Body: { "email": "admin@test.com", "password": "test123", "name": "Admin" }');
    } else {
      console.log(`✅ Found ${result.rows.length} user(s):\n`);
      result.rows.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email}`);
        console.log(`   Name: ${user.name}`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Created: ${user.created_at}`);
        console.log('');
      });
    }

    console.log('\n✅ Check complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkUser();
