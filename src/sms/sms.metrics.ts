import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Counter, Histogram } from '@opentelemetry/api';
import { OperationMetricsService } from '../common';

export const SMS_SENT_METRIC = 'sms:sent';
export const SMS_BULK_SENT_METRIC = 'sms:bulk_sent';
export const SMS_ERROR_METRIC = 'sms:error';

/**
 * Metrics for SMS operations
 */
export interface SmsMetric {
  receiver: string;
  messageLength: number;
  success: boolean;
  duration: number;
  errorType?: string;
  provider?: string;
}

/**
 * Metrics for bulk SMS operations
 */
export interface SmsBulkMetric {
  receiverCount: number;
  messageLength: number;
  success: boolean;
  duration: number;
  errorType?: string;
  provider?: string;
}

/**
 * Service for collecting metrics related to SMS operations
 * Uses OpenTelemetry for metrics collection
 */
@Injectable()
export class SmsMetricsService extends OperationMetricsService {
  protected readonly logger = new Logger(SmsMetricsService.name);

  // SMS-specific counters
  private smsSentCounter!: Counter;
  private smsBulkSentCounter!: Counter;
  private smsErrorCounter!: Counter;

  // SMS-specific histograms
  private smsLatencyHistogram!: Histogram;
  private smsBulkLatencyHistogram!: Histogram;
  private smsMessageLengthHistogram!: Histogram;
  private smsReceiverCountHistogram!: Histogram;

  constructor(private eventEmitter: EventEmitter2) {
    super('sms', 'operation');
    this.initializeMetrics();
  }

  /**
   * Initialize SMS-specific metrics
   */
  private initializeMetrics(): void {
    // SMS counters
    this.smsSentCounter = this.createCounter('sms.sent.count', {
      description: 'Number of SMS messages sent',
    });

    this.smsBulkSentCounter = this.createCounter('sms.bulk_sent.count', {
      description: 'Number of bulk SMS operations',
    });

    this.smsErrorCounter = this.createCounter('sms.errors.count', {
      description: 'Number of SMS errors',
    });

    // SMS histograms
    this.smsLatencyHistogram = this.createHistogram('sms.latency', {
      description: 'Latency of SMS operations in milliseconds',
      unit: 'ms',
    });

    this.smsBulkLatencyHistogram = this.createHistogram('sms.bulk_latency', {
      description: 'Latency of bulk SMS operations in milliseconds',
      unit: 'ms',
    });

    this.smsMessageLengthHistogram = this.createHistogram(
      'sms.message_length',
      {
        description: 'Length of SMS messages in characters',
        unit: 'characters',
      },
    );

    this.smsReceiverCountHistogram = this.createHistogram(
      'sms.receiver_count',
      {
        description: 'Number of receivers in bulk SMS operations',
        unit: 'receivers',
      },
    );
  }

  /**
   * Record metrics for an SMS operation
   * @param metric Metrics data for the SMS operation
   */
  recordSmsMetric(metric: SmsMetric): void {
    const startTime = performance.now();

    try {
      // Record to OpenTelemetry with standard OperationMetricsService
      this.recordOperationMetric({
        operation: 'sms_send',
        success: metric.success,
        duration: metric.duration,
        errorType: metric.errorType,
        labels: {
          receiver: metric.receiver,
          provider: metric.provider || 'unknown',
        },
      });

      // Record SMS-specific metrics
      this.smsSentCounter.add(1, {
        success: String(metric.success),
        provider: metric.provider || 'unknown',
      });

      this.smsLatencyHistogram.record(metric.duration, {
        success: String(metric.success),
        provider: metric.provider || 'unknown',
      });

      this.smsMessageLengthHistogram.record(metric.messageLength);

      if (!metric.success && metric.errorType) {
        this.smsErrorCounter.add(1, {
          errorType: metric.errorType,
          operation: 'send',
        });
      }

      // Emit event for potential subscribers
      this.eventEmitter.emit(SMS_SENT_METRIC, {
        ...metric,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(
        `Error recording SMS metrics: ${error.message}`,
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
   * Record metrics for a bulk SMS operation
   * @param metric Metrics data for the bulk SMS operation
   */
  recordSmsBulkMetric(metric: SmsBulkMetric): void {
    const startTime = performance.now();

    try {
      // Record to OpenTelemetry with standard OperationMetricsService
      this.recordOperationMetric({
        operation: 'sms_bulk_send',
        success: metric.success,
        duration: metric.duration,
        errorType: metric.errorType,
        labels: {
          receiverCount: String(metric.receiverCount),
          provider: metric.provider || 'unknown',
        },
      });

      // Record SMS-specific metrics
      this.smsBulkSentCounter.add(1, {
        success: String(metric.success),
        provider: metric.provider || 'unknown',
      });

      this.smsBulkLatencyHistogram.record(metric.duration, {
        success: String(metric.success),
        provider: metric.provider || 'unknown',
      });

      this.smsMessageLengthHistogram.record(metric.messageLength);
      this.smsReceiverCountHistogram.record(metric.receiverCount);

      if (!metric.success && metric.errorType) {
        this.smsErrorCounter.add(1, {
          errorType: metric.errorType,
          operation: 'bulk_send',
        });
      }

      // Emit event for potential subscribers
      this.eventEmitter.emit(SMS_BULK_SENT_METRIC, {
        ...metric,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(
        `Error recording bulk SMS metrics: ${error.message}`,
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
