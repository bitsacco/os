import * as Joi from 'joi';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { HttpModule } from '@nestjs/axios';
import {
  DatabaseModule,
  FedimintService,
  LnurlMetricsService,
  LoggerModule,
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
import { SwapModule } from '../swap/swap.module';
import { JwtConfigModule } from '../shared/jwt-config.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().required(),
        DATABASE_URL: Joi.string().required(),
        FEDIMINT_CLIENTD_BASE_URL: Joi.string().required(),
        FEDIMINT_CLIENTD_PASSWORD: Joi.string().required(),
        FEDIMINT_FEDERATION_ID: Joi.string().required(),
        FEDIMINT_GATEWAY_ID: Joi.string().required(),
        LNURL_CALLBACK: Joi.string().required(),
        MOCK_BTC_KES_RATE: Joi.number(),
        CURRENCY_API_KEY: Joi.string(),
        INTASEND_PUBLIC_KEY: Joi.string().required(),
        INTASEND_PRIVATE_KEY: Joi.string().required(),
      }),
    }),
    DatabaseModule,
    DatabaseModule.forFeature([
      { name: SolowalletDocument.name, schema: SolowalletSchema },
    ]),
    LoggerModule,
    HttpModule,
    SwapModule,
    JwtConfigModule.forRoot(),
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
    RoleValidationService,
  ],
})
export class SolowalletModule {}
