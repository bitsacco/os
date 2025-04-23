import { join } from 'path';
import { Logger } from 'nestjs-pino';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ReflectionService } from '@grpc/reflection';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { getRedisConfig } from '@bitsacco/common';
import { ChamaModule } from './chama.module';

async function bootstrap() {
  const app = await NestFactory.create(ChamaModule);

  const configService = app.get(ConfigService);

  const chama_url = configService.getOrThrow<string>('CHAMA_GRPC_URL');
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: ['chama', 'chamawallet'],
      url: chama_url,
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

  // setup pino logging
  app.useLogger(app.get(Logger));

  await app.startAllMicroservices();
}
bootstrap();
