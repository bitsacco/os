import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseMetricsRepository } from '../../common/database/metrics.repository';
import {
  OperationalMetrics,
  OperationalMetricsDocument,
  OperationalMetricsModel,
} from './operational-metrics.schema';

/**
 * Repository for operational metrics persistence operations
 * Handles system health, performance monitoring, resource usage, and infrastructure metrics
 */
@Injectable()
export class OperationalMetricsRepository extends BaseMetricsRepository<OperationalMetricsDocument> {
  protected readonly logger = new Logger(OperationalMetricsRepository.name);

  constructor(
    @InjectModel(OperationalMetrics.name)
    private operationalMetricsModel: Model<OperationalMetricsModel>,
  ) {
    super(operationalMetricsModel as any);
  }

  /**
   * Get system health trends over time
   */
  async getSystemHealthTrends(hours: number = 24): Promise<any[]> {
    const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);

    const pipeline = [
      {
        $match: {
          period: 'hourly',
          timestamp: { $gte: startDate },
        },
      },
      {
        $sort: { timestamp: 1 },
      },
      {
        $project: {
          timestamp: 1,
          status: '$system.health.status',
          uptime: '$system.health.uptime',
          memoryUsage: '$system.health.memoryUsage',
          cpuUsage: '$system.health.cpuUsage',
          errorRate: '$system.performance.errorMetrics.errorRate',
          responseTime: '$system.performance.responseTime.averageResponseTime',
        },
      },
    ];

