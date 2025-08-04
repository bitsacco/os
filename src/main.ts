import { Logger } from 'nestjs-pino';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import {
  HttpLoggingInterceptor,
  initializeOpenTelemetry,
  getGlobalTelemetryProvider,
} from './common';
import { ApiModule } from './api.module';
import { setupDocs } from './docs.plugin';

const API_VERSION = 'v1';

async function bootstrap() {
  // Initialize OpenTelemetry for the monolith
  const prometheusPort = parseInt(process.env.PROMETHEUS_PORT || '9090', 10);
  const otelSdk = initializeOpenTelemetry('bitsacco-os', prometheusPort);

  // Set SDK in global telemetry provider
  getGlobalTelemetryProvider().setSdk(otelSdk);

  const port = process.env.PORT ?? 4000;
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

  // Set global prefix for all routes except .well-known
  //
  // IMPORTANT: Why .well-known is excluded from versioning:
  //
  // The .well-known prefix is a standard convention defined in RFC 5785 for hosting
  // metadata at predictable URLs. Lightning addresses specifically use the path
  // .well-known/lnurlp/{username} as per the LNURL specification (LUD-16).
  //
  // External Lightning wallets expect this endpoint to be available at the root
  // domain without any version prefix. For example:
  // - Correct: https://bitsacco.com/.well-known/lnurlp/alice
  // - Wrong: https://bitsacco.com/v1/.well-known/lnurlp/alice
  //
  // All other API routes (including the LNURL callback) should maintain the /v1/
  // prefix for proper API versioning. The callback URL in the LNURL response
  // correctly includes the version prefix.
  app.setGlobalPrefix(API_VERSION, {
    exclude: ['.well-known/lnurlp/(.*)'],
  });

  // app.enableVersioning({
  //   type: VersioningType.URI,
  //   defaultVersion: API_VERSION,
  // });

  // Add URL normalization middleware to remove trailing slashes
  app.use((req, res, next) => {
    if (req.url.endsWith('/') && req.url.length > 1) {
      const query = req.url.indexOf('?');
      const base = query !== -1 ? req.url.slice(0, query) : req.url;

      if (base.length > 1 && base.endsWith('/')) {
        const normalizedUrl =
          base.slice(0, -1) + (query !== -1 ? req.url.slice(query) : '');
        req.url = normalizedUrl;
      }
    }
    next();
  });

  // Set up CORS
  setupCORS(app);

  // Add WebSocket documentation to Swagger UI (includes REST docs)
  setupDocs(app, 'docs');

  app.useGlobalInterceptors(new HttpLoggingInterceptor());

  // Register shutdown hooks
  app.enableShutdownHooks();

  // Graceful shutdown handler for both SIGTERM and SIGINT
  let isShuttingDown = false;
  const shutdownHandler = async (signal: string) => {
    if (isShuttingDown) {
      console.log('Shutdown already in progress...');
      return;
    }

    isShuttingDown = true;
    console.log(`Received ${signal}. Shutting down gracefully...`);

    try {
      await otelSdk.shutdown();
      console.log('OpenTelemetry shutdown complete');

      // Close the NestJS application
      await app.close();
      console.log('Application closed successfully');

      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  // Handle both SIGTERM (production) and SIGINT (Ctrl+C in development)
  process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
  process.on('SIGINT', () => shutdownHandler('SIGINT'));

  await app.listen(port);
  console.log(`🚀 Application running on port ${port}`);
  console.log(
    `📊 Prometheus metrics available at http://localhost:${prometheusPort}/metrics`,
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
