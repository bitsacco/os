import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseMetricsRepository } from '../../common/database/metrics.repository';
import {
  FinancialMetrics,
  FinancialMetricsDocument,
  FinancialMetricsModel,
} from './financial-metrics.schema';

/**
 * Repository for financial metrics persistence operations
 * Handles transaction volumes, swap metrics, FX rates, and financial analytics
 */
@Injectable()
export class FinancialMetricsRepository extends BaseMetricsRepository<FinancialMetricsDocument> {
  protected readonly logger = new Logger(FinancialMetricsRepository.name);

  constructor(
    @InjectModel(FinancialMetrics.name)
    private financialMetricsModel: Model<FinancialMetricsModel>,
  ) {
    super(financialMetricsModel as any);
  }

  /**
   * Get transaction volume trends over time
   */
  async getTransactionVolumeTrends(days: number = 30): Promise<any[]> {
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
          totalVolume: '$transactions.volume.total',
          successfulTransactions: '$transactions.counts.successful',
          failedTransactions: '$transactions.counts.failed',
          successRate: '$transactions.performance.successRate',
          averageDuration: '$transactions.performance.averageDuration',
        },
      },
    ];

    return this.getAggregatedMetrics('financial-metrics', 'daily', pipeline);
  }

  /**
   * Get swap analytics with volume and performance metrics
   */
  async getSwapAnalytics(
    period: string = 'daily',
    days: number = 7,
  ): Promise<any[]> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const pipeline = [
      {
        $match: {
          period,
          timestamp: { $gte: startDate },
        },
      },
      {
        $sort: { timestamp: -1 },
      },
      {
        $project: {
          timestamp: 1,
          onrampVolume: '$swaps.volume.onrampVolume',
          offrampVolume: '$swaps.volume.offrampVolume',
          totalVolume: '$swaps.volume.totalVolume',
          onrampSuccessRate: '$swaps.onramp.successRate',
          offrampSuccessRate: '$swaps.offramp.successRate',
          fxRates: '$swaps.fxRates',
        },
      },
    ];

    return this.getAggregatedMetrics('financial-metrics', period, pipeline);
  }

  /**
   * Get currency distribution analysis
   */
  async getCurrencyDistribution(): Promise<any[]> {
    const pipeline = [
      {
        $match: {
          period: 'daily',
          'transactions.volume.byCurrency': { $exists: true, $ne: {} },
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
          path: '$transactions.volume.byCurrency',
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $group: {
          _id: '$transactions.volume.byCurrency.k',
          totalVolume: { $sum: '$transactions.volume.byCurrency.v' },
          avgVolume: { $avg: '$transactions.volume.byCurrency.v' },
          dataPoints: { $sum: 1 },
        },
      },
      {
        $sort: { totalVolume: -1 },
      },
    ];

    return this.getAggregatedMetrics('financial-metrics', 'daily', pipeline);
  }

  /**
   * Get operation type performance analysis
   */
  async getOperationTypeAnalysis(): Promise<any[]> {
    const pipeline = [
      {
        $match: {
          period: 'daily',
          'transactions.volume.byOperation': { $exists: true, $ne: {} },
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
          path: '$transactions.volume.byOperation',
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $group: {
          _id: '$transactions.volume.byOperation.k',
          totalVolume: { $sum: '$transactions.volume.byOperation.v' },
          avgVolume: { $avg: '$transactions.volume.byOperation.v' },
          dataPoints: { $sum: 1 },
        },
      },
      {
        $sort: { totalVolume: -1 },
      },
    ];

    return this.getAggregatedMetrics('financial-metrics', 'daily', pipeline);
  }

  /**
   * Get FX rate volatility analysis
   */
  async getFxRateVolatility(days: number = 30): Promise<any[]> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const pipeline = [
      {
        $match: {
          period: { $in: ['hourly', 'daily'] },
          timestamp: { $gte: startDate },
          'swaps.fxRates.latestBuyRate': { $gt: 0 },
          'swaps.fxRates.latestSellRate': { $gt: 0 },
        },
      },
      {
        $sort: { timestamp: 1 },
      },
      {
        $project: {
          timestamp: 1,
          buyRate: '$swaps.fxRates.latestBuyRate',
          sellRate: '$swaps.fxRates.latestSellRate',
          spread: '$swaps.fxRates.spread',
          volatility: '$swaps.fxRates.volatility',
        },
      },
      {
        $addFields: {
          spreadPercentage: {
            $cond: {
              if: { $gt: ['$buyRate', 0] },
              then: {
                $multiply: [
                  {
                    $divide: [
                      { $subtract: ['$sellRate', '$buyRate'] },
                      '$buyRate',
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

    return this.getAggregatedMetrics('financial-metrics', '', pipeline);
  }

  /**
   * Get chama financial summary
   */
  async getChamaFinancialSummary(): Promise<any[]> {
    const pipeline = [
      {
        $match: {
          period: 'daily',
          'chamas.totalContributions': { $gt: 0 },
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
          totalContributions: '$chamas.totalContributions',
          totalWithdrawals: '$chamas.totalWithdrawals',
          activeContributors: '$chamas.activeContributors',
          averageContribution: '$chamas.averageContribution',
          totalBalance: '$chamas.totalBalance',
        },
      },
      {
        $addFields: {
          netFlow: { $subtract: ['$totalContributions', '$totalWithdrawals'] },
          contributionGrowthRate: {
            $cond: {
              if: { $gt: ['$totalContributions', 0] },
              then: {
                $divide: ['$totalContributions', '$activeContributors'],
              },
              else: 0,
            },
          },
        },
      },
    ];

    return this.getAggregatedMetrics('financial-metrics', 'daily', pipeline);
  }

  /**
   * Get shares financial performance
   */
  async getSharesFinancialPerformance(): Promise<any[]> {
    const pipeline = [
      {
        $match: {
          period: 'daily',
          'shares.totalShareValue': { $gt: 0 },
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
          totalShareValue: '$shares.totalShareValue',
          totalSubscriptions: '$shares.totalSubscriptions',
          totalTransfers: '$shares.totalTransfers',
          averageSharePrice: '$shares.averageSharePrice',
          marketCapitalization: '$shares.marketCapitalization',
        },
      },
      {
        $addFields: {
          tradingVolume: { $add: ['$totalSubscriptions', '$totalTransfers'] },
          priceToMarketRatio: {
            $cond: {
              if: { $gt: ['$marketCapitalization', 0] },
              then: {
                $divide: ['$averageSharePrice', '$marketCapitalization'],
              },
              else: 0,
            },
          },
        },
      },
    ];

    return this.getAggregatedMetrics('financial-metrics', 'daily', pipeline);
  }

  /**
   * Get real-time financial summary
   */
  async getRealTimeFinancialSummary(): Promise<FinancialMetricsDocument | null> {
    try {
      const latestMetrics = await this.getLatestMetrics(
        'financial-metrics',
        'real-time',
      );
      return latestMetrics;
    } catch (error) {
      this.logger.error('Failed to get real-time financial summary', error);
      return null;
    }
  }

  /**
   * Store financial metrics with validation
   */
  async storeFinancialMetrics(
    metricsData: Omit<
      FinancialMetricsDocument,
      '_id' | 'createdAt' | 'updatedAt'
    >,
  ): Promise<FinancialMetricsDocument> {
    try {
      // Validate required fields
      if (!metricsData.source || !metricsData.period) {
        throw new Error('Source and period are required fields');
      }

      // Ensure timestamp is set
      if (!metricsData.timestamp) {
        metricsData.timestamp = new Date();
      }

      // Validate financial data consistency
      this.validateFinancialDataConsistency(metricsData);

      return await this.storeCurrentMetrics(metricsData);
    } catch (error) {
      this.logger.error('Failed to store financial metrics', {
        source: metricsData.source,
        period: metricsData.period,
        error,
      });
      throw error;
    }
  }

  /**
   * Get financial metrics comparison between periods
   */
  async getFinancialComparison(
    currentPeriod: string,
    previousPeriod: string,
  ): Promise<any> {
    try {
      const [current, previous] = await Promise.all([
        this.getLatestMetrics('financial-metrics', currentPeriod),
        this.getLatestMetrics('financial-metrics', previousPeriod),
      ]);

      if (!current || !previous) {
        return null;
      }

      return {
        current: {
          totalVolume: current.transactions.volume.total,
          successRate: current.transactions.performance.successRate,
          swapVolume: current.swaps.volume.totalVolume,
        },
        previous: {
          totalVolume: previous.transactions.volume.total,
          successRate: previous.transactions.performance.successRate,
          swapVolume: previous.swaps.volume.totalVolume,
        },
        growth: {
          volumeGrowth: this.calculateGrowthRate(
            previous.transactions.volume.total,
            current.transactions.volume.total,
          ),
          successRateChange:
            current.transactions.performance.successRate -
            previous.transactions.performance.successRate,
          swapVolumeGrowth: this.calculateGrowthRate(
            previous.swaps.volume.totalVolume,
            current.swaps.volume.totalVolume,
          ),
        },
      };
    } catch (error) {
      this.logger.error('Failed to get financial comparison', error);
      return null;
    }
  }

  /**
   * Validate financial data consistency
   */
  private validateFinancialDataConsistency(
    metricsData: Omit<
      FinancialMetricsDocument,
      '_id' | 'createdAt' | 'updatedAt'
    >,
  ): void {
    const { transactions, swaps } = metricsData;

    // Validate transaction counts consistency
    if (
      transactions.counts.total <
      transactions.counts.successful + transactions.counts.failed
    ) {
      this.logger.warn('Transaction counts inconsistency detected', {
        total: transactions.counts.total,
        successful: transactions.counts.successful,
        failed: transactions.counts.failed,
      });
    }

    // Validate success rate calculation
    const calculatedSuccessRate =
      transactions.counts.total > 0
        ? (transactions.counts.successful / transactions.counts.total) * 100
        : 0;

    if (
      Math.abs(calculatedSuccessRate - transactions.performance.successRate) > 1
    ) {
      this.logger.warn('Success rate calculation inconsistency', {
        calculated: calculatedSuccessRate,
        stored: transactions.performance.successRate,
      });
    }

    // Validate swap volume consistency
    const totalSwapVolume =
      swaps.volume.onrampVolume + swaps.volume.offrampVolume;
    if (Math.abs(totalSwapVolume - swaps.volume.totalVolume) > 0.01) {
      this.logger.warn('Swap volume inconsistency detected', {
        calculated: totalSwapVolume,
        stored: swaps.volume.totalVolume,
      });
    }
  }

  /**
   * Calculate growth rate percentage
   */
  private calculateGrowthRate(previous: number, current: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }
}
