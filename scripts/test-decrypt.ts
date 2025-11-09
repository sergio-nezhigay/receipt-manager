import { config } from 'dotenv';
import { resolve } from 'path';
import { sql } from '@vercel/postgres';
import { decrypt } from '@/lib/encryption';

config({ path: resolve(process.cwd(), '.env.local') });

async function testDecrypt() {
  try {
    console.log('ENCRYPTION_KEY length:', process.env.ENCRYPTION_KEY?.length);
    console.log('ENCRYPTION_KEY first 8 chars:', process.env.ENCRYPTION_KEY?.substring(0, 8));

    const result = await sql`
      SELECT id, name, pb_api_token_encrypted
      FROM companies
      WHERE id = 4
    `;

    const company = result.rows[0];
    console.log('\nCompany:', company.name);
    console.log('Encrypted token preview:', company.pb_api_token_encrypted?.substring(0, 60) + '...');

    console.log('\nAttempting decryption...');
    const decrypted = decrypt(company.pb_api_token_encrypted);
    console.log('Decryption successful!');
    console.log('Decrypted token length:', decrypted.length);
    console.log('Decrypted token preview:', decrypted.substring(0, 20) + '...');

  } catch (error: any) {
    console.error('\nDecryption failed!');
    console.error('Error:', error.message);
    console.error('Error code:', error.code);
    console.error('\nFull error:', error);
  } finally {
    await sql.end();
  }
}

testDecrypt();
