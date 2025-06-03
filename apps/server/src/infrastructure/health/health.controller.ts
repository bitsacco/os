import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  HealthCheckService,
  HealthCheck,
  MongooseHealthIndicator,
  HealthCheckResult,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { InjectConnection } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { MetricsService } from '../monitoring/metrics.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly mongooseHealthIndicator: MongooseHealthIndicator,
    private readonly metricsService: MetricsService,
    @InjectConnection() private readonly mongoConnection: mongoose.Connection,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  @ApiResponse({ status: 503, description: 'Service is unhealthy' })
  @HealthCheck()
  async check(): Promise<HealthCheckResult> {
    return this.healthCheckService.check([
      // Database health check
      () =>
        this.mongooseHealthIndicator.pingCheck('database', {
          connection: this.mongoConnection,
        }),

      // Redis health check (if available)
      () => this.checkRedis(),

      // Memory health check
      () => this.checkMemoryUsage(),
    ]);
  }

  @Get('detailed')
  @ApiOperation({ summary: 'Detailed health check with metrics' })
  @ApiResponse({ status: 200, description: 'Detailed health information' })
  async detailedCheck() {
    const startTime = Date.now();

    try {
      const [basicHealth, metrics, systemInfo] = await Promise.all([
        this.check(),
        this.metricsService.getHealthMetrics(),
        this.getSystemInfo(),
      ]);

      const responseTime = Date.now() - startTime;

      return {
        ...basicHealth,
        metrics,
        system: systemInfo,
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString(),
        version: process.env.APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
      };
    } catch (error) {
      throw error;
    }
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness check for Kubernetes' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  @ApiResponse({ status: 503, description: 'Service is not ready' })
  async readiness() {
    // Check critical dependencies
    const checks = await Promise.allSettled([
      this.mongooseHealthIndicator.pingCheck('database', {
        connection: this.mongoConnection,
      }),
    ]);

    const failed = checks.filter((check) => check.status === 'rejected');

    if (failed.length > 0) {
      return {
        status: 'error',
        message: 'Service not ready',
        checks: checks.map((check, index) => ({
          name: ['database'][index],
          status: check.status,
          error: check.status === 'rejected' ? check.reason : null,
        })),
      };
    }

    return {
      status: 'ok',
      message: 'Service is ready',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness check for Kubernetes' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  async liveness() {
    // Basic liveness check - just return OK if the service is running
    return {
      status: 'ok',
      message: 'Service is alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  private async checkRedis(): Promise<HealthIndicatorResult> {
    try {
      // TODO: Implement Redis health check when Redis is integrated
      return {
        redis: {
          status: 'up',
          message: 'Redis is healthy',
        },
      };
    } catch (error) {
      return {
        redis: {
          status: 'down',
          message: error.message,
        },
      };
    }
  }

  private async checkMemoryUsage(): Promise<HealthIndicatorResult> {
    const memoryUsage = process.memoryUsage();
    const totalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    const usedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const usagePercentage = (usedMB / totalMB) * 100;

    // Consider unhealthy if memory usage > 90%
    const isHealthy = usagePercentage < 90;

    return {
      memory: {
        status: isHealthy ? 'up' : 'down',
        message: `Memory usage: ${usedMB}MB / ${totalMB}MB (${usagePercentage.toFixed(1)}%)`,
        details: {
          heapUsed: `${usedMB}MB`,
          heapTotal: `${totalMB}MB`,
          external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
          rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
          usagePercentage: `${usagePercentage.toFixed(1)}%`,
        },
      },
    };
  }

  private async getSystemInfo() {
    const cpuUsage = process.cpuUsage();

    return {
      node: {
        version: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      process: {
        pid: process.pid,
        uptime: `${Math.round(process.uptime())}s`,
        memoryUsage: process.memoryUsage(),
        cpuUsage,
      },
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    };
  }
}
