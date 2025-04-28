import * as Joi from 'joi';
import { join } from 'path';
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { HttpModule } from '@nestjs/axios';
import {
  DatabaseModule,
  EVENTS_SERVICE_BUS,
  FedimintService,
  getRedisConfig,
  LnurlMetricsService,
  LoggerModule,
  RedisProvider,
  SWAP_SERVICE_NAME,
  RoleValidationService,
} from '@bitsacco/common';
import { SolowalletMetricsService } from './solowallet.metrics';
import {
  SolowalletDocument,
  SolowalletRepository,
  SolowalletSchema,
} from './db';
import { SolowalletController } from './solowallet.controller';
import { SolowalletService } from './solowallet.service';

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
        REDIS_HOST: Joi.string().required(),
        REDIS_PORT: Joi.number().required(),
        REDIS_PASSWORD: Joi.string().required(),
        REDIS_TLS: Joi.boolean().default(false),
      }),
    }),
    DatabaseModule,
    DatabaseModule.forFeature([
      { name: SolowalletDocument.name, schema: SolowalletSchema },
    ]),
    LoggerModule,
    HttpModule,
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
      {
        name: EVENTS_SERVICE_BUS,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.REDIS,
          options: getRedisConfig(configService),
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
    LnurlMetricsService,
    SolowalletMetricsService,
    RedisProvider,
    RoleValidationService,
  ],
})
export class SolowalletModule {}
