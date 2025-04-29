import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Attributes, Counter, Histogram, Observable } from '@opentelemetry/api';
import { OperationMetricsService } from './metrics.service';

/**
 * Event constants for transaction metrics
 */
export const TRANSACTION_METRIC = 'transaction:operation';

/**
 * Standard transaction metric for cross-service transaction tracking
 */
export interface TransactionMetric {
  transactionId: string; // Correlation ID
  userId: string;
  operationType: string;
  amount: number;
  currency: string;
  startTime: number;
  endTime?: number;
  status: 'initiated' | 'processing' | 'completed' | 'failed';
  involvedServices: string[];
  errorType?: string;
  metadata?: Record<string, string>;
}

/**
 * Service for tracking cross-service transaction metrics
 * Provides comprehensive financial and operational metrics for business reporting
 */
@Injectable()
export class TransactionMetricsService extends OperationMetricsService {
  protected readonly logger = new Logger(TransactionMetricsService.name);

  // Transaction volume counters
  private transactionVolumeCounter!: Counter;
  private transactionCountCounter!: Counter;
  private transactionErrorCounter!: Counter;

  // Transaction duration histogram
  private transactionDurationHistogram!: Histogram;

  // Transaction status gauge
  private activeTransactionsObservable!: Observable<Attributes>;

  // In-memory metrics for reporting
  private metrics = {
    // Transaction counts
    totalTransactions: 0,
    completedTransactions: 0,
    failedTransactions: 0,
    inProgressTransactions: 0,

    // Transaction volume by currency
    volumeByCurrency: {} as Record<
      string,
      {
        total: number;
        completed: number;
        failed: number;
      }
    >,

    // Transaction volume by operation type
    volumeByOperation: {} as Record<
      string,
      {
        total: number;
        completed: number;
        failed: number;
      }
    >,

    // Transaction duration
    averageDuration: 0,
    durationByOperation: {} as Record<string, number>,

    // Transaction errors
    errorsByType: {} as Record<string, number>,
    errorsByService: {} as Record<string, number>,

    // Active transactions
    activeTransactions: 0,
  };

  // Current active transactions for observable metrics
  private currentActiveTransactions = 0;

  constructor(private eventEmitter: EventEmitter2) {
    super('business', 'transaction');
    this.initializeMetrics();
  }

  /**
   * Initialize transaction metrics
   */
  private initializeMetrics() {
    // Transaction volume counter
    this.transactionVolumeCounter = this.createCounter(
      'business.transaction.volume',
      {
        description: 'Total volume of financial transactions',
      },
    );

    // Transaction count counter
    this.transactionCountCounter = this.createCounter(
      'business.transaction.count',
      {
        description: 'Number of financial transactions',
      },
    );

    // Transaction error counter
    this.transactionErrorCounter = this.createCounter(
      'business.transaction.errors',
      {
        description: 'Number of transaction errors',
      },
    );

    // Transaction duration histogram
    this.transactionDurationHistogram = this.createHistogram(
      'business.transaction.duration',
      {
        description: 'Duration of financial transactions',
        unit: 'ms',
      },
    );

    // Active transactions observable
    this.activeTransactionsObservable = this.createObservable(
      'business.transaction.active',
      {
        description: 'Number of currently active transactions',
      },
      (observable) => {
        observable.observe(this.currentActiveTransactions);
      },
    );
  }

