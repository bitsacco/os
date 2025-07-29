import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Counter, Histogram } from '@opentelemetry/api';
import { OperationMetricsService } from '../common';

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
export class SharesMetricsService extends OperationMetricsService {
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

  constructor(private eventEmitter: EventEmitter2) {
    super('shares', 'transaction');
    this.initializeMetrics();
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
  }
}
