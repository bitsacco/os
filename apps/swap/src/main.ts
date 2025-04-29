import { join } from 'path';
import { Logger } from 'nestjs-pino';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ReflectionService } from '@grpc/reflection';
import { bootstrapTelemetry, getRedisConfig } from '@bitsacco/common';
import { SwapModule } from './swap.module';

async function bootstrap() {
  const port = process.env.PORT ?? 4040;
  const metricsPort = process.env.METRICS_PORT ?? 4042;
  try {
    // Initialize OpenTelemetry for metrics and tracing
    bootstrapTelemetry('swap-service', Number(metricsPort));
  } catch (e) {
    console.error('Failed to bootstrap telemetry', e);
  }

  const app = await NestFactory.create(SwapModule);
  const configService = app.get(ConfigService);

  const swap_url = configService.getOrThrow<string>('SWAP_GRPC_URL');
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'swap',
      url: swap_url,
      protoPath: join(__dirname, '../../../proto/swap.proto'),
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
    `🔍 Telemetry enabled - Metrics available at 0.0.0.0:${metricsPort}/metrics`,
  );
}

bootstrap();
