import { join } from 'path';
import { Logger } from 'nestjs-pino';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ReflectionService } from '@grpc/reflection';
import { NostrModule } from './nostr.module';

async function bootstrap() {
  const app = await NestFactory.create(NostrModule);

  const configService = app.get(ConfigService);

  const nostr_url = configService.getOrThrow<string>('NOSTR_GRPC_URL');
  const nostr = app.connectMicroservice<MicroserviceOptions>({
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

  // setup pino logging
  app.useLogger(app.get(Logger));

  await app.startAllMicroservices();
}

bootstrap();
