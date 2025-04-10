import { join } from 'path';
import { Logger } from 'nestjs-pino';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ReflectionService } from '@grpc/reflection';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { initializeOpenTelemetry } from '@bitsacco/common';
import { NotificationModule } from './notification.module';

async function bootstrap() {
  // Initialize OpenTelemetry for metrics and tracing
  const telemetrySdk = initializeOpenTelemetry('notification-service');

  const app = await NestFactory.create(NotificationModule);
  const configService = app.get(ConfigService);

  const notification_url = configService.getOrThrow<string>(
    'NOTIFICATION_GRPC_URL',
  );
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'notification',
      url: notification_url,
      protoPath: join(__dirname, '../../../proto/notification.proto'),
      onLoadPackageDefinition: (pkg, server) => {
        new ReflectionService(pkg).addToServer(server);
      },
    },
  });

  app.enableShutdownHooks();

  process.on('SIGTERM', async () => {
    await telemetrySdk
      .shutdown()
      .then(() => console.log('OpenTelemetry shut down successfully'))
      .catch((err) => console.error('OpenTelemetry shut down error', err));
  });

  // setup pino logging
  app.useLogger(app.get(Logger));

  await app.startAllMicroservices();
  console.log(
    `🔍 Telemetry enabled - Prometheus metrics available at ${notification_url}/metrics`,
  );
}

bootstrap();
