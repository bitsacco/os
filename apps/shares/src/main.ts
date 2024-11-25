import { join } from 'path';
import { Logger } from 'nestjs-pino';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ReflectionService } from '@grpc/reflection';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { SharesModule } from './shares.module';

async function bootstrap() {
  const app = await NestFactory.create(SharesModule);

  const configService = app.get(ConfigService);

  const shares_url = configService.getOrThrow<string>('SHARES_GRPC_URL');
  const shares = app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'shares',
      url: shares_url,
      protoPath: join(__dirname, '../../../proto/shares.proto'),
      onLoadPackageDefinition: (pkg, server) => {
        new ReflectionService(pkg).addToServer(server);
      },
    },
  });

  // setup pino logging
  app.useLogger(app.get(Logger));

  await app.startAllMicroservices();
}

bootstrap();
