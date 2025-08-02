import { Injectable, Logger } from '@nestjs/common';
import {
  metrics,
  Meter,
  Counter,
  Histogram,
  ObservableGauge,
  ObservableResult,
  Attributes,
} from '@opentelemetry/api';

/**
 * LnurlMetricsService using OpenTelemetry API
 *
 * This service maintains comprehensive LNURL-specific metrics while integrating
 * with the common telemetry infrastructure through OpenTelemetry API.
 */
@Injectable()
export class LnurlMetricsService {
  private readonly logger = new Logger(LnurlMetricsService.name);
  private readonly meter: Meter;

  // Withdrawal metrics
  private readonly withdrawalCreatedCounter: Counter;
  private readonly withdrawalCompletedCounter: Counter;
  private readonly withdrawalFailedCounter: Counter;
  private readonly withdrawalDurationHistogram: Histogram;
  private activeWithdrawalsGauge: ObservableGauge;
  private activeWithdrawalsState: Map<string, number> = new Map();

  // Lightning Address metrics
  private readonly lightningAddressCreatedCounter: Counter;
  private readonly lightningAddressPaymentCounter: Counter;
  private readonly lightningAddressPaymentAmountHistogram: Histogram;
  private activeLightningAddressesGauge: ObservableGauge;
  private activeLightningAddressesState: Map<string, number> = new Map();

  // External payment metrics
  private readonly externalPaymentCounter: Counter;
  private readonly externalPaymentFailedCounter: Counter;
  private readonly externalPaymentDurationHistogram: Histogram;
  private readonly externalPaymentAmountHistogram: Histogram;

  // General LNURL metrics
  private readonly lnurlRequestDurationHistogram: Histogram;
  private readonly lnurlErrorCounter: Counter;

  constructor() {
    // Get meter from OpenTelemetry API
    this.meter = metrics.getMeter('lnurl', '1.0.0');

    // Initialize withdrawal metrics
    this.withdrawalCreatedCounter = this.meter.createCounter(
      'lnurl.withdrawal.created.total',
      {
        description: 'Total number of LNURL withdrawals created',
      },
    );

    this.withdrawalCompletedCounter = this.meter.createCounter(
      'lnurl.withdrawal.completed.total',
      {
        description: 'Total number of LNURL withdrawals completed',
      },
    );

    this.withdrawalFailedCounter = this.meter.createCounter(
      'lnurl.withdrawal.failed.total',
      {
        description: 'Total number of LNURL withdrawals failed',
      },
    );

    this.withdrawalDurationHistogram = this.meter.createHistogram(
      'lnurl.withdrawal.duration',
      {
        description: 'Duration of LNURL withdrawal process',
        unit: 'seconds',
      },
    );

    this.activeWithdrawalsGauge = this.meter.createObservableGauge(
      'lnurl.withdrawal.active',
      {
        description: 'Number of active LNURL withdrawal links',
      },
    );
    this.activeWithdrawalsGauge.addCallback(
      (observableResult: ObservableResult<Attributes>) => {
        this.activeWithdrawalsState.forEach((value, type) => {
          observableResult.observe(value, { type });
        });
      },
    );

    // Initialize Lightning Address metrics
    this.lightningAddressCreatedCounter = this.meter.createCounter(
      'lnurl.lightning_address.created.total',
      {
        description: 'Total number of Lightning Addresses created',
      },
    );

    this.lightningAddressPaymentCounter = this.meter.createCounter(
      'lnurl.lightning_address.payment.total',
      {
        description: 'Total number of payments received via Lightning Address',
      },
    );

    this.lightningAddressPaymentAmountHistogram = this.meter.createHistogram(
      'lnurl.lightning_address.payment.amount',
      {
        description: 'Payment amounts received via Lightning Address',
        unit: 'millisatoshis',
      },
    );

    this.activeLightningAddressesGauge = this.meter.createObservableGauge(
      'lnurl.lightning_address.active',
      {
        description: 'Number of active Lightning Addresses',
      },
    );
    this.activeLightningAddressesGauge.addCallback(
      (observableResult: ObservableResult<Attributes>) => {
        this.activeLightningAddressesState.forEach((value, type) => {
          observableResult.observe(value, { type });
        });
      },
    );

    // Initialize external payment metrics
    this.externalPaymentCounter = this.meter.createCounter(
      'lnurl.external_payment.total',
      {
        description: 'Total number of external LNURL payments',
      },
    );

    this.externalPaymentFailedCounter = this.meter.createCounter(
      'lnurl.external_payment.failed.total',
      {
        description: 'Total number of failed external LNURL payments',
      },
    );

    this.externalPaymentDurationHistogram = this.meter.createHistogram(
      'lnurl.external_payment.duration',
      {
        description: 'Duration of external LNURL payment process',
        unit: 'seconds',
      },
    );

    this.externalPaymentAmountHistogram = this.meter.createHistogram(
      'lnurl.external_payment.amount',
      {
        description: 'Payment amounts sent to external LNURL addresses',
        unit: 'millisatoshis',
      },
    );

    // Initialize general LNURL metrics
    this.lnurlRequestDurationHistogram = this.meter.createHistogram(
      'lnurl.request.duration',
      {
        description: 'Duration of LNURL API requests',
        unit: 'seconds',
      },
    );

    this.lnurlErrorCounter = this.meter.createCounter('lnurl.error.total', {
      description: 'Total number of LNURL errors',
    });

    this.logger.log('LnurlMetricsService initialized with OpenTelemetry');
  }

