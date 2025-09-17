import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseMetricsRepository } from '../../common/database/metrics.repository';
import {
  BusinessMetrics,
  BusinessMetricsDocument,
  BusinessMetricsModel,
} from './business-metrics.schema';

/**
 * Repository for business metrics persistence operations
 * Handles user engagement, session tracking, feature usage, and retention metrics
 */
@Injectable()
export class BusinessMetricsRepository extends BaseMetricsRepository<BusinessMetricsDocument> {
  protected readonly logger = new Logger(BusinessMetricsRepository.name);

  constructor(
    @InjectModel(BusinessMetrics.name)
    private businessMetricsModel: Model<BusinessMetricsModel>,
  ) {
    super(businessMetricsModel as any);
  }

  /**
   * Get user engagement trends over time
   */
  async getUserEngagementTrends(days: number = 30): Promise<any[]> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const pipeline = [
      {
        $match: {
          period: 'daily',
          timestamp: { $gte: startDate },
        },
      },
      {
        $sort: { timestamp: 1 },
      },
      {
        $project: {
          timestamp: 1,
          dailyActiveUsers: '$userEngagement.dailyActiveUsers',
          monthlyActiveUsers: '$userEngagement.monthlyActiveUsers',
          newRegistrations: '$userEngagement.newUserRegistrations',
          dauMauRatio: '$userEngagement.dau_mau_ratio',
        },
      },
    ];

    return this.getAggregatedMetrics('business-metrics', 'daily', pipeline);
  }

  /**
   * Get feature usage analytics
   */
  async getFeatureUsageAnalytics(featureName?: string): Promise<any[]> {
    const matchStage: any = {
      period: { $in: ['daily', 'weekly'] },
      featureUsage: { $exists: true, $ne: {} },
    };

    const pipeline = [
      { $match: matchStage },
      { $sort: { timestamp: -1 } },
      { $limit: 50 },
      {
        $project: {
          timestamp: 1,
          period: 1,
          featureUsage: 1,
        },
      },
    ];

    if (featureName) {
      pipeline.splice(3, 0, {
        $match: {
          [`featureUsage.${featureName}`]: { $exists: true },
        },
      });
    }

    return this.getAggregatedMetrics('business-metrics', '', pipeline);
  }

  /**
   * Get session analytics by device type
   */
  async getSessionAnalyticsByDevice(days: number = 7): Promise<any[]> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const pipeline = [
      {
        $match: {
          period: 'daily',
          timestamp: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: '$sessions.total' },
          avgDuration: { $avg: '$sessions.averageDuration' },
          deviceBreakdown: {
            $push: '$sessions.byDevice',
          },
        },
      },
      {
        $project: {
          _id: 0,
          totalSessions: 1,
          avgDuration: 1,
          deviceBreakdown: {
            $reduce: {
              input: '$deviceBreakdown',
              initialValue: {},
              in: {
                $mergeObjects: ['$$value', '$$this'],
              },
            },
          },
        },
      },
    ];

    return this.getAggregatedMetrics('business-metrics', 'daily', pipeline);
  }

  /**
   * Get retention funnel analysis
   */
  async getRetentionFunnelAnalysis(): Promise<any[]> {
    const pipeline = [
      {
        $match: {
          period: 'daily',
          'retention.day1': { $gt: 0 },
        },
      },
      {
        $sort: { timestamp: -1 },
      },
      {
        $limit: 30,
      },
      {
        $project: {
          timestamp: 1,
          retention: 1,
        },
      },
      {
        $group: {
          _id: null,
          avgDay1Retention: { $avg: '$retention.day1' },
          avgDay7Retention: { $avg: '$retention.day7' },
          avgDay30Retention: { $avg: '$retention.day30' },
          avgDay90Retention: { $avg: '$retention.day90' },
          dataPoints: {
            $push: {
              timestamp: '$timestamp',
              day1: '$retention.day1',
              day7: '$retention.day7',
              day30: '$retention.day30',
              day90: '$retention.day90',
            },
          },
        },
      },
    ];

    return this.getAggregatedMetrics('business-metrics', 'daily', pipeline);
  }

  /**
   * Get real-time engagement summary
   */
  async getRealTimeEngagementSummary(): Promise<BusinessMetricsDocument | null> {
    try {
      const latestMetrics = await this.getLatestMetrics(
        'business-metrics',
        'real-time',
      );
      return latestMetrics;
    } catch (error) {
      this.logger.error('Failed to get real-time engagement summary', error);
      return null;
    }
  }

  /**
   * Store business metrics with validation
   */
  async storeBusinessMetrics(
    metricsData: Omit<
      BusinessMetricsDocument,
      '_id' | 'createdAt' | 'updatedAt'
    >,
  ): Promise<BusinessMetricsDocument> {
    try {
      // Validate required fields
      if (!metricsData.source || !metricsData.period) {
        throw new Error('Source and period are required fields');
      }

      // Ensure timestamp is set
      if (!metricsData.timestamp) {
        metricsData.timestamp = new Date();
      }

      return await this.storeCurrentMetrics(metricsData);
    } catch (error) {
      this.logger.error('Failed to store business metrics', {
        source: metricsData.source,
        period: metricsData.period,
        error,
      });
      throw error;
    }
  }

  /**
   * Get top performing features by success rate
   */
  async getTopPerformingFeatures(limit: number = 10): Promise<any[]> {
    const pipeline = [
      {
        $match: {
          period: 'daily',
          featureUsage: { $exists: true, $ne: {} },
        },
      },
      {
        $sort: { timestamp: -1 },
      },
      {
        $limit: 30,
      },
      {
        $unwind: {
          path: '$featureUsage',
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $group: {
          _id: '$featureUsage.k',
          totalUsage: { $sum: '$featureUsage.v.usageCount' },
          totalSuccess: { $sum: '$featureUsage.v.successCount' },
          totalFailure: { $sum: '$featureUsage.v.failureCount' },
          avgDuration: { $avg: '$featureUsage.v.averageDuration' },
        },
      },
      {
        $addFields: {
          successRate: {
            $cond: {
              if: { $gt: ['$totalUsage', 0] },
              then: { $divide: ['$totalSuccess', '$totalUsage'] },
              else: 0,
            },
          },
        },
      },
      {
        $sort: { successRate: -1, totalUsage: -1 },
      },
      {
        $limit: limit,
      },
    ];

    return this.getAggregatedMetrics('business-metrics', 'daily', pipeline);
  }
}
