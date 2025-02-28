import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface LnurlMetric {
  success: boolean;
  duration: number;
  errorType?: string;
  amountMsats?: number;
  amountFiat?: number;
}

export const LNURL_WITHDRAW_METRIC = 'lnurl:withdraw';

/**
 * Service for collecting metrics related to LNURL operations
 * This can be extended in the future to integrate with a proper
 * metrics collection system like Prometheus
 */
@Injectable()
export class LnurlMetricsService {
  private readonly logger = new Logger(LnurlMetricsService.name);

  // Simple in-memory metrics for demonstration
  private metrics = {
    totalWithdraws: 0,
    successfulWithdraws: 0,
    failedWithdraws: 0,
    averageDuration: 0,
    errorTypes: {} as Record<string, number>,
    totalWithdrawAmountMsats: 0,
    totalWithdrawAmountFiat: 0,
  };

  constructor(private eventEmitter: EventEmitter2) {
    this.logger.log('LnurlMetricsService initialized');
  }

  /**
   * Record a metric for an LNURL withdrawal
   * @param metric The metric data to record
   */
  recordWithdrawalMetric(metric: LnurlMetric): void {
    // Increment total counter
    this.metrics.totalWithdraws++;

    // Track success/failure
    if (metric.success) {
      this.metrics.successfulWithdraws++;
      if (metric.amountMsats) {
        this.metrics.totalWithdrawAmountMsats += metric.amountMsats;
      }
      if (metric.amountFiat) {
        this.metrics.totalWithdrawAmountFiat += metric.amountFiat;
      }
    } else {
      this.metrics.failedWithdraws++;
      // Track error types
      if (metric.errorType) {
        this.metrics.errorTypes[metric.errorType] =
          (this.metrics.errorTypes[metric.errorType] || 0) + 1;
      }
    }

    // Update average duration using running average formula
    this.metrics.averageDuration =
      (this.metrics.averageDuration * (this.metrics.totalWithdraws - 1) +
        metric.duration) /
      this.metrics.totalWithdraws;

    // Emit event for potential subscribers
    this.eventEmitter.emit(LNURL_WITHDRAW_METRIC, {
      ...metric,
      timestamp: new Date().toISOString(),
    });

    // Log the metric for monitoring
    this.logger.log(
      `LNURL metric - Success: ${metric.success}, Duration: ${metric.duration}ms${
        metric.errorType ? `, Error: ${metric.errorType}` : ''
      }${metric.amountMsats ? `, Amount (msats): ${metric.amountMsats}` : ''}
      ${metric.amountFiat ? `, Amount (KES): ${metric.amountFiat}` : ''}`,
    );
  }

  /**
   * Get the current metrics summary
   * @returns Object containing current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate:
        this.metrics.totalWithdraws > 0
          ? (this.metrics.successfulWithdraws / this.metrics.totalWithdraws) *
            100
          : 0,
    };
  }

  /**
   * Reset all metrics to zero
   */
  resetMetrics(): void {
    this.metrics = {
      totalWithdraws: 0,
      successfulWithdraws: 0,
      failedWithdraws: 0,
      averageDuration: 0,
      errorTypes: {},
      totalWithdrawAmountMsats: 0,
      totalWithdrawAmountFiat: 0,
    };
  }
}
