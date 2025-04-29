import { join } from 'path';
import { Logger } from 'nestjs-pino';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ReflectionService } from '@grpc/reflection';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { bootstrapTelemetry, getRedisConfig } from '@bitsacco/common';
import { SolowalletModule } from './solowallet.module';

async function bootstrap() {
  const port = process.env.PORT ?? 4080;
  try {
    // Initialize OpenTelemetry for metrics and tracing
    bootstrapTelemetry('solowallet-service', Number(port));
  } catch (e) {
    console.error('Failed to bootstrap telemetry', e);
  }

  const app = await NestFactory.create(SolowalletModule);
  const configService = app.get(ConfigService);

  const solowallet_url = configService.getOrThrow<string>(
    'SOLOWALLET_GRPC_URL',
  );
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'solowallet',
      url: solowallet_url,
      protoPath: join(__dirname, '../../../proto/solowallet.proto'),
      onLoadPackageDefinition: (pkg, server) => {
        new ReflectionService(pkg).addToServer(server);
      },
    },
  });

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.REDIS,
    options: {
      ...getRedisConfig(configService),
      retryAttempts: 2,
      retryDelay: 100,
    },
  });

  // Enable graceful shutdown
  app.enableShutdownHooks();

  // Setup pino logging
  app.useLogger(app.get(Logger));

  await app.startAllMicroservices();
  console.log(
    `🔍 Telemetry enabled - Metrics available at ${solowallet_url}/metrics`,
  );
}

bootstrap();
