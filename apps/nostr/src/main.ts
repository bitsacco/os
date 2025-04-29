import { join } from 'path';
import { Logger } from 'nestjs-pino';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ReflectionService } from '@grpc/reflection';
import { bootstrapTelemetry } from '@bitsacco/common';
import { NostrModule } from './nostr.module';

async function bootstrap() {
  const port = process.env.PORT ?? 4050;
  try {
    // Initialize OpenTelemetry for metrics and tracing
    bootstrapTelemetry('nostr-service', Number(port));
  } catch (e) {
    console.error('Failed to bootstrap telemetry', e);
  }

  const app = await NestFactory.create(NostrModule);
  const configService = app.get(ConfigService);

  const nostr_url = configService.getOrThrow<string>('NOSTR_GRPC_URL');
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'nostr',
      url: nostr_url,
      protoPath: join(__dirname, '../../../proto/nostr.proto'),
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
    `🔍 Telemetry enabled - Metrics available at ${nostr_url}/metrics`,
  );
}

bootstrap();
