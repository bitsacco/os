import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Counter, Histogram } from '@opentelemetry/api';
import { OperationMetricsService } from './metrics.service';

/**
 * Interface for metrics related to LNURL withdrawal operations
 */
export interface LnurlWithdrawalMetric {
  userId?: string;
  success: boolean;
  duration: number;
  errorType?: string;
  amountMsats?: number;
  amountFiat?: number;
  paymentHash?: string;
  wallet?: string;
}

export const LNURL_WITHDRAW_METRIC = 'lnurl:withdraw';

/**
 * Service for collecting metrics related to LNURL operations
 * Fully integrated with OpenTelemetry for metrics collection
 */
@Injectable()
export class LnurlMetricsService extends OperationMetricsService {
  protected readonly logger = new Logger(LnurlMetricsService.name);

  // Withdrawal amount counters
  private withdrawAmountMsatsCounter!: Counter;
  private withdrawAmountFiatCounter!: Counter;

  // Withdrawal amount histograms
  private withdrawAmountMsatsHistogram!: Histogram;
  private withdrawAmountFiatHistogram!: Histogram;

  // Withdrawal by wallet counter
  private withdrawByWalletCounter!: Counter;

  constructor(private eventEmitter: EventEmitter2) {
    super('lnurl', 'withdrawal');
    this.initializeMetrics();
  }

  /**
   * Initialize LNURL-specific metrics using OpenTelemetry
   */
  private initializeMetrics(): void {
    // Amount counters for tracking total amounts
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

    // Histograms for distribution of withdrawal amounts
    this.withdrawAmountMsatsHistogram = this.createHistogram(
      'lnurl.withdrawal.amount_msats',
      {
        description: 'Distribution of withdrawal amounts in millisatoshis',
        unit: 'msats',
      },
    );

    this.withdrawAmountFiatHistogram = this.createHistogram(
      'lnurl.withdrawal.amount_fiat',
      {
        description: 'Distribution of withdrawal amounts in fiat currency',
        unit: 'KES',
      },
    );

    // Counter for tracking withdrawals by wallet
    this.withdrawByWalletCounter = this.createCounter(
      'lnurl.withdrawal.by_wallet',
      {
        description: 'Number of withdrawals by wallet type',
      },
    );
  }

  /**
   * Record comprehensive metrics for an LNURL withdrawal operation
   * Uses OpenTelemetry for complete metrics collection
   *
   * @param metric The withdrawal metric data to record
   */
  recordWithdrawalMetric(metric: LnurlWithdrawalMetric): void {
    // Performance measurement
    const startTime = performance.now();

    try {
      // 1. Record using the standard OperationMetricsService pattern
      this.recordOperationMetric({
        operation: 'withdrawal',
        success: metric.success,
        duration: metric.duration,
        errorType: metric.errorType,
        labels: {
          userId: metric.userId || 'anonymous',
          paymentHash: metric.paymentHash || 'unknown',
          wallet: metric.wallet || 'unknown',
        },
      });

      // 2. Record specific LNURL metrics with OpenTelemetry

      // Track withdrawal amounts
      if (metric.amountMsats) {
        // Record to counter (total sum)
        this.withdrawAmountMsatsCounter.add(metric.amountMsats, {
          success: String(metric.success),
          wallet: metric.wallet || 'unknown',
          userId: metric.userId || 'anonymous',
        });

        // Record to histogram (distribution)
        this.withdrawAmountMsatsHistogram.record(metric.amountMsats, {
          success: String(metric.success),
          wallet: metric.wallet || 'unknown',
        });
      }

      if (metric.amountFiat) {
        // Record to counter (total sum)
        this.withdrawAmountFiatCounter.add(metric.amountFiat, {
          success: String(metric.success),
          wallet: metric.wallet || 'unknown',
          userId: metric.userId || 'anonymous',
        });

        // Record to histogram (distribution)
        this.withdrawAmountFiatHistogram.record(metric.amountFiat, {
          success: String(metric.success),
          wallet: metric.wallet || 'unknown',
        });
      }

      // Track withdrawals by wallet
      if (metric.wallet) {
        this.withdrawByWalletCounter.add(1, {
          success: String(metric.success),
          wallet: metric.wallet,
          userId: metric.userId || 'anonymous',
        });
      }

      // 3. Emit event for potential subscribers
      this.eventEmitter.emit(LNURL_WITHDRAW_METRIC, {
        ...metric,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`Error recording LNURL withdrawal metric: ${error}`);
    } finally {
      // Log metric recording performance in debug mode
      const endTime = performance.now();
      this.logger.debug(
        `Recorded LNURL withdrawal metric in ${endTime - startTime}ms`,
      );
    }
  }
}
