import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createMeter } from './opentelemetry';
import { Counter, Histogram, Meter, Observable } from '@opentelemetry/api';

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
export class SharesMetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SharesMetricsService.name);
  private meter: Meter;
  
  // Counters
  private totalSubscriptionCounter!: Counter;
  private successfulSubscriptionCounter!: Counter;
  private failedSubscriptionCounter!: Counter;
  private totalTransferCounter!: Counter;
  private successfulTransferCounter!: Counter;
  private failedTransferCounter!: Counter;
  private limitWarningCounter!: Counter;
  
  // Histograms
  private subscriptionDurationHistogram!: Histogram;
  private transferDurationHistogram!: Histogram;
  private shareQuantityHistogram!: Histogram;
  private ownershipPercentageHistogram!: Observable;
  
  // Simple in-memory metrics for demonstration and testing
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
    this.logger.log('SharesMetricsService initialized');
    this.meter = createMeter('shares-metrics');
  }

  onModuleInit() {
    // Create counters
    this.totalSubscriptionCounter = this.meter.createCounter('shares.subscriptions.total', {
      description: 'Total number of share subscription attempts',
    });
    
    this.successfulSubscriptionCounter = this.meter.createCounter('shares.subscriptions.successful', {
      description: 'Number of successful share subscriptions',
    });
    
    this.failedSubscriptionCounter = this.meter.createCounter('shares.subscriptions.failed', {
      description: 'Number of failed share subscriptions',
    });
    
    this.totalTransferCounter = this.meter.createCounter('shares.transfers.total', {
      description: 'Total number of share transfer attempts',
    });
    
    this.successfulTransferCounter = this.meter.createCounter('shares.transfers.successful', {
      description: 'Number of successful share transfers',
    });
    
    this.failedTransferCounter = this.meter.createCounter('shares.transfers.failed', {
      description: 'Number of failed share transfers',
    });
    
    this.limitWarningCounter = this.meter.createCounter('shares.ownership.limit_warnings', {
      description: 'Number of times users have attempted to exceed ownership limits',
    });
    
    // Create histograms
    this.subscriptionDurationHistogram = this.meter.createHistogram('shares.subscriptions.duration', {
      description: 'Duration of share subscription operations in milliseconds',
      unit: 'ms',
    });
    
    this.transferDurationHistogram = this.meter.createHistogram('shares.transfers.duration', {
      description: 'Duration of share transfer operations in milliseconds',
      unit: 'ms',
    });
    
    this.shareQuantityHistogram = this.meter.createHistogram('shares.quantity', {
      description: 'Quantity of shares in transactions',
      unit: 'shares',
    });
    
    // Create observable for user ownership percentages
    this.ownershipPercentageHistogram = this.meter.createHistogram('shares.ownership.percentage', {
      description: 'Percentage of total shares owned by users',
      unit: '%',
    });

    this.logger.log('SharesMetricsService initialized with OpenTelemetry metrics');
  }

  onModuleDestroy() {
    // Clean up if needed
    this.logger.log('SharesMetricsService destroyed');
  }

  /**
   * Record metrics for a share subscription operation
   * @param metric Metrics data for the subscription operation
   */
  recordSubscriptionMetric(metric: SharesSubscriptionMetric): void {
    // Update in-memory metrics
    this.metrics.totalSubscriptions++;
    
    // Record in OpenTelemetry
    this.totalSubscriptionCounter.add(1, {
      userId: metric.userId,
      offerId: metric.offerId,
    });
    
    this.shareQuantityHistogram.record(metric.quantity, {
      operation: 'subscription',
      userId: metric.userId,
      offerId: metric.offerId,
    });
    
    // Track success/failure
    if (metric.success) {
      this.metrics.successfulSubscriptions++;
      this.metrics.totalSharesSubscribed += metric.quantity;
      
      this.successfulSubscriptionCounter.add(1, {
        userId: metric.userId,
        offerId: metric.offerId,
      });
    } else {
      this.metrics.failedSubscriptions++;
      
      this.failedSubscriptionCounter.add(1, {
        userId: metric.userId,
        offerId: metric.offerId,
        errorType: metric.errorType || 'unknown',
      });
      
      // Track error types
      if (metric.errorType) {
        this.metrics.errorTypes[metric.errorType] = 
          (this.metrics.errorTypes[metric.errorType] || 0) + 1;
      }
    }
    
    // Record duration
    this.subscriptionDurationHistogram.record(metric.duration, {
      userId: metric.userId,
      offerId: metric.offerId,
      success: String(metric.success),
    });
    
    // Update average duration
    this.metrics.averageDurationSubscription = 
      (this.metrics.averageDurationSubscription * (this.metrics.totalSubscriptions - 1) 
        + metric.duration) / this.metrics.totalSubscriptions;
    
    // Emit event for potential subscribers
    this.eventEmitter.emit(SHARES_SUBSCRIPTION_METRIC, {
      ...metric,
      timestamp: new Date().toISOString(),
    });
    
    // Log the metric for monitoring
    this.logger.log(
      `Shares subscription metric - UserId: ${metric.userId}, OfferId: ${metric.offerId}, ` +
      `Quantity: ${metric.quantity}, Success: ${metric.success}, Duration: ${metric.duration}ms` +
      `${metric.errorType ? `, Error: ${metric.errorType}` : ''}`
    );
  }
  
  /**
   * Record metrics for a share transfer operation
   * @param metric Metrics data for the transfer operation
   */
  recordTransferMetric(metric: SharesTransferMetric): void {
    // Update in-memory metrics
    this.metrics.totalTransfers++;
    
    // Record in OpenTelemetry
    this.totalTransferCounter.add(1, {
      fromUserId: metric.fromUserId,
      toUserId: metric.toUserId,
    });
    
    this.shareQuantityHistogram.record(metric.quantity, {
      operation: 'transfer',
      fromUserId: metric.fromUserId,
      toUserId: metric.toUserId,
    });
    
    // Track success/failure
    if (metric.success) {
      this.metrics.successfulTransfers++;
      this.metrics.totalSharesTransferred += metric.quantity;
      
      this.successfulTransferCounter.add(1, {
        fromUserId: metric.fromUserId,
        toUserId: metric.toUserId,
      });
    } else {
      this.metrics.failedTransfers++;
      
      this.failedTransferCounter.add(1, {
        fromUserId: metric.fromUserId,
        toUserId: metric.toUserId,
        errorType: metric.errorType || 'unknown',
      });
      
      // Track error types
      if (metric.errorType) {
        this.metrics.errorTypes[metric.errorType] = 
          (this.metrics.errorTypes[metric.errorType] || 0) + 1;
      }
    }
    
    // Record duration
    this.transferDurationHistogram.record(metric.duration, {
      fromUserId: metric.fromUserId,
      toUserId: metric.toUserId,
      success: String(metric.success),
    });
    
    // Update average duration
    this.metrics.averageDurationTransfer = 
      (this.metrics.averageDurationTransfer * (this.metrics.totalTransfers - 1) 
        + metric.duration) / this.metrics.totalTransfers;
    
    // Emit event for potential subscribers
    this.eventEmitter.emit(SHARES_TRANSFER_METRIC, {
      ...metric,
      timestamp: new Date().toISOString(),
    });
    
    // Log the metric for monitoring
    this.logger.log(
      `Shares transfer metric - FromUserId: ${metric.fromUserId}, ToUserId: ${metric.toUserId}, ` +
      `Quantity: ${metric.quantity}, Success: ${metric.success}, Duration: ${metric.duration}ms` +
      `${metric.errorType ? `, Error: ${metric.errorType}` : ''}`
    );
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
    });
    
    // Track users approaching limits
    if (metric.limitReached) {
      this.metrics.userReachingLimits++;
      this.limitWarningCounter.add(1, { userId: metric.userId });
      
      // Emit event for potential subscribers
      this.eventEmitter.emit(SHARES_OWNERSHIP_METRIC, {
        ...metric,
        timestamp: new Date().toISOString(),
      });
      
      this.logger.warn(
        `User ${metric.userId} has reached ${metric.percentageOfTotal.toFixed(2)}% of ` +
        `total shares (${metric.quantity} shares), approaching the 20% limit`
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
      subscriptionSuccessRate:
        this.metrics.totalSubscriptions > 0
          ? (this.metrics.successfulSubscriptions / this.metrics.totalSubscriptions) * 100
          : 0,
      transferSuccessRate:
        this.metrics.totalTransfers > 0
          ? (this.metrics.successfulTransfers / this.metrics.totalTransfers) * 100
          : 0,
    };
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
    
    this.logger.log('Shares metrics reset');
  }
}