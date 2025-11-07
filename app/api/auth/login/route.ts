import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { z } from 'zod';
import { verifyPassword, createJWT } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { errors, handleApiError } from '@/lib/api-error-handler';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export async function POST(request: NextRequest) {
  const context = { method: 'POST', path: '/api/auth/login' };

  try {
    logger.apiRequest(context.method, context.path);

    const body = await request.json();

    // Validate input
    const { email, password } = loginSchema.parse(body);

    // Find user by email
    logger.dbQuery('SELECT user by email', [email]);
    const result = await sql`
      SELECT id, email, password_hash, name
      FROM users
      WHERE email = ${email}
    `;

    if (result.rows.length === 0) {
      logger.warn('Login attempt with invalid email', { email });
      throw errors.unauthorized('Invalid email or password');
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password_hash);

    if (!isValidPassword) {
      logger.warn('Login attempt with invalid password', { email });
      throw errors.unauthorized('Invalid email or password');
    }

    // Create JWT token
    const token = await createJWT(user.id);

    logger.info('User logged in successfully', { userId: user.id, email: user.email });

    const response = NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });

    logger.apiResponse(context.method, context.path, 200);
    return response;
  } catch (error) {
    return handleApiError(error, context);
  }
}
