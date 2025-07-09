import * as Joi from 'joi';
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import {
  DatabaseModule,
  FedimintService,
  LoggerModule,
  RoleValidationService,
} from '@bitsacco/common';
import { SwapController } from './swap.controller';
import { SwapService } from './swap.service';
import { FxService } from './fx/fx.service';
import { IntasendService } from './intasend/intasend.service';
import { SwapMetricsService } from './metrics/swap.metrics';
import {
  MpesaOfframpSwapRepository,
  MpesaOfframpSwapDocument,
  MpesaOfframpSwapSchema,
  MpesaOnrampSwapRepository,
  MpesaOnrampSwapDocument,
  MpesaOnrampSwapSchema,
} from './db';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        MOCK_BTC_KES_RATE: Joi.number(),
        CURRENCY_API_KEY: Joi.string(),
        DATABASE_URL: Joi.string().required(),
        INTASEND_PUBLIC_KEY: Joi.string().required(),
        INTASEND_PRIVATE_KEY: Joi.string().required(),
        FEDIMINT_CLIENTD_BASE_URL: Joi.string().required(),
        FEDIMINT_CLIENTD_PASSWORD: Joi.string().required(),
        FEDIMINT_FEDERATION_ID: Joi.string().required(),
        FEDIMINT_GATEWAY_ID: Joi.string().required(),
      }),
    }),
    DatabaseModule,
    DatabaseModule.forFeature([
      { name: MpesaOnrampSwapDocument.name, schema: MpesaOnrampSwapSchema },
      { name: MpesaOfframpSwapDocument.name, schema: MpesaOfframpSwapSchema },
    ]),
    LoggerModule,
    HttpModule,
    CacheModule.register({
      isGlobal: true,
      ttl: 60 * 60 * 5 * 1000, // 5 hours in milliseconds
      max: 1000, // Maximum number of items in cache
    }),
    EventEmitterModule.forRoot({
      global: true,
      delimiter: '.',
      verboseMemoryLeak: true,
    }),
  ],
  controllers: [SwapController],
  providers: [
    SwapMetricsService,
    SwapService,
    FxService,
    IntasendService,
    ConfigService,
    FedimintService,
    MpesaOfframpSwapRepository,
    MpesaOnrampSwapRepository,
    RoleValidationService,
  ],
  exports: [SwapService],
})
export class SwapModule {}
