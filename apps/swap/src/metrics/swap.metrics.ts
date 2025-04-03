import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Attributes, Counter, Histogram, Observable } from '@opentelemetry/api';
import { OperationMetricsService } from '@bitsacco/common';

// Event constants for metrics
export const SWAP_ONRAMP_METRIC = 'swap:onramp';
export const SWAP_OFFRAMP_METRIC = 'swap:offramp';
export const SWAP_QUOTE_METRIC = 'swap:quote';
export const SWAP_FX_METRIC = 'swap:fx';

/**
 * Base metrics for swap operations
 */
export interface SwapMetric {
  txId?: string;
  userId?: string;
  success: boolean;
  duration: number;
  errorType?: string;
}

/**
 * Metrics for onramp operations (KES -> BTC)
 */
export interface OnrampMetric extends SwapMetric {
  amountKes?: number;
  amountSats?: number;
  conversionRate?: number;
  paymentMethod?: string;
}

/**
 * Metrics for offramp operations (BTC -> KES)
 */
export interface OfframpMetric extends SwapMetric {
  amountKes?: number;
  amountSats?: number;
  conversionRate?: number;
  payoutMethod?: string;
}

/**
 * Metrics for quote operations
 */
export interface QuoteMetric extends SwapMetric {
  direction: 'onramp' | 'offramp';
  amountKes?: number;
  amountSats?: number;
  conversionRate?: number;
}

/**
 * Metrics for FX rate operations
 */
export interface FxMetric extends SwapMetric {
  rateType: 'buy' | 'sell';
  rate: number;
  cached: boolean;
}

/**
 * Service for tracking swap operations metrics
 */
@Injectable()
export class SwapMetricsService extends OperationMetricsService {
  protected readonly logger = new Logger(SwapMetricsService.name);

  // Swap-specific counters
  private onrampCounter!: Counter;
  private offrampCounter!: Counter;
  private quoteCounter!: Counter;
  private fxRateCounter!: Counter;

  // Swap-specific histograms
  private onrampAmountKesHistogram!: Histogram;
  private onrampAmountSatsHistogram!: Histogram;
  private offrampAmountKesHistogram!: Histogram;
  private offrampAmountSatsHistogram!: Histogram;
  private onrampDurationHistogram!: Histogram;
  private offrampDurationHistogram!: Histogram;
  private quoteDurationHistogram!: Histogram;

  // Swap-specific observables
  private buyRateObservable!: Observable<Attributes>;
  private sellRateObservable!: Observable<Attributes>;

  // In-memory metrics for backward compatibility
  private metrics = {
    // Onramp metrics
    onrampCount: 0,
    successfulOnrampCount: 0,
    totalOnrampKes: 0,
    totalOnrampSats: 0,

    // Offramp metrics
    offrampCount: 0,
    successfulOfframpCount: 0,
    totalOfframpKes: 0,
    totalOfframpSats: 0,

    // Quote metrics
    quoteCount: 0,
    successfulQuoteCount: 0,

    // FX metrics
    latestBuyRate: 0,
    latestSellRate: 0,

    // Error tracking
    errorTypes: {} as Record<string, number>,

    // Payment methods
    onrampByPaymentMethod: {} as Record<string, number>,
    offrampByPayoutMethod: {} as Record<string, number>,
  };

  // Current FX rates for observable metrics
  private currentRates = {
    buy: 0,
    sell: 0,
  };

  constructor(private eventEmitter: EventEmitter2) {
    super('swap', 'transaction');
    this.initializeMetrics();
  }

  /**
   * Initialize swap-specific metrics
   */
  private initializeMetrics() {
    // Onramp counters
    this.onrampCounter = this.createCounter('swap.onramp.count', {
      description: 'Number of onramp transactions (KES -> BTC)',
    });

    // Offramp counters
    this.offrampCounter = this.createCounter('swap.offramp.count', {
      description: 'Number of offramp transactions (BTC -> KES)',
    });

    // Quote counters
    this.quoteCounter = this.createCounter('swap.quote.count', {
      description: 'Number of quote requests',
    });

    // FX rate counters
    this.fxRateCounter = this.createCounter('swap.fx.update', {
      description: 'Number of FX rate updates',
    });

    // Onramp histograms
    this.onrampAmountKesHistogram = this.createHistogram(
      'swap.onramp.amount_kes',
      {
        description: 'Distribution of onramp amounts in KES',
        unit: 'KES',
      },
    );

    this.onrampAmountSatsHistogram = this.createHistogram(
      'swap.onramp.amount_sats',
      {
        description: 'Distribution of onramp amounts in satoshis',
        unit: 'sats',
      },
    );

    this.onrampDurationHistogram = this.createHistogram(
      'swap.onramp.duration',
      {
        description: 'Duration of onramp transactions',
        unit: 'ms',
      },
    );

    // Offramp histograms
    this.offrampAmountKesHistogram = this.createHistogram(
      'swap.offramp.amount_kes',
      {
        description: 'Distribution of offramp amounts in KES',
        unit: 'KES',
      },
    );

    this.offrampAmountSatsHistogram = this.createHistogram(
      'swap.offramp.amount_sats',
      {
        description: 'Distribution of offramp amounts in satoshis',
        unit: 'sats',
      },
    );

    this.offrampDurationHistogram = this.createHistogram(
      'swap.offramp.duration',
      {
        description: 'Duration of offramp transactions',
        unit: 'ms',
      },
    );

    // Quote duration histogram
    this.quoteDurationHistogram = this.createHistogram('swap.quote.duration', {
      description: 'Duration of quote operations',
      unit: 'ms',
    });

    // FX rate observables
    this.buyRateObservable = this.createObservable(
      'swap.fx.buy_rate',
      {
        description: 'Current buy rate (KES/BTC)',
      },
      (observable) => {
        observable.observe(this.currentRates.buy);
      },
    );

    this.sellRateObservable = this.createObservable(
      'swap.fx.sell_rate',
      {
        description: 'Current sell rate (KES/BTC)',
      },
      (observable) => {
        observable.observe(this.currentRates.sell);
      },
    );
  }

