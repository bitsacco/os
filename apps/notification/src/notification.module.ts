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
        REDIS_PASSWORD: Joi.string().default('securepassword'),
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
          options: {
            host: configService.getOrThrow<string>('REDIS_HOST'),
            port: configService.getOrThrow<number>('REDIS_PORT'),
            password: configService.get<string>('REDIS_PASSWORD'),
            tls: configService.get<boolean>('REDIS_TLS', false)
              ? {}
              : undefined,
          },
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
    // Provide Redis client for distributed services
    {
      provide: 'REDIS_CLIENT',
      useFactory: (configService: ConfigService) => {
        try {
          const Redis = require('ioredis');
          return new Redis({
            host: configService.get('REDIS_HOST', 'localhost'),
            port: configService.get('REDIS_PORT', 6379),
            password: configService.get('REDIS_PASSWORD'),
            tls: configService.get('REDIS_TLS', false) ? {} : undefined,
            connectTimeout: 5000,
            retryStrategy: (times) => Math.min(times * 100, 3000),
          });
        } catch (error) {
          console.error('Failed to initialize Redis client:', error);
          return null;
        }
      },
      inject: [ConfigService],
    },
    // Provide the distributed rate limit service
    DistributedRateLimitService,
  ],
})
export class NotificationModule {}
