import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as api from '@/app/lib/api';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

// Extend NextRequest type to include our custom properties
declare module 'next/server' {
  interface NextRequest {
    pastelID?: string;
    validatedBody?: unknown;
  }
}

// Rate limiting configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
});

// PastelID Authentication middleware
export async function authenticatePastelID(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new NextResponse(
      JSON.stringify({ error: 'Missing or invalid authentication token' }),
      { status: 401 }
    );
  }

  const token = authHeader.split(' ')[1];
  try {
    // Verify PastelID signature
    const [pastelID, timestamp, signature] = token.split('.');
    const message = `${pastelID}:${timestamp}`;
    const isValid = await api.verifyMessageWithPastelID(pastelID, message, signature);

    if (!isValid) {
      return new NextResponse(
        JSON.stringify({ error: 'Invalid PastelID signature' }),
        { status: 401 }
      );
    }

    // Check timestamp to prevent replay attacks
    const signatureTime = parseInt(timestamp);
    const now = Date.now();
    if (now - signatureTime > 5 * 60 * 1000) { // 5 minutes expiry
      return new NextResponse(
        JSON.stringify({ error: 'Authentication token expired' }),
        { status: 401 }
      );
    }

    // Add PastelID to request context
    request.pastelID = pastelID;
    
    return null; // Indicate success
    
  } catch {
    return new NextResponse(
      JSON.stringify({ error: 'Authentication failed' }),
      { status: 401 }
    );
  }
}

// Error handling middleware
export function errorHandler(err: unknown) {
  console.error('API Error:', err);

  const error = err as Error;  // Type assertion for error handling

  // Specific error types
  if (error.name === 'ValidationError') {
    return new NextResponse(
      JSON.stringify({ 
        error: 'Validation failed',
        details: error.message
      }),
      { status: 400 }
    );
  }

  if (error.message.includes('not found')) {
    return new NextResponse(
      JSON.stringify({ error: error.message }),
      { status: 404 }
    );
  }

  if (error.message.includes('insufficient')) {
    return new NextResponse(
      JSON.stringify({ error: error.message }),
      { status: 402 }
    );
  }

  // Default error response
  return new NextResponse(
    JSON.stringify({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    }),
    { status: 500 }
  );
}

// Request validation middleware using zod
export function validateRequest(schema: z.ZodSchema) {
  return async (request: NextRequest) => {
    try {
      const body = await request.json();
      const result = schema.parse(body);
      request.validatedBody = result;
      return null; // Indicate success
    } catch (error) {
      if (error instanceof z.ZodError) {
        return new NextResponse(
          JSON.stringify({
            error: 'Validation failed',
            details: error.errors
          }),
          { status: 400 }
        );
      }
      return new NextResponse(
        JSON.stringify({
          error: 'Validation failed',
          details: 'Unknown validation error'
        }),
        { status: 400 }
      );
    }
  };
}

// Middleware configuration
export const config = {
  matcher: '/api/:path*',
};

// Main middleware function
export async function middleware(request: NextRequest) {
  // Apply rate limiting
  const response = await limiter(request);
  if (response) return response;

  // Skip authentication for specific routes
  const publicPaths = ['/api/docs', '/api/network/info'];
  if (!publicPaths.includes(request.nextUrl.pathname)) {
    // Apply authentication
    const authResponse = await authenticatePastelID(request);
    if (authResponse) return authResponse;
  }

  try {
    // Continue to route handler
    const response = await NextResponse.next();

    // Add security headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    
    return response;
  } catch (err) {
    return errorHandler(err);
  }
}