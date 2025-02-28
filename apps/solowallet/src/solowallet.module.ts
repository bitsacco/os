import * as Joi from 'joi';
import { join } from 'path';
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import {
  DatabaseModule,
  FedimintService,
  LoggerModule,
  MonitoringModule,
  SWAP_SERVICE_NAME,
} from '@bitsacco/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SolowalletController } from './solowallet.controller';
import { SolowalletService } from './solowallet.service';
import {
  SolowalletDocument,
  SolowalletRepository,
  SolowalletSchema,
} from './db';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().required(),
        SOLOWALLET_GRPC_URL: Joi.string().required(),
        SWAP_GRPC_URL: Joi.string().required(),
        DATABASE_URL: Joi.string().required(),
        FEDIMINT_CLIENTD_BASE_URL: Joi.string().required(),
        FEDIMINT_CLIENTD_PASSWORD: Joi.string().required(),
        FEDIMINT_FEDERATION_ID: Joi.string().required(),
        FEDIMINT_GATEWAY_ID: Joi.string().required(),
        LNURL_CALLBACK: Joi.string().required(),
      }),
    }),
    DatabaseModule,
    DatabaseModule.forFeature([
      { name: SolowalletDocument.name, schema: SolowalletSchema },
    ]),
    LoggerModule,
    HttpModule,
    MonitoringModule,
    ClientsModule.registerAsync([
      {
        name: SWAP_SERVICE_NAME,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'swap',
            protoPath: join(__dirname, '../../../proto/swap.proto'),
            url: configService.getOrThrow<string>('SWAP_GRPC_URL'),
          },
        }),
        inject: [ConfigService],
      },
    ]),
    EventEmitterModule.forRoot({
      global: true,
      delimiter: '.',
      verboseMemoryLeak: true,
    }),
  ],
  controllers: [SolowalletController],
  providers: [
    SolowalletService,
    ConfigService,
    SolowalletRepository,
    FedimintService,
  ],
})
export class SolowalletModule {}
