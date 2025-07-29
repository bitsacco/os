import { Module } from '@nestjs/common';
import { createMeter } from '../common';
import { MetricsController } from './metrics.controller';

@Module({
  controllers: [MetricsController],
  providers: [],
})
export class MetricsModule {
  constructor() {
    // Initialize metrics specific to API gateway
    const meter = createMeter('api-gateway');

    meter.createCounter('api_gateway.requests_total', {
      description: 'Total number of requests processed by the API gateway',
    });

    meter.createCounter('api_gateway.errors_total', {
      description: 'Total number of errors encountered by the API gateway',
    });
  }
}
