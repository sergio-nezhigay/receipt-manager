import { sql } from '@vercel/postgres';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local explicitly
config({ path: resolve(process.cwd(), '.env.local') });

async function checkEncoding() {
  try {
    console.log('Checking database encoding...\n');

    // Check database encoding
    const dbEncoding = await sql`SHOW SERVER_ENCODING`;
    console.log('Database encoding:', dbEncoding.rows[0].server_encoding);

    // Check client encoding
    const clientEncoding = await sql`SHOW CLIENT_ENCODING`;
    console.log('Client encoding:', clientEncoding.rows[0].client_encoding);

    console.log('\n---\n');

    // Check a sample payment to see how the data looks
    const samplePayment = await sql`
      SELECT id, sender_name, description, payment_date
      FROM payments
      ORDER BY id DESC
      LIMIT 5
    `;

    console.log('Sample payments from database:\n');
    samplePayment.rows.forEach((payment, idx) => {
      console.log(`${idx + 1}. ID: ${payment.id}`);
      console.log(`   Sender: ${payment.sender_name}`);
      console.log(`   Description: ${payment.description}`);
      console.log(`   Raw bytes (sender_name):`, Buffer.from(payment.sender_name, 'utf-8').toString('hex').slice(0, 100));
      console.log('');
    });

    console.log('\n---\n');
    console.log('If you see corrupted characters above (����), the data was inserted with wrong encoding.');
    console.log('Solution: Re-fetch payments from PrivatBank to get fresh UTF-8 data.');
    console.log('\nIf characters look correct in this output but wrong in browser:');
    console.log('- Check browser encoding settings');
    console.log('- Verify HTML meta charset tag is present');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkEncoding();
