// src/app/api/docs/route.ts
import { withSwagger } from 'next-swagger-doc';
import { NextResponse } from 'next/server';

const swaggerHandler = withSwagger({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Pastel Network Inference Layer API',
      version: '1.0.0',
      description: 'API documentation for Pastel Network\'s decentralized inference layer',
      contact: {
        name: 'Pastel Network',
        url: 'https://pastel.network'
      },
    },
    servers: [
      {
        url: 'https://inference-api.pastel.network',
        description: 'Production server'
      },
      {
        url: 'http://localhost:3000',
        description: 'Development server'  
      }
    ],
    tags: [
      {
        name: 'Credit Packs',
        description: 'Credit pack management endpoints'
      },
      {
        name: 'Inference',
        description: 'Model inference endpoints'  
      },
      {
        name: 'Messages',
        description: 'Message system endpoints'
      },
      {
        name: 'Network',
        description: 'Network status and info endpoints'
      },
      {
        name: 'PastelID',
        description: 'PastelID management endpoints'
      },
      {
        name: 'Transactions',
        description: 'Transaction management endpoints'
      },
      {
        name: 'Wallet',
        description: 'Wallet management endpoints'
      }
    ],
    components: {
      securitySchemes: {
        pastelIDAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'PastelID',
          description: 'Enter your PastelID token (format: pastelID.timestamp.signature)'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'string',
              description: 'Error message describing what went wrong'
            },
            details: {
              type: 'object',
              description: 'Additional error details when available'
            }
          }
        },
        ValidationError: {
          type: 'object',
          required: ['error', 'details'],
          properties: {
            error: {
              type: 'string',
              enum: ['Validation failed']
            },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: {
                    type: 'string',
                    description: 'The field that failed validation'
                  },
                  message: {
                    type: 'string',
                    description: 'The validation error message'
                  }
                }
              }
            }
          }
        },
        // Common response components
        SuccessResponse: {
          type: 'object',
          required: ['success'],
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              description: 'Success message when applicable'
            }
          }
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication information is missing or invalid',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: 'Missing or invalid authentication token'
              }
            }
          }
        },
        ValidationError: {
          description: 'Invalid input parameters',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ValidationError'
              }
            }
          }
        },
        InternalError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: 'Internal server error'
              }
            }
          }
        }
      }
    },
    security: [
      {
        pastelIDAuth: []
      }
    ]
  },
  apiFolder: 'src/app/api',
  scanPatterns: [
    'credit-packs/**/*.ts',
    'inference/**/*.ts',
    'messages/**/*.ts', 
    'network/**/*.ts',
    'pastelid/**/*.ts',
    'transactions/**/*.ts',
    'wallet/**/*.ts'
  ]
});

// App Router compatible handler
export async function GET(request: Request) {
  // Create a mock object that has the properties the swagger handler expects
  const mockReq = {
    method: request.method,
    headers: Object.fromEntries(request.headers),
    query: Object.fromEntries(new URL(request.url).searchParams),
    url: request.url
  };
  
  const responseData = await new Promise<Record<string, unknown>>((resolve) => {
    const mockRes = {
      setHeader: () => mockRes,
      status: () => mockRes,
      json: (data: Record<string, unknown>) => {
        resolve(data);
        return mockRes;
      },
      send: (data: Record<string, unknown>) => {
        resolve(data);
        return mockRes;
      },
      end: () => {
        resolve({});
        return mockRes;
      }
    };
    
    // @ts-expect-error - we're adapting between different API styles
    swaggerHandler()(mockReq, mockRes);
  });
  
  return NextResponse.json(responseData);
}