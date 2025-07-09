import { Injectable, Logger } from '@nestjs/common';
import { Counter, Histogram } from '@opentelemetry/api';
import { OperationMetricsService } from '@bitsacco/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Event constants for metrics
export const TOKEN_OPERATION_METRIC = 'auth:token:operation';

/**
 * Metrics for token operations
 */
export interface TokenOperationMetric {
  userId?: string;
  operation: 'issue' | 'refresh' | 'verify' | 'revoke';
  success: boolean;
  duration: number;
  errorType?: string;
}

/**
 * Service for tracking token operations metrics
 */
@Injectable()
export class TokenMetricsService extends OperationMetricsService {
  protected readonly logger = new Logger(TokenMetricsService.name);

  // Token operation specific counters
  private tokenOperationByTypeCounter!: Counter;

  // Token operation specific histograms
  private tokenOperationByTypeHistogram!: Histogram;

  // In-memory metrics for backward compatibility
  private metrics = {
    // Token operations by type
    tokenOperations: {
      issue: 0,
      refresh: 0,
      verify: 0,
      revoke: 0,
    },
    successfulTokenOperations: {
      issue: 0,
      refresh: 0,
      verify: 0,
      revoke: 0,
    },

    // Error tracking
    errorTypes: {} as Record<string, number>,
  };

  constructor(private eventEmitter: EventEmitter2) {
    super('auth', 'token');
    this.initializeMetrics();
  }

  /**
   * Initialize token-specific metrics
   */
  private initializeMetrics() {
    // Token operation by type counter
    this.tokenOperationByTypeCounter = this.createCounter(
      'auth.token.operations_by_type',
      {
        description: 'Number of token operations by operation type',
      },
    );

    // Token operation by type histogram
    this.tokenOperationByTypeHistogram = this.createHistogram(
      'auth.token.operations_by_type.duration',
      {
        description: 'Duration of token operations by operation type',
        unit: 'ms',
      },
    );
  }

  /**
   * Record metrics for token operations
   */
  recordTokenOperationMetric(metric: TokenOperationMetric): void {
    // Update in-memory metrics
    this.metrics.tokenOperations[metric.operation]++;

    if (metric.success) {
      this.metrics.successfulTokenOperations[metric.operation]++;
    }

    if (metric.errorType) {
      this.metrics.errorTypes[metric.errorType] =
        (this.metrics.errorTypes[metric.errorType] || 0) + 1;
    }

    // Record to OpenTelemetry with standard OperationMetricsService
    this.recordOperationMetric({
      operation: `token_${metric.operation}`,
      success: metric.success,
      duration: metric.duration,
      errorType: metric.errorType,
      labels: {
        userId: metric.userId || 'anonymous',
        operation: metric.operation,
      },
    });

    // Record token operation specific metrics
    this.tokenOperationByTypeCounter.add(1, {
      operation: metric.operation,
      success: String(metric.success),
    });

    this.tokenOperationByTypeHistogram.record(metric.duration, {
      operation: metric.operation,
      success: String(metric.success),
    });

    // Emit event for potential subscribers
    this.eventEmitter.emit(TOKEN_OPERATION_METRIC, {
      ...metric,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get the current metrics summary
   */
  getMetrics() {
    // Calculate token operation success rates
    const tokenSuccessRate = {
      total: this.calculateSuccessRate(
        Object.values(this.metrics.successfulTokenOperations).reduce(
          (a, b) => a + b,
          0,
        ),
        Object.values(this.metrics.tokenOperations).reduce((a, b) => a + b, 0),
      ),
      byOperation: {} as Record<string, number>,
    };

    // Calculate success rates by operation
    for (const operation of Object.keys(this.metrics.tokenOperations)) {
      tokenSuccessRate.byOperation[operation] = this.calculateSuccessRate(
        this.metrics.successfulTokenOperations[operation],
        this.metrics.tokenOperations[operation],
      );
    }

    return {
      operations: this.metrics.tokenOperations,
      successful: this.metrics.successfulTokenOperations,
      successRate: tokenSuccessRate,
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
    // Reset token metrics
    for (const operation of Object.keys(this.metrics.tokenOperations)) {
      this.metrics.tokenOperations[operation] = 0;
      this.metrics.successfulTokenOperations[operation] = 0;
    }

    // Reset error types
    this.metrics.errorTypes = {};
  }
}
