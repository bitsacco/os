import * as Joi from 'joi';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LoggerModule, DatabaseModule } from '@bitsacco/common';
import { SmsModule } from '../sms/sms.module';
import { NostrModule } from '../nostr/nostr.module';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
      }),
    }),
    LoggerModule,
    EventEmitterModule.forRoot({
      global: true,
      delimiter: '.',
      verboseMemoryLeak: true,
    }),
    DatabaseModule,
    DatabaseModule.forFeature([
      { name: NotificationDocument.name, schema: NotificationSchema },
      {
        name: NotificationPreferencesDocument.name,
        schema: NotificationPreferencesSchema,
      },
    ]),
    SmsModule,
    NostrModule,
  ],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationGateway,
    NotificationMetrics,
    RateLimitService,
    NotificationRepository,
    NotificationPreferencesRepository,
  ],
  exports: [NotificationService, NotificationGateway],
})
export class NotificationModule {}
