import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Gauge, register } from 'prom-client';

@Injectable()
export class LnurlMetricsService {
  // Withdrawal metrics
  private readonly withdrawalCreatedCounter: Counter<string>;
  private readonly withdrawalCompletedCounter: Counter<string>;
  private readonly withdrawalFailedCounter: Counter<string>;
  private readonly withdrawalDurationHistogram: Histogram<string>;
  private readonly activeWithdrawalsGauge: Gauge<string>;

  // Lightning Address metrics
  private readonly lightningAddressCreatedCounter: Counter<string>;
  private readonly lightningAddressPaymentCounter: Counter<string>;
  private readonly lightningAddressPaymentAmountHistogram: Histogram<string>;
  private readonly activeLightningAddressesGauge: Gauge<string>;

  // External payment metrics
  private readonly externalPaymentCounter: Counter<string>;
  private readonly externalPaymentFailedCounter: Counter<string>;
  private readonly externalPaymentDurationHistogram: Histogram<string>;
  private readonly externalPaymentAmountHistogram: Histogram<string>;

  // General LNURL metrics
  private readonly lnurlRequestDurationHistogram: Histogram<string>;
  private readonly lnurlErrorCounter: Counter<string>;

  constructor() {
    // Withdrawal metrics
    this.withdrawalCreatedCounter = new Counter({
      name: 'lnurl_withdrawal_created_total',
      help: 'Total number of LNURL withdrawals created',
      labelNames: ['type', 'batch'], // 'single_use', 'reusable'
    });

    this.withdrawalCompletedCounter = new Counter({
      name: 'lnurl_withdrawal_completed_total',
      help: 'Total number of LNURL withdrawals completed',
      labelNames: ['type'],
    });

    this.withdrawalFailedCounter = new Counter({
      name: 'lnurl_withdrawal_failed_total',
      help: 'Total number of LNURL withdrawals failed',
      labelNames: ['type', 'reason'],
    });

    this.withdrawalDurationHistogram = new Histogram({
      name: 'lnurl_withdrawal_duration_seconds',
      help: 'Duration of LNURL withdrawal process',
      labelNames: ['status'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
    });

    this.activeWithdrawalsGauge = new Gauge({
      name: 'lnurl_active_withdrawals',
      help: 'Number of active LNURL withdrawal links',
      labelNames: ['type'],
    });

    // Lightning Address metrics
    this.lightningAddressCreatedCounter = new Counter({
      name: 'lnurl_lightning_address_created_total',
      help: 'Total number of Lightning Addresses created',
      labelNames: ['type'], // 'personal', 'chama', 'member_chama'
    });

    this.lightningAddressPaymentCounter = new Counter({
      name: 'lnurl_lightning_address_payment_total',
      help: 'Total number of payments received via Lightning Address',
      labelNames: ['address_type', 'status'],
    });

    this.lightningAddressPaymentAmountHistogram = new Histogram({
      name: 'lnurl_lightning_address_payment_amount_msats',
      help: 'Payment amounts received via Lightning Address',
      labelNames: ['address_type'],
      buckets: [1000, 10000, 100000, 1000000, 10000000, 100000000],
    });

    this.activeLightningAddressesGauge = new Gauge({
      name: 'lnurl_active_lightning_addresses',
      help: 'Number of active Lightning Addresses',
      labelNames: ['type'],
    });

    // External payment metrics
    this.externalPaymentCounter = new Counter({
      name: 'lnurl_external_payment_total',
      help: 'Total number of external LNURL payments',
      labelNames: ['domain', 'status'],
    });

    this.externalPaymentFailedCounter = new Counter({
      name: 'lnurl_external_payment_failed_total',
      help: 'Total number of failed external LNURL payments',
      labelNames: ['domain', 'reason'],
    });

    this.externalPaymentDurationHistogram = new Histogram({
      name: 'lnurl_external_payment_duration_seconds',
      help: 'Duration of external LNURL payment process',
      labelNames: ['domain', 'status'],
      buckets: [0.5, 1, 2, 5, 10, 30],
    });

    this.externalPaymentAmountHistogram = new Histogram({
      name: 'lnurl_external_payment_amount_msats',
      help: 'Payment amounts sent to external LNURL addresses',
      labelNames: ['domain'],
      buckets: [1000, 10000, 100000, 1000000, 10000000, 100000000],
    });

    // General LNURL metrics
    this.lnurlRequestDurationHistogram = new Histogram({
      name: 'lnurl_request_duration_seconds',
      help: 'Duration of LNURL API requests',
      labelNames: ['endpoint', 'method', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    });

    this.lnurlErrorCounter = new Counter({
      name: 'lnurl_error_total',
      help: 'Total number of LNURL errors',
      labelNames: ['type', 'endpoint', 'error_code'],
    });

    // Register all metrics
    register.registerMetric(this.withdrawalCreatedCounter);
    register.registerMetric(this.withdrawalCompletedCounter);
    register.registerMetric(this.withdrawalFailedCounter);
    register.registerMetric(this.withdrawalDurationHistogram);
    register.registerMetric(this.activeWithdrawalsGauge);
    register.registerMetric(this.lightningAddressCreatedCounter);
    register.registerMetric(this.lightningAddressPaymentCounter);
    register.registerMetric(this.lightningAddressPaymentAmountHistogram);
    register.registerMetric(this.activeLightningAddressesGauge);
    register.registerMetric(this.externalPaymentCounter);
    register.registerMetric(this.externalPaymentFailedCounter);
    register.registerMetric(this.externalPaymentDurationHistogram);
    register.registerMetric(this.externalPaymentAmountHistogram);
    register.registerMetric(this.lnurlRequestDurationHistogram);
    register.registerMetric(this.lnurlErrorCounter);
  }

  // Withdrawal metrics methods
  recordWithdrawalCreated(type: 'single_use' | 'reusable', count: number = 1) {
    this.withdrawalCreatedCounter.inc({ type, batch: 'single' }, count);
  }

  recordWithdrawalCompleted(
    type: 'single_use' | 'reusable',
    durationMs: number,
  ) {
    this.withdrawalCompletedCounter.inc({ type });
    this.withdrawalDurationHistogram.observe(
      { status: 'completed' },
      durationMs / 1000,
    );
  }

  recordWithdrawalFailed(
    type: 'single_use' | 'reusable',
    reason: string,
    durationMs: number,
  ) {
    this.withdrawalFailedCounter.inc({ type, reason });
    this.withdrawalDurationHistogram.observe(
      { status: 'failed' },
      durationMs / 1000,
    );
  }

  setActiveWithdrawals(type: 'single_use' | 'reusable', count: number) {
    this.activeWithdrawalsGauge.set({ type }, count);
  }

  // Lightning Address metrics methods
  recordLightningAddressCreated(type: 'personal' | 'chama' | 'member_chama') {
    this.lightningAddressCreatedCounter.inc({ type });
  }

  recordLightningAddressPayment(
    addressType: 'personal' | 'chama' | 'member_chama',
    status: 'success' | 'failed',
    amountMsats?: number,
  ) {
    this.lightningAddressPaymentCounter.inc({
      address_type: addressType,
      status,
    });
    if (amountMsats && status === 'success') {
      this.lightningAddressPaymentAmountHistogram.observe(
        { address_type: addressType },
        amountMsats,
      );
    }
  }

  setActiveLightningAddresses(
    type: 'personal' | 'chama' | 'member_chama',
    count: number,
  ) {
    this.activeLightningAddressesGauge.set({ type }, count);
  }

  // External payment metrics methods
  recordExternalPayment(
    domain: string,
    status: 'success' | 'failed',
    durationMs: number,
    amountMsats?: number,
    failureReason?: string,
  ) {
    this.externalPaymentCounter.inc({ domain, status });
    this.externalPaymentDurationHistogram.observe(
      { domain, status },
      durationMs / 1000,
    );

    if (status === 'failed' && failureReason) {
      this.externalPaymentFailedCounter.inc({ domain, reason: failureReason });
    }

    if (amountMsats && status === 'success') {
      this.externalPaymentAmountHistogram.observe({ domain }, amountMsats);
    }
  }

  // General LNURL metrics methods
  recordApiRequest(
    endpoint: string,
    method: string,
    status: number,
    durationMs: number,
  ) {
    this.lnurlRequestDurationHistogram.observe(
      { endpoint, method, status: status.toString() },
      durationMs / 1000,
    );
  }

  recordError(type: string, endpoint: string, errorCode: string) {
    this.lnurlErrorCounter.inc({ type, endpoint, error_code: errorCode });
  }
}
