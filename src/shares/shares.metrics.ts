import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Counter, Histogram } from '@opentelemetry/api';
import { Cron, SchedulerRegistry } from '@nestjs/schedule';
import { OperationMetricsService } from '../common';
import { SharesMetricsRepository } from '../dashboard/db/shares-metrics.repository';
import { SharesMetricsDocument } from '../dashboard/db/shares-metrics.schema';

export const SHARES_SUBSCRIPTION_METRIC = 'shares:subscription';
export const SHARES_TRANSFER_METRIC = 'shares:transfer';
export const SHARES_OWNERSHIP_METRIC = 'shares:ownership';

/**
 * Metrics for share subscription operations
 */
export interface SharesSubscriptionMetric {
  userId: string;
  offerId: string;
  quantity: number;
  success: boolean;
  duration: number;
  errorType?: string;
}

/**
 * Metrics for share transfer operations
 */
export interface SharesTransferMetric {
  fromUserId: string;
  toUserId: string;
  quantity: number;
  success: boolean;
  duration: number;
  errorType?: string;
}

/**
 * Metrics for share ownership
 */
export interface SharesOwnershipMetric {
  userId: string;
  quantity: number;
  percentageOfTotal: number;
  limitReached: boolean;
}

/**
 * Service for collecting metrics related to shares operations
 * Uses OpenTelemetry for metrics collection and supports Prometheus
 */
