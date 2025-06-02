import { Module, Global } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MetricsService } from './metrics.service';
import { TelemetryService } from './telemetry.service';
import { BusinessMetricsService } from './business-metrics.service';

@Global()
@Module({
  imports: [
    PrometheusModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        path: '/metrics',
        defaultMetrics: {
          enabled: true,
          config: {
            prefix: 'bitsacco_',
          },
        },
        defaultLabels: {
          service: 'server',
          version: configService.get('APP_VERSION', '1.0.0'),
          environment: configService.get('NODE_ENV', 'development'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [MetricsService, TelemetryService, BusinessMetricsService],
  exports: [
    MetricsService,
    TelemetryService,
    BusinessMetricsService,
    PrometheusModule,
  ],
})
export class MonitoringModule {}
