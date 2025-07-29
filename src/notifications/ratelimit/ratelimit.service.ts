import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel, NotificationImportance } from '../../common';

export interface RateLimitConfig {
  // Number of allowed notifications per time window
  limit: number;

  // Time window in seconds
  windowSeconds: number;

  // Maximum burst allowed (can exceed normal rate for this many messages)
  burstLimit?: number;
}

export interface RateLimitResult {
  // Whether the request is allowed
  allowed: boolean;

  // How many requests are remaining in the current window
  remaining: number;

  // When the rate limit will reset (Unix timestamp in seconds)
  resetAt: number;

  // How long to wait before the next request (ms)
  retryAfterMs: number;
}

interface UserRateLimitData {
  count: number;
  resetAt: number;
}

/**
 * Simple in-memory rate limiting service for notifications
 */
@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);

  // In-memory storage for rate limit data
  private rateLimits = new Map<string, UserRateLimitData>();

  // Default settings for rate limiting
  private defaultConfig: RateLimitConfig = {
    limit: 20, // 20 notifications
    windowSeconds: 3600, // Per hour
    burstLimit: 5, // Allow 5 extra in a burst
  };

  // Store custom configurations
  private channelConfigs: Map<NotificationChannel, RateLimitConfig> = new Map();
  private importanceConfigs: Map<NotificationImportance, RateLimitConfig> =
    new Map();

  constructor() {
    // Set default configurations for different channels
    this.channelConfigs.set(NotificationChannel.SMS, {
      limit: 10, // Stricter limit for SMS
      windowSeconds: 3600, // Per hour
      burstLimit: 3, // Small burst allowed
    });

    this.channelConfigs.set(NotificationChannel.NOSTR, {
      limit: 15, // Medium limit for Nostr
      windowSeconds: 3600, // Per hour
      burstLimit: 5, // Medium burst allowed
    });

    this.channelConfigs.set(NotificationChannel.IN_APP, {
      limit: 50, // Higher limit for in-app
      windowSeconds: 3600, // Per hour
      burstLimit: 10, // Larger burst allowed
    });

    // Set default configurations for different importance levels
    this.importanceConfigs.set(NotificationImportance.LOW, {
      limit: 20,
      windowSeconds: 3600,
    });

    this.importanceConfigs.set(NotificationImportance.MEDIUM, {
      limit: 30,
      windowSeconds: 3600,
      burstLimit: 5,
    });

    this.importanceConfigs.set(NotificationImportance.HIGH, {
      limit: 40,
      windowSeconds: 3600,
      burstLimit: 8,
    });

    this.importanceConfigs.set(NotificationImportance.CRITICAL, {
      limit: 50, // Higher limit for critical
      windowSeconds: 3600,
      burstLimit: 10, // Larger burst allowed for critical
    });
  }

  /**
   * Check if a notification should be rate limited
   * @param userId User ID
   * @param channel Notification channel
   * @param importance Notification importance
   * @returns Rate limit result
   */
  async checkRateLimit(
    userId: string,
    channel: NotificationChannel,
    importance: NotificationImportance,
  ): Promise<RateLimitResult> {
    // Get the appropriate config based on channel and importance
    const config = this.getEffectiveConfig(channel, importance);

    // Create a unique key for this user and channel
    const key = `${userId}:${NotificationChannel[channel]}`;

    const now = Date.now();
    const windowMs = config.windowSeconds * 1000;

    // Get or create rate limit data
    let rateLimitData = this.rateLimits.get(key);

    // If no data exists or window has expired, reset
    if (!rateLimitData || now >= rateLimitData.resetAt) {
      rateLimitData = {
        count: 0,
        resetAt: now + windowMs,
      };
      this.rateLimits.set(key, rateLimitData);
    }

    // Check if limit exceeded
    const totalLimit = config.limit + (config.burstLimit || 0);
    const allowed = rateLimitData.count < totalLimit;

    if (allowed) {
      rateLimitData.count++;
    }

    const remaining = Math.max(0, totalLimit - rateLimitData.count);
    const resetAtSeconds = Math.floor(rateLimitData.resetAt / 1000);
    const retryAfterMs = allowed ? 0 : rateLimitData.resetAt - now;

    return {
      allowed,
      remaining,
      resetAt: resetAtSeconds,
      retryAfterMs,
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
      windowSeconds: Math.max(
        channelConfig.windowSeconds,
        importanceConfig.windowSeconds,
      ),
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
  async resetUserLimits(userId: string): Promise<void> {
    if (!userId) return;

    // Reset rate limits for all notification channels
    const keysToDelete: string[] = [];

    for (const [key] of this.rateLimits.entries()) {
      if (key.startsWith(`${userId}:`)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.rateLimits.delete(key));

    this.logger.log(`Reset rate limits for user ${userId}`);
  }

  /**
   * Clean up expired rate limit entries periodically
   * Call this method periodically (e.g., every hour) to prevent memory leaks
   */
  cleanupExpiredEntries(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, data] of this.rateLimits.entries()) {
      if (now >= data.resetAt) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.rateLimits.delete(key));

    if (keysToDelete.length > 0) {
      this.logger.debug(
        `Cleaned up ${keysToDelete.length} expired rate limit entries`,
      );
    }
  }
}
