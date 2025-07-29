import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Counter, Histogram } from '@opentelemetry/api';
import { OperationMetricsService } from '../common';

export const CHAMA_DEPOSIT_METRIC = 'chama:deposit';
export const CHAMA_WITHDRAWAL_METRIC = 'chama:withdrawal';
export const CHAMA_CREATION_METRIC = 'chama:creation';
export const CHAMA_MEMBERSHIP_METRIC = 'chama:membership';

/**
 * Metrics for chama deposit operations
 */
export interface ChamaDepositMetric {
  chamaId: string;
  memberId: string;
  amountMsats: number;
  amountFiat?: number;
  method: 'lightning' | 'onramp' | 'other';
  success: boolean;
  duration: number;
  errorType?: string;
}

/**
 * Metrics for chama withdrawal operations
 */
export interface ChamaWithdrawalMetric {
  chamaId: string;
  memberId: string;
  amountMsats: number;
  amountFiat?: number;
  method: 'lightning' | 'lnurl' | 'offramp' | 'other';
  status: 'requested' | 'approved' | 'rejected' | 'completed' | 'failed';
  success: boolean;
  duration: number;
  errorType?: string;
}

/**
 * Metrics for chama creation
 */
export interface ChamaCreationMetric {
  chamaId: string;
  createdById: string;
  memberCount: number;
  success: boolean;
  duration: number;
  errorType?: string;
}

/**
 * Metrics for chama membership operations
 */
export interface ChamaMembershipMetric {
  chamaId: string;
  memberId: string;
  operation: 'join' | 'invite' | 'update' | 'remove';
  success: boolean;
  duration: number;
  errorType?: string;
}

/**
 * Service for collecting metrics related to chama operations
 * Uses OpenTelemetry for metrics collection
 */
@Injectable()
export class ChamaMetricsService extends OperationMetricsService {
  protected readonly logger = new Logger(ChamaMetricsService.name);

  // Chama-specific counters
  private depositCounter!: Counter;
  private withdrawalCounter!: Counter;
  private withdrawalRequestCounter!: Counter;
  private withdrawalApprovalCounter!: Counter;
  private chamaCreationCounter!: Counter;
  private membershipCounter!: Counter;

  // Chama-specific histograms
  private depositAmountHistogram!: Histogram;
  private withdrawalAmountHistogram!: Histogram;
  private chamaBalanceHistogram!: Histogram;
  private memberBalanceHistogram!: Histogram;
  private chamaSizeHistogram!: Histogram;

  constructor(private eventEmitter: EventEmitter2) {
    super('chama', 'transaction');
    this.initializeMetrics();
  }

  /**
   * Initialize chama-specific metrics
   */
  private initializeMetrics(): void {
    // Deposit counter
    this.depositCounter = this.createCounter('chama.deposits.count', {
      description: 'Number of chama deposit operations',
    });

    // Withdrawal counters
    this.withdrawalCounter = this.createCounter('chama.withdrawals.count', {
      description: 'Number of chama withdrawal operations',
    });

    this.withdrawalRequestCounter = this.createCounter(
      'chama.withdrawals.requests.count',
      {
        description: 'Number of chama withdrawal requests',
      },
    );

    this.withdrawalApprovalCounter = this.createCounter(
      'chama.withdrawals.approvals.count',
      {
        description: 'Number of chama withdrawal approvals',
      },
    );

    // Chama creation counter
    this.chamaCreationCounter = this.createCounter('chama.creations.count', {
      description: 'Number of chama creation operations',
    });

    // Membership counter
    this.membershipCounter = this.createCounter('chama.memberships.count', {
      description: 'Number of chama membership operations',
    });

    // Deposit amount histogram
    this.depositAmountHistogram = this.createHistogram(
      'chama.deposits.amount',
      {
        description: 'Amount of deposits in msats',
        unit: 'msats',
      },
    );

    // Withdrawal amount histogram
    this.withdrawalAmountHistogram = this.createHistogram(
      'chama.withdrawals.amount',
      {
        description: 'Amount of withdrawals in msats',
        unit: 'msats',
      },
    );

    // Chama balance histogram
    this.chamaBalanceHistogram = this.createHistogram('chama.balance', {
      description: 'Chama group balance in msats',
      unit: 'msats',
    });

    // Member balance histogram
    this.memberBalanceHistogram = this.createHistogram('chama.member.balance', {
      description: 'Chama member balance in msats',
      unit: 'msats',
    });

    // Chama size histogram
    this.chamaSizeHistogram = this.createHistogram('chama.size', {
      description: 'Number of members in a chama',
      unit: 'members',
    });
  }

