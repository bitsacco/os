import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CommonRateLimitService,
  RateLimitContext,
  WITHDRAWAL_RATE_LIMITS,
} from '../../common/rate-limiting';
import { WithdrawalRateLimitRepository } from '../db/withdrawal-rate-limit.repository';

/**
 * Rate limit check result (legacy compatibility)
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  reason?: string;
  shouldBlock?: boolean;
}

/**
 * User blocking state
 */
interface UserBlockState {
  userId: string;
  blockedUntil?: Date;
  suspiciousActivity: number;
}

/**
 * Withdrawal Rate Limit Service (V2)
 *
 * Simplified wrapper around CommonRateLimitService for withdrawal operations.
 * Provides backward compatibility while leveraging the common rate limiting system.
 *
 * Features:
 * - Multiple rate limit checks (burst, per-minute, high-value)
 * - User blocking for suspicious activity
 * - Automatic cleanup
 * - Event emission for monitoring
 */
@Injectable()
export class WithdrawalRateLimitService {
  private readonly logger = new Logger(WithdrawalRateLimitService.name);

  // User block tracking
  private readonly userBlocks = new Map<string, UserBlockState>();

  // High-value threshold
  private readonly HIGH_VALUE_THRESHOLD = 100000; // 100k sats

  // Cleanup interval
  private cleanupInterval: any;

  constructor(
    private readonly rateLimitRepository: WithdrawalRateLimitRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly commonRateLimit: CommonRateLimitService,
  ) {
    // Register withdrawal rate limit configurations
    this.commonRateLimit.registerConfigs(WITHDRAWAL_RATE_LIMITS.rules);
    this.logger.log('Initialized withdrawal rate limiting with common service');

    // Start cleanup process
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if a withdrawal request is allowed based on rate limits.
   *
   * @param userId User ID
   * @param amountSats Amount in satoshis
   * @param withdrawalType Type of withdrawal (LIGHTNING, LNURL, EXTERNAL)
   * @returns Rate limit check result
   */
  async checkRateLimit(
    userId: string,
    amountSats: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _withdrawalType: 'LIGHTNING' | 'LNURL' | 'EXTERNAL' = 'LIGHTNING',
  ): Promise<RateLimitResult> {
    try {
      // Check if user is blocked
      const blockState = this.userBlocks.get(userId);
      if (blockState?.blockedUntil && blockState.blockedUntil > new Date()) {
        const minutesLeft = Math.ceil(
          (blockState.blockedUntil.getTime() - Date.now()) / 60000,
        );
        return {
          allowed: false,
          remaining: 0,
          resetAt: blockState.blockedUntil,
          reason: `Account temporarily blocked. Try again in ${minutesLeft} minutes.`,
          shouldBlock: true,
        };
      }

      // Check burst limits first (most restrictive)
      const burstCheck = await this.commonRateLimit.check({
        context: RateLimitContext.WITHDRAWAL,
        action: 'request:burst',
        entityId: userId,
        entityType: 'user',
      });

      if (!burstCheck.allowed) {
        this.logger.warn(
          `Burst limit exceeded for user ${userId}: ${burstCheck.reason}`,
        );
        await this.incrementSuspiciousActivity(userId);
        return this.convertToLegacyResult(burstCheck);
      }

      // Check per-minute limits
      const minuteCheck = await this.commonRateLimit.check({
        context: RateLimitContext.WITHDRAWAL,
        action: 'request:minute',
        entityId: userId,
        entityType: 'user',
      });

      if (!minuteCheck.allowed) {
        this.logger.warn(
          `Per-minute limit exceeded for user ${userId}: ${minuteCheck.reason}`,
        );
        return this.convertToLegacyResult(minuteCheck);
      }

      // Check high-value limits if applicable
      if (amountSats > this.HIGH_VALUE_THRESHOLD) {
        const highValueCheck = await this.commonRateLimit.check({
          context: RateLimitContext.WITHDRAWAL,
          action: 'high_value:minute',
          entityId: userId,
          entityType: 'user',
        });

        if (!highValueCheck.allowed) {
          this.logger.warn(
            `High-value limit exceeded for user ${userId}: ${highValueCheck.reason}`,
          );
          return this.convertToLegacyResult(highValueCheck);
        }
      }

      // All checks passed
      return {
        allowed: true,
        remaining: Math.min(burstCheck.remaining, minuteCheck.remaining),
        resetAt: new Date(
          Math.min(burstCheck.resetAt.getTime(), minuteCheck.resetAt.getTime()),
        ),
      };
    } catch (error) {
      this.logger.error(`Error checking rate limit for user ${userId}:`, error);
      // Fail closed for withdrawals (security-critical)
      this.eventEmitter.emit('rate-limit.error', {
        userId,
        error: error.message,
        timestamp: new Date(),
      });
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(Date.now() + 60000),
        reason: 'Rate limit check failed for security reasons',
      };
    }
  }

