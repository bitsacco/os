import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WithdrawalRateLimitRepository } from '../db/withdrawal-rate-limit.repository';

/**
 * Rate limiting configuration for different withdrawal types
 */
export interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
  identifier: string;
}

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  reason?: string;
  shouldBlock?: boolean;
}

/**
 * User rate limit tracking
 */
interface UserRateLimits {
  userId: string;
  daily: {
    count: number;
    totalSats: number;
    resetAt: Date;
  };
  hourly: {
    count: number;
    totalSats: number;
    resetAt: Date;
  };
  burst: {
    count: number;
    resetAt: Date;
  };
  blockedUntil?: Date;
  suspiciousActivity: number;
}

/**
 * Service for handling withdrawal rate limiting without external throttler dependencies.
 * Implements multi-layer rate limiting with both in-memory and MongoDB persistence.
 */
@Injectable()
export class WithdrawalRateLimitService {
  private readonly logger = new Logger(WithdrawalRateLimitService.name);

  // Rate limit configurations
  private readonly LIMITS = {
    // Burst protection: max 20 requests per 10 seconds
    BURST: {
      maxRequests: 20,
      windowSeconds: 10,
    },
    // Per-minute limits by type
    LIGHTNING: {
      maxRequests: 5,
      windowSeconds: 60,
    },
    LNURL: {
      maxRequests: 3,
      windowSeconds: 60,
    },
    EXTERNAL: {
      maxRequests: 10,
      windowSeconds: 60,
    },
    // High-value limits (> 100,000 sats)
    HIGH_VALUE: {
      maxRequests: 1,
      windowSeconds: 300, // 5 minutes
      thresholdSats: 100000,
    },
    // Daily limits
    DAILY: {
      maxRequests: 100,
      maxTotalSats: 10000000, // 10M sats
      windowSeconds: 86400, // 24 hours
    },
    // Hourly limits
    HOURLY: {
      maxRequests: 20,
      maxTotalSats: 2000000, // 2M sats
      windowSeconds: 3600, // 1 hour
    },
  };

  // In-memory cache for fast lookups
  private readonly userLimits = new Map<string, UserRateLimits>();
  private readonly requestCounts = new Map<
    string,
    Map<string, { count: number; resetAt: Date }>
  >();

  // Cleanup interval
  private cleanupInterval: any; // Using any to avoid Timer/Timeout type mismatch

