/**
 * Centralized API error handling utility
 * Provides consistent error responses and logging
 */

import { NextResponse } from 'next/server';
import { logger } from './logger';
import { ZodError } from 'zod';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ErrorResponse {
  error: string;
  details?: any;
  timestamp: string;
}

export function handleApiError(
  error: unknown,
  context: { method: string; path: string }
): NextResponse<ErrorResponse> {
  const timestamp = new Date().toISOString();

  // Handle known ApiError
  if (error instanceof ApiError) {
    logger.apiError(context.method, context.path, error, {
      statusCode: error.statusCode,
      details: error.details,
    });

    return NextResponse.json(
      {
        error: error.message,
        details: error.details,
        timestamp,
      },
      { status: error.statusCode }
    );
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const validationErrors = error.issues.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    }));

    logger.apiError(context.method, context.path, error, {
      validationErrors,
    });

    return NextResponse.json(
      {
        error: 'Validation error',
        details: validationErrors,
        timestamp,
      },
      { status: 400 }
    );
  }

  // Handle generic errors
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';

  logger.apiError(context.method, context.path, error);

  // Don't expose internal error details in production
  const isProduction = process.env.NODE_ENV === 'production';

  return NextResponse.json(
    {
      error: isProduction ? 'Internal server error' : errorMessage,
      details: isProduction ? undefined : (error instanceof Error ? error.stack : undefined),
      timestamp,
    },
    { status: 500 }
  );
}

/**
 * Wrapper for API route handlers with automatic error handling and logging
 */
export function withErrorHandling<T>(
  handler: (req: Request, context?: any) => Promise<NextResponse<T>>,
  routeInfo: { method: string; path: string }
) {
  return async (req: Request, context?: any): Promise<NextResponse> => {
    const startTime = Date.now();

    try {
      logger.apiRequest(routeInfo.method, routeInfo.path, {
        url: req.url,
      });

      const response = await handler(req, context);

      const duration = Date.now() - startTime;
      logger.apiResponse(routeInfo.method, routeInfo.path, response.status, duration);

      return response;
    } catch (error) {
      return handleApiError(error, routeInfo);
    }
  };
}

/**
 * Common error factories
 */
export const errors = {
  notFound: (resource: string) =>
    new ApiError(404, `${resource} not found`),

  unauthorized: (message = 'Unauthorized') =>
    new ApiError(401, message),

  forbidden: (message = 'Forbidden') =>
    new ApiError(403, message),

  badRequest: (message: string, details?: any) =>
    new ApiError(400, message, details),

  conflict: (message: string) =>
    new ApiError(409, message),

  internalError: (message = 'Internal server error') =>
    new ApiError(500, message),

  serviceUnavailable: (service: string) =>
    new ApiError(503, `${service} is unavailable`),
};
