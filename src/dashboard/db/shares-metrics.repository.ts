import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseMetricsRepository } from '../../common/database/metrics.repository';
import {
  SharesMetrics,
  SharesMetricsDocument,
  SharesMetricsModel,
} from './shares-metrics.schema';

/**
 * Repository for shares metrics persistence operations
 * Handles subscription tracking, transfer analysis, ownership distribution, and valuation metrics
 */
@Injectable()
export class SharesMetricsRepository extends BaseMetricsRepository<SharesMetricsDocument> {
  protected readonly logger = new Logger(SharesMetricsRepository.name);

  constructor(
    @InjectModel(SharesMetrics.name)
    private sharesMetricsModel: Model<SharesMetricsModel>,
  ) {
    super(sharesMetricsModel as any);
  }

  /**
   * Get subscription trends over time
   */
  async getSubscriptionTrends(days: number = 30): Promise<any[]> {
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
          totalSubscriptions: '$subscriptions.total',
          successfulSubscriptions: '$subscriptions.successful',
          successRate: '$subscriptions.successRate',
          totalShares: '$subscriptions.totalShares',
          totalValue: '$subscriptions.totalValue',
          averageSubscriptionSize: '$subscriptions.averageSubscriptionSize',
          averageDuration: '$subscriptions.averageDuration',
        },
      },
    ];

    return this.getAggregatedMetrics('shares-metrics', 'daily', pipeline);
  }

  /**
   * Get ownership distribution analysis
   */
  async getOwnershipDistributionAnalysis(): Promise<any[]> {
    const pipeline = [
      {
        $match: {
          period: 'daily',
          'ownership.totalShares': { $gt: 0 },
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
          totalShares: '$ownership.totalShares',
          distributedShares: '$ownership.distributedShares',
          availableShares: '$ownership.availableShares',
          ownershipConcentration: '$ownership.ownershipConcentration',
          totalShareholders: '$ownership.totalShareholders',
          averageSharesPerHolder: '$ownership.averageSharesPerHolder',
          medianSharesPerHolder: '$ownership.medianSharesPerHolder',
          giniCoefficient: '$ownership.giniCoefficient',
          distributionBuckets: '$ownership.distributionBuckets',
        },
      },
      {
        $addFields: {
          distributionRatio: {
            $cond: {
              if: { $gt: ['$totalShares', 0] },
              then: {
                $multiply: [
                  { $divide: ['$distributedShares', '$totalShares'] },
                  100,
                ],
              },
              else: 0,
            },
          },
        },
      },
    ];

    return this.getAggregatedMetrics('shares-metrics', 'daily', pipeline);
  }

  /**
   * Get valuation trends and market metrics
   */
  async getValuationTrends(days: number = 90): Promise<any[]> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const pipeline = [
      {
        $match: {
          period: 'daily',
          timestamp: { $gte: startDate },
          'valuation.currentSharePrice': { $gt: 0 },
        },
      },
      {
        $sort: { timestamp: 1 },
      },
      {
        $project: {
          timestamp: 1,
          currentSharePrice: '$valuation.currentSharePrice',
          marketCapitalization: '$valuation.marketCapitalization',
          totalAssetValue: '$valuation.totalAssetValue',
          bookValuePerShare: '$valuation.bookValuePerShare',
          priceToBookRatio: '$valuation.priceToBookRatio',
          dividendYield: '$valuation.dividendYield',
          returnOnEquity: '$valuation.returnOnEquity',
        },
      },
      {
        $addFields: {
          priceChange: {
            $subtract: [
              '$currentSharePrice',
              {
                $ifNull: [
                  { $first: '$currentSharePrice' },
                  '$currentSharePrice',
                ],
              },
            ],
          },
          priceChangePercent: {
            $cond: {
              if: { $gt: [{ $first: '$currentSharePrice' }, 0] },
              then: {
                $multiply: [
                  {
                    $divide: [
                      {
                        $subtract: [
                          '$currentSharePrice',
                          { $first: '$currentSharePrice' },
                        ],
                      },
                      { $first: '$currentSharePrice' },
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

    return this.getAggregatedMetrics('shares-metrics', 'daily', pipeline);
  }

  /**
   * Get transfer activity analysis
   */
  async getTransferActivityAnalysis(days: number = 14): Promise<any[]> {
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
          totalTransfers: '$transfers.total',
          successfulTransfers: '$transfers.successful',
          successRate: '$transfers.successRate',
          transferVolume: '$transfers.volume',
          averageSize: '$transfers.averageSize',
          totalShares: '$transfers.totalShares',
          totalValue: '$transfers.totalValue',
          averageDuration: '$transfers.averageDuration',
          frequentTransferPairs: '$transfers.frequentTransferPairs',
        },
      },
      {
        $addFields: {
          transferVelocity: {
            $cond: {
              if: { $gt: ['$totalShares', 0] },
              then: { $divide: ['$transferVolume', '$totalShares'] },
              else: 0,
            },
          },
        },
      },
    ];

    return this.getAggregatedMetrics('shares-metrics', 'daily', pipeline);
  }

  /**
   * Get trading activity patterns
   */
  async getTradingActivityPatterns(): Promise<any[]> {
    const pipeline = [
      {
        $match: {
          period: 'daily',
          'tradingActivity.totalTransactions': { $gt: 0 },
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
          totalTransactions: '$tradingActivity.totalTransactions',
          tradingVolume: '$tradingActivity.tradingVolume',
          averageTransactionValue: '$tradingActivity.averageTransactionValue',
          activeTraders: '$tradingActivity.activeTraders',
          velocityRatio: '$tradingActivity.velocityRatio',
          turnoverRate: '$tradingActivity.turnoverRate',
          tradingVolumeByHour: '$tradingActivity.tradingVolumeByHour',
          tradingVolumeByDay: '$tradingActivity.tradingVolumeByDay',
        },
      },
      {
        $addFields: {
          averageTradesPerTrader: {
            $cond: {
              if: { $gt: ['$activeTraders', 0] },
              then: { $divide: ['$totalTransactions', '$activeTraders'] },
              else: 0,
            },
          },
          marketLiquidity: {
            $cond: {
              if: { $gt: ['$tradingVolume', 0] },
              then: { $multiply: ['$turnoverRate', '$velocityRatio'] },
              else: 0,
            },
          },
        },
      },
    ];

    return this.getAggregatedMetrics('shares-metrics', 'daily', pipeline);
  }

  /**
   * Get error analysis and troubleshooting data
   */
  async getErrorAnalysis(days: number = 7): Promise<any[]> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const pipeline = [
      {
        $match: {
          period: 'daily',
          timestamp: { $gte: startDate },
          $or: [
            { 'errorAnalysis.userReachingLimits': { $gt: 0 } },
            { 'errorAnalysis.validationErrors': { $gt: 0 } },
            { 'errorAnalysis.systemErrors': { $gt: 0 } },
          ],
        },
      },
      {
        $sort: { timestamp: -1 },
      },
      {
        $project: {
          timestamp: 1,
          errorTypes: '$errorAnalysis.errorTypes',
          userReachingLimits: '$errorAnalysis.userReachingLimits',
          validationErrors: '$errorAnalysis.validationErrors',
          insufficientFundsErrors: '$errorAnalysis.insufficientFundsErrors',
          ownershipLimitErrors: '$errorAnalysis.ownershipLimitErrors',
          systemErrors: '$errorAnalysis.systemErrors',
          networkErrors: '$errorAnalysis.networkErrors',
          errorsByService: '$errorAnalysis.errorsByService',
        },
      },
      {
        $addFields: {
          totalErrors: {
            $add: [
              '$validationErrors',
              '$systemErrors',
              '$networkErrors',
              '$insufficientFundsErrors',
              '$ownershipLimitErrors',
            ],
          },
        },
      },
    ];

    return this.getAggregatedMetrics('shares-metrics', 'daily', pipeline);
  }

  /**
   * Get performance metrics analysis
   */
  async getPerformanceAnalysis(hours: number = 24): Promise<any[]> {
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
          averageSubscriptionTime: '$performance.averageSubscriptionTime',
          averageTransferTime: '$performance.averageTransferTime',
          averageValuationTime: '$performance.averageValuationTime',
          p95SubscriptionTime: '$performance.p95SubscriptionTime',
          p95TransferTime: '$performance.p95TransferTime',
          systemThroughput: '$performance.systemThroughput',
          concurrentOperations: '$performance.concurrentOperations',
          operationsByType: '$performance.operationsByType',
        },
      },
      {
        $addFields: {
          overallPerformanceScore: {
            $divide: [
              {
                $add: [
                  {
                    $divide: [10000, { $add: ['$averageSubscriptionTime', 1] }],
                  },
                  { $divide: [10000, { $add: ['$averageTransferTime', 1] }] },
                  { $multiply: ['$systemThroughput', 0.1] },
                ],
              },
              3,
            ],
          },
        },
      },
    ];

    return this.getAggregatedMetrics('shares-metrics', 'hourly', pipeline);
  }

  /**
   * Get top shareholders analysis
   */
  async getTopShareholdersAnalysis(): Promise<any[]> {
    const pipeline = [
      {
        $match: {
          period: 'daily',
          'ownership.distributionBuckets': { $exists: true, $ne: {} },
        },
      },
      {
        $sort: { timestamp: -1 },
      },
      {
        $limit: 1,
      },
      {
        $unwind: {
          path: '$ownership.distributionBuckets',
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $project: {
          bucket: '$ownership.distributionBuckets.k',
          shareholderCount: '$ownership.distributionBuckets.v',
          totalShareholders: '$ownership.totalShareholders',
        },
      },
      {
        $addFields: {
          percentageOfShareholders: {
            $cond: {
              if: { $gt: ['$totalShareholders', 0] },
              then: {
                $multiply: [
                  { $divide: ['$shareholderCount', '$totalShareholders'] },
                  100,
                ],
              },
              else: 0,
            },
          },
        },
      },
      {
        $sort: { bucket: 1 },
      },
    ];

    return this.getAggregatedMetrics('shares-metrics', 'daily', pipeline);
  }

  /**
   * Get real-time shares summary
   */
  async getRealTimeSharesSummary(): Promise<SharesMetricsDocument | null> {
    try {
      const latestMetrics = await this.getLatestMetrics(
        'shares-metrics',
        'real-time',
      );
      return latestMetrics;
    } catch (error) {
      this.logger.error('Failed to get real-time shares summary', error);
      return null;
    }
  }

  /**
   * Store shares metrics with validation
   */
  async storeSharesMetrics(
    metricsData: Omit<SharesMetricsDocument, '_id' | 'createdAt' | 'updatedAt'>,
  ): Promise<SharesMetricsDocument> {
    try {
      // Validate required fields
      if (!metricsData.source || !metricsData.period) {
        throw new Error('Source and period are required fields');
      }

      // Ensure timestamp is set
      if (!metricsData.timestamp) {
        metricsData.timestamp = new Date();
      }

      // Validate shares data consistency
      this.validateSharesDataConsistency(metricsData);

      return await this.storeCurrentMetrics(metricsData);
    } catch (error) {
      this.logger.error('Failed to store shares metrics', {
        source: metricsData.source,
        period: metricsData.period,
        error,
      });
      throw error;
    }
  }

  /**
   * Get market health indicators
   */
  async getMarketHealthIndicators(): Promise<any> {
    try {
      const latest = await this.getLatestMetrics('shares-metrics', 'daily');
      if (!latest) return null;

      const healthScore = this.calculateMarketHealthScore(latest);

      return {
        timestamp: latest.timestamp,
        healthScore,
        indicators: {
          ownershipDistribution:
            latest.ownership.giniCoefficient < 0.7 ? 'healthy' : 'concentrated',
          tradingActivity:
            latest.tradingActivity.turnoverRate > 0.1 ? 'active' : 'low',
          subscriptionSuccess:
            latest.subscriptions.successRate > 90 ? 'healthy' : 'concerning',
          transferSuccess:
            latest.transfers.successRate > 95 ? 'healthy' : 'concerning',
          marketLiquidity:
            latest.valuation.priceToBookRatio > 0.8 ? 'liquid' : 'illiquid',
        },
        metrics: {
          totalShares: latest.ownership.totalShares,
          marketCap: latest.valuation.marketCapitalization,
          sharePrice: latest.valuation.currentSharePrice,
          activeTraders: latest.tradingActivity.activeTraders,
          errorRate:
            (latest.errorAnalysis.userReachingLimits /
              Math.max(
                latest.subscriptions.total + latest.transfers.total,
                1,
              )) *
            100,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get market health indicators', error);
      return null;
    }
  }

  /**
   * Validate shares data consistency
   */
  private validateSharesDataConsistency(
    metricsData: Omit<SharesMetricsDocument, '_id' | 'createdAt' | 'updatedAt'>,
  ): void {
    const { subscriptions, transfers, ownership, valuation } = metricsData;

    // Validate subscription counts
    if (subscriptions.total < subscriptions.successful + subscriptions.failed) {
      this.logger.warn('Subscription counts inconsistency detected', {
        total: subscriptions.total,
        successful: subscriptions.successful,
        failed: subscriptions.failed,
      });
    }

    // Validate transfer counts
    if (transfers.total < transfers.successful + transfers.failed) {
      this.logger.warn('Transfer counts inconsistency detected', {
        total: transfers.total,
        successful: transfers.successful,
        failed: transfers.failed,
      });
    }

    // Validate ownership totals
    if (ownership.totalShares < ownership.distributedShares) {
      this.logger.warn('Ownership shares inconsistency detected', {
        total: ownership.totalShares,
        distributed: ownership.distributedShares,
      });
    }

    // Validate percentage values
    if (subscriptions.successRate > 100 || subscriptions.successRate < 0) {
      this.logger.warn('Invalid subscription success rate', {
        successRate: subscriptions.successRate,
      });
    }

    if (transfers.successRate > 100 || transfers.successRate < 0) {
      this.logger.warn('Invalid transfer success rate', {
        successRate: transfers.successRate,
      });
    }

    // Validate valuation consistency
    if (valuation.priceToBookRatio < 0) {
      this.logger.warn('Invalid price to book ratio', {
        priceToBookRatio: valuation.priceToBookRatio,
      });
    }
  }

  /**
   * Calculate market health score (0-100)
   */
  private calculateMarketHealthScore(metrics: SharesMetricsDocument): number {
    const weights = {
      subscriptionSuccess: 0.25,
      transferSuccess: 0.25,
      ownershipDistribution: 0.2,
      tradingActivity: 0.15,
      errorRate: 0.15,
    };

    const scores = {
      subscriptionSuccess: Math.min(metrics.subscriptions.successRate, 100),
      transferSuccess: Math.min(metrics.transfers.successRate, 100),
      ownershipDistribution: Math.max(
        0,
        100 - metrics.ownership.giniCoefficient * 100,
      ),
      tradingActivity: Math.min(
        metrics.tradingActivity.turnoverRate * 1000,
        100,
      ),
      errorRate: Math.max(
        0,
        100 -
          (metrics.errorAnalysis.userReachingLimits /
            Math.max(
              metrics.subscriptions.total + metrics.transfers.total,
              1,
            )) *
            100,
      ),
    };

    let totalScore = 0;
    for (const [metric, weight] of Object.entries(weights)) {
      totalScore += scores[metric as keyof typeof scores] * weight;
    }

    return Math.round(totalScore);
  }
}
