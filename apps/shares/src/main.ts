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
  const metricsPort = process.env.METRICS_PORT ?? 4072;
  try {
    // Initialize OpenTelemetry for metrics and tracing
    bootstrapTelemetry('shares-service', Number(metricsPort));
  } catch (e) {
    console.error('Failed to bootstrap telemetry', e);
  }

  const app = await NestFactory.create(SharesModule);
  const configService = app.get(ConfigService);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'shares',
      url: `0.0.0.0:${port}`,
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
    `🔍 Telemetry enabled - Prometheus metrics available at 0.0.0.0:${metricsPort}/metrics`,
  );
}

bootstrap();
