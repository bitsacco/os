import * as Joi from 'joi';
import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import {
  DatabaseModule,
  EVENTS_SERVICE_BUS,
  LoggerModule,
  NOSTR_SERVICE_NAME,
  SMS_SERVICE_NAME,
  DistributedRateLimitService,
  RedisProvider,
  getRedisConfig,
  RoleValidationService,
} from '@bitsacco/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationMetrics } from './notification.metrics';
import { RateLimitService } from './ratelimit';
import {
  NotificationDocument,
  NotificationRepository,
  NotificationSchema,
  NotificationPreferencesRepository,
  NotificationPreferencesDocument,
  NotificationPreferencesSchema,
} from './db';

@Module({
  imports: [
    LoggerModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        PORT: Joi.string().required(),
        NODE_ENV: Joi.string().required(),
        NOTIFICATION_GRPC_URL: Joi.string().required(),
        SMS_GRPC_URL: Joi.string().required(),
        NOSTR_GRPC_URL: Joi.string().required(),
        REDIS_HOST: Joi.string().required(),
        REDIS_PORT: Joi.number().required(),
        REDIS_PASSWORD: Joi.string().required(),
        REDIS_TLS: Joi.boolean().default(false),
        DATABASE_URL: Joi.string().required(),
      }),
    }),
    DatabaseModule,
    DatabaseModule.forFeature([
      { name: NotificationDocument.name, schema: NotificationSchema },
      {
        name: NotificationPreferencesDocument.name,
        schema: NotificationPreferencesSchema,
      },
    ]),
    ClientsModule.registerAsync([
      {
        name: SMS_SERVICE_NAME,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'sms',
            protoPath: join(__dirname, '../../../proto/sms.proto'),
            url: configService.getOrThrow<string>('SMS_GRPC_URL'),
          },
        }),
        inject: [ConfigService],
      },
      {
        name: NOSTR_SERVICE_NAME,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'nostr',
            protoPath: join(__dirname, '../../../proto/nostr.proto'),
            url: configService.getOrThrow<string>('NOSTR_GRPC_URL'),
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
  ],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationMetrics,
    NotificationRepository,
    NotificationPreferencesRepository,
    RateLimitService,
    DistributedRateLimitService,
    RedisProvider,
    RoleValidationService,
  ],
})
export class NotificationModule {}
