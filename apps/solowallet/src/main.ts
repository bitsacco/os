import { join } from 'path';
import { Logger } from 'nestjs-pino';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ReflectionService } from '@grpc/reflection';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { SolowalletModule } from './solowallet.module';

async function bootstrap() {
  const app = await NestFactory.create(SolowalletModule);

  const configService = app.get(ConfigService);

  const solowallet_url = configService.getOrThrow<string>(
    'SOLOWALLET_GRPC_URL',
  );
  const solowallet = app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'solowallet',
      url: solowallet_url,
      protoPath: join(__dirname, '../../../proto/solowallet.proto'),
      onLoadPackageDefinition: (pkg, server) => {
        new ReflectionService(pkg).addToServer(server);
      },
    },
  });

  // setup pino logging
  app.useLogger(app.get(Logger));

  await app.startAllMicroservices();
}