  /**
   * Record metrics for onramp operations (KES -> BTC)
   */
  recordOnrampMetric(metric: OnrampMetric): void {
    // Update in-memory metrics
    this.metrics.onrampCount++;

    if (metric.success) {
      this.metrics.successfulOnrampCount++;
    }

    if (metric.amountKes) {
      this.metrics.totalOnrampKes += metric.amountKes;
    }

    if (metric.amountSats) {
      this.metrics.totalOnrampSats += metric.amountSats;
    }

    if (metric.paymentMethod) {
      this.metrics.onrampByPaymentMethod[metric.paymentMethod] =
        (this.metrics.onrampByPaymentMethod[metric.paymentMethod] || 0) + 1;
    }

    if (metric.errorType) {
      this.metrics.errorTypes[metric.errorType] =
        (this.metrics.errorTypes[metric.errorType] || 0) + 1;
    }

    // Record to OpenTelemetry with standard OperationMetricsService
    this.recordOperationMetric({
      operation: 'onramp',
      success: metric.success,
      duration: metric.duration,
      errorType: metric.errorType,
      labels: {
        userId: metric.userId || 'anonymous',
        txId: metric.txId || 'unknown',
        paymentMethod: metric.paymentMethod || 'unknown',
      },
    });

    // Record onramp specific counters
    this.onrampCounter.add(1, {
      success: String(metric.success),
      paymentMethod: metric.paymentMethod || 'unknown',
    });

    // Record amount histograms if amounts are provided
    if (metric.amountKes) {
      this.onrampAmountKesHistogram.record(metric.amountKes, {
        success: String(metric.success),
        paymentMethod: metric.paymentMethod || 'unknown',
      });
    }

    if (metric.amountSats) {
      this.onrampAmountSatsHistogram.record(metric.amountSats, {
        success: String(metric.success),
        paymentMethod: metric.paymentMethod || 'unknown',
      });
    }

    // Record duration histogram
    this.onrampDurationHistogram.record(metric.duration, {
      success: String(metric.success),
      paymentMethod: metric.paymentMethod || 'unknown',
    });

    // Emit event for potential subscribers
    this.eventEmitter.emit(SWAP_ONRAMP_METRIC, {
      ...metric,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Record metrics for offramp operations (BTC -> KES)
   */
  recordOfframpMetric(metric: OfframpMetric): void {
    // Update in-memory metrics
    this.metrics.offrampCount++;

    if (metric.success) {
      this.metrics.successfulOfframpCount++;
    }

    if (metric.amountKes) {
      this.metrics.totalOfframpKes += metric.amountKes;
    }

    if (metric.amountSats) {
      this.metrics.totalOfframpSats += metric.amountSats;
    }

    if (metric.payoutMethod) {
      this.metrics.offrampByPayoutMethod[metric.payoutMethod] =
        (this.metrics.offrampByPayoutMethod[metric.payoutMethod] || 0) + 1;
    }

    if (metric.errorType) {
      this.metrics.errorTypes[metric.errorType] =
        (this.metrics.errorTypes[metric.errorType] || 0) + 1;
    }

    // Record to OpenTelemetry with standard OperationMetricsService
    this.recordOperationMetric({
      operation: 'offramp',
      success: metric.success,
      duration: metric.duration,
      errorType: metric.errorType,
      labels: {
        userId: metric.userId || 'anonymous',
        txId: metric.txId || 'unknown',
        payoutMethod: metric.payoutMethod || 'unknown',
      },
    });

    // Record offramp specific counters
    this.offrampCounter.add(1, {
      success: String(metric.success),
      payoutMethod: metric.payoutMethod || 'unknown',
    });

    // Record amount histograms if amounts are provided
    if (metric.amountKes) {
      this.offrampAmountKesHistogram.record(metric.amountKes, {
        success: String(metric.success),
        payoutMethod: metric.payoutMethod || 'unknown',
      });
    }

    if (metric.amountSats) {
      this.offrampAmountSatsHistogram.record(metric.amountSats, {
        success: String(metric.success),
        payoutMethod: metric.payoutMethod || 'unknown',
      });
    }

    // Record duration histogram
    this.offrampDurationHistogram.record(metric.duration, {
      success: String(metric.success),
      payoutMethod: metric.payoutMethod || 'unknown',
    });

    // Emit event for potential subscribers
    this.eventEmitter.emit(SWAP_OFFRAMP_METRIC, {
      ...metric,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Record metrics for quote operations
   */
  recordQuoteMetric(metric: QuoteMetric): void {
    // Update in-memory metrics
    this.metrics.quoteCount++;

    if (metric.success) {
      this.metrics.successfulQuoteCount++;
    }

    if (metric.errorType) {
      this.metrics.errorTypes[metric.errorType] =
        (this.metrics.errorTypes[metric.errorType] || 0) + 1;
    }

    // Record to OpenTelemetry with standard OperationMetricsService
    this.recordOperationMetric({
      operation: 'quote',
      success: metric.success,
      duration: metric.duration,
      errorType: metric.errorType,
      labels: {
        userId: metric.userId || 'anonymous',
        direction: metric.direction,
      },
    });

    // Record quote specific counters
    this.quoteCounter.add(1, {
      success: String(metric.success),
      direction: metric.direction,
    });

    // Record duration histogram
    this.quoteDurationHistogram.record(metric.duration, {
      success: String(metric.success),
      direction: metric.direction,
    });

    // Emit event for potential subscribers
    this.eventEmitter.emit(SWAP_QUOTE_METRIC, {
      ...metric,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Record metrics for FX rate operations
   */
  recordFxMetric(metric: FxMetric): void {
    // Update in-memory metrics
    if (metric.rateType === 'buy') {
      this.metrics.latestBuyRate = metric.rate;
      this.currentRates.buy = metric.rate;
    } else {
      this.metrics.latestSellRate = metric.rate;
      this.currentRates.sell = metric.rate;
    }

    if (metric.errorType) {
      this.metrics.errorTypes[metric.errorType] =
        (this.metrics.errorTypes[metric.errorType] || 0) + 1;
    }

    // Record to OpenTelemetry with standard OperationMetricsService
    this.recordOperationMetric({
      operation: 'fx_rate',
      success: metric.success,
      duration: metric.duration,
      errorType: metric.errorType,
      labels: {
        rateType: metric.rateType,
        cached: String(metric.cached),
      },
    });

    // Record FX rate specific counters
    this.fxRateCounter.add(1, {
      success: String(metric.success),
      rateType: metric.rateType,
      cached: String(metric.cached),
    });

    // Emit event for potential subscribers
    this.eventEmitter.emit(SWAP_FX_METRIC, {
      ...metric,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get the current metrics summary
   */
  getMetrics() {
    return {
      onramp: {
        count: this.metrics.onrampCount,
        successful: this.metrics.successfulOnrampCount,
        successRate: this.calculateSuccessRate(
          this.metrics.successfulOnrampCount,
          this.metrics.onrampCount,
        ),
        totalKes: this.metrics.totalOnrampKes,
        totalSats: this.metrics.totalOnrampSats,
        byPaymentMethod: this.metrics.onrampByPaymentMethod,
      },
      offramp: {
        count: this.metrics.offrampCount,
        successful: this.metrics.successfulOfframpCount,
        successRate: this.calculateSuccessRate(
          this.metrics.successfulOfframpCount,
          this.metrics.offrampCount,
        ),
        totalKes: this.metrics.totalOfframpKes,
        totalSats: this.metrics.totalOfframpSats,
        byPayoutMethod: this.metrics.offrampByPayoutMethod,
      },
      quote: {
        count: this.metrics.quoteCount,
        successful: this.metrics.successfulQuoteCount,
        successRate: this.calculateSuccessRate(
          this.metrics.successfulQuoteCount,
          this.metrics.quoteCount,
        ),
      },
      fx: {
        latestBuyRate: this.metrics.latestBuyRate,
        latestSellRate: this.metrics.latestSellRate,
      },
      errors: this.metrics.errorTypes,
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
    // Reset onramp metrics
    this.metrics.onrampCount = 0;
    this.metrics.successfulOnrampCount = 0;
    this.metrics.totalOnrampKes = 0;
    this.metrics.totalOnrampSats = 0;

    // Reset offramp metrics
    this.metrics.offrampCount = 0;
    this.metrics.successfulOfframpCount = 0;
    this.metrics.totalOfframpKes = 0;
    this.metrics.totalOfframpSats = 0;

    // Reset quote metrics
    this.metrics.quoteCount = 0;
    this.metrics.successfulQuoteCount = 0;

    // Reset payment method metrics
    this.metrics.onrampByPaymentMethod = {};
    this.metrics.offrampByPayoutMethod = {};

    // Reset error types
    this.metrics.errorTypes = {};
  }
}
