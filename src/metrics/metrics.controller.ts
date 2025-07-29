import { Controller, Get, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { register } from 'prom-client';
import { Public } from '../common';

@Injectable()
@Controller('metrics')
export class MetricsController {
  private readonly serviceEndpoints: Record<string, string>;

  constructor(private readonly configService: ConfigService) {
    // Map service names to their HTTP metric endpoints
    this.serviceEndpoints = {
      auth: 'auth:4012',
      swap: 'swap:4042',
      nostr: 'nostr:4052',
      sms: 'sms:4062',
      shares: 'shares:4072',
      solowallet: 'solowallet:4082',
      chama: 'chama:4092',
      notification: 'notification:5002',
    };
  }

  @Get()
  @Public()
  async getMetrics() {
    try {
      // First, get metrics from API gateway itself
      const ownMetrics = await register.metrics();
      let combinedMetrics = ownMetrics;

      // Collect metrics from individual services
      for (const [service, url] of Object.entries(this.serviceEndpoints)) {
        if (!url) continue;

        try {
          const metricsUrl = `http://${url}/metrics`;
          const response = await axios.get(metricsUrl, { timeout: 500 });

          if (response.status === 200) {
            // Add service metrics to combined output without logging the data
            combinedMetrics += `\n# Metrics from ${service} service\n${response.data}`;
          }
        } catch (err) {
          // Skip services that don't have metrics endpoints available
          console.log(
            `Could not fetch metrics from ${service}: ${err.message}`,
          );
        }
      }

      return combinedMetrics;
    } catch (error) {
      console.error('Error fetching metrics:', error);
      return 'Error fetching metrics';
    }
  }
}
