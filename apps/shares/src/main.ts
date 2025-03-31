import { join } from 'path';
import { Logger } from 'nestjs-pino';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ReflectionService } from '@grpc/reflection';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { SharesModule } from './shares.module';
import { initializeOpenTelemetry } from '@bitsacco/common';

async function bootstrap() {
  // Initialize OpenTelemetry for metrics and tracing
  const telemetrySdk = initializeOpenTelemetry('shares-service');
  
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
      host: configService.getOrThrow<string>('REDIS_HOST'),
      port: configService.getOrThrow<number>('REDIS_PORT'),
      retryAttempts: 2,
      retryDelay: 100,
    },
  });

  // Setup HTTP endpoint for Prometheus metrics
  app.enableShutdownHooks();
  
  const shutdownSignals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

  // Register shutdown handler to gracefully shut down telemetry
  app.beforeApplicationShutdown(async () => {
    await telemetrySdk.shutdown()
      .then(() => console.log('OpenTelemetry shut down successfully'))
      .catch(err => console.error('Error shutting down OpenTelemetry', err));
  });
  
  // setup pino logging
  app.useLogger(app.get(Logger));

  await app.startAllMicroservices();
  console.log(`🔍 Telemetry enabled - Prometheus metrics available at ${shares_url}/metrics`);
}

bootstrap();
