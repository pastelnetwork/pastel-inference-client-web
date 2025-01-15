// src/app/api/docs/route.ts
import { withSwagger } from 'next-swagger-doc';

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
        name: 'Authentication',
        description: 'Authentication and wallet connection endpoints'
      }
    ],
    components: {
      securitySchemes: {
        pastelIDAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'PastelID',
          description: 'Enter your Pastel ID token'
        }
      }
    },
    security: [
      {
        pastelIDAuth: []
      }
    ]
  },
  apiFolder: 'src/app/api'
});

export const GET = swaggerHandler();