import * as Joi from 'joi';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ClientsModule, Transport } from '@nestjs/microservices';
import {
  LoggerModule,
  DatabaseModule,
  EVENTS_SERVICE_BUS,
  getRedisConfig,
  RedisProvider,
} from '@bitsacco/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationGateway } from './notification.gateway';
import { NotificationMetrics } from './notification.metrics';
import { RateLimitService } from './ratelimit';
import {
  NotificationRepository,
  NotificationPreferencesRepository,
  NotificationDocument,
  NotificationSchema,
  NotificationPreferencesDocument,
  NotificationPreferencesSchema,
} from './db';
import { SmsService } from '../sms/sms.service';
import { NostrService } from '../nostr/nostr.service';

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
    LoggerModule,
    EventEmitterModule.forRoot(),
    ClientsModule.registerAsync([
      {
        name: EVENTS_SERVICE_BUS,
        useFactory: (configService) => ({
          transport: Transport.REDIS,
          options: getRedisConfig(configService),
        }),
        inject: [ConfigService],
      },
    ]),
    DatabaseModule,
    DatabaseModule.forFeature([
      { name: NotificationDocument.name, schema: NotificationSchema },
      {
        name: NotificationPreferencesDocument.name,
        schema: NotificationPreferencesSchema,
      },
    ]),
  ],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationGateway,
    NotificationMetrics,
    RateLimitService,
    NotificationRepository,
    NotificationPreferencesRepository,
    RedisProvider,
    SmsService,
    NostrService,
  ],
  exports: [NotificationService, NotificationGateway],
})
export class NotificationModule {}
