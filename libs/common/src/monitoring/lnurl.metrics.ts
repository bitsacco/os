import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Counter, Histogram } from '@opentelemetry/api';
import { OperationMetricsService } from './metrics.service';

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
 * Uses OpenTelemetry for metrics collection and supports Prometheus
 */
@Injectable()
export class LnurlMetricsService extends OperationMetricsService {
  // Additional counters specific to LNURL operations
  private withdrawAmountMsatsCounter!: Counter;
  private withdrawAmountFiatCounter!: Counter;

  // Additional histograms
  private withdrawAmountHistogram!: Histogram;

  // Keep the in-memory metrics for backward compatibility
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
    super('lnurl', 'withdrawal');
    this.initializeMetrics();
  }

  /**
   * Initialize LNURL-specific metrics
   */
  private initializeMetrics(): void {
    // Create additional counter for tracking withdrawal amounts
    this.withdrawAmountMsatsCounter = this.createCounter(
      'lnurl.withdrawal.amount.msats',
      {
        description: 'Total amount withdrawn in millisatoshis',
        unit: 'msats',
      },
    );

    this.withdrawAmountFiatCounter = this.createCounter(
      'lnurl.withdrawal.amount.fiat',
      {
        description: 'Total amount withdrawn in fiat currency',
        unit: 'KES',
      },
    );

    // Create histogram for withdrawal amounts
    this.withdrawAmountHistogram = this.createHistogram(
      'lnurl.withdrawal.amount',
      {
        description: 'Distribution of withdrawal amounts',
        unit: 'msats',
      },
    );
  }

  /**
   * Record a metric for an LNURL withdrawal
   * @param metric The metric data to record
   */
  recordWithdrawalMetric(metric: LnurlMetric): void {
    // Update in-memory metrics for backward compatibility
    this.metrics.totalWithdraws++;

    // Record to OpenTelemetry metrics
    this.recordOperationMetric({
      operation: 'withdrawal',
      success: metric.success,
      duration: metric.duration,
      errorType: metric.errorType,
    });

    // Track withdrawal amounts
    if (metric.success) {
      this.metrics.successfulWithdraws++;

      if (metric.amountMsats) {
        this.metrics.totalWithdrawAmountMsats += metric.amountMsats;
        this.withdrawAmountMsatsCounter.add(metric.amountMsats);
        this.withdrawAmountHistogram.record(metric.amountMsats);
      }

      if (metric.amountFiat) {
        this.metrics.totalWithdrawAmountFiat += metric.amountFiat;
        this.withdrawAmountFiatCounter.add(metric.amountFiat);
      }
    } else {
      this.metrics.failedWithdraws++;

      // Track error types
      if (metric.errorType) {
        this.metrics.errorTypes[metric.errorType] =
          (this.metrics.errorTypes[metric.errorType] || 0) + 1;
      }
    }

    // Update average duration for in-memory metrics
    this.metrics.averageDuration =
      (this.metrics.averageDuration * (this.metrics.totalWithdraws - 1) +
        metric.duration) /
      this.metrics.totalWithdraws;

    // Emit event for potential subscribers
    this.eventEmitter.emit(LNURL_WITHDRAW_METRIC, {
      ...metric,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get the current metrics summary from in-memory metrics
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
   * Reset in-memory metrics to zero
   * Note: OpenTelemetry metrics cannot be reset as they are cumulative
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
