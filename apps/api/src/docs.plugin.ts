import { Request, Response, NextFunction } from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * A custom plugin that enhances Swagger documentation with WebSocket endpoint details.
 * This plugin adds a custom section to the Swagger UI that displays WebSocket events.
 *
 * In production, the documentation is secured with API key authentication.
 */
export function setupDocs(app: INestApplication, path: string) {
  const configService = app.get(ConfigService);
  // Check if we should disable docs in production
  const environment = process.env.NODE_ENV || 'development';
  const enableDocsInProduction = process.env.ENABLE_SWAGGER_DOCS === 'true';

  // If we're in production and docs are not explicitly enabled, skip Swagger setup
  if (environment === 'production' && !enableDocsInProduction) {
    console.log('📚 API Documentation disabled in production environment');
    return;
  }

  const API_VERSION = 'v1';
  const isProduction = environment === 'production';

  // Create the base document builder
  const options = new DocumentBuilder()
    .setTitle('Bitsacco API')
    .setDescription('endpoints for bitsacco api')
    .setVersion(API_VERSION)
    .setContact('Bitsacco', 'https://bitsacco.com', 'os@bitsacco.com')
    .setLicense(
      'MIT',
      'https://github.com/bitsacco/opensource/blob/main/LICENSE',
    )
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'Authorization',
      description: 'Enter JWT token',
      in: 'header',
    })
    .addApiKey({
      type: 'apiKey',
      name: 'x-api-key',
      in: 'header',
      description: 'API key for service authentication',
    })
    .addTag(
      'Notifications WebSocket',
      'Real-time notification WebSocket endpoints',
    )
    .build();

  // Create the document
  const document = SwaggerModule.createDocument(app, options);

  // Manually extend the document with our WebSocket endpoint documentation
  if (!document.paths) {
    document.paths = {};
  }

  // Create a connection section in the Swagger document
  document.paths['/notifications/websocket'] = {
    get: {
      tags: ['Notifications WebSocket'],
      summary: 'WebSocket Connection Endpoint',
      description: `
## WebSocket Connection

Connect to the WebSocket server at \`ws://your-api-server-host/v1/notifications/websocket\` with your JWT authentication token:

\`\`\`javascript
import { io } from 'socket.io-client';

const socket = io('ws://your-api-server/notifications', {
  auth: {
    token: 'your-jwt-token-here'
  }
});

// Listen for connection events
socket.on('connect', () => {
  console.log('Connected to notification service');
});

socket.on('disconnect', () => {
  console.log('Disconnected from notification service');
});
\`\`\`

## Server-Emitted Events

The server will emit these events to connected clients:

- \`connection:established\` - Emitted immediately after successful connection and authentication
- \`notification:created\` - A new notification has been created for the user
- \`notification:delivered\` - A notification has been delivered through a specific channel
- \`preferences:updated\` - The user's notification preferences have been updated
`,
      responses: {
        '101': {
          description: 'WebSocket connection established',
        },
      },
    },
  };

  // Make the Swagger UI include our custom WebSocket documentation
  const customOptions = {
    explorer: true,
    swaggerOptions: {
      docExpansion: 'list',
      operationsSorter: 'alpha',
      tagsSorter: 'alpha',
      plugins: [
        {
          statePlugins: {
            auth: {
              persistAuthorization: true,
            },
          },
        },
      ],
    },
    useGlobalPrefix: true,
    jsonDocumentUrl: `${path}/json`,
    yamlDocumentUrl: `${path}/yaml`,
    customCss: '.swagger-ui .topbar { display: none }',
  };

  // In production, add API key protection middleware to the Swagger UI
  if (isProduction) {
    const docsApiKey = configService.get('DOCS_API_KEY');

    if (!docsApiKey) {
      console.warn(
        '⚠️ DOCS_API_KEY not set in production - Swagger UI will not be available',
      );
      return;
    }

    // First set up middleware to check API key
    app.use(path, (req: Request, res: Response, next: NextFunction) => {
      // Check for API key in header
      const apiKey = req.headers['x-api-key'] as string;

      // Validate API key
      if (!apiKey || apiKey !== docsApiKey) {
        res.status(401).json({
          statusCode: 401,
          message: 'Unauthorized access to API documentation',
          error: 'Unauthorized',
        });
        return;
      }

      // Valid API key, proceed to Swagger UI
      next();
    });

    // Then setup Swagger UI without middleware in options
    SwaggerModule.setup(path, app, document, customOptions);

    console.log(
      '🔒 API Documentation secured with API key authentication in production',
    );
  } else {
    // Development setup without auth
    SwaggerModule.setup(path, app, document, customOptions);
    console.log(
      '📚 API Documentation available at /docs (no authentication in development)',
    );
  }
}
