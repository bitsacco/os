import { join } from 'path';
import { Logger } from 'nestjs-pino';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ReflectionService } from '@grpc/reflection';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { bootstrapTelemetry, getRedisConfig } from '@bitsacco/common';
import { SharesModule } from './shares.module';

async function bootstrap() {
  const port = process.env.PORT ?? 4070;
  try {
    // Initialize OpenTelemetry for metrics and tracing
    bootstrapTelemetry('shares-service', Number(port));
  } catch (e) {
    console.error('Failed to bootstrap telemetry', e);
  }

  const app = await NestFactory.create(SharesModule);
  const configService = app.get(ConfigService);

  const shares_url = configService.getOrThrow<string>('SHARES_GRPC_URL');
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'shares',
      url: shares_url,
      protoPath: join(__dirname, '../../../proto/shares.proto'),
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
    `🔍 Telemetry enabled - Prometheus metrics available at ${shares_url}/metrics`,
  );
}

bootstrap();
