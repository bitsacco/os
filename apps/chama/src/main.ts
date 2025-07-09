import { join } from 'path';
import { Logger } from 'nestjs-pino';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ReflectionService } from '@grpc/reflection';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { getRedisConfig } from '@bitsacco/common';
import { ChamaModule } from './chama.module';

async function bootstrap() {
  const port = process.env.PORT ?? 4090;
  const app = await NestFactory.create(ChamaModule);
  const configService = app.get(ConfigService);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: ['chama', 'chamawallet'],
      url: `0.0.0.0:${port}`,
      protoPath: [
        join(__dirname, '../../../proto/chama.proto'),
        join(__dirname, '../../../proto/chamawallet.proto'),
      ],
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
}
bootstrap();
