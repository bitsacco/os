import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LnurlMetricsService } from './lnurl-metrics.service';
import { SharesMetricsService } from './shares-metrics.service';

@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [LnurlMetricsService, SharesMetricsService],
  exports: [LnurlMetricsService, SharesMetricsService],
})
export class MonitoringModule {}
