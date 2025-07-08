import { join } from 'path';
import { Logger } from 'nestjs-pino';
import { NestFactory } from '@nestjs/core';
import { ReflectionService } from '@grpc/reflection';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { bootstrapTelemetry } from '@bitsacco/common';
import { NotificationModule } from './notification.module';

async function bootstrap() {
  const port = process.env.PORT ?? 5000;
  const metricsPort = process.env.METRICS_PORT ?? 5002;
  try {
    // Initialize OpenTelemetry for metrics and tracing
    bootstrapTelemetry('notification-service', Number(metricsPort));
  } catch (e) {
    console.error('Failed to bootstrap telemetry', e);
  }

  const app = await NestFactory.create(NotificationModule);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'notification',
      url: `0.0.0.0:${port}`,
      protoPath: join(__dirname, '../../../proto/notification.proto'),
      onLoadPackageDefinition: (pkg, server) => {
        new ReflectionService(pkg).addToServer(server);
      },
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
