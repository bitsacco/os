import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel, NotificationImportance } from '@bitsacco/common';

export interface RateLimitConfig {
  // Number of allowed notifications per time window
  limit: number;

  // Time window in milliseconds
  windowMs: number;

  // Maximum burst allowed (can exceed normal rate for this many messages)
  burstLimit?: number;
}

export interface RateLimitResult {
  // Whether the request should be allowed
  allowed: boolean;

  // When the next request will be allowed (ms since epoch)
  nextAllowedAt: number;

  // How many requests are remaining in the current window
  remaining: number;

  // How long to wait before the next request (ms)
  retryAfterMs: number;
}

/**
 * Rate limiting service for notifications
 */
@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);

  // Default settings for rate limiting
  private defaultConfig: RateLimitConfig = {
    limit: 20, // 20 notifications
    windowMs: 3600000, // Per hour (in ms)
    burstLimit: 5, // Allow 5 extra in a burst
  };

  // Store rate limit data by user
  private userLimits: Map<
    string,
    Map<string, { count: number; resetAt: number }>
  > = new Map();

  // Store custom configurations
  private channelConfigs: Map<NotificationChannel, RateLimitConfig> = new Map();
  private importanceConfigs: Map<NotificationImportance, RateLimitConfig> =
    new Map();

  constructor() {
    // Set default configurations for different channels
    this.channelConfigs.set(NotificationChannel.SMS, {
      limit: 10, // Stricter limit for SMS
      windowMs: 3600000, // Per hour
      burstLimit: 3, // Small burst allowed
    });

    this.channelConfigs.set(NotificationChannel.NOSTR, {
      limit: 15, // Medium limit for Nostr
      windowMs: 3600000, // Per hour
      burstLimit: 5, // Medium burst allowed
    });

    this.channelConfigs.set(NotificationChannel.IN_APP, {
      limit: 50, // Higher limit for in-app
      windowMs: 3600000, // Per hour
      burstLimit: 10, // Larger burst allowed
    });

    // Set default configurations for different importance levels
    this.importanceConfigs.set(NotificationImportance.LOW, {
      limit: 20,
      windowMs: 3600000,
    });

    this.importanceConfigs.set(NotificationImportance.MEDIUM, {
      limit: 30,
      windowMs: 3600000,
      burstLimit: 5,
    });

    this.importanceConfigs.set(NotificationImportance.HIGH, {
      limit: 40,
      windowMs: 3600000,
      burstLimit: 8,
    });

    this.importanceConfigs.set(NotificationImportance.CRITICAL, {
      limit: 50, // Higher limit for critical
      windowMs: 3600000,
      burstLimit: 10, // Larger burst allowed for critical
    });

    // Start cleanup task
    this.startCleanupTask();
  }

  /**
   * Check if a notification should be rate limited
   * @param userId User ID
   * @param channel Notification channel
   * @param importance Notification importance
   * @returns Rate limit result
   */
  checkRateLimit(
    userId: string,
    channel: NotificationChannel,
    importance: NotificationImportance,
  ): RateLimitResult {
    // Get the appropriate config based on channel and importance
    const config = this.getEffectiveConfig(channel, importance);

    // Get the current time
    const now = Date.now();

    // Get or create the user's rate limit data
    const userKey = `${userId}:${NotificationChannel[channel]}`;
    if (!this.userLimits.has(userId)) {
      this.userLimits.set(userId, new Map());
    }

    const userMap = this.userLimits.get(userId);
    if (!userMap.has(userKey)) {
      userMap.set(userKey, {
        count: 0,
        resetAt: now + config.windowMs,
      });
    }

    // Get the rate limit data
    const limitData = userMap.get(userKey);

    // Reset if window expired
    if (now >= limitData.resetAt) {
      limitData.count = 0;
      limitData.resetAt = now + config.windowMs;
    }

    // Check if limit exceeded
    const effectiveLimit = config.limit + (config.burstLimit || 0);
    if (limitData.count >= effectiveLimit) {
      const retryAfterMs = limitData.resetAt - now;

      return {
        allowed: false,
        nextAllowedAt: limitData.resetAt,
        remaining: 0,
        retryAfterMs,
      };
    }

    // Increment counter and return
    limitData.count++;

    const exceededStandardRate = limitData.count > config.limit;
    if (exceededStandardRate) {
      this.logger.warn(
        `User ${userId} exceeded standard rate limit for ${NotificationChannel[channel]} ` +
          `(${limitData.count}/${config.limit}), using burst capacity`,
      );
    }

    return {
      allowed: true,
      nextAllowedAt: now,
      remaining: effectiveLimit - limitData.count,
      retryAfterMs: 0,
    };
  }

  /**
   * Get the configuration to use for a specific channel and importance
   */
  private getEffectiveConfig(
    channel: NotificationChannel,
    importance: NotificationImportance,
  ): RateLimitConfig {
    // Get base config from channel
    const channelConfig =
      this.channelConfigs.get(channel) || this.defaultConfig;

    // Get importance config
    const importanceConfig =
      this.importanceConfigs.get(importance) || this.defaultConfig;

    // For critical importance, use the higher limits
    if (importance === NotificationImportance.CRITICAL) {
      return importanceConfig;
    }

    // For other importance levels, use the more restrictive of the two
    return {
      limit: Math.min(channelConfig.limit, importanceConfig.limit),
      windowMs: Math.max(channelConfig.windowMs, importanceConfig.windowMs),
      burstLimit: Math.min(
        channelConfig.burstLimit || 0,
        importanceConfig.burstLimit || 0,
      ),
    };
  }

  /**
   * Update rate limit configuration for a channel
   */
  updateChannelConfig(
    channel: NotificationChannel,
    config: Partial<RateLimitConfig>,
  ): void {
    const existingConfig = this.channelConfigs.get(channel) || {
      ...this.defaultConfig,
    };

    this.channelConfigs.set(channel, {
      ...existingConfig,
      ...config,
    });

    this.logger.log(
      `Updated rate limit config for channel ${NotificationChannel[channel]}: ${JSON.stringify(this.channelConfigs.get(channel))}`,
    );
  }

  /**
   * Update rate limit configuration for an importance level
   */
  updateImportanceConfig(
    importance: NotificationImportance,
    config: Partial<RateLimitConfig>,
  ): void {
    const existingConfig = this.importanceConfigs.get(importance) || {
      ...this.defaultConfig,
    };

    this.importanceConfigs.set(importance, {
      ...existingConfig,
      ...config,
    });

    this.logger.log(
      `Updated rate limit config for importance ${NotificationImportance[importance]}: ${JSON.stringify(this.importanceConfigs.get(importance))}`,
    );
  }

  /**
   * Reset rate limits for a user
   */
  resetUserLimits(userId: string): void {
    this.userLimits.delete(userId);
    this.logger.log(`Reset rate limits for user ${userId}`);
  }

  /**
   * Start the cleanup task to remove expired rate limit data
   */
  private startCleanupTask(): void {
    const cleanupInterval = 60 * 60 * 1000; // 1 hour

    setInterval(() => {
      const now = Date.now();
      let expiredEntries = 0;

      // Clean up expired entries
      for (const [userId, userMap] of this.userLimits.entries()) {
        for (const [key, data] of userMap.entries()) {
          if (now >= data.resetAt) {
            userMap.delete(key);
            expiredEntries++;
          }
        }

        // Remove user if no entries left
        if (userMap.size === 0) {
          this.userLimits.delete(userId);
        }
      }

      if (expiredEntries > 0) {
        this.logger.debug(
          `Cleaned up ${expiredEntries} expired rate limit entries`,
        );
      }
    }, cleanupInterval);
  }
}
