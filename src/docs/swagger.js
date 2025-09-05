import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'АСОУ ПД Пульс API',
      version: '1.0.0',
      description:
        'REST API for the АСОУ ПД Пульс application providing user management and authentication.\n\nError contract: most failures return { error: <code> }. Validation errors return { error: "validation_error", details: [{ field, code }] }.',
      contact: {
        email: 'support@example.com',
      },
      license: {
        name: 'MIT',
      },
    },
    servers: [
      {
        url: process.env.BASE_URL || 'http://localhost:3000',
        description: process.env.BASE_URL
          ? 'Production server'
          : 'Local server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      responses: {
        RateLimited: {
          description:
            'Too Many Requests (rate limit exceeded — may be enforced by API or upstream DDoS protection)',
          headers: {
            'Retry-After': {
              description: 'Seconds to wait before retrying (advisory)',
              schema: { type: 'integer', minimum: 1 },
            },
          },
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              examples: {
                default: { value: { error: 'rate_limited' } },
              },
            },
          },
        },
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string', description: 'Error code' },
          },
          required: ['error'],
        },
        ValidationErrorDetail: {
          type: 'object',
          properties: {
            field: { type: 'string' },
            code: { type: 'string' },
          },
          required: ['field', 'code'],
        },
        ValidationErrorResponse: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              enum: ['validation_error'],
              description: 'Validation error code',
            },
            details: {
              type: 'array',
              items: { $ref: '#/components/schemas/ValidationErrorDetail' },
            },
          },
          required: ['error', 'details'],
        },
      },
    },
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
