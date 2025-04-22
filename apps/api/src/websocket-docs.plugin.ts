import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

/**
 * A custom plugin that enhances Swagger documentation with WebSocket endpoint details.
 * This plugin adds a custom section to the Swagger UI that displays WebSocket events.
 *
 * In production, the documentation can be disabled for security.
 */
export function setupWebSocketDocs(app: INestApplication, path: string) {
  // Check if we should disable docs in production
  const environment = process.env.NODE_ENV || 'development';
  const enableDocsInProduction = process.env.ENABLE_SWAGGER_DOCS === 'true';

  // If we're in production and docs are not explicitly enabled, skip Swagger setup
  if (environment === 'production' && !enableDocsInProduction) {
    console.log('📚 API Documentation disabled in production environment');
    return;
  }

  const API_VERSION = 'v1';

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
    .addBearerAuth()
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
    },
    useGlobalPrefix: true,
    jsonDocumentUrl: `${path}/json`,
    yamlDocumentUrl: `${path}/yaml`,
  };

  // Update the Swagger UI with our custom document and options
  SwaggerModule.setup(path, app, document, customOptions);
}
