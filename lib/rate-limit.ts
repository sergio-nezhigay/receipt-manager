/**
 * Rate limiting middleware for API routes
 * Prevents abuse by limiting requests per IP address
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from './logger';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting (use Redis in production for distributed systems)
const rateLimitStore = new Map<string, RateLimitEntry>();

export interface RateLimitOptions {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Maximum requests per window
  message?: string;      // Custom error message
  skipSuccessfulRequests?: boolean;  // Don't count successful requests
  skipFailedRequests?: boolean;      // Don't count failed requests
}

const DEFAULT_OPTIONS: RateLimitOptions = {
  windowMs: 60 * 1000,  // 1 minute
  maxRequests: 60,       // 60 requests per minute
  message: 'Too many requests, please try again later',
};

/**
 * Get client identifier (IP address)
 */
function getClientIdentifier(request: NextRequest): string {
  // Try to get real IP from headers (for proxies/load balancers)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to connection IP
  return request.ip || 'unknown';
}

/**
 * Check if request should be rate limited
 */
export function checkRateLimit(
  request: NextRequest,
  options: Partial<RateLimitOptions> = {}
): { allowed: boolean; limit: number; remaining: number; reset: number } {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const identifier = getClientIdentifier(request);
  const now = Date.now();

  // Get or create entry
  let entry = rateLimitStore.get(identifier);

  // Reset if window has passed
  if (!entry || now > entry.resetTime) {
    entry = {
      count: 0,
      resetTime: now + opts.windowMs,
    };
    rateLimitStore.set(identifier, entry);
  }

  // Increment request count
  entry.count++;

  // Calculate remaining requests
  const remaining = Math.max(0, opts.maxRequests - entry.count);
  const allowed = entry.count <= opts.maxRequests;

  // Log rate limit violations
  if (!allowed) {
    logger.warn('Rate limit exceeded', {
      identifier,
      count: entry.count,
      limit: opts.maxRequests,
      path: request.nextUrl.pathname,
    });
  }

  return {
    allowed,
    limit: opts.maxRequests,
    remaining,
    reset: entry.resetTime,
  };
}

/**
 * Middleware wrapper for rate limiting
 */
export function withRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>,
  options: Partial<RateLimitOptions> = {}
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const result = checkRateLimit(request, opts);

    // Add rate limit headers to response
    const headers = {
      'X-RateLimit-Limit': result.limit.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': new Date(result.reset).toISOString(),
    };

    // If rate limited, return error
    if (!result.allowed) {
      return NextResponse.json(
        {
          error: opts.message,
          retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            ...headers,
            'Retry-After': Math.ceil((result.reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // Execute handler
    const response = await handler(request);

    // Add rate limit headers to successful response
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  };
}

/**
 * Clean up expired entries (should be called periodically)
 */
export function cleanupRateLimitStore(): void {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    logger.debug('Cleaned up rate limit store', { cleanedCount });
  }
}

// Clean up every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupRateLimitStore, 5 * 60 * 1000);
}

/**
 * Different rate limit configurations for different endpoints
 */
export const rateLimitConfigs: Record<string, RateLimitOptions> = {
  // Strict limit for authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000,  // 15 minutes
    maxRequests: 5,             // 5 attempts per 15 minutes
    message: 'Too many authentication attempts, please try again later',
  },

  // Moderate limit for API endpoints
  api: {
    windowMs: 60 * 1000,        // 1 minute
    maxRequests: 60,            // 60 requests per minute
    message: 'Too many requests',
  },

  // Stricter limit for external API calls (PrivatBank, Checkbox)
  external: {
    windowMs: 60 * 1000,        // 1 minute
    maxRequests: 10,            // 10 requests per minute
    message: 'Too many requests to external service, please slow down',
  },

  // Lenient limit for read-only operations
  read: {
    windowMs: 60 * 1000,        // 1 minute
    maxRequests: 120,           // 120 requests per minute
    message: 'Too many requests',
  },
};
