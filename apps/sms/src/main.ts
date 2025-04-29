import { join } from 'path';
import { Logger } from 'nestjs-pino';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ReflectionService } from '@grpc/reflection';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { bootstrapTelemetry } from '@bitsacco/common';
import { SmsModule } from './sms.module';

async function bootstrap() {
  const port = process.env.PORT ?? 4060;
  try {
    // Initialize OpenTelemetry for metrics and tracing
    bootstrapTelemetry('sms-service', Number(port));
  } catch (e) {
    console.error('Failed to bootstrap telemetry', e);
  }

  const app = await NestFactory.create(SmsModule);
  const configService = app.get(ConfigService);

  const sms_url = configService.getOrThrow<string>('SMS_GRPC_URL');
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'sms',
      url: sms_url,
      protoPath: join(__dirname, '../../../proto/sms.proto'),
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
  console.log(`🔍 Telemetry enabled - Metrics available at ${sms_url}/metrics`);
}

bootstrap();