    return this.getAggregatedMetrics('operational-metrics', 'hourly', pipeline);
  }

  /**
   * Get performance analytics with response times and throughput
   */
  async getPerformanceAnalytics(
    period: string = 'hourly',
    hours: number = 6,
  ): Promise<any[]> {
    const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);

    const pipeline = [
      {
        $match: {
          period,
          timestamp: { $gte: startDate },
        },
      },
      {
        $sort: { timestamp: 1 },
      },
      {
        $project: {
          timestamp: 1,
          averageResponseTime:
            '$system.performance.responseTime.averageResponseTime',
          p95ResponseTime: '$system.performance.responseTime.p95ResponseTime',
          p99ResponseTime: '$system.performance.responseTime.p99ResponseTime',
          requestsPerSecond:
            '$system.performance.responseTime.requestsPerSecond',
          totalRequests: '$system.performance.throughput.totalRequests',
          successfulRequests:
            '$system.performance.throughput.successfulRequests',
          failedRequests: '$system.performance.throughput.failedRequests',
          errorRate: '$system.performance.errorMetrics.errorRate',
        },
      },
      {
        $addFields: {
          successRate: {
            $cond: {
              if: { $gt: ['$totalRequests', 0] },
              then: {
                $multiply: [
                  { $divide: ['$successfulRequests', '$totalRequests'] },
                  100,
                ],
              },
              else: 0,
            },
          },
        },
      },
    ];

    return this.getAggregatedMetrics('operational-metrics', period, pipeline);
  }

  /**
   * Get resource utilization trends
   */
  async getResourceUtilizationTrends(hours: number = 12): Promise<any[]> {
    const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);

    const pipeline = [
      {
        $match: {
          period: 'hourly',
          timestamp: { $gte: startDate },
        },
      },
      {
        $sort: { timestamp: 1 },
      },
      {
        $project: {
          timestamp: 1,
          memoryUsagePercent: '$resources.server.memoryUsagePercent',
          cpuUsagePercent: '$resources.server.cpuUsagePercent',
          diskUsagePercent: '$resources.server.diskUsagePercent',
          activeConnections: '$resources.server.activeConnections',
          loadAverage: '$resources.server.loadAverage',
          dbConnections: '$resources.database.connectionCount',
          dbActiveConnections: '$resources.database.activeConnections',
          cacheHitRate: '$resources.cache.hitRate',
          cacheMemoryUsed: '$resources.cache.memoryUsedMB',
        },
      },
    ];

    return this.getAggregatedMetrics('operational-metrics', 'hourly', pipeline);
  }

  /**
   * Get error analysis and breakdown
   */
  async getErrorAnalysis(days: number = 7): Promise<any[]> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const pipeline = [
      {
        $match: {
          period: 'daily',
          timestamp: { $gte: startDate },
          'system.performance.errorMetrics.totalErrors': { $gt: 0 },
        },
      },
      {
        $sort: { timestamp: -1 },
      },
      {
        $project: {
          timestamp: 1,
          totalErrors: '$system.performance.errorMetrics.totalErrors',
          errorRate: '$system.performance.errorMetrics.errorRate',
          errorsByType: '$system.performance.errorMetrics.errorsByType',
          errorsByService: '$system.performance.errorMetrics.errorsByService',
          criticalErrors: '$system.performance.errorMetrics.criticalErrors',
        },
      },
      {
        $limit: days,
      },
    ];

    return this.getAggregatedMetrics('operational-metrics', 'daily', pipeline);
  }

  /**
   * Get infrastructure health summary
   */
  async getInfrastructureHealthSummary(): Promise<any[]> {
    const pipeline = [
      {
        $match: {
          period: 'real-time',
        },
      },
      {
        $sort: { timestamp: -1 },
      },
      {
        $limit: 1,
      },
      {
        $project: {
          timestamp: 1,
          activeServices: '$infrastructure.activeServices',
          healthyServices: '$infrastructure.healthyServices',
          unhealthyServices: '$infrastructure.unhealthyServices',
          serviceStatus: '$infrastructure.serviceStatus',
          externalDependencies: '$infrastructure.externalDependencies',
          networkLatency: '$infrastructure.networkLatency',
          networkErrorRate: {
            $cond: {
              if: { $gt: ['$infrastructure.totalNetworkRequests', 0] },
              then: {
                $multiply: [
                  {
                    $divide: [
                      '$infrastructure.failedNetworkRequests',
                      '$infrastructure.totalNetworkRequests',
                    ],
                  },
                  100,
                ],
              },
              else: 0,
            },
          },
        },
      },
    ];

    return this.getAggregatedMetrics(
      'operational-metrics',
      'real-time',
      pipeline,
    );
  }

  /**
   * Get endpoint performance breakdown
   */
  async getEndpointPerformance(): Promise<any[]> {
    const pipeline = [
      {
        $match: {
          period: 'daily',
          'system.performance.responseTime.endpointMetrics': {
            $exists: true,
            $ne: {},
          },
        },
      },
      {
        $sort: { timestamp: -1 },
      },
      {
        $limit: 7,
      },
      {
        $unwind: {
          path: '$system.performance.responseTime.endpointMetrics',
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $group: {
          _id: '$system.performance.responseTime.endpointMetrics.k',
          avgResponseTime: {
            $avg: '$system.performance.responseTime.endpointMetrics.v.averageResponseTime',
          },
          totalRequests: {
            $sum: '$system.performance.responseTime.endpointMetrics.v.requestCount',
          },
          totalErrors: {
            $sum: '$system.performance.responseTime.endpointMetrics.v.errorCount',
          },
          dataPoints: { $sum: 1 },
        },
      },
      {
        $addFields: {
          errorRate: {
            $cond: {
              if: { $gt: ['$totalRequests', 0] },
              then: {
                $multiply: [
                  { $divide: ['$totalErrors', '$totalRequests'] },
                  100,
                ],
              },
              else: 0,
            },
          },
        },
      },
      {
        $sort: { totalRequests: -1 },
      },
    ];

    return this.getAggregatedMetrics('operational-metrics', 'daily', pipeline);
  }

  /**
   * Get database performance metrics
   */
  async getDatabasePerformanceMetrics(hours: number = 24): Promise<any[]> {
    const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);

    const pipeline = [
      {
        $match: {
          period: 'hourly',
          timestamp: { $gte: startDate },
        },
      },
      {
        $sort: { timestamp: 1 },
      },
      {
        $project: {
          timestamp: 1,
          connectionCount: '$resources.database.connectionCount',
          activeConnections: '$resources.database.activeConnections',
          queryExecutionTime: '$resources.database.queryExecutionTime',
          slowQueries: '$resources.database.slowQueries',
          connectionPoolUsage: '$resources.database.connectionPoolUsage',
          isHealthy: '$resources.database.isHealthy',
          documentsRead: '$resources.database.documentsRead',
          documentsWritten: '$resources.database.documentsWritten',
        },
      },
      {
        $addFields: {
          totalDocumentOperations: {
            $add: ['$documentsRead', '$documentsWritten'],
          },
          connectionUtilization: {
            $cond: {
              if: { $gt: ['$connectionCount', 0] },
              then: {
                $multiply: [
                  { $divide: ['$activeConnections', '$connectionCount'] },
                  100,
                ],
              },
              else: 0,
            },
          },
        },
      },
    ];

    return this.getAggregatedMetrics('operational-metrics', 'hourly', pipeline);
  }

  /**
   * Get real-time operational summary
   */
  async getRealTimeOperationalSummary(): Promise<OperationalMetricsDocument | null> {
    try {
      const latestMetrics = await this.getLatestMetrics(
        'operational-metrics',
        'real-time',
      );
      return latestMetrics;
    } catch (error) {
      this.logger.error('Failed to get real-time operational summary', error);
      return null;
    }
  }

  /**
   * Store operational metrics with validation
   */
  async storeOperationalMetrics(
    metricsData: Omit<
      OperationalMetricsDocument,
      '_id' | 'createdAt' | 'updatedAt'
    >,
  ): Promise<OperationalMetricsDocument> {
    try {
      // Validate required fields
      if (!metricsData.source || !metricsData.period) {
        throw new Error('Source and period are required fields');
      }

      // Ensure timestamp is set
      if (!metricsData.timestamp) {
        metricsData.timestamp = new Date();
      }

      // Validate operational data consistency
      this.validateOperationalDataConsistency(metricsData);

      return await this.storeCurrentMetrics(metricsData);
    } catch (error) {
      this.logger.error('Failed to store operational metrics', {
        source: metricsData.source,
        period: metricsData.period,
        error,
      });
      throw error;
    }
  }

  /**
   * Get alerts based on thresholds
   */
  async getOperationalAlerts(): Promise<any[]> {
    const pipeline = [
      {
        $match: {
          period: 'real-time',
          $or: [
            { 'system.health.status': { $in: ['degraded', 'critical'] } },
            { 'system.performance.errorMetrics.errorRate': { $gt: 5 } },
            { 'resources.server.memoryUsagePercent': { $gt: 85 } },
            { 'resources.server.cpuUsagePercent': { $gt: 80 } },
            { 'resources.database.isHealthy': false },
            { 'resources.cache.isHealthy': false },
          ],
        },
      },
      {
        $sort: { timestamp: -1 },
      },
      {
        $limit: 10,
      },
      {
        $project: {
          timestamp: 1,
          healthStatus: '$system.health.status',
          errorRate: '$system.performance.errorMetrics.errorRate',
          memoryUsage: '$resources.server.memoryUsagePercent',
          cpuUsage: '$resources.server.cpuUsagePercent',
          dbHealthy: '$resources.database.isHealthy',
          cacheHealthy: '$resources.cache.isHealthy',
          unhealthyServices: '$infrastructure.unhealthyServices',
        },
      },
    ];

    return this.getAggregatedMetrics(
      'operational-metrics',
      'real-time',
      pipeline,
    );
  }

  /**
   * Validate operational data consistency
   */
  private validateOperationalDataConsistency(
    metricsData: Omit<
      OperationalMetricsDocument,
      '_id' | 'createdAt' | 'updatedAt'
    >,
  ): void {
    const { system, resources, infrastructure } = metricsData;

    // Validate throughput consistency
    const totalRequests = system.performance.throughput.totalRequests;
    const successfulRequests = system.performance.throughput.successfulRequests;
    const failedRequests = system.performance.throughput.failedRequests;

    if (totalRequests < successfulRequests + failedRequests) {
      this.logger.warn('Throughput metrics inconsistency detected', {
        total: totalRequests,
        successful: successfulRequests,
        failed: failedRequests,
      });
    }

    // Validate percentage values
    if (
      resources.server.memoryUsagePercent > 100 ||
      resources.server.memoryUsagePercent < 0
    ) {
      this.logger.warn('Invalid memory usage percentage', {
        memoryUsage: resources.server.memoryUsagePercent,
      });
    }

    if (
      resources.server.cpuUsagePercent > 100 ||
      resources.server.cpuUsagePercent < 0
    ) {
      this.logger.warn('Invalid CPU usage percentage', {
        cpuUsage: resources.server.cpuUsagePercent,
      });
    }

    // Validate cache hit rate
    if (resources.cache.hitRate > 100 || resources.cache.hitRate < 0) {
      this.logger.warn('Invalid cache hit rate', {
        hitRate: resources.cache.hitRate,
      });
    }

    // Validate infrastructure consistency
    const totalServices =
      infrastructure.healthyServices + infrastructure.unhealthyServices;
    if (totalServices !== infrastructure.activeServices) {
      this.logger.warn('Infrastructure service count inconsistency', {
        activeServices: infrastructure.activeServices,
        healthy: infrastructure.healthyServices,
        unhealthy: infrastructure.unhealthyServices,
        calculated: totalServices,
      });
    }
  }
}