  constructor(
    private readonly rateLimitRepository: WithdrawalRateLimitRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {
    // Start cleanup process
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Every minute
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
    withdrawalType: 'LIGHTNING' | 'LNURL' | 'EXTERNAL' = 'LIGHTNING',
  ): Promise<RateLimitResult> {
    try {
      // Get or initialize user limits
      const userLimits = await this.getUserLimits(userId);

      // Check if user is blocked
      if (userLimits.blockedUntil && userLimits.blockedUntil > new Date()) {
        const minutesLeft = Math.ceil(
          (userLimits.blockedUntil.getTime() - Date.now()) / 60000,
        );
        return {
          allowed: false,
          remaining: 0,
          resetAt: userLimits.blockedUntil,
          reason: `Account temporarily blocked. Try again in ${minutesLeft} minutes.`,
          shouldBlock: true,
        };
      }

      // Check burst limits first (most restrictive)
      const burstCheck = this.checkBurstLimit(userId);
      if (!burstCheck.allowed) {
        this.logger.warn(
          `Burst limit exceeded for user ${userId}: ${burstCheck.reason}`,
        );
        await this.incrementSuspiciousActivity(userId);
        return burstCheck;
      }

      // Check type-specific per-minute limits
      const typeConfig = this.LIMITS[withdrawalType];
      const typeCheck = this.checkWindowLimit(
        userId,
        `${withdrawalType}_minute`,
        typeConfig.maxRequests,
        typeConfig.windowSeconds,
      );
      if (!typeCheck.allowed) {
        this.logger.warn(
          `${withdrawalType} limit exceeded for user ${userId}: ${typeCheck.reason}`,
        );
        return typeCheck;
      }

      // Check high-value limits if applicable
      if (amountSats > this.LIMITS.HIGH_VALUE.thresholdSats) {
        const highValueCheck = this.checkWindowLimit(
          userId,
          'high_value',
          this.LIMITS.HIGH_VALUE.maxRequests,
          this.LIMITS.HIGH_VALUE.windowSeconds,
        );
        if (!highValueCheck.allowed) {
          this.logger.warn(
            `High-value limit exceeded for user ${userId}: ${highValueCheck.reason}`,
          );
          return highValueCheck;
        }
      }

      // Check hourly limits
      const hourlyCheck = await this.checkHourlyLimit(userId, amountSats);
      if (!hourlyCheck.allowed) {
        this.logger.warn(
          `Hourly limit exceeded for user ${userId}: ${hourlyCheck.reason}`,
        );
        return hourlyCheck;
      }

      // Check daily limits
      const dailyCheck = await this.checkDailyLimit(userId, amountSats);
      if (!dailyCheck.allowed) {
        this.logger.warn(
          `Daily limit exceeded for user ${userId}: ${dailyCheck.reason}`,
        );
        return dailyCheck;
      }

      // All checks passed
      return {
        allowed: true,
        remaining: Math.min(
          burstCheck.remaining,
          typeCheck.remaining,
          hourlyCheck.remaining,
          dailyCheck.remaining,
        ),
        resetAt: new Date(
          Math.min(
            burstCheck.resetAt.getTime(),
            typeCheck.resetAt.getTime(),
            hourlyCheck.resetAt.getTime(),
            dailyCheck.resetAt.getTime(),
          ),
        ),
      };
    } catch (error) {
      this.logger.error(`Error checking rate limit for user ${userId}:`, error);
      // On error, be conservative and allow the request but log it
      this.eventEmitter.emit('rate-limit.error', {
        userId,
        error: error.message,
        timestamp: new Date(),
      });
      return {
        allowed: true,
        remaining: 1,
        resetAt: new Date(Date.now() + 60000),
        reason: 'Rate limit check failed, allowing request',
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
      // Update in-memory counters
      this.incrementWindowCount(userId, 'burst');
      this.incrementWindowCount(userId, `${withdrawalType}_minute`);

      if (amountSats > this.LIMITS.HIGH_VALUE.thresholdSats) {
        this.incrementWindowCount(userId, 'high_value');
      }

      // Update user limits
      const userLimits = await this.getUserLimits(userId);

      // Update hourly
      const now = new Date();
      if (userLimits.hourly.resetAt <= now) {
        userLimits.hourly = {
          count: 1,
          totalSats: amountSats,
          resetAt: new Date(
            now.getTime() + this.LIMITS.HOURLY.windowSeconds * 1000,
          ),
        };
      } else {
        userLimits.hourly.count++;
        userLimits.hourly.totalSats += amountSats;
      }

      // Update daily
      if (userLimits.daily.resetAt <= now) {
        userLimits.daily = {
          count: 1,
          totalSats: amountSats,
          resetAt: new Date(
            now.getTime() + this.LIMITS.DAILY.windowSeconds * 1000,
          ),
        };
      } else {
        userLimits.daily.count++;
        userLimits.daily.totalSats += amountSats;
      }

      // Save to cache
      this.userLimits.set(userId, userLimits);

      // Persist to MongoDB
      await this.persistUserLimits(userLimits);

      // Emit event for monitoring
      this.eventEmitter.emit('withdrawal.recorded', {
        userId,
        amountSats,
        withdrawalType,
        timestamp: now,
        limits: {
          hourly: userLimits.hourly,
          daily: userLimits.daily,
        },
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
    const userLimits = await this.getUserLimits(userId);
    userLimits.blockedUntil = new Date(Date.now() + durationMinutes * 60000);
    userLimits.suspiciousActivity++;

    this.userLimits.set(userId, userLimits);
    await this.persistUserLimits(userLimits);

    this.logger.warn(
      `User ${userId} blocked for ${durationMinutes} minutes: ${reason}`,
    );

    this.eventEmitter.emit('user.blocked', {
      userId,
      blockedUntil: userLimits.blockedUntil,
      reason,
      suspiciousActivity: userLimits.suspiciousActivity,
    });
  }

  /**
   * Reset rate limits for a user (e.g., after successful payment).
   *
   * @param userId User ID
   * @param resetType Type of reset (burst, hourly, daily, all)
   */
  async resetLimits(
    userId: string,
    resetType: 'burst' | 'hourly' | 'daily' | 'all' = 'burst',
  ): Promise<void> {
    if (resetType === 'all') {
      this.userLimits.delete(userId);
      const userCounts = this.requestCounts.get(userId);
      if (userCounts) {
        userCounts.clear();
      }
      await this.rateLimitRepository.deleteUserLimits(userId);
    } else if (resetType === 'burst') {
      const userCounts = this.requestCounts.get(userId);
      if (userCounts) {
        userCounts.delete('burst');
      }
    } else {
      const userLimits = await this.getUserLimits(userId);
      const now = new Date();

      if (resetType === 'hourly') {
        userLimits.hourly = {
          count: 0,
          totalSats: 0,
          resetAt: new Date(
            now.getTime() + this.LIMITS.HOURLY.windowSeconds * 1000,
          ),
        };
      } else if (resetType === 'daily') {
        userLimits.daily = {
          count: 0,
          totalSats: 0,
          resetAt: new Date(
            now.getTime() + this.LIMITS.DAILY.windowSeconds * 1000,
          ),
        };
      }

      this.userLimits.set(userId, userLimits);
      await this.persistUserLimits(userLimits);
    }
  }

  /**
   * Get current rate limit status for a user.
   *
   * @param userId User ID
   * @returns Current rate limit status
   */
  async getRateLimitStatus(userId: string): Promise<{
    limits: UserRateLimits;
    windows: Map<string, { count: number; resetAt: Date }>;
  }> {
    const limits = await this.getUserLimits(userId);
    const windows = this.requestCounts.get(userId) || new Map();

    return { limits, windows };
  }

  // Private helper methods

  private checkBurstLimit(userId: string): RateLimitResult {
    return this.checkWindowLimit(
      userId,
      'burst',
      this.LIMITS.BURST.maxRequests,
      this.LIMITS.BURST.windowSeconds,
    );
  }

  private checkWindowLimit(
    userId: string,
    windowKey: string,
    maxRequests: number,
    windowSeconds: number,
  ): RateLimitResult {
    const now = new Date();
    const resetAt = new Date(now.getTime() + windowSeconds * 1000);

    let userCounts = this.requestCounts.get(userId);
    if (!userCounts) {
      userCounts = new Map();
      this.requestCounts.set(userId, userCounts);
    }

    let windowData = userCounts.get(windowKey);
    if (!windowData || windowData.resetAt <= now) {
      windowData = { count: 0, resetAt };
      userCounts.set(windowKey, windowData);
    }

    const remaining = Math.max(0, maxRequests - windowData.count);

    if (windowData.count >= maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: windowData.resetAt,
        reason: `Too many requests. Limit: ${maxRequests} per ${windowSeconds} seconds.`,
      };
    }

    return {
      allowed: true,
      remaining,
      resetAt: windowData.resetAt,
    };
  }

  private incrementWindowCount(userId: string, windowKey: string): void {
    let userCounts = this.requestCounts.get(userId);
    if (!userCounts) {
      userCounts = new Map();
      this.requestCounts.set(userId, userCounts);
    }

    const windowData = userCounts.get(windowKey);
    if (windowData) {
      windowData.count++;
    }
  }

  private async checkHourlyLimit(
    userId: string,
    amountSats: number,
  ): Promise<RateLimitResult> {
    const userLimits = await this.getUserLimits(userId);
    const now = new Date();

    if (userLimits.hourly.resetAt <= now) {
      // Reset hourly limits
      userLimits.hourly = {
        count: 0,
        totalSats: 0,
        resetAt: new Date(
          now.getTime() + this.LIMITS.HOURLY.windowSeconds * 1000,
        ),
      };
    }

    const wouldExceedCount =
      userLimits.hourly.count >= this.LIMITS.HOURLY.maxRequests;
    const wouldExceedAmount =
      userLimits.hourly.totalSats + amountSats >
      this.LIMITS.HOURLY.maxTotalSats;

    if (wouldExceedCount) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: userLimits.hourly.resetAt,
        reason: `Hourly request limit exceeded (${this.LIMITS.HOURLY.maxRequests} requests).`,
      };
    }

    if (wouldExceedAmount) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: userLimits.hourly.resetAt,
        reason: `Hourly amount limit exceeded (${this.LIMITS.HOURLY.maxTotalSats} sats).`,
      };
    }

    return {
      allowed: true,
      remaining: this.LIMITS.HOURLY.maxRequests - userLimits.hourly.count,
      resetAt: userLimits.hourly.resetAt,
    };
  }

