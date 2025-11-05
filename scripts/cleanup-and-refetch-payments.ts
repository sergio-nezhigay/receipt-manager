import { sql } from '@vercel/postgres';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local explicitly
config({ path: resolve(process.cwd(), '.env.local') });

async function cleanupAndRefetch() {
  try {
    console.log('🧹 Cleaning up corrupted payments...\n');

    // Delete all existing payments
    const deleteResult = await sql`
      DELETE FROM payments
      RETURNING id
    `;

    console.log(`✅ Deleted ${deleteResult.rowCount} corrupted payment(s)`);

    // Also delete receipts (they reference the deleted payments)
    const deleteReceipts = await sql`
      DELETE FROM receipts
      RETURNING id
    `;

    console.log(`✅ Deleted ${deleteReceipts.rowCount} receipt(s)`);

    console.log('\n✅ Cleanup complete!');
    console.log('\n📥 Now you can re-fetch payments from PrivatBank:');
    console.log('   1. Go to your app (http://localhost:3000)');
    console.log('   2. Select your company');
    console.log('   3. Click "Отримати з PrivatBank" button');
    console.log('   4. Payments will be fetched with proper UTF-8 encoding');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

cleanupAndRefetch();
