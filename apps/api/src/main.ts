import { Logger } from 'nestjs-pino';
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpLoggingInterceptor, bootstrapTelemetry } from '@bitsacco/common';
import { ApiModule } from './api.module';
import { setupDocs } from './docs.plugin';

const API_VERSION = 'v1';

async function bootstrap() {
  const port = process.env.PORT ?? 4000;

  try {
    // Initialize OpenTelemetry for metrics and tracing
    // Set up metrics endpoint for API gateway that will aggregate all metrics
    bootstrapTelemetry('api-gateway-service');
  } catch (e) {
    console.error('Failed to bootstrap telemetry', e);
  }

  const app = await NestFactory.create(ApiModule);

  // setup pino logging
  app.useLogger(app.get(Logger));

  // setup validation
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.setGlobalPrefix(API_VERSION);
  // app.enableVersioning({
  //   type: VersioningType.URI,
  //   defaultVersion: API_VERSION,
  // });

  // Set up CORS
  setupCORS(app);

  // Configure WebSocket adapter to use the same HTTP server
  app.useWebSocketAdapter(new IoAdapter(app));

  // Add WebSocket documentation to Swagger UI (includes REST docs)
  setupDocs(app, 'docs');

  app.useGlobalInterceptors(new HttpLoggingInterceptor());

  // Register shutdown hooks
  app.enableShutdownHooks();

  await app.listen(port);
  console.log(
    `🔍 Telemetry enabled - Aggregated metrics available at http://127.0.0.1:${port}/metrics`,
  );
}

bootstrap();

// OpenAPI setup has been moved to websocket-docs.plugin.ts

function setupCORS(app: INestApplication) {
  const configService = app.get(ConfigService);
  const environment = process.env.NODE_ENV || 'development';
  const isProduction = environment === 'production';

  // Default allowed origins for development
  const defaultAllowedOrigins = [
    'https://bitsacco.com',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:*',
    'http://0.0.0.0:*',
  ];

  // In production, use configured origins or fallback to defaults
  const allowedOrigins = isProduction
    ? configService.get<string>('ALLOWED_ORIGINS')?.split(',') || [
        'https://bitsacco.com',
      ]
    : defaultAllowedOrigins;

  app.enableCors({
    origin: (origin, callback) => {
      // In production, strictly check origins against allowlist
      if (isProduction) {
        if (
          !origin ||
          allowedOrigins.some((allowedOrigin) => {
            // Handle wildcard patterns (e.g., "*.example.com")
            if (allowedOrigin.includes('*')) {
              const pattern = allowedOrigin.replace(/\*/g, '.*');
              return new RegExp(`^${pattern}$`).test(origin);
            }
            return allowedOrigin === origin;
          })
        ) {
          callback(null, origin);
        } else {
          callback(
            new Error(`Origin ${origin} not allowed by CORS policy`),
            false,
          );
        }
      } else {
        // In development, allow all origins for easier testing
        callback(null, origin);
      }
    },
    methods: 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'Authorization',
      'Cookie',
      'Origin',
      'X-Requested-With',
      'X-API-Key',
      'X-CSRF-Token',
      'Access-Control-Allow-Headers',
      'Access-Control-Allow-Origin',
      'Access-Control-Allow-Credentials',
    ].join(','),
    exposedHeaders: ['X-Session-Id', 'Set-Cookie'].join(', '),
  });

  console.log(
    `🔒 CORS configured with ${isProduction ? 'strict' : 'permissive'} rules for ${environment} environment`,
  );
}
