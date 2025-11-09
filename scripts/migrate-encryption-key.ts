import { config } from 'dotenv';
import { resolve } from 'path';
import { sql } from '@vercel/postgres';
import { createDecipheriv, createCipheriv, randomBytes } from 'crypto';
import readline from 'readline';

config({ path: resolve(process.cwd(), '.env.local') });

const ALGORITHM = 'aes-256-cbc';

function decryptWithOldKey(encryptedText: string, oldKey: string): string {
  const [ivHex, encryptedData] = encryptedText.split(':');

  if (!ivHex || !encryptedData) {
    throw new Error('Invalid encrypted text format');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const key = Buffer.from(oldKey, 'utf8');
  const decipher = createDecipheriv(ALGORITHM, key, iv);

  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

function encryptWithNewKey(text: string, newKey: string): string {
  const iv = randomBytes(16);
  const key = Buffer.from(newKey, 'utf8');
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return `${iv.toString('hex')}:${encrypted}`;
}

async function migrateEncryptionKey(oldKey: string, newKey: string) {
  try {
    console.log('Starting encryption key migration...\n');

    // Fetch all companies with encrypted data
    const companiesResult = await sql`
      SELECT
        id,
        name,
        pb_api_token_encrypted,
        checkbox_license_key_encrypted,
        checkbox_cashier_pin_encrypted
      FROM companies
      WHERE pb_api_token_encrypted IS NOT NULL
         OR checkbox_license_key_encrypted IS NOT NULL
         OR checkbox_cashier_pin_encrypted IS NOT NULL
    `;

    console.log(`Found ${companiesResult.rows.length} companies with encrypted credentials\n`);

    let successCount = 0;
    let failureCount = 0;

    for (const company of companiesResult.rows) {
      console.log(`Processing company: ${company.name} (ID: ${company.id})`);

      try {
        // Decrypt and re-encrypt each field
        const newPbToken = company.pb_api_token_encrypted
          ? encryptWithNewKey(decryptWithOldKey(company.pb_api_token_encrypted, oldKey), newKey)
          : null;

        const newLicenseKey = company.checkbox_license_key_encrypted
          ? encryptWithNewKey(decryptWithOldKey(company.checkbox_license_key_encrypted, oldKey), newKey)
          : null;

        const newPin = company.checkbox_cashier_pin_encrypted
          ? encryptWithNewKey(decryptWithOldKey(company.checkbox_cashier_pin_encrypted, oldKey), newKey)
          : null;

        // Update the database
        await sql`
          UPDATE companies
          SET
            pb_api_token_encrypted = ${newPbToken},
            checkbox_license_key_encrypted = ${newLicenseKey},
            checkbox_cashier_pin_encrypted = ${newPin}
          WHERE id = ${company.id}
        `;

        console.log(`  ✓ Successfully migrated credentials for ${company.name}\n`);
        successCount++;

      } catch (error: any) {
        console.error(`  ✗ Failed to migrate ${company.name}:`, error.message);
        console.error(`    This may indicate the old key is incorrect\n`);
        failureCount++;
      }
    }

    console.log('\n=== Migration Summary ===');
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${failureCount}`);
    console.log(`Total: ${companiesResult.rows.length}`);

  } catch (error: any) {
    console.error('Migration failed:', error.message);
    throw error;
  } finally {
    await sql.end();
  }
}

// Interactive prompt
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log('=== Encryption Key Migration Tool ===\n');
  console.log('This script will re-encrypt all company credentials with a new encryption key.\n');

  const currentKey = process.env.ENCRYPTION_KEY;
  if (!currentKey || currentKey.length !== 32) {
    console.error('Error: ENCRYPTION_KEY not found or invalid in .env.local');
    process.exit(1);
  }

  console.log(`Current ENCRYPTION_KEY (first 8 chars): ${currentKey.substring(0, 8)}...\n`);

  const oldKey = await question('Enter the OLD encryption key (32 characters): ');

  if (oldKey.length !== 32) {
    console.error('Error: Old key must be exactly 32 characters');
    rl.close();
    process.exit(1);
  }

  const confirm = await question('\nThis will re-encrypt all credentials. Continue? (yes/no): ');

  if (confirm.toLowerCase() !== 'yes') {
    console.log('Migration cancelled');
    rl.close();
    process.exit(0);
  }

  rl.close();

  await migrateEncryptionKey(oldKey, currentKey);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
