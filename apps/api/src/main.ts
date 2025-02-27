import { Logger } from 'nestjs-pino';
import { NestFactory } from '@nestjs/core';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpLoggingInterceptor } from '@bitsacco/common';
import { ApiModule } from './api.module';

const API_VERSION = 'v1';

async function bootstrap() {
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

  await app.listen(process.env.PORT ?? 4000);
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
