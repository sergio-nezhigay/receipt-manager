import { NextResponse } from 'next/server';

export async function GET() {
  const key = process.env.ENCRYPTION_KEY;

  return NextResponse.json({
    exists: !!key,
    length: key?.length || 0,
    firstChars: key?.substring(0, 8) || 'N/A',
    lastChars: key?.substring(key.length - 8) || 'N/A',
    hasQuotes: key?.startsWith('"') || key?.endsWith('"'),
  });
}
