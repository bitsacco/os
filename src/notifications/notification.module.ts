import { Module } from '@nestjs/common';
import { SharedModule } from '../common/shared.module';
import { DatabaseModule } from '../common';
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
    SharedModule,
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
