import * as Joi from 'joi';
import { Module } from '@nestjs/common';
import {
  CustomStore,
  DatabaseModule,
  EVENTS_SERVICE_BUS,
  LnurlMetricsService,
  LoggerModule,
  RedisProvider,
} from '@bitsacco/common';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { SharesController } from './shares.controller';
import { SharesService } from './shares.service';
import {
  SharesDocument,
  SharesOfferDocument,
  SharesOfferRepository,
  SharesOfferSchema,
  SharesRepository,
  SharesSchema,
} from './db';
import { SharesMetricsService } from './shares.metrics';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().required(),
        SHARES_GRPC_URL: Joi.string().required(),
        SHARES_ISSUED: Joi.number().required(),
        DATABASE_URL: Joi.string().required(),
        REDIS_HOST: Joi.string().required(),
        REDIS_PORT: Joi.number().required(),
        REDIS_PASSWORD: Joi.string().required(),
        REDIS_TLS: Joi.boolean().default(false),
      }),
    }),
    EventEmitterModule.forRoot(),
    ClientsModule.registerAsync([
      {
        name: EVENTS_SERVICE_BUS,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.REDIS,
          options: {
            host: configService.getOrThrow<string>('REDIS_HOST'),
            port: configService.getOrThrow<number>('REDIS_PORT'),
            password: configService.getOrThrow<string>('REDIS_PASSWORD'),
            tls: configService.get<boolean>('REDIS_TLS', false)
              ? {}
              : undefined,
          },
        }),
        inject: [ConfigService],
      },
    ]),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const store = await redisStore({
          socket: {
            host: configService.getOrThrow<string>('REDIS_HOST'),
            port: configService.getOrThrow<number>('REDIS_PORT'),
          },
          password: configService.getOrThrow<string>('REDIS_PASSWORD'),
          ttl: 60 * 60 * 5, // 5 hours
          tls: configService.get<boolean>('REDIS_TLS', false) ? {} : undefined,
        });

        return {
          store: new CustomStore(store, undefined /* TODO: inject logger */),
          ttl: 60 * 60 * 5, // 5 hours
        };
      },
      inject: [ConfigService],
    }),
    DatabaseModule,
    DatabaseModule.forFeature([
      { name: SharesOfferDocument.name, schema: SharesOfferSchema },
      { name: SharesDocument.name, schema: SharesSchema },
    ]),
    LoggerModule,
  ],
  controllers: [SharesController],
  providers: [
    ConfigService,
    LnurlMetricsService,
    SharesService,
    SharesOfferRepository,
    SharesRepository,
    SharesMetricsService,
    RedisProvider,
  ],
})
export class SharesModule {}
