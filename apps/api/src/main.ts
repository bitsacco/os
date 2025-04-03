import { Logger } from 'nestjs-pino';
import { NestFactory } from '@nestjs/core';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import {
  HttpLoggingInterceptor,
  initializeOpenTelemetry,
} from '@bitsacco/common';
import { ApiModule } from './api.module';

const API_VERSION = 'v1';

async function bootstrap() {
  // Initialize OpenTelemetry for metrics and tracing
  // Set up metrics endpoint for API gateway that will aggregate all metrics
  // Pass true as the third parameter to indicate this is the API gateway
  const telemetrySdk = initializeOpenTelemetry(
    'api-gateway-service',
    4000,
    true,
  );

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

  setupOpenAPI(app, 'docs');

  setupCORS(app);

  app.useGlobalInterceptors(new HttpLoggingInterceptor());

  // Register shutdown hooks for OpenTelemetry
  app.enableShutdownHooks();
  process.on('SIGTERM', async () => {
    await telemetrySdk
      .shutdown()
      .then(() => console.log('OpenTelemetry shut down successfully'))
      .catch((err) => console.error('OpenTelemetry shut down error', err));
  });

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  console.log(
    `🔍 Telemetry enabled - Aggregated metrics available at http://localhost:${port}/metrics`,
  );
}

bootstrap();

function setupOpenAPI(app: INestApplication, path: string) {
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
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, options);

  SwaggerModule.setup(path, app, documentFactory, {
    useGlobalPrefix: true,
    jsonDocumentUrl: `${path}/json`,
    yamlDocumentUrl: `${path}/yaml`,
  });
}

function setupCORS(app: INestApplication) {
  const allowedOrigins = [
    'https://bitsacco.com',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:*',
    'http://0.0.0.0:*',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // TODO: Strict CORS origin check in production
      callback(null, origin);
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
      'Access-Control-Allow-Headers',
      'Access-Control-Allow-Origin',
      'Access-Control-Allow-Credentials',
    ].join(','),
    exposedHeaders: ['X-Session-Id', 'Set-Cookie'].join(', '),
  });
}
