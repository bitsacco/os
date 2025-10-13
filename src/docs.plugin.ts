import { Request, Response, NextFunction } from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * A custom plugin that enhances Swagger documentation with API versioning support.
 * In production, the documentation is secured with API key authentication.
 */
export function setupDocs(app: INestApplication, path: string) {
  // Check if we should disable docs in production
  const environment = process.env.NODE_ENV || 'development';
  const enableDocsInProduction = process.env.ENABLE_SWAGGER_DOCS === 'true';

  // If we're in production and docs are not explicitly enabled, skip Swagger setup
  if (environment === 'production' && !enableDocsInProduction) {
    console.log('📚 API Documentation disabled in production environment');
    return;
  }

  const configService = app.get(ConfigService);
  // const environment = process.env.NODE_ENV || 'development';
  const isProduction = environment === 'production';
  // const enableDocsInProduction = process.env.ENABLE_SWAGGER_DOCS === 'true';

  // If we're in production and docs are not explicitly enabled, skip Swagger setup
  if (isProduction && !enableDocsInProduction) {
    return;
  }

  // Create the base document builder with version-specific information
  const title = 'Bitsacco API';

  const description =
    'REST-compliant endpoints for Bitsacco API \n\n' +
    '**Note**: This version implements strict REST compliance with resource-based URLs.';

  const options = new DocumentBuilder()
    .setTitle(title)
    .setDescription(description)
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

  // Create the document with version filtering
  // This ensures only endpoints with the specified version are included
  const document = SwaggerModule.createDocument(app, options, {
    operationIdFactory: (controllerKey: string, methodKey: string) =>
      `${controllerKey}_${methodKey}`,
  });

  // Manually extend the document with our WebSocket endpoint documentation
  if (!document.paths) {
    document.paths = {};
  }

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
    customSiteTitle: `Bitsacco API Documentation`,
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
  }
}
