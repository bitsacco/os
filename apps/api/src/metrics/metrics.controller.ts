import { Controller, Get, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { register } from 'prom-client';
import { Public } from '@bitsacco/common';

@Injectable()
@Controller('metrics')
export class MetricsController {
  private readonly serviceEndpoints: Record<string, string>;

  constructor(private readonly configService: ConfigService) {
    // Map service names to their HTTP metric endpoints
    this.serviceEndpoints = {
      shares: 'shares:4070',
      chama: 'chama:4090',
      solowallet: 'solowallet:4080',
      swap: 'swap:4040',
      auth: 'auth:4010',
      sms: 'sms:4060',
      nostr: 'nostr:4050',
      notification: 'notification:5000',
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
            // Add service metrics to combined output
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