  /**
   * Record metrics for a chama deposit operation
   * @param metric Metrics data for the deposit operation
   */
  recordDepositMetric(metric: ChamaDepositMetric): void {
    const startTime = performance.now();

    try {
      // Record to OpenTelemetry with standard OperationMetricsService
      this.recordOperationMetric({
        operation: 'deposit',
        success: metric.success,
        duration: metric.duration,
        errorType: metric.errorType,
        labels: {
          chamaId: metric.chamaId,
          memberId: metric.memberId,
          method: metric.method,
        },
      });

      // Record chama-specific metrics
      this.depositCounter.add(1, {
        chamaId: metric.chamaId,
        memberId: metric.memberId,
        method: metric.method,
        success: String(metric.success),
      });

      if (metric.amountMsats) {
        this.depositAmountHistogram.record(metric.amountMsats, {
          chamaId: metric.chamaId,
          memberId: metric.memberId,
          method: metric.method,
          success: String(metric.success),
        });
      }

      // Emit event for potential subscribers
      this.eventEmitter.emit(CHAMA_DEPOSIT_METRIC, {
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
   * Record metrics for a chama withdrawal operation
   * @param metric Metrics data for the withdrawal operation
   */
  recordWithdrawalMetric(metric: ChamaWithdrawalMetric): void {
    const startTime = performance.now();

    try {
      // Record to OpenTelemetry with standard OperationMetricsService
      this.recordOperationMetric({
        operation: 'withdrawal',
        success: metric.success,
        duration: metric.duration,
        errorType: metric.errorType,
        labels: {
          chamaId: metric.chamaId,
          memberId: metric.memberId,
          method: metric.method,
          status: metric.status,
        },
      });

      // Record chama-specific metrics
      this.withdrawalCounter.add(1, {
        chamaId: metric.chamaId,
        memberId: metric.memberId,
        method: metric.method,
        status: metric.status,
        success: String(metric.success),
      });

      // Record specific status counters
      if (metric.status === 'requested') {
        this.withdrawalRequestCounter.add(1, {
          chamaId: metric.chamaId,
          memberId: metric.memberId,
        });
      } else if (metric.status === 'approved') {
        this.withdrawalApprovalCounter.add(1, {
          chamaId: metric.chamaId,
          memberId: metric.memberId,
        });
      }

      if (metric.amountMsats) {
        this.withdrawalAmountHistogram.record(metric.amountMsats, {
          chamaId: metric.chamaId,
          memberId: metric.memberId,
          method: metric.method,
          status: metric.status,
          success: String(metric.success),
        });
      }

      // Emit event for potential subscribers
      this.eventEmitter.emit(CHAMA_WITHDRAWAL_METRIC, {
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
   * Record metrics for chama creation
   * @param metric Metrics data for chama creation
   */
  recordChamaCreationMetric(metric: ChamaCreationMetric): void {
    const startTime = performance.now();

    try {
      // Record to OpenTelemetry with standard OperationMetricsService
      this.recordOperationMetric({
        operation: 'creation',
        success: metric.success,
        duration: metric.duration,
        errorType: metric.errorType,
        labels: {
          chamaId: metric.chamaId,
          createdById: metric.createdById,
        },
      });

      // Record chama-specific metrics
      this.chamaCreationCounter.add(1, {
        chamaId: metric.chamaId,
        createdById: metric.createdById,
        success: String(metric.success),
      });

      this.chamaSizeHistogram.record(metric.memberCount, {
        chamaId: metric.chamaId,
      });

      // Emit event for potential subscribers
      this.eventEmitter.emit(CHAMA_CREATION_METRIC, {
        ...metric,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(
        `Error recording chama creation metrics: ${error.message}`,
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
   * Record metrics for chama membership operations
   * @param metric Metrics data for membership operations
   */
  recordMembershipMetric(metric: ChamaMembershipMetric): void {
    const startTime = performance.now();

    try {
      // Record to OpenTelemetry with standard OperationMetricsService
      this.recordOperationMetric({
        operation: 'membership',
        success: metric.success,
        duration: metric.duration,
        errorType: metric.errorType,
        labels: {
          chamaId: metric.chamaId,
          memberId: metric.memberId,
          operation: metric.operation,
        },
      });

      // Record chama-specific metrics
      this.membershipCounter.add(1, {
        chamaId: metric.chamaId,
        memberId: metric.memberId,
        operation: metric.operation,
        success: String(metric.success),
      });

      // Emit event for potential subscribers
      this.eventEmitter.emit(CHAMA_MEMBERSHIP_METRIC, {
        ...metric,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(
        `Error recording membership metrics: ${error.message}`,
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
   * Record balance metrics for a chama group
   * @param chamaId ID of the chama
   * @param balanceMsats Current chama balance in msats
   */
  recordChamaBalanceMetric(chamaId: string, balanceMsats: number): void {
    try {
      this.chamaBalanceHistogram.record(balanceMsats, {
        chamaId,
      });
    } catch (error) {
      this.logger.error(
        `Error recording chama balance metrics: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Record balance metrics for a chama member
   * @param chamaId ID of the chama
   * @param memberId ID of the member
   * @param balanceMsats Current member balance in msats
   */
  recordMemberBalanceMetric(
    chamaId: string,
    memberId: string,
    balanceMsats: number,
  ): void {
    try {
      this.memberBalanceHistogram.record(balanceMsats, {
        chamaId,
        memberId,
      });
    } catch (error) {
      this.logger.error(
        `Error recording member balance metrics: ${error.message}`,
        error.stack,
      );
    }
  }
}