  // Withdrawal metrics methods
  recordWithdrawalCreated(type: 'single_use' | 'reusable', count: number = 1) {
    this.withdrawalCreatedCounter.add(count, {
      type,
      batch: count > 1 ? 'batch' : 'single',
    });
  }

  recordWithdrawalCompleted(
    type: 'single_use' | 'reusable',
    durationMs: number,
  ) {
    this.withdrawalCompletedCounter.add(1, { type });
    this.withdrawalDurationHistogram.record(durationMs / 1000, {
      status: 'completed',
      type,
    });
  }

  recordWithdrawalFailed(
    type: 'single_use' | 'reusable',
    reason: string,
    durationMs: number,
  ) {
    this.withdrawalFailedCounter.add(1, { type, reason });
    this.withdrawalDurationHistogram.record(durationMs / 1000, {
      status: 'failed',
      type,
      reason,
    });
  }

  setActiveWithdrawals(type: 'single_use' | 'reusable', count: number) {
    this.activeWithdrawalsState.set(type, count);
  }

  // Lightning Address metrics methods
  recordLightningAddressCreated(type: 'personal' | 'chama' | 'member_chama') {
    this.lightningAddressCreatedCounter.add(1, { type });
  }

  recordLightningAddressPayment(
    addressType: 'personal' | 'chama' | 'member_chama',
    status: 'success' | 'failed',
    amountMsats?: number,
  ) {
    this.lightningAddressPaymentCounter.add(1, {
      address_type: addressType,
      status,
    });

    if (amountMsats && status === 'success') {
      this.lightningAddressPaymentAmountHistogram.record(amountMsats, {
        address_type: addressType,
      });
    }
  }

  setActiveLightningAddresses(
    type: 'personal' | 'chama' | 'member_chama',
    count: number,
  ) {
    this.activeLightningAddressesState.set(type, count);
  }

  // External payment metrics methods
  recordExternalPayment(
    domain: string,
    status: 'success' | 'failed',
    durationMs: number,
    amountMsats?: number,
    failureReason?: string,
  ) {
    this.externalPaymentCounter.add(1, { domain, status });
    this.externalPaymentDurationHistogram.record(durationMs / 1000, {
      domain,
      status,
    });

    if (status === 'failed' && failureReason) {
      this.externalPaymentFailedCounter.add(1, {
        domain,
        reason: failureReason,
      });
    }

    if (amountMsats && status === 'success') {
      this.externalPaymentAmountHistogram.record(amountMsats, { domain });
    }
  }

  // General LNURL metrics methods
  recordApiRequest(
    endpoint: string,
    method: string,
    status: number,
    durationMs: number,
  ) {
    this.lnurlRequestDurationHistogram.record(durationMs / 1000, {
      endpoint,
      method,
      status: status.toString(),
    });
  }

  recordError(type: string, endpoint: string, errorCode: string) {
    this.lnurlErrorCounter.add(1, { type, endpoint, error_code: errorCode });
  }
}
