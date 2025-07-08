import { join } from 'path';
import { Logger } from 'nestjs-pino';
import { NestFactory } from '@nestjs/core';
import { ReflectionService } from '@grpc/reflection';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { bootstrapTelemetry } from '@bitsacco/common';
import { AuthModule } from './auth.module';

async function bootstrap() {
  const port = process.env.PORT ?? 4010;
  const metricsPort = process.env.METRICS_PORT ?? 8010;
  try {
    // Initialize OpenTelemetry for metrics and tracing
    bootstrapTelemetry('auth-service', Number(metricsPort));
  } catch (e) {
    console.error('Failed to bootstrap telemetry', e);
  }

  const app = await NestFactory.create(AuthModule);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'auth',
      url: `0.0.0.0:${port}`,
      protoPath: join(__dirname, '../../../proto/auth.proto'),
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
    ` Telemetry enabled - Metrics available at 0.0.0.0:${metricsPort}/metrics`,
  );
}

bootstrap();
