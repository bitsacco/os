import { join } from 'path';
import { Logger } from 'nestjs-pino';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ReflectionService } from '@grpc/reflection';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { bootstrapTelemetry } from '@bitsacco/common';
import { AuthModule } from './auth.module';

async function bootstrap() {
  const port = process.env.PORT ?? 4010;
  try {
    // Initialize OpenTelemetry for metrics and tracing
    bootstrapTelemetry('auth-service', Number(port));
  } catch (e) {
    console.error('Failed to bootstrap telemetry', e);
  }

  const app = await NestFactory.create(AuthModule);
  const configService = app.get(ConfigService);

  const auth_url = configService.getOrThrow<string>('AUTH_GRPC_URL');
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'auth',
      url: auth_url,
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
    `🔍 Telemetry enabled - Metrics available at ${auth_url}/metrics`,
  );
}

bootstrap();
