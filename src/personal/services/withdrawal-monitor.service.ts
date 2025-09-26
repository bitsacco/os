import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SolowalletRepository } from '../db/solowallet.repository';
import { TransactionType, TransactionStatus } from '../../common';
import { DistributedLockService } from './distributed-lock.service';
import { WithdrawalRateLimitService } from './withdrawal-rate-limit.service';

/**
 * Service for monitoring withdrawal patterns and detecting suspicious activity.
 * Implements security monitoring and alerting for the withdrawal system.
 */
@Injectable()
export class WithdrawalMonitorService {
  private readonly logger = new Logger(WithdrawalMonitorService.name);

  // Thresholds for suspicious activity detection
  private readonly RAPID_WITHDRAWAL_THRESHOLD = 5; // withdrawals
  private readonly RAPID_WITHDRAWAL_WINDOW = 60000; // 1 minute
  private readonly HIGH_VALUE_THRESHOLD = 1000000; // 1M sats
  private readonly DAILY_LIMIT = 10000000; // 10M sats
  private readonly FAILED_ATTEMPT_THRESHOLD = 3;

  // In-memory tracking for rapid detection (would use Redis in production)
  private readonly withdrawalAttempts = new Map<string, Date[]>();
  private readonly failedAttempts = new Map<string, number>();

  constructor(
    private readonly walletRepository: SolowalletRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly distributedLockService: DistributedLockService,
    private readonly rateLimitService: WithdrawalRateLimitService,
  ) {}

  /**
   * Monitors a withdrawal attempt for suspicious patterns.
   * Should be called before processing each withdrawal.
   *
   * @param userId User attempting withdrawal
   * @param amountMsats Withdrawal amount in millisats
   * @param walletId Wallet ID
   * @returns Security check result
   */
  async checkWithdrawalSecurity(
    userId: string,
    amountMsats: number,
    walletId: string,
  ): Promise<{
    allowed: boolean;
    reason?: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    alerts: string[];
  }> {
    const alerts: string[] = [];
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';

    // Check 1: Rapid successive withdrawals
    const rapidCheck = await this.checkRapidWithdrawals(userId);
    if (rapidCheck.exceeded) {
      alerts.push(
        `User ${userId} attempting rapid withdrawals: ${rapidCheck.count} in ${rapidCheck.windowMs}ms`,
      );
      riskLevel = 'HIGH';

      if (rapidCheck.count > this.RAPID_WITHDRAWAL_THRESHOLD * 2) {
        this.logger.error(
          `CRITICAL: Possible attack - User ${userId} attempted ${rapidCheck.count} withdrawals`,
        );
        this.emitSecurityAlert({
          type: 'RAPID_WITHDRAWAL_ATTACK',
          userId,
          details: rapidCheck,
          severity: 'CRITICAL',
        });

        return {
          allowed: false,
          reason: 'Too many withdrawal attempts in short period',
          riskLevel: 'CRITICAL',
          alerts,
        };
      }
    }

    // Check 2: High value withdrawal
    if (amountMsats > this.HIGH_VALUE_THRESHOLD) {
      alerts.push(
        `High value withdrawal detected: ${amountMsats} msats for user ${userId}`,
      );
      riskLevel = riskLevel === 'LOW' ? 'MEDIUM' : riskLevel;

      this.emitSecurityAlert({
        type: 'HIGH_VALUE_WITHDRAWAL',
        userId,
        amountMsats,
        severity: 'MEDIUM',
      });
    }

    // Check 3: Daily withdrawal limit
    const dailyTotal = await this.getDailyWithdrawalTotal(userId);
    if (dailyTotal + amountMsats > this.DAILY_LIMIT) {
      alerts.push(
        `Daily limit would be exceeded: Current ${dailyTotal}, Requested ${amountMsats}`,
      );

      this.emitSecurityAlert({
        type: 'DAILY_LIMIT_EXCEEDED',
        userId,
        currentTotal: dailyTotal,
        requestedAmount: amountMsats,
        severity: 'HIGH',
      });

      return {
        allowed: false,
        reason: 'Daily withdrawal limit exceeded',
        riskLevel: 'HIGH',
        alerts,
      };
    }

    // Check 4: Failed attempt tracking
    const failedCount = this.failedAttempts.get(userId) || 0;
    if (failedCount >= this.FAILED_ATTEMPT_THRESHOLD) {
      alerts.push(
        `Multiple failed withdrawal attempts detected for user ${userId}: ${failedCount}`,
      );
      riskLevel = 'HIGH';

      this.emitSecurityAlert({
        type: 'MULTIPLE_FAILED_ATTEMPTS',
        userId,
        failedCount,
        severity: 'HIGH',
      });
    }

    // Check 5: Concurrent withdrawal attempts
    const lockKey = `withdrawal:${userId}:${walletId}`;
    const lockToken = await this.distributedLockService.acquireLock(
      lockKey,
      100,
    ); // Try for 100ms
    const isLocked = !lockToken;

    if (isLocked) {
      alerts.push(`Concurrent withdrawal attempt detected for user ${userId}`);

      this.emitSecurityAlert({
        type: 'CONCURRENT_WITHDRAWAL_ATTEMPT',
        userId,
        severity: 'MEDIUM',
      });

      return {
        allowed: false,
        reason: 'Another withdrawal is currently being processed',
        riskLevel: 'MEDIUM',
        alerts,
      };
    } else if (lockToken) {
      // Release the lock immediately since we're just checking
      await this.distributedLockService.releaseLock(lockKey, lockToken);
    }

    // Check 6: Pattern analysis for anomalies
    const anomalyCheck = await this.checkWithdrawalPatternAnomalies(
      userId,
      amountMsats,
      walletId,
    );

    if (anomalyCheck.suspicious) {
      alerts.push(
        `Anomalous withdrawal pattern detected: ${anomalyCheck.reason}`,
      );
      riskLevel = anomalyCheck.severity as any;

      this.emitSecurityAlert({
        type: 'PATTERN_ANOMALY',
        userId,
        details: anomalyCheck,
        severity: anomalyCheck.severity,
      });
    }

    // Log security check result
    if (alerts.length > 0) {
      this.logger.warn(
        `Security alerts for withdrawal - User: ${userId}, Risk: ${riskLevel}, Alerts: ${alerts.join('; ')}`,
      );
    }

    return {
      allowed: true,
      riskLevel,
      alerts,
    };
  }

