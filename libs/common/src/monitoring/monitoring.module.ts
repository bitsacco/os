import { Module, DynamicModule } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LnurlMetricsService } from './lnurl-metrics.service';
import { OperationMetricsService } from './metrics.service';

/**
 * Base monitoring module with core metrics services
 */
@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [LnurlMetricsService],
  exports: [LnurlMetricsService],
})
export class MonitoringModule {
  /**
   * Register additional custom metric services
   * @param metricServices Array of metric service providers to register
   * @returns Dynamic module with custom metric services
   */
  static forFeature(metricServices: any[] = []): DynamicModule {
    return {
      module: MonitoringModule,
      providers: [...metricServices],
      exports: [...metricServices],
    };
  }
}