  /**
   * Record a successful withdrawal for rate limiting.
   *
   * @param userId User ID
   * @param amountSats Amount in satoshis
   * @param withdrawalType Type of withdrawal
   */
  async recordWithdrawal(
    userId: string,
    amountSats: number,
    withdrawalType: 'LIGHTNING' | 'LNURL' | 'EXTERNAL' = 'LIGHTNING',
  ): Promise<void> {
    try {
      // Emit event for monitoring
      // Note: Rate limit recording happens atomically in check() method
      this.eventEmitter.emit('withdrawal.recorded', {
        userId,
        amountSats,
        withdrawalType,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(
        `Error recording withdrawal for user ${userId}:`,
        error,
      );
    }
  }

  /**
   * Block a user temporarily due to suspicious activity.
   *
   * @param userId User ID
   * @param durationMinutes Block duration in minutes
   * @param reason Reason for blocking
   */
  async blockUser(
    userId: string,
    durationMinutes: number,
    reason: string,
  ): Promise<void> {
    const blockState: UserBlockState = {
      userId,
      blockedUntil: new Date(Date.now() + durationMinutes * 60000),
      suspiciousActivity:
        (this.userBlocks.get(userId)?.suspiciousActivity || 0) + 1,
    };

    this.userBlocks.set(userId, blockState);

    // Persist to database
    try {
      await this.rateLimitRepository.saveUserLimits({
        userId,
        blockedUntil: blockState.blockedUntil,
        suspiciousActivity: blockState.suspiciousActivity,
        daily: { count: 0, totalSats: 0, resetAt: new Date() },
        hourly: { count: 0, totalSats: 0, resetAt: new Date() },
        burst: { count: 0, resetAt: new Date() },
      });
    } catch (error) {
      this.logger.error(`Error persisting block state for ${userId}:`, error);
    }

    this.logger.warn(
      `User ${userId} blocked for ${durationMinutes} minutes: ${reason}`,
    );

    this.eventEmitter.emit('user.blocked', {
      userId,
      blockedUntil: blockState.blockedUntil,
      reason,
      suspiciousActivity: blockState.suspiciousActivity,
    });
  }

  /**
   * Reset rate limits for a user (e.g., after successful payment).
   *
   * @param userId User ID
   * @param resetType Type of reset (burst, all)
   */
  async resetLimits(
    userId: string,
    resetType: 'burst' | 'all' = 'burst',
  ): Promise<void> {
    if (resetType === 'all') {
      // Reset all rate limits
      await this.commonRateLimit.reset({
        context: RateLimitContext.WITHDRAWAL,
        action: 'request:burst',
        entityId: userId,
      });
      await this.commonRateLimit.reset({
        context: RateLimitContext.WITHDRAWAL,
        action: 'request:minute',
        entityId: userId,
      });
      await this.commonRateLimit.reset({
        context: RateLimitContext.WITHDRAWAL,
        action: 'high_value:minute',
        entityId: userId,
      });

      // Clear block state
      this.userBlocks.delete(userId);

      // Clear from database
      try {
        await this.rateLimitRepository.deleteUserLimits(userId);
      } catch (error) {
        this.logger.error(`Error deleting user limits for ${userId}:`, error);
      }
    } else if (resetType === 'burst') {
      // Reset only burst protection
      await this.commonRateLimit.reset({
        context: RateLimitContext.WITHDRAWAL,
        action: 'request:burst',
        entityId: userId,
      });
    }
  }

  /**
   * Get current rate limit status for a user.
   *
   * @param userId User ID
   * @returns Current rate limit status
   */
  async getRateLimitStatus(userId: string): Promise<{
    burst: any;
    minute: any;
    highValue: any;
    blocked: boolean;
    blockedUntil?: Date;
  }> {
    const [burst, minute, highValue] = await Promise.all([
      this.commonRateLimit.getStatus({
        context: RateLimitContext.WITHDRAWAL,
        action: 'request:burst',
        entityId: userId,
      }),
      this.commonRateLimit.getStatus({
        context: RateLimitContext.WITHDRAWAL,
        action: 'request:minute',
        entityId: userId,
      }),
      this.commonRateLimit.getStatus({
        context: RateLimitContext.WITHDRAWAL,
        action: 'high_value:minute',
        entityId: userId,
      }),
    ]);

    const blockState = this.userBlocks.get(userId);
    const blocked = !!(
      blockState?.blockedUntil && blockState.blockedUntil > new Date()
    );

    return {
      burst,
      minute,
      highValue,
      blocked,
      blockedUntil: blockState?.blockedUntil,
    };
  }

  /**
   * Convert unified rate limit result to legacy format
   */
  private convertToLegacyResult(result: any): RateLimitResult {
    return {
      allowed: result.allowed,
      remaining: result.remaining,
      resetAt: result.resetAt,
      reason: result.reason,
      shouldBlock: !result.allowed,
    };
  }

  /**
   * Increment suspicious activity counter
   */
  private async incrementSuspiciousActivity(userId: string): Promise<void> {
    const blockState = this.userBlocks.get(userId) || {
      userId,
      suspiciousActivity: 0,
    };

    blockState.suspiciousActivity++;

    // Auto-block after too many suspicious attempts
    if (blockState.suspiciousActivity >= 10) {
      await this.blockUser(
        userId,
        60, // 1 hour block
        'Too many suspicious withdrawal attempts',
      );
    } else if (blockState.suspiciousActivity >= 5) {
      await this.blockUser(
        userId,
        15, // 15 minute block
        'Multiple suspicious withdrawal attempts',
      );
    }

    this.userBlocks.set(userId, blockState);
  }

  /**
   * Cleanup expired block states
   */
  private cleanup(): void {
    const now = new Date();
    let cleaned = 0;

    for (const [userId, blockState] of this.userBlocks.entries()) {
      if (blockState.blockedUntil && blockState.blockedUntil <= now) {
        this.userBlocks.delete(userId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} expired block states`);
    }
  }

  /**
   * Lifecycle hook - cleanup on destroy
   */
  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}