  private async checkDailyLimit(
    userId: string,
    amountSats: number,
  ): Promise<RateLimitResult> {
    const userLimits = await this.getUserLimits(userId);
    const now = new Date();

    if (userLimits.daily.resetAt <= now) {
      // Reset daily limits
      userLimits.daily = {
        count: 0,
        totalSats: 0,
        resetAt: new Date(
          now.getTime() + this.LIMITS.DAILY.windowSeconds * 1000,
        ),
      };
    }

    const wouldExceedCount =
      userLimits.daily.count >= this.LIMITS.DAILY.maxRequests;
    const wouldExceedAmount =
      userLimits.daily.totalSats + amountSats > this.LIMITS.DAILY.maxTotalSats;

    if (wouldExceedCount) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: userLimits.daily.resetAt,
        reason: `Daily request limit exceeded (${this.LIMITS.DAILY.maxRequests} requests).`,
      };
    }

    if (wouldExceedAmount) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: userLimits.daily.resetAt,
        reason: `Daily amount limit exceeded (${this.LIMITS.DAILY.maxTotalSats} sats).`,
      };
    }

    return {
      allowed: true,
      remaining: this.LIMITS.DAILY.maxRequests - userLimits.daily.count,
      resetAt: userLimits.daily.resetAt,
    };
  }

  private async getUserLimits(userId: string): Promise<UserRateLimits> {
    // Check cache first
    let userLimits = this.userLimits.get(userId);

    if (!userLimits) {
      // Try to load from database
      const dbLimits = await this.rateLimitRepository.getUserLimits(userId);

      if (dbLimits) {
        userLimits = {
          userId: dbLimits.userId,
          daily: dbLimits.daily,
          hourly: dbLimits.hourly,
          burst: dbLimits.burst,
          blockedUntil: dbLimits.blockedUntil,
          suspiciousActivity: dbLimits.suspiciousActivity,
        };
      } else {
        // Initialize new limits
        const now = new Date();
        userLimits = {
          userId,
          daily: {
            count: 0,
            totalSats: 0,
            resetAt: new Date(
              now.getTime() + this.LIMITS.DAILY.windowSeconds * 1000,
            ),
          },
          hourly: {
            count: 0,
            totalSats: 0,
            resetAt: new Date(
              now.getTime() + this.LIMITS.HOURLY.windowSeconds * 1000,
            ),
          },
          burst: {
            count: 0,
            resetAt: new Date(
              now.getTime() + this.LIMITS.BURST.windowSeconds * 1000,
            ),
          },
          suspiciousActivity: 0,
        };
      }

      this.userLimits.set(userId, userLimits);
    }

    return userLimits;
  }

  private async persistUserLimits(userLimits: UserRateLimits): Promise<void> {
    try {
      await this.rateLimitRepository.saveUserLimits(userLimits);
    } catch (error) {
      this.logger.error(
        `Error persisting user limits for ${userLimits.userId}:`,
        error,
      );
    }
  }

  private async incrementSuspiciousActivity(userId: string): Promise<void> {
    const userLimits = await this.getUserLimits(userId);
    userLimits.suspiciousActivity++;

    // Auto-block after too many suspicious attempts
    if (userLimits.suspiciousActivity >= 10) {
      await this.blockUser(
        userId,
        60, // 1 hour block
        'Too many suspicious withdrawal attempts',
      );
    } else if (userLimits.suspiciousActivity >= 5) {
      await this.blockUser(
        userId,
        15, // 15 minute block
        'Multiple suspicious withdrawal attempts',
      );
    }

    this.userLimits.set(userId, userLimits);
    await this.persistUserLimits(userLimits);
  }

  private cleanup(): void {
    const now = new Date();
    let cleaned = 0;

    // Clean up expired window counters
    for (const [userId, userCounts] of this.requestCounts.entries()) {
      for (const [windowKey, windowData] of userCounts.entries()) {
        if (windowData.resetAt <= now) {
          userCounts.delete(windowKey);
          cleaned++;
        }
      }

      if (userCounts.size === 0) {
        this.requestCounts.delete(userId);
      }
    }

    // Clean up expired user limits from cache (keep in DB for audit)
    for (const [userId, userLimits] of this.userLimits.entries()) {
      const allExpired =
        userLimits.daily.resetAt <= now &&
        userLimits.hourly.resetAt <= now &&
        userLimits.burst.resetAt <= now &&
        (!userLimits.blockedUntil || userLimits.blockedUntil <= now);

      if (allExpired && userLimits.suspiciousActivity === 0) {
        this.userLimits.delete(userId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} expired rate limit entries`);
    }
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}
