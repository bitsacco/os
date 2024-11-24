import { join } from 'path';
import { Logger } from 'nestjs-pino';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ReflectionService } from '@grpc/reflection';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { SmsModule } from './sms.module';

async function bootstrap() {
  const app = await NestFactory.create(SmsModule);

  const configService = app.get(ConfigService);

  const sms_url = configService.getOrThrow<string>('SMS_GRPC_URL');
  const sms = app.connectMicroservice<MicroserviceOptions>({
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

  // setup pino logging
  app.useLogger(app.get(Logger));

  await app.startAllMicroservices();
}

bootstrap();
