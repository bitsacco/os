import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LnurlMetricsService } from './lnurl-metrics.service';

@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [LnurlMetricsService],
  exports: [LnurlMetricsService],
})
export class MonitoringModule {}
