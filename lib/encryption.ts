import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// Get encryption key from environment
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
  throw new Error('ENCRYPTION_KEY must be exactly 32 characters long');
}

const ALGORITHM = 'aes-256-cbc';
const KEY = Buffer.from(ENCRYPTION_KEY, 'utf8');

/**
 * Encrypts a string value
 * @param text - Plain text to encrypt
 * @returns Encrypted string in format: iv:encryptedData
 */
export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Return IV + encrypted data (separated by :)
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts an encrypted string
 * @param encryptedText - Encrypted string in format: iv:encryptedData
 * @returns Decrypted plain text
 */
export function decrypt(encryptedText: string): string {
  const [ivHex, encryptedData] = encryptedText.split(':');

  if (!ivHex || !encryptedData) {
    throw new Error('Invalid encrypted text format');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, KEY, iv);

  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