  /**
   * Record a cross-service transaction metric
   * This method is the core of the Phase 2 business metrics enhancement
   */
  recordTransactionMetric(metric: TransactionMetric): void {
    // Update in-memory metrics
    this.metrics.totalTransactions++;

    // Update transaction status counts
    if (metric.status === 'completed') {
      this.metrics.completedTransactions++;
    } else if (metric.status === 'failed') {
      this.metrics.failedTransactions++;
    } else {
      this.metrics.inProgressTransactions++;
      this.currentActiveTransactions++;
    }

    // Update volume by currency
    if (!this.metrics.volumeByCurrency[metric.currency]) {
      this.metrics.volumeByCurrency[metric.currency] = {
        total: 0,
        completed: 0,
        failed: 0,
      };
    }

    this.metrics.volumeByCurrency[metric.currency].total += metric.amount;

    if (metric.status === 'completed') {
      this.metrics.volumeByCurrency[metric.currency].completed += metric.amount;
    } else if (metric.status === 'failed') {
      this.metrics.volumeByCurrency[metric.currency].failed += metric.amount;
    }

    // Update volume by operation
    if (!this.metrics.volumeByOperation[metric.operationType]) {
      this.metrics.volumeByOperation[metric.operationType] = {
        total: 0,
        completed: 0,
        failed: 0,
      };
    }

    this.metrics.volumeByOperation[metric.operationType].total += metric.amount;

    if (metric.status === 'completed') {
      this.metrics.volumeByOperation[metric.operationType].completed +=
        metric.amount;
    } else if (metric.status === 'failed') {
      this.metrics.volumeByOperation[metric.operationType].failed +=
        metric.amount;
    }

    // Calculate and update duration for completed or failed transactions
    if (
      metric.endTime &&
      (metric.status === 'completed' || metric.status === 'failed')
    ) {
      const duration = metric.endTime - metric.startTime;

      // Update average duration
      this.metrics.averageDuration =
        (this.metrics.averageDuration * (this.metrics.totalTransactions - 1) +
          duration) /
        this.metrics.totalTransactions;

      // Update duration by operation
      if (!this.metrics.durationByOperation[metric.operationType]) {
        this.metrics.durationByOperation[metric.operationType] = duration;
      } else {
        this.metrics.durationByOperation[metric.operationType] =
          (this.metrics.durationByOperation[metric.operationType] + duration) /
          2;
      }

      // Record duration histogram
      this.transactionDurationHistogram.record(duration, {
        operation: metric.operationType,
        currency: metric.currency,
        status: metric.status,
      });
    }

    // Update error metrics
    if (metric.status === 'failed' && metric.errorType) {
      // Update error by type
      this.metrics.errorsByType[metric.errorType] =
        (this.metrics.errorsByType[metric.errorType] || 0) + 1;

      // Update error by service
      for (const service of metric.involvedServices) {
        this.metrics.errorsByService[service] =
          (this.metrics.errorsByService[service] || 0) + 1;
      }

      // Record to error counter
      this.transactionErrorCounter.add(1, {
        operation: metric.operationType,
        currency: metric.currency,
        errorType: metric.errorType,
      });
    }

    // Record to OpenTelemetry with standard OperationMetricsService
    this.recordOperationMetric({
      operation: metric.operationType,
      success: metric.status === 'completed',
      duration: metric.endTime ? metric.endTime - metric.startTime : 0,
      errorType: metric.errorType,
      labels: {
        userId: metric.userId,
        transactionId: metric.transactionId,
        currency: metric.currency,
        status: metric.status,
      },
    });

    // Record transaction volume counter
    this.transactionVolumeCounter.add(metric.amount, {
      operation: metric.operationType,
      currency: metric.currency,
      status: metric.status,
    });

    // Record transaction count counter
    this.transactionCountCounter.add(1, {
      operation: metric.operationType,
      currency: metric.currency,
      status: metric.status,
    });

    // Emit event for potential subscribers
    this.eventEmitter.emit(TRANSACTION_METRIC, {
      ...metric,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Complete a transaction that was previously recorded as initiated or processing
   * Updates the transaction status and records completion metrics
   */
  completeTransaction(transactionId: string, endTime: number): void {
    // Decrement active transactions counter
    if (this.metrics.inProgressTransactions > 0) {
      this.metrics.inProgressTransactions--;
      this.currentActiveTransactions--;
    }

    // Emit completion event
    this.eventEmitter.emit(`${TRANSACTION_METRIC}:completed`, {
      transactionId,
      endTime,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Fail a transaction that was previously recorded as initiated or processing
   * Updates the transaction status and records failure metrics
   */
  failTransaction(
    transactionId: string,
    endTime: number,
    errorType: string,
  ): void {
    // Decrement active transactions counter
    if (this.metrics.inProgressTransactions > 0) {
      this.metrics.inProgressTransactions--;
      this.currentActiveTransactions--;
    }

    // Emit failure event
    this.eventEmitter.emit(`${TRANSACTION_METRIC}:failed`, {
      transactionId,
      endTime,
      errorType,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get the current transaction metrics
   */
  getTransactionMetrics() {
    return {
      counts: {
        total: this.metrics.totalTransactions,
        completed: this.metrics.completedTransactions,
        failed: this.metrics.failedTransactions,
        inProgress: this.metrics.inProgressTransactions,
        successRate: this.calculateSuccessRate(
          this.metrics.completedTransactions,
          this.metrics.totalTransactions,
        ),
      },
      volume: {
        byCurrency: this.metrics.volumeByCurrency,
        byOperation: this.metrics.volumeByOperation,
      },
      performance: {
        averageDuration: this.metrics.averageDuration,
        byOperation: this.metrics.durationByOperation,
      },
      errors: {
        byType: this.metrics.errorsByType,
        byService: this.metrics.errorsByService,
      },
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
   * Reset all transaction metrics to zero
   */
  resetMetrics(): void {
    this.metrics = {
      totalTransactions: 0,
      completedTransactions: 0,
      failedTransactions: 0,
      inProgressTransactions: 0,
      volumeByCurrency: {},
      volumeByOperation: {},
      averageDuration: 0,
      durationByOperation: {},
      errorsByType: {},
      errorsByService: {},
      activeTransactions: 0,
    };
    this.currentActiveTransactions = 0;
  }
}