  /**
   * Records a failed withdrawal attempt for tracking.
   *
   * @param userId User ID
   * @param amountSats Amount in satoshis
   * @param reason Failure reason
   */
  async recordFailedWithdrawal(
    userId: string,
    amountSats: number,
    reason: string,
  ): Promise<void> {
    const current = this.failedAttempts.get(userId) || 0;
    const newCount = current + 1;
    this.failedAttempts.set(userId, newCount);

    this.logger.warn(
      `Failed withdrawal attempt recorded for user ${userId}: ${reason}`,
    );

    // Auto-block user after too many failed attempts
    if (newCount >= this.FAILED_ATTEMPT_THRESHOLD * 2) {
      await this.rateLimitService.blockUser(
        userId,
        30, // 30 minute block
        `Too many failed withdrawal attempts (${newCount})`,
      );

      this.emitSecurityAlert({
        type: 'USER_BLOCKED_FAILED_ATTEMPTS',
        userId,
        failedCount: newCount,
        severity: 'HIGH',
      });
    }

    // Reset counter after 1 hour
    setTimeout(() => {
      this.failedAttempts.delete(userId);
    }, 3600000);
  }

  /**
   * Records a successful withdrawal for tracking.
   *
   * @param userId User ID
   * @param amountMsats Amount in millisatoshis
   */
  async recordSuccessfulWithdrawal(
    userId: string,
    amountMsats: number,
  ): Promise<void> {
    // Track for rapid withdrawal detection
    const attempts = this.withdrawalAttempts.get(userId) || [];
    attempts.push(new Date());

    // Keep only recent attempts
    const cutoff = Date.now() - this.RAPID_WITHDRAWAL_WINDOW;
    const recentAttempts = attempts.filter((d) => d.getTime() > cutoff);
    this.withdrawalAttempts.set(userId, recentAttempts);

    // Clear failed attempts on success
    this.failedAttempts.delete(userId);

    // Check if we should reset rate limiting after successful withdrawal
    if (recentAttempts.length === 1) {
      // First withdrawal after period of inactivity - reset burst limits
      await this.rateLimitService.resetLimits(userId, 'burst');
    }
  }

  /**
   * Checks for rapid successive withdrawal attempts.
   *
   * @param userId User ID
   * @returns Rapid withdrawal check result
   */
  private async checkRapidWithdrawals(userId: string): Promise<{
    exceeded: boolean;
    count: number;
    windowMs: number;
  }> {
    const attempts = this.withdrawalAttempts.get(userId) || [];
    const cutoff = Date.now() - this.RAPID_WITHDRAWAL_WINDOW;
    const recentAttempts = attempts.filter((d) => d.getTime() > cutoff);

    return {
      exceeded: recentAttempts.length >= this.RAPID_WITHDRAWAL_THRESHOLD,
      count: recentAttempts.length,
      windowMs: this.RAPID_WITHDRAWAL_WINDOW,
    };
  }

  /**
   * Gets the total withdrawal amount for a user in the last 24 hours.
   *
   * @param userId User ID
   * @returns Total withdrawal amount in msats
   */
  private async getDailyWithdrawalTotal(userId: string): Promise<number> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await this.walletRepository.aggregate([
      {
        $match: {
          userId,
          type: TransactionType.WITHDRAW,
          status: {
            $in: [TransactionStatus.COMPLETE, TransactionStatus.PROCESSING],
          },
          createdAt: { $gte: oneDayAgo },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amountMsats' },
        },
      },
    ]);

