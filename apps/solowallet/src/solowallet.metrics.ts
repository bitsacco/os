import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Counter, Histogram } from '@opentelemetry/api';
import { OperationMetricsService } from '@bitsacco/common';

export const SOLOWALLET_DEPOSIT_METRIC = 'solowallet:deposit';
export const SOLOWALLET_WITHDRAWAL_METRIC = 'solowallet:withdrawal';
export const SOLOWALLET_BALANCE_METRIC = 'solowallet:balance';

/**
 * Metrics for wallet deposit operations
 */
export interface SolowalletDepositMetric {
  userId: string;
  amountMsats: number;
  amountFiat?: number;
  method: 'lightning' | 'onramp' | 'other';
  success: boolean;
  duration: number;
  errorType?: string;
}

/**
 * Metrics for wallet withdrawal operations
 */
export interface SolowalletWithdrawalMetric {
  userId: string;
  amountMsats: number;
  amountFiat?: number;
  method: 'lightning' | 'lnurl' | 'offramp' | 'other';
  success: boolean;
  duration: number;
  errorType?: string;
}

/**
 * Metrics for wallet balance
 */
export interface SolowalletBalanceMetric {
  userId: string;
  balanceMsats: number;
  activity: 'deposit' | 'withdrawal' | 'query';
}

/**
 * Service for collecting metrics related to solowallet operations
 * Uses OpenTelemetry for metrics collection
 */
@Injectable()
export class SolowalletMetricsService extends OperationMetricsService {
  protected readonly logger = new Logger(SolowalletMetricsService.name);

  // Solowallet-specific counters
  private depositCounter!: Counter;
  private withdrawalCounter!: Counter;
  private failedDepositCounter!: Counter;
  private failedWithdrawalCounter!: Counter;

  // Solowallet-specific histograms
  private depositAmountHistogram!: Histogram;
  private withdrawalAmountHistogram!: Histogram;
  private balanceHistogram!: Histogram;

  constructor(private eventEmitter: EventEmitter2) {
    super('solowallet', 'transaction');
    this.initializeMetrics();
  }

  /**
   * Initialize solowallet-specific metrics
   */
  private initializeMetrics(): void {
    // Deposit counter
    this.depositCounter = this.createCounter('solowallet.deposits.count', {
      description: 'Number of wallet deposit operations',
    });

    // Withdrawal counter
    this.withdrawalCounter = this.createCounter(
      'solowallet.withdrawals.count',
      {
        description: 'Number of wallet withdrawal operations',
      },
    );

    // Failed deposit counter
    this.failedDepositCounter = this.createCounter(
      'solowallet.deposits.failed.count',
      {
        description: 'Number of failed wallet deposit operations',
      },
    );

    // Failed withdrawal counter
    this.failedWithdrawalCounter = this.createCounter(
      'solowallet.withdrawals.failed.count',
      {
        description: 'Number of failed wallet withdrawal operations',
      },
    );

    // Deposit amount histogram
    this.depositAmountHistogram = this.createHistogram(
      'solowallet.deposits.amount',
      {
        description: 'Amount of deposits in msats',
        unit: 'msats',
      },
    );

    // Withdrawal amount histogram
    this.withdrawalAmountHistogram = this.createHistogram(
      'solowallet.withdrawals.amount',
      {
        description: 'Amount of withdrawals in msats',
        unit: 'msats',
      },
    );

    // Balance histogram
    this.balanceHistogram = this.createHistogram('solowallet.balance', {
      description: 'User wallet balance in msats',
      unit: 'msats',
    });
  }

  /**
   * Record metrics for a wallet deposit operation
   * @param metric Metrics data for the deposit operation
   */
  recordDepositMetric(metric: SolowalletDepositMetric): void {
    const startTime = performance.now();

    try {
      // Record to OpenTelemetry with standard OperationMetricsService
      this.recordOperationMetric({
        operation: 'deposit',
        success: metric.success,
        duration: metric.duration,
        errorType: metric.errorType,
        labels: {
          userId: metric.userId,
          method: metric.method,
        },
      });

      // Record solowallet-specific metrics
      this.depositCounter.add(1, {
        userId: metric.userId,
        method: metric.method,
        success: String(metric.success),
      });

      if (!metric.success && metric.errorType) {
        this.failedDepositCounter.add(1, {
          userId: metric.userId,
          method: metric.method,
          errorType: metric.errorType,
        });
      }

      if (metric.amountMsats) {
        this.depositAmountHistogram.record(metric.amountMsats, {
          userId: metric.userId,
          method: metric.method,
          success: String(metric.success),
        });
      }

      // Emit event for potential subscribers
      this.eventEmitter.emit(SOLOWALLET_DEPOSIT_METRIC, {
        ...metric,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(
        `Error recording deposit metrics: ${error.message}`,
        error.stack,
      );
    } finally {
      const processingTime = performance.now() - startTime;
      if (processingTime > 100) {
        this.logger.warn(
          `Metrics recording took ${processingTime.toFixed(2)}ms`,
        );
      }
    }
  }

  /**
   * Record metrics for a wallet withdrawal operation
   * @param metric Metrics data for the withdrawal operation
   */
  recordWithdrawalMetric(metric: SolowalletWithdrawalMetric): void {
    const startTime = performance.now();

    try {
      // Record to OpenTelemetry with standard OperationMetricsService
      this.recordOperationMetric({
        operation: 'withdrawal',
        success: metric.success,
        duration: metric.duration,
        errorType: metric.errorType,
        labels: {
          userId: metric.userId,
          method: metric.method,
        },
      });

      // Record solowallet-specific metrics
      this.withdrawalCounter.add(1, {
        userId: metric.userId,
        method: metric.method,
        success: String(metric.success),
      });

      if (!metric.success && metric.errorType) {
        this.failedWithdrawalCounter.add(1, {
          userId: metric.userId,
          method: metric.method,
          errorType: metric.errorType,
        });
      }

      if (metric.amountMsats) {
        this.withdrawalAmountHistogram.record(metric.amountMsats, {
          userId: metric.userId,
          method: metric.method,
          success: String(metric.success),
        });
      }

      // Emit event for potential subscribers
      this.eventEmitter.emit(SOLOWALLET_WITHDRAWAL_METRIC, {
        ...metric,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(
        `Error recording withdrawal metrics: ${error.message}`,
        error.stack,
      );
    } finally {
      const processingTime = performance.now() - startTime;
      if (processingTime > 100) {
        this.logger.warn(
          `Metrics recording took ${processingTime.toFixed(2)}ms`,
        );
      }
    }
  }

  /**
   * Record metrics for user wallet balance
   * @param metric Metrics data for user balance
   */
  recordBalanceMetric(metric: SolowalletBalanceMetric): void {
    const startTime = performance.now();

    try {
      // Record balance to histogram
      this.balanceHistogram.record(metric.balanceMsats, {
        userId: metric.userId,
        activity: metric.activity,
      });

      // Emit event for potential subscribers
      this.eventEmitter.emit(SOLOWALLET_BALANCE_METRIC, {
        ...metric,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(
        `Error recording balance metrics: ${error.message}`,
        error.stack,
      );
    } finally {
      const processingTime = performance.now() - startTime;
      if (processingTime > 100) {
        this.logger.warn(
          `Metrics recording took ${processingTime.toFixed(2)}ms`,
        );
      }
    }
  }
}
