import { join } from 'path';
import { Logger } from 'nestjs-pino';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ReflectionService } from '@grpc/reflection';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { 
  initializeOpenTelemetry, 
  CoreMetricsService, 
  MetricsIntegration 
} from '@bitsacco/common';
import { AuthModule } from './auth.module';

async function bootstrap() {
  // Initialize OpenTelemetry for metrics and tracing
  const telemetrySdk = initializeOpenTelemetry('auth-service');
  
  const app = await NestFactory.create(AuthModule);

  const configService = app.get(ConfigService);

  const auth_url = configService.getOrThrow<string>('AUTH_GRPC_URL');
  const auth = app.connectMicroservice<MicroserviceOptions>({
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

  // setup pino logging
  app.useLogger(app.get(Logger));
  
  // Get CoreMetricsService instance from DI container
  const metricsService = app.get(CoreMetricsService);
  
  // Apply gRPC metrics interceptor for automatic collection
  MetricsIntegration.applyGrpcMetricsInterceptor(app, metricsService);

  // Register shutdown hooks for OpenTelemetry
  app.enableShutdownHooks();
  process.on('SIGTERM', async () => {
    await telemetrySdk
      .shutdown()
      .then(() => console.log('OpenTelemetry shut down successfully'))
      .catch((err) => console.error('OpenTelemetry shut down error', err));
  });

  await app.startAllMicroservices();
  console.log('🔍 Telemetry enabled for auth service');
}

bootstrap();
