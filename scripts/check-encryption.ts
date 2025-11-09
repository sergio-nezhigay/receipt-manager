import { config } from 'dotenv';
import { resolve } from 'path';
import { sql } from '@vercel/postgres';

config({ path: resolve(process.cwd(), '.env.local') });

async function checkEncryption() {
  try {
    const result = await sql`
      SELECT id, name, pb_merchant_id, pb_api_token_encrypted
      FROM companies
      WHERE id = 4
    `;

    const company = result.rows[0];
    console.log('Company ID:', company.id);
    console.log('Company Name:', company.name);
    console.log('Merchant ID:', company.pb_merchant_id);
    console.log('Encrypted token preview:', company.pb_api_token_encrypted?.substring(0, 60) + '...');
    console.log('Has colon separator:', company.pb_api_token_encrypted?.includes(':') ? 'YES' : 'NO');
    console.log('Token length:', company.pb_api_token_encrypted?.length || 0);

    if (company.pb_api_token_encrypted?.includes(':')) {
      const parts = company.pb_api_token_encrypted.split(':');
      console.log('IV length:', parts[0]?.length || 0, '(should be 32 for hex representation of 16 bytes)');
      console.log('Encrypted data length:', parts[1]?.length || 0);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

checkEncryption();
