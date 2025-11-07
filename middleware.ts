import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT, getTokenFromHeader } from '@/lib/jwt';
import { checkRateLimit, rateLimitConfigs } from '@/lib/rate-limit';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Apply rate limiting to API routes
  if (pathname.startsWith('/api/')) {
    // Determine rate limit config based on endpoint
    let rateLimitConfig = rateLimitConfigs.api;

    if (pathname.startsWith('/api/auth/')) {
      rateLimitConfig = rateLimitConfigs.auth;
    } else if (pathname.startsWith('/api/integrations/')) {
      rateLimitConfig = rateLimitConfigs.external;
    } else if (request.method === 'GET') {
      rateLimitConfig = rateLimitConfigs.read;
    }

    // Check rate limit
    const rateLimitResult = checkRateLimit(request, rateLimitConfig);

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: rateLimitConfig.message || 'Too many requests',
          retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(rateLimitResult.reset).toISOString(),
            'Retry-After': Math.ceil((rateLimitResult.reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }
  }

  // Allow public routes (auth endpoints, static files, Next.js internals)
  const publicRoutes = [
    '/api/auth/login',
    '/api/auth/register',
    '/login',
    '/_next',
    '/favicon.ico',
  ];

  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Check for API routes that need authentication
  if (pathname.startsWith('/api/')) {
    const authHeader = request.headers.get('authorization');
    const token = getTokenFromHeader(authHeader);

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const payload = await verifyJWT(token);

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Add user ID to request headers for use in API routes
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', payload.userId.toString());

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // For non-API routes, we'll handle auth redirect in the layout component
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
