import { Controller, Get, Injectable, Res } from '@nestjs/common';
import type { Response } from 'express';
import * as promClient from 'prom-client';
import { Public } from '../common';

@Injectable()
@Controller('metrics')
export class MetricsController {
  @Get()
  @Public()
  async getMetrics(@Res() res: Response) {
    try {
      // Get metrics from the Prometheus registry
      const metrics = await promClient.register.metrics();

      // Set appropriate content type for Prometheus
      res.set('Content-Type', promClient.register.contentType);
      res.send(metrics);
    } catch (error) {
      console.error('Error fetching metrics:', error);
      res.status(500).send('Error fetching metrics');
    }
  }
}
