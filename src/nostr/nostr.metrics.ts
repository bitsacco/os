import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Counter, Histogram } from '@opentelemetry/api';
import { OperationMetricsService } from '../common';

export const NOSTR_MESSAGE_METRIC = 'nostr:message';
export const NOSTR_RELAY_METRIC = 'nostr:relay';

export enum NostrMessageType {
  encrypted = 'encrypted',
  public = 'public',
  other = 'other',
}

export enum NostrRecipientType {
  user = 'user',
  group = 'group',
  self = 'self',
  other = 'other',
}

export enum NostrOperation {
  connect = 'connect',
  disconnect = 'disconnect',
  publishAttempt = 'publish-attempt',
  publish = 'publish',
  subscribe = 'subscribe',
}

/**
 * Metrics for nostr message operations
 */
export interface NostrMessageMetric {
  messageType: NostrMessageType;
  recipientType: NostrRecipientType;
  success: boolean;
  duration: number;
  errorType?: string;
}

/**
 * Metrics for nostr relay operations
 */
export interface NostrRelayMetric {
  relayUrl: string;
  operation: NostrOperation;
  success: boolean;
  duration: number;
  errorType?: string;
}

/**
 * Service for collecting metrics related to nostr operations
 * Uses OpenTelemetry for metrics collection
 */
@Injectable()
export class NostrMetricsService extends OperationMetricsService {
  protected readonly logger = new Logger(NostrMetricsService.name);

  // Nostr-specific counters
  private messageCounter!: Counter;
  private relayOperationCounter!: Counter;
  private connectedRelaysCounter!: Counter;
  private messageErrorCounter!: Counter;
  private relayErrorCounter!: Counter;

  // Nostr-specific histograms
  private messageLatencyHistogram!: Histogram;
  private relayLatencyHistogram!: Histogram;

  constructor(private eventEmitter: EventEmitter2) {
    super('nostr', 'operation');
    this.initializeMetrics();
  }

  /**
   * Initialize nostr-specific metrics
   */
  private initializeMetrics(): void {
    // Message counter
    this.messageCounter = this.createCounter('nostr.messages.count', {
      description: 'Number of nostr messages sent',
    });

    // Relay operation counter
    this.relayOperationCounter = this.createCounter(
      'nostr.relay.operations.count',
      {
        description: 'Number of nostr relay operations',
      },
    );

    // Connected relays counter
    this.connectedRelaysCounter = this.createCounter(
      'nostr.relays.connected.count',
      {
        description: 'Number of connected nostr relays',
      },
    );

    // Message error counter
    this.messageErrorCounter = this.createCounter(
      'nostr.messages.errors.count',
      {
        description: 'Number of nostr message errors',
      },
    );

    // Relay error counter
    this.relayErrorCounter = this.createCounter('nostr.relay.errors.count', {
      description: 'Number of nostr relay operation errors',
    });

    // Message latency histogram
    this.messageLatencyHistogram = this.createHistogram(
      'nostr.messages.latency',
      {
        description: 'Latency of nostr message operations in milliseconds',
        unit: 'ms',
      },
    );

    // Relay latency histogram
    this.relayLatencyHistogram = this.createHistogram('nostr.relay.latency', {
      description: 'Latency of nostr relay operations in milliseconds',
      unit: 'ms',
    });
  }

  /**
   * Record metrics for a nostr message operation
   * @param metric Metrics data for the message operation
   */
  recordMessageMetric(metric: NostrMessageMetric): void {
    const startTime = performance.now();

    try {
      // Record to OpenTelemetry with standard OperationMetricsService
      this.recordOperationMetric({
        operation: 'message',
        success: metric.success,
        duration: metric.duration,
        errorType: metric.errorType,
        labels: {
          messageType: metric.messageType,
          recipientType: metric.recipientType,
        },
      });

      // Record nostr-specific metrics
      this.messageCounter.add(1, {
        messageType: metric.messageType,
        recipientType: metric.recipientType,
        success: String(metric.success),
      });

      this.messageLatencyHistogram.record(metric.duration, {
        messageType: metric.messageType,
        recipientType: metric.recipientType,
        success: String(metric.success),
      });

      if (!metric.success && metric.errorType) {
        this.messageErrorCounter.add(1, {
          messageType: metric.messageType,
          recipientType: metric.recipientType,
          errorType: metric.errorType,
        });
      }

      // Emit event for potential subscribers
      this.eventEmitter.emit(NOSTR_MESSAGE_METRIC, {
        ...metric,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(
        `Error recording message metrics: ${error.message}`,
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
   * Record metrics for a nostr relay operation
   * @param metric Metrics data for the relay operation
   */
  recordRelayMetric(metric: NostrRelayMetric): void {
    const startTime = performance.now();

    try {
      // Record to OpenTelemetry with standard OperationMetricsService
      this.recordOperationMetric({
        operation: 'relay',
        success: metric.success,
        duration: metric.duration,
        errorType: metric.errorType,
        labels: {
          relayUrl: metric.relayUrl,
          operation: metric.operation,
        },
      });

      // Record nostr-specific metrics
      this.relayOperationCounter.add(1, {
        relayUrl: metric.relayUrl,
        operation: metric.operation,
        success: String(metric.success),
      });

      this.relayLatencyHistogram.record(metric.duration, {
        relayUrl: metric.relayUrl,
        operation: metric.operation,
        success: String(metric.success),
      });

      if (!metric.success && metric.errorType) {
        this.relayErrorCounter.add(1, {
          relayUrl: metric.relayUrl,
          operation: metric.operation,
          errorType: metric.errorType,
        });
      }

      // Emit event for potential subscribers
      this.eventEmitter.emit(NOSTR_RELAY_METRIC, {
        ...metric,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(
        `Error recording relay metrics: ${error.message}`,
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
   * Update the count of connected relays
   * @param count Number of connected relays
   */
  updateConnectedRelaysCount(count: number): void {
    try {
      // Since we want to record the actual count, we'll reset the counter and then add the current count
      this.connectedRelaysCounter.add(count);
    } catch (error) {
      this.logger.error(
        `Error updating connected relays count: ${error.message}`,
        error.stack,
      );
    }
  }
}
