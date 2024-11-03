import * as Joi from 'joi';
import { redisStore } from 'cache-manager-redis-store';
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CACHE_MANAGER, CacheModule } from '@nestjs/cache-manager';
import { CustomStore, LoggerModule } from '@bitsacco/common';
import { SwapController } from './swap.controller';
import { SwapService } from './swap.service';
import { FxService } from './fx/fx.service';
import { PrismaService } from './prisma.service';
import { IntasendService } from './intasend/intasend.service';
import { EventsController } from './events.controller';
import { FedimintService } from './fedimint/fedimint.service';

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
    {
      provide: SwapService,
      useFactory: (
        fxService: FxService,
        intasendService: IntasendService,
        fedimintService: FedimintService,
        prismaService: PrismaService,
        eventEmitter: EventEmitter2,
        cacheManager: CustomStore,
      ) => {
        return new SwapService(
          fxService,
          intasendService,
          fedimintService,
          prismaService,
          eventEmitter,
          cacheManager,
        );
      },
      inject: [
        FxService,
        IntasendService,
        FedimintService,
        PrismaService,
        EventEmitter2,
        CACHE_MANAGER,
      ],
    },
    FxService,
    PrismaService,
    IntasendService,
    ConfigService,
    FedimintService,
  ],
})
export class SwapModule {}
