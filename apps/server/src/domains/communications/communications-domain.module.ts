import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { SmsService } from './services/sms.service';
import { NostrService } from './services/nostr.service';
import { BusinessMetricsService } from '../../infrastructure/monitoring/business-metrics.service';
import { TelemetryService } from '../../infrastructure/monitoring/telemetry.service';
import { MetricsService } from '../../infrastructure/monitoring/metrics.service';

@Module({
  imports: [ConfigModule, EventEmitterModule],
  providers: [
    SmsService,
    NostrService,
    BusinessMetricsService,
    TelemetryService,
    MetricsService,
  ],
  exports: [SmsService, NostrService],
})
export class CommunicationsDomainModule {}
