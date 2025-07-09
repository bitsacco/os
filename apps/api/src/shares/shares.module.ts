import * as Joi from 'joi';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import {
  DatabaseModule,
  EVENTS_SERVICE_BUS,
  getRedisConfig,
  LnurlMetricsService,
  LoggerModule,
  RedisProvider,
  configRedisCacheStore,
  RoleValidationService,
} from '@bitsacco/common';
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
          options: getRedisConfig(configService),
        }),
        inject: [ConfigService],
      },
    ]),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const ttl = 60 * 60 * 5; // 5 hours
        return configRedisCacheStore(configService, ttl);
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
    RoleValidationService,
  ],
})
export class SharesModule {}