@Injectable()
export class SharesMetricsService
  extends OperationMetricsService
  implements OnModuleInit
{
  protected readonly logger = new Logger(SharesMetricsService.name);

  // Shares-specific counters
  private subscriptionCounter!: Counter;
  private transferCounter!: Counter;
  private limitWarningCounter!: Counter;

  // Shares-specific histograms
  private shareQuantityHistogram!: Histogram;
  private ownershipPercentageHistogram!: Histogram;

  // In-memory metrics for backward compatibility
  private metrics = {
    totalSubscriptions: 0,
    successfulSubscriptions: 0,
    failedSubscriptions: 0,
    totalTransfers: 0,
    successfulTransfers: 0,
    failedTransfers: 0,
    averageDurationSubscription: 0,
    averageDurationTransfer: 0,
    errorTypes: {} as Record<string, number>,
    totalSharesSubscribed: 0,
    totalSharesTransferred: 0,
    userReachingLimits: 0,
  };

  // Persistence tracking
  private persistenceEnabled = false;
  private lastPersistenceTime: Date | null = null;
  private persistenceErrorCount = 0;
  private ownershipCache: Map<string, number> = new Map(); // userId -> shareCount

  constructor(
    private eventEmitter: EventEmitter2,
    private readonly sharesMetricsRepository?: SharesMetricsRepository,
    private readonly schedulerRegistry?: SchedulerRegistry,
  ) {
    super('shares', 'transaction');
    this.initializeMetrics();
  }

  /**
   * Initialize service on module startup
   */
  async onModuleInit(): Promise<void> {
    await this.initializeFromDatabase();
    this.setupPeriodicPersistence();
  }

  /**
   * Initialize shares-specific metrics
   */
  private initializeMetrics(): void {
    // Subscription counter
    this.subscriptionCounter = this.createCounter(
      'shares.subscriptions.count',
      {
        description: 'Number of share subscription operations',
      },
    );

    // Transfer counter
    this.transferCounter = this.createCounter('shares.transfers.count', {
      description: 'Number of share transfer operations',
    });

    // Limit warning counter
    this.limitWarningCounter = this.createCounter(
      'shares.ownership.limit_warnings',
      {
        description: 'Number of times users have approached ownership limits',
      },
    );

    // Share quantity histogram
    this.shareQuantityHistogram = this.createHistogram('shares.quantity', {
      description: 'Quantity of shares in transactions',
      unit: 'shares',
    });

    // Ownership percentage histogram
    this.ownershipPercentageHistogram = this.createHistogram(
      'shares.ownership.percentage',
      {
        description: 'Percentage of total shares owned by users',
        unit: '%',
      },
    );
  }

  /**
   * Record metrics for a share subscription operation
   * @param metric Metrics data for the subscription operation
   */
  recordSubscriptionMetric(metric: SharesSubscriptionMetric): void {
    // Update in-memory metrics
    this.metrics.totalSubscriptions++;

    if (metric.success) {
      this.metrics.successfulSubscriptions++;
      this.metrics.totalSharesSubscribed += metric.quantity;
    } else {
      this.metrics.failedSubscriptions++;

      // Track error types
      if (metric.errorType) {
        this.metrics.errorTypes[metric.errorType] =
          (this.metrics.errorTypes[metric.errorType] || 0) + 1;
      }
    }

    // Update average duration
    this.metrics.averageDurationSubscription =
      (this.metrics.averageDurationSubscription *
        (this.metrics.totalSubscriptions - 1) +
        metric.duration) /
      this.metrics.totalSubscriptions;

    // Record to OpenTelemetry with standard OperationMetricsService
    this.recordOperationMetric({
      operation: 'subscription',
      success: metric.success,
      duration: metric.duration,
      errorType: metric.errorType,
      labels: {
        userId: metric.userId,
        offerId: metric.offerId,
      },
    });

    // Record shares-specific metrics
    this.subscriptionCounter.add(1, {
      userId: metric.userId,
      offerId: metric.offerId,
      success: String(metric.success),
    });

    this.shareQuantityHistogram.record(metric.quantity, {
      operation: 'subscription',
      userId: metric.userId,
      offerId: metric.offerId,
      success: String(metric.success),
    });

    // Emit event for potential subscribers
    this.eventEmitter.emit(SHARES_SUBSCRIPTION_METRIC, {
      ...metric,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Record metrics for a share transfer operation
   * @param metric Metrics data for the transfer operation
   */
  recordTransferMetric(metric: SharesTransferMetric): void {
    // Update in-memory metrics
    this.metrics.totalTransfers++;

    if (metric.success) {
      this.metrics.successfulTransfers++;
      this.metrics.totalSharesTransferred += metric.quantity;
    } else {
      this.metrics.failedTransfers++;

      // Track error types
      if (metric.errorType) {
        this.metrics.errorTypes[metric.errorType] =
          (this.metrics.errorTypes[metric.errorType] || 0) + 1;
      }
    }

    // Update average duration
    this.metrics.averageDurationTransfer =
      (this.metrics.averageDurationTransfer *
        (this.metrics.totalTransfers - 1) +
        metric.duration) /
      this.metrics.totalTransfers;

    // Record to OpenTelemetry with standard OperationMetricsService
    this.recordOperationMetric({
      operation: 'transfer',
      success: metric.success,
      duration: metric.duration,
      errorType: metric.errorType,
      labels: {
        fromUserId: metric.fromUserId,
        toUserId: metric.toUserId,
      },
    });

    // Record shares-specific metrics
    this.transferCounter.add(1, {
      fromUserId: metric.fromUserId,
      toUserId: metric.toUserId,
      success: String(metric.success),
    });

    this.shareQuantityHistogram.record(metric.quantity, {
      operation: 'transfer',
      fromUserId: metric.fromUserId,
      toUserId: metric.toUserId,
      success: String(metric.success),
    });

    // Emit event for potential subscribers
    this.eventEmitter.emit(SHARES_TRANSFER_METRIC, {
      ...metric,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Record metrics for user share ownership
   * @param metric Metrics data for user ownership
   */
  recordOwnershipMetric(metric: SharesOwnershipMetric): void {
    // Record ownership percentage
    this.ownershipPercentageHistogram.record(metric.percentageOfTotal, {
      userId: metric.userId,
      quantity: String(metric.quantity),
      limitReached: String(metric.limitReached),
    });

    // Track users approaching limits
    if (metric.limitReached) {
      this.metrics.userReachingLimits++;
      this.limitWarningCounter.add(1, {
        userId: metric.userId,
        percentageOfTotal: metric.percentageOfTotal.toFixed(2),
      });

      // Emit event for potential subscribers
      this.eventEmitter.emit(SHARES_OWNERSHIP_METRIC, {
        ...metric,
        timestamp: new Date().toISOString(),
      });

      this.logger.warn(
        `User ${metric.userId} has reached ${metric.percentageOfTotal.toFixed(2)}% of ` +
          `total shares (${metric.quantity} shares), approaching the ownership limit`,
      );
    }
  }

  /**
   * Get the current metrics summary
   * @returns Object containing current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      subscriptionSuccessRate: this.calculateSuccessRate(
        this.metrics.successfulSubscriptions,
        this.metrics.totalSubscriptions,
      ),
      transferSuccessRate: this.calculateSuccessRate(
        this.metrics.successfulTransfers,
        this.metrics.totalTransfers,
      ),
    };
  }

  /**
   * Helper method to calculate success rate percentage
   */
  private calculateSuccessRate(successful: number, total: number): number {
    if (total === 0) return 0;
    return (successful / total) * 100;
  }

  /**
   * Reset all metrics to zero
   */
  resetMetrics(): void {
    this.metrics = {
      totalSubscriptions: 0,
      successfulSubscriptions: 0,
      failedSubscriptions: 0,
      totalTransfers: 0,
      successfulTransfers: 0,
      failedTransfers: 0,
      averageDurationSubscription: 0,
      averageDurationTransfer: 0,
      errorTypes: {},
      totalSharesSubscribed: 0,
      totalSharesTransferred: 0,
      userReachingLimits: 0,
    };
    this.ownershipCache.clear();
  }

  // === PERSISTENCE METHODS ===

  /**
   * Initialize metrics from database on startup
   */
  private async initializeFromDatabase(): Promise<void> {
    if (!this.sharesMetricsRepository) {
      this.logger.warn(
        'Shares metrics repository not available, running in memory-only mode',
      );
      return;
    }

    try {
      // Load latest daily metrics to restore state
      const dailyMetrics = await this.sharesMetricsRepository.getLatestMetrics(
        'shares-metrics',
        'daily',
      );

      if (dailyMetrics) {
        this.restoreInMemoryMetrics(dailyMetrics);
        this.logger.log('Shares metrics initialized from database');
      } else {
        this.logger.log('No previous shares metrics found, starting fresh');
      }

      this.persistenceEnabled = true;
      this.persistenceErrorCount = 0;
    } catch (error) {
      this.logger.warn(
        'Failed to initialize from database, starting fresh',
        error,
      );
      this.persistenceEnabled = false;
      this.persistenceErrorCount++;
    }
  }

  /**
   * Setup scheduled persistence every 5 minutes
   */
  private setupPeriodicPersistence(): void {
    if (!this.schedulerRegistry || !this.persistenceEnabled) {
      return;
    }

    try {
      // Save metrics every 5 minutes
      const interval = setInterval(
        () => {
          this.persistCurrentMetrics();
        },
        5 * 60 * 1000,
      );

      this.schedulerRegistry.addInterval('shares-metrics-persist', interval);
      this.logger.log('Periodic persistence scheduled every 5 minutes');
    } catch (error) {
      this.logger.error('Failed to setup periodic persistence', error);
    }
  }

  /**
   * Persist current in-memory metrics to database
   */
  private async persistCurrentMetrics(): Promise<void> {
    if (!this.sharesMetricsRepository || !this.persistenceEnabled) {
      return;
    }

    try {
      const metricsData = this.buildMetricsDocument('real-time');
      await this.sharesMetricsRepository.storeSharesMetrics(metricsData);

      this.lastPersistenceTime = new Date();
      this.persistenceErrorCount = 0;
      this.logger.debug('Shares metrics persisted to database');
    } catch (error) {
      this.persistenceErrorCount++;
      this.logger.error('Failed to persist shares metrics', error);

      // Disable persistence after too many failures
      if (this.persistenceErrorCount >= 5) {
        this.persistenceEnabled = false;
        this.logger.error('Persistence disabled due to repeated failures');
      }
    }
  }

  /**
   * Daily aggregation job - runs at midnight
   */
  @Cron('0 0 * * *', {
    name: 'shares-metrics-daily-aggregation',
    timeZone: 'UTC',
  })
  async aggregateDailyMetrics(): Promise<void> {
    if (!this.sharesMetricsRepository || !this.persistenceEnabled) {
      return;
    }

    try {
      const dailyMetrics = this.buildMetricsDocument('daily');
      await this.sharesMetricsRepository.storeSharesMetrics(dailyMetrics);

      this.logger.log('Daily shares metrics aggregated and stored');
    } catch (error) {
      this.logger.error('Failed to aggregate daily shares metrics', error);
    }
  }

  /**
   * Weekly aggregation job - runs on Sundays
   */
  @Cron('0 1 * * 0', {
    name: 'shares-metrics-weekly-aggregation',
    timeZone: 'UTC',
  })
  async aggregateWeeklyMetrics(): Promise<void> {
    if (!this.sharesMetricsRepository || !this.persistenceEnabled) {
      return;
    }

    try {
      const weeklyMetrics = this.buildMetricsDocument('weekly');
      await this.sharesMetricsRepository.storeSharesMetrics(weeklyMetrics);

      this.logger.log('Weekly shares metrics aggregated and stored');
    } catch (error) {
      this.logger.error('Failed to aggregate weekly shares metrics', error);
    }
  }

  /**
   * Monthly aggregation job - runs on the 1st of each month
   */
  @Cron('0 2 1 * *', {
    name: 'shares-metrics-monthly-aggregation',
    timeZone: 'UTC',
  })
  async aggregateMonthlyMetrics(): Promise<void> {
    if (!this.sharesMetricsRepository || !this.persistenceEnabled) {
      return;
    }

    try {
      const monthlyMetrics = this.buildMetricsDocument('monthly');
      await this.sharesMetricsRepository.storeSharesMetrics(monthlyMetrics);

      this.logger.log('Monthly shares metrics aggregated and stored');
    } catch (error) {
      this.logger.error('Failed to aggregate monthly shares metrics', error);
    }
  }

  /**
   * Build metrics document for persistence
   */
  private buildMetricsDocument(
    period: 'real-time' | 'daily' | 'weekly' | 'monthly',
  ): Omit<SharesMetricsDocument, '_id' | 'createdAt' | 'updatedAt'> {
    // Calculate ownership metrics from cache
    const totalShares = Array.from(this.ownershipCache.values()).reduce(
      (sum, shares) => sum + shares,
      0,
    );
    const totalShareholders = this.ownershipCache.size;
    const averageSharesPerHolder =
      totalShareholders > 0 ? totalShares / totalShareholders : 0;

    // Calculate distribution buckets
    const distributionBuckets: Record<string, number> = {};
    this.ownershipCache.forEach((shares) => {
      const bucket = this.getSharesBucket(shares);
      distributionBuckets[bucket] = (distributionBuckets[bucket] || 0) + 1;
    });

    return {
      timestamp: new Date(),
      period,
      source: 'shares-metrics',
      version: 1,
      __v: 0,
      subscriptions: {
        total: this.metrics.totalSubscriptions,
        successful: this.metrics.successfulSubscriptions,
        failed: this.metrics.failedSubscriptions,
        successRate: this.calculateSuccessRate(
          this.metrics.successfulSubscriptions,
          this.metrics.totalSubscriptions,
        ),
        averageDuration: this.metrics.averageDurationSubscription,
        totalShares: this.metrics.totalSharesSubscribed,
        totalValue: this.metrics.totalSharesSubscribed * 1000, // Assumed share price
        averageSubscriptionSize:
          this.metrics.totalSubscriptions > 0
            ? this.metrics.totalSharesSubscribed /
              this.metrics.totalSubscriptions
            : 0,
        byPaymentMethod: {}, // Would need to track this separately
      },
      transfers: {
        total: this.metrics.totalTransfers,
        successful: this.metrics.successfulTransfers,
        failed: this.metrics.failedTransfers,
        successRate: this.calculateSuccessRate(
          this.metrics.successfulTransfers,
          this.metrics.totalTransfers,
        ),
        averageDuration: this.metrics.averageDurationTransfer,
        volume: this.metrics.totalTransfers,
        averageSize:
          this.metrics.totalTransfers > 0
            ? this.metrics.totalSharesTransferred / this.metrics.totalTransfers
            : 0,
        totalShares: this.metrics.totalSharesTransferred,
        totalValue: this.metrics.totalSharesTransferred * 1000, // Assumed share price
        frequentTransferPairs: {}, // Would need to track this separately
      },
      ownership: {
        totalShares: totalShares,
        distributedShares: totalShares, // All shares are considered distributed
        availableShares: Math.max(0, 1000000 - totalShares), // Assumed total cap
        ownershipConcentration: this.calculateOwnershipConcentration(),
        totalShareholders: totalShareholders,
        averageSharesPerHolder: averageSharesPerHolder,
        medianSharesPerHolder: this.calculateMedianShares(),
        distributionBuckets: distributionBuckets,
        giniCoefficient: this.calculateGiniCoefficient(),
      },
      valuation: {
        currentSharePrice: 1000, // Would need to get from valuation service
        marketCapitalization: totalShares * 1000,
        totalAssetValue: totalShares * 1000,
        bookValuePerShare: 1000,
        priceToBookRatio: 1.0,
        dividendYield: 0.05, // 5% assumed
        returnOnEquity: 0.12, // 12% assumed
        lastValuationUpdate: new Date(),
      },
      tradingActivity: {
        totalTransactions:
          this.metrics.totalSubscriptions + this.metrics.totalTransfers,
        tradingVolume:
          this.metrics.totalSharesSubscribed +
          this.metrics.totalSharesTransferred,
        averageTransactionValue: 1000, // Would need to calculate properly
        activeTraders: totalShareholders,
        velocityRatio:
          totalShareholders > 0
            ? this.metrics.totalTransfers / totalShareholders
            : 0,
        turnoverRate:
          totalShares > 0
            ? this.metrics.totalSharesTransferred / totalShares
            : 0,
        tradingVolumeByHour: {}, // Would need to track separately
        tradingVolumeByDay: {}, // Would need to track separately
      },
      errorAnalysis: {
        errorTypes: this.metrics.errorTypes,
        userReachingLimits: this.metrics.userReachingLimits,
        validationErrors: this.metrics.errorTypes['validation'] || 0,
        insufficientFundsErrors:
          this.metrics.errorTypes['insufficient_funds'] || 0,
        ownershipLimitErrors: this.metrics.errorTypes['ownership_limit'] || 0,
        systemErrors: this.metrics.errorTypes['system'] || 0,
        networkErrors: this.metrics.errorTypes['network'] || 0,
        errorsByService: {}, // Would need to track separately
      },
      performance: {
        averageSubscriptionTime: this.metrics.averageDurationSubscription,
        averageTransferTime: this.metrics.averageDurationTransfer,
        averageValuationTime: 100, // Assumed
        p95SubscriptionTime: this.metrics.averageDurationSubscription * 1.5, // Approximation
        p95TransferTime: this.metrics.averageDurationTransfer * 1.5, // Approximation
        systemThroughput:
          (this.metrics.totalSubscriptions + this.metrics.totalTransfers) /
          3600, // per hour
        concurrentOperations: 1, // Would need to track separately
        operationsByType: {
          subscriptions: this.metrics.totalSubscriptions,
          transfers: this.metrics.totalTransfers,
        },
      },
    };
  }

  /**
   * Restore in-memory metrics from database document
   */
  private restoreInMemoryMetrics(metricsDoc: SharesMetricsDocument): void {
    try {
      // Restore basic metrics
      this.metrics.totalSubscriptions = metricsDoc.subscriptions.total;
      this.metrics.successfulSubscriptions =
        metricsDoc.subscriptions.successful;
      this.metrics.failedSubscriptions = metricsDoc.subscriptions.failed;
      this.metrics.totalTransfers = metricsDoc.transfers.total;
      this.metrics.successfulTransfers = metricsDoc.transfers.successful;
      this.metrics.failedTransfers = metricsDoc.transfers.failed;
      this.metrics.averageDurationSubscription =
        metricsDoc.subscriptions.averageDuration;
      this.metrics.averageDurationTransfer =
        metricsDoc.transfers.averageDuration;
      this.metrics.totalSharesSubscribed = metricsDoc.subscriptions.totalShares;
      this.metrics.totalSharesTransferred = metricsDoc.transfers.totalShares;
      this.metrics.userReachingLimits =
        metricsDoc.errorAnalysis.userReachingLimits;
      this.metrics.errorTypes = metricsDoc.errorAnalysis.errorTypes || {};

      this.logger.debug('In-memory shares metrics restored from database');
    } catch (error) {
      this.logger.error('Failed to restore in-memory shares metrics', error);
    }
  }

  /**
   * Update ownership cache for a user
   */
  updateUserOwnership(userId: string, shareCount: number): void {
    if (shareCount <= 0) {
      this.ownershipCache.delete(userId);
    } else {
      this.ownershipCache.set(userId, shareCount);
    }
  }

  /**
   * Get shares bucket for distribution analysis
   */
  private getSharesBucket(shares: number): string {
    if (shares <= 100) return '0-100';
    if (shares <= 500) return '101-500';
    if (shares <= 1000) return '501-1000';
    if (shares <= 5000) return '1001-5000';
    if (shares <= 10000) return '5001-10000';
    return '10000+';
  }

  /**
   * Calculate ownership concentration (percentage held by top 10%)
   */
  private calculateOwnershipConcentration(): number {
    const shareAmounts = Array.from(this.ownershipCache.values()).sort(
      (a, b) => b - a,
    );
    const totalShares = shareAmounts.reduce((sum, shares) => sum + shares, 0);

    if (totalShares === 0) return 0;

    const top10PercentCount = Math.max(1, Math.ceil(shareAmounts.length * 0.1));
    const top10PercentShares = shareAmounts
      .slice(0, top10PercentCount)
      .reduce((sum, shares) => sum + shares, 0);

    return (top10PercentShares / totalShares) * 100;
  }

  /**
   * Calculate median shares per holder
   */
  private calculateMedianShares(): number {
    const shareAmounts = Array.from(this.ownershipCache.values()).sort(
      (a, b) => a - b,
    );
    if (shareAmounts.length === 0) return 0;

    const mid = Math.floor(shareAmounts.length / 2);
    return shareAmounts.length % 2 === 0
      ? (shareAmounts[mid - 1] + shareAmounts[mid]) / 2
      : shareAmounts[mid];
  }

  /**
   * Calculate Gini coefficient for ownership inequality
   */
  private calculateGiniCoefficient(): number {
    const shareAmounts = Array.from(this.ownershipCache.values()).sort(
      (a, b) => a - b,
    );
    const n = shareAmounts.length;

    if (n === 0) return 0;

    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += (2 * (i + 1) - n - 1) * shareAmounts[i];
    }

    const totalShares = shareAmounts.reduce((sum, shares) => sum + shares, 0);
    return totalShares === 0 ? 0 : sum / (n * totalShares);
  }

  /**
   * Get persistence status for health monitoring
   */
  getPersistenceStatus(): {
    enabled: boolean;
    lastPersistenceTime: Date | null;
    errorCount: number;
    repositoryAvailable: boolean;
    ownershipCacheSize: number;
  } {
    return {
      enabled: this.persistenceEnabled,
      lastPersistenceTime: this.lastPersistenceTime,
      errorCount: this.persistenceErrorCount,
      repositoryAvailable: !!this.sharesMetricsRepository,
      ownershipCacheSize: this.ownershipCache.size,
    };
  }

  /**
   * Manual persistence trigger for testing or emergency use
   */
  async forcePersistence(): Promise<boolean> {
    try {
      await this.persistCurrentMetrics();
      return true;
    } catch (error) {
      this.logger.error('Forced persistence failed', error);
      return false;
    }
  }

  /**
   * Get historical metrics from database
   */
  async getHistoricalMetrics(days: number = 30): Promise<any[]> {
    if (!this.sharesMetricsRepository) {
      return [];
    }

    try {
      return await this.sharesMetricsRepository.getSubscriptionTrends(days);
    } catch (error) {
      this.logger.error('Failed to get historical shares metrics', error);
      return [];
    }
  }

  /**
   * Get ownership distribution analysis
   */
  async getOwnershipAnalysis(): Promise<any[]> {
    if (!this.sharesMetricsRepository) {
      return [];
    }

    try {
      return await this.sharesMetricsRepository.getOwnershipDistributionAnalysis();
    } catch (error) {
      this.logger.error('Failed to get ownership analysis', error);
      return [];
    }
  }

  /**
   * Get current ownership snapshot
   */
  getCurrentOwnershipSnapshot(): {
    totalShareholders: number;
    totalShares: number;
    averageHolding: number;
    medianHolding: number;
    concentration: number;
    giniCoefficient: number;
  } {
    const shareAmounts = Array.from(this.ownershipCache.values());
    const totalShares = shareAmounts.reduce((sum, shares) => sum + shares, 0);
    const totalShareholders = shareAmounts.length;

    return {
      totalShareholders,
      totalShares,
      averageHolding:
        totalShareholders > 0 ? totalShares / totalShareholders : 0,
      medianHolding: this.calculateMedianShares(),
      concentration: this.calculateOwnershipConcentration(),
      giniCoefficient: this.calculateGiniCoefficient(),
    };
  }
}
