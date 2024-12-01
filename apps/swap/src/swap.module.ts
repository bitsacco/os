import * as Joi from 'joi';
import { redisStore } from 'cache-manager-redis-store';
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CacheModule } from '@nestjs/cache-manager';
import {
  CustomStore,
  DatabaseModule,
  FedimintService,
  LoggerModule,
} from '@bitsacco/common';
import { SwapController } from './swap.controller';
import { SwapService } from './swap.service';
import { FxService } from './fx/fx.service';
import { IntasendService } from './intasend/intasend.service';
import { EventsController } from './events.controller';
import {
  MpesaOfframpSwapRepository,
  MpesaOfframpSwapDocument,
  MpesaOfframpSwapSchema,
  MpesaOnrampSwapRepository,
  MpesaOnrampSwapDocument,
  MpesaOnrampSwapSchema,
} from '../db';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().required(),
        SWAP_GRPC_URL: Joi.string().required(),
        REDIS_HOST: Joi.string().required(),
        REDIS_PORT: Joi.number().required(),
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
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const store = await redisStore({
          socket: {
            host: configService.getOrThrow<string>('REDIS_HOST'),
            port: configService.getOrThrow<number>('REDIS_PORT'),
          },
          ttl: 60 * 60 * 5, // 5 hours
        });

        return {
          store: new CustomStore(store, undefined /* TODO: inject logger */),
          ttl: 60 * 60 * 5, // 5 hours
        };
      },
      inject: [ConfigService],
    }),
    EventEmitterModule.forRoot({
      global: true,
      delimiter: '.',
      verboseMemoryLeak: true,
    }),
  ],
  controllers: [SwapController, EventsController],
  providers: [
    SwapService,
    FxService,
    IntasendService,
    ConfigService,
    FedimintService,
    MpesaOfframpSwapRepository,
    MpesaOnrampSwapRepository,
  ],
})
export class SwapModule {}