    return result[0]?.total || 0;
  }

  /**
   * Analyzes withdrawal patterns for anomalies.
   *
   * @param userId User ID
   * @param amountMsats Withdrawal amount
   * @param walletId Wallet ID
   * @returns Anomaly detection result
   */
  private async checkWithdrawalPatternAnomalies(
    userId: string,
    amountMsats: number,
    walletId: string,
  ): Promise<{
    suspicious: boolean;
    reason?: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
  }> {
    // Get user's withdrawal history for pattern analysis
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const history = await this.walletRepository.find(
      {
        userId,
        type: TransactionType.WITHDRAW,
        status: TransactionStatus.COMPLETE,
        createdAt: { $gte: thirtyDaysAgo },
      },
      { createdAt: -1 },
    );

    if (history.length < 5) {
      // Not enough history for pattern analysis
      return { suspicious: false, severity: 'LOW' };
    }

    // Calculate average withdrawal amount
    const avgAmount =
      history.reduce((sum, tx) => sum + tx.amountMsats, 0) / history.length;

    // Check for significant deviation from average
    if (amountMsats > avgAmount * 10) {
      return {
        suspicious: true,
        reason: `Amount is ${Math.round(amountMsats / avgAmount)}x higher than average`,
        severity: 'HIGH',
      };
    }

    if (amountMsats > avgAmount * 5) {
      return {
        suspicious: true,
        reason: `Amount is ${Math.round(amountMsats / avgAmount)}x higher than average`,
        severity: 'MEDIUM',
      };
    }

    // Check for unusual time patterns
    const currentHour = new Date().getHours();
    const historicalHours = history.map((tx) => tx.createdAt.getHours());
    const avgHour =
      historicalHours.reduce((sum, h) => sum + h, 0) / historicalHours.length;

    if (Math.abs(currentHour - avgHour) > 8) {
      return {
        suspicious: true,
        reason: 'Withdrawal at unusual time compared to history',
        severity: 'LOW',
      };
    }

    return { suspicious: false, severity: 'LOW' };
  }

  /**
   * Emits a security alert event for monitoring systems.
   *
   * @param alert Alert details
   */
  private emitSecurityAlert(alert: {
    type: string;
    userId: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    [key: string]: any;
  }): void {
    this.eventEmitter.emit('withdrawal.security.alert', alert);

    // Log based on severity
    switch (alert.severity) {
      case 'CRITICAL':
        this.logger.error(`SECURITY ALERT: ${JSON.stringify(alert)}`);
        break;
      case 'HIGH':
        this.logger.error(`Security Alert: ${JSON.stringify(alert)}`);
        break;
      case 'MEDIUM':
        this.logger.warn(`Security Alert: ${JSON.stringify(alert)}`);
        break;
      default:
        this.logger.log(`Security Notice: ${JSON.stringify(alert)}`);
    }
  }

  /**
   * Scheduled job to clean up stale PROCESSING withdrawals.
   * Runs every 5 minutes to detect and handle stuck transactions.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async cleanupStaleWithdrawals(): Promise<void> {
    const lockKey = 'monitor:cleanup:withdrawals';
    const lockToken = await this.distributedLockService.acquireLock(
      lockKey,
      60000,
    );

    if (!lockToken) {
      this.logger.debug('Skipping cleanup - another instance is running');
      return;
    }

    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      // Find stuck PROCESSING withdrawals
      const staleWithdrawals = await this.walletRepository.find({
        type: TransactionType.WITHDRAW,
        status: TransactionStatus.PROCESSING,
        stateChangedAt: { $lt: fiveMinutesAgo },
      });

      if (staleWithdrawals.length > 0) {
        this.logger.warn(
          `Found ${staleWithdrawals.length} stale PROCESSING withdrawals`,
        );

        for (const withdrawal of staleWithdrawals) {
          this.emitSecurityAlert({
            type: 'STALE_WITHDRAWAL_DETECTED',
            userId: withdrawal.userId,
            withdrawalId: withdrawal._id,
            stuckDuration: Date.now() - withdrawal.stateChangedAt.getTime(),
            severity: 'MEDIUM',
          });

          // Could implement auto-recovery here if appropriate
          // For now, just alert for manual intervention
        }
      }
    } finally {
      await this.distributedLockService.releaseLock(lockKey, lockToken);
    }
  }

  /**
   * Gets withdrawal security metrics for monitoring dashboards.
   *
   * @returns Security metrics
   */
  async getSecurityMetrics(): Promise<{
    activeAlerts: number;
    suspiciousUsers: string[];
    recentHighValueWithdrawals: number;
    processingWithdrawals: number;
    failedAttemptUsers: number;
  }> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const [processingCount, highValueCount] = await Promise.all([
      this.walletRepository.countDocuments({
        type: TransactionType.WITHDRAW,
        status: TransactionStatus.PROCESSING,
      }),
      this.walletRepository.countDocuments({
        type: TransactionType.WITHDRAW,
        status: TransactionStatus.COMPLETE,
        amountMsats: { $gte: this.HIGH_VALUE_THRESHOLD },
        createdAt: { $gte: oneHourAgo },
      }),
    ]);

    return {
      activeAlerts: this.failedAttempts.size,
      suspiciousUsers: Array.from(this.failedAttempts.keys()),
      recentHighValueWithdrawals: highValueCount,
      processingWithdrawals: processingCount,
      failedAttemptUsers: this.failedAttempts.size,
    };
  }
}
