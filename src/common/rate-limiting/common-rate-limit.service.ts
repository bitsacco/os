import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  RateLimitAction,
  RateLimitConfig,
  RateLimitContext,
  RateLimitEvent,
  RateLimitResult,
  RateLimitStorage,
  RateLimitStrategy,
} from './types';
import { MemoryRateLimitStorage } from './memory.storage';

/**
 * Common Rate Limiting Service
 *
 * A comprehensive, scalable rate limiting service that can be used across all modules.
 * Supports multiple strategies (fixed window, sliding window, token bucket) with
 * in-memory storage.
 *
 * Features:
 * - Multiple rate limiting strategies
 * - In-memory storage with automatic cleanup
 * - Event emission for monitoring
 * - Preset configurations for common scenarios
 * - Cost-based rate limiting (different operations can have different costs)
 * - Flexible configuration per context/action
 *
 * Note: This uses in-memory storage, so rate limits are per-instance.
 * For distributed deployments, consider implementing Redis storage backend.
 */
@Injectable()
export class CommonRateLimitService {
  private readonly logger = new Logger(CommonRateLimitService.name);
  private readonly configs = new Map<string, RateLimitConfig>();
  private storage: RateLimitStorage;

  constructor(
    private readonly memoryStorage: MemoryRateLimitStorage,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.storage = this.memoryStorage;
    this.logger.log('Initialized common rate limiting with in-memory storage');
  }

  /**
   * Register a rate limit configuration
   */
  registerConfig(config: RateLimitConfig): void {
    this.configs.set(config.key, config);
    this.logger.debug(`Registered rate limit config: ${config.key}`);
  }

  /**
   * Register multiple configurations at once
   */
  registerConfigs(configs: RateLimitConfig[]): void {
    configs.forEach((config) => this.registerConfig(config));
  }

  /**
   * Check if an action is allowed based on rate limits
   * NOTE: This now performs atomic check-and-increment to prevent TOCTOU race conditions
   */
  async check(
    action: RateLimitAction,
    configKey?: string,
  ): Promise<RateLimitResult> {
    // Build the full key for this specific action
    const fullKey = configKey || this.buildKey(action);
    const config = this.configs.get(fullKey);

    if (!config) {
      this.logger.warn(
        `No rate limit config found for key: ${fullKey}, allowing request`,
      );
      return {
        allowed: true,
        remaining: 999,
        resetAt: new Date(Date.now() + 60000),
        limit: 999,
        metadata: {
          current: 0,
          strategy: RateLimitStrategy.FIXED_WINDOW,
          context: action.context,
        },
      };
    }

    // Determine if this is a critical context that should fail closed
    const criticalContexts = [
      RateLimitContext.AUTH,
      RateLimitContext.WITHDRAWAL,
      RateLimitContext.CHAMA,
    ];
    const isCritical = criticalContexts.includes(action.context);

    try {
      // Delegate to appropriate strategy with atomic increment
      const result = await this.enforceWithStrategy(action, config);

      // Emit event if limit exceeded
      if (!result.allowed) {
        this.emitEvent({
          type: 'limit_exceeded',
          action,
          result,
          timestamp: new Date(),
        });
      }

      return result;
    } catch (error) {
      this.logger.error(`Error checking rate limit for ${fullKey}:`, error);

      // Fail closed for critical contexts, fail open for others
      if (isCritical) {
        this.logger.warn(
          `Failing closed for critical context: ${action.context}`,
        );
        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(Date.now() + config.windowSeconds * 1000),
          limit: config.limit,
          reason: 'Rate limit check failed for security reasons',
        };
      }

      // Fail open for non-critical contexts
      return {
        allowed: true,
        remaining: 0,
        resetAt: new Date(Date.now() + config.windowSeconds * 1000),
        limit: config.limit,
        reason: 'Rate limit check failed, allowing request',
      };
    }
  }

  /**
   * Record a successful action (increment counters)
   * NOTE: This is now a no-op since check() already increments atomically.
   * Kept for backward compatibility.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async record(action: RateLimitAction, configKey?: string): Promise<void> {
    // No-op: increment already happened in check() for atomicity
    // This method is kept for backward compatibility with existing code
    // that calls check() followed by record()
  }

  /**
   * Reset rate limits for an entity
   */
  async reset(action: RateLimitAction, configKey?: string): Promise<void> {
    const fullKey = configKey || this.buildKey(action);
    const config = this.configs.get(fullKey);

    if (!config) {
      return;
    }

    try {
      const storageKey = this.buildStorageKey(action, config);
      await this.storage.delete(storageKey);
      this.logger.log(`Reset rate limit for: ${storageKey}`);
    } catch (error) {
      this.logger.error(`Error resetting rate limit for ${fullKey}:`, error);
    }
  }

  /**
   * Get current status for an action (read-only, does not increment)
   */
  async getStatus(
    action: RateLimitAction,
    configKey?: string,
  ): Promise<RateLimitResult | null> {
    const fullKey = configKey || this.buildKey(action);
    const config = this.configs.get(fullKey);

    if (!config) {
      return null;
    }

    try {
      return await this.checkWithStrategy(action, config);
    } catch (error) {
      this.logger.error(`Error getting status for ${fullKey}:`, error);
      return null;
    }
  }

  /**
   * Check with specific strategy (read-only)
   */
  private async checkWithStrategy(
    action: RateLimitAction,
    config: RateLimitConfig,
  ): Promise<RateLimitResult> {
    switch (config.strategy) {
      case RateLimitStrategy.FIXED_WINDOW:
        return this.checkFixedWindow(action, config);

      case RateLimitStrategy.SLIDING_WINDOW:
        return this.checkSlidingWindow(action, config);

      case RateLimitStrategy.TOKEN_BUCKET:
        return this.checkTokenBucket(action, config);

      default:
        throw new Error(`Unknown strategy: ${config.strategy}`);
    }
  }

  /**
   * Enforce rate limit with specific strategy (atomic check-and-increment)
   */
  private async enforceWithStrategy(
    action: RateLimitAction,
    config: RateLimitConfig,
  ): Promise<RateLimitResult> {
    switch (config.strategy) {
      case RateLimitStrategy.FIXED_WINDOW:
        return this.enforceFixedWindow(action, config);

      case RateLimitStrategy.SLIDING_WINDOW:
        return this.enforceSlidingWindow(action, config);

      case RateLimitStrategy.TOKEN_BUCKET:
        return this.enforceTokenBucket(action, config);

      default:
        throw new Error(`Unknown strategy: ${config.strategy}`);
    }
  }

  /**
   * Fixed window strategy - simple and efficient
   */
  private async checkFixedWindow(
    action: RateLimitAction,
    config: RateLimitConfig,
  ): Promise<RateLimitResult> {
    const key = this.buildStorageKey(action, config);
    const current = (await this.storage.get(key)) || 0;
    const cost = config.cost || 1;
    const resetAt = new Date(Date.now() + config.windowSeconds * 1000);

    const allowed = current + cost <= config.limit;
    const remaining = Math.max(0, config.limit - current - cost);

    return {
      allowed: allowed || !config.blockOnExceed,
      remaining,
      resetAt,
      limit: config.limit,
      reason: allowed
        ? undefined
        : config.errorMessage || 'Rate limit exceeded',
      retryAfter: allowed ? undefined : config.windowSeconds,
      metadata: {
        current,
        strategy: RateLimitStrategy.FIXED_WINDOW,
        context: action.context,
      },
    };
  }

  /**
   * Sliding window strategy - more accurate but more expensive
   * Uses approximation: (prev_window * overlap) + current_window
   */
  private async checkSlidingWindow(
    action: RateLimitAction,
    config: RateLimitConfig,
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowMs = config.windowSeconds * 1000;
    const currentWindowStart = Math.floor(now / windowMs) * windowMs;
    const prevWindowStart = currentWindowStart - windowMs;

    // Keys for current and previous windows
    const currentKey = `${this.buildStorageKey(action, config)}:${currentWindowStart}`;
    const prevKey = `${this.buildStorageKey(action, config)}:${prevWindowStart}`;

    const [currentCount, prevCount] = await this.storage.mget([
      currentKey,
      prevKey,
    ]);

    const current = currentCount || 0;
    const prev = prevCount || 0;

    // Calculate overlap with previous window
    const overlap = (windowMs - (now - currentWindowStart)) / windowMs;
    const approximateCount = Math.floor(prev * overlap + current);

    const cost = config.cost || 1;
    const allowed = approximateCount + cost <= config.limit;
    const remaining = Math.max(0, config.limit - approximateCount - cost);
    const resetAt = new Date(currentWindowStart + windowMs);

    return {
      allowed: allowed || !config.blockOnExceed,
      remaining,
      resetAt,
      limit: config.limit,
      reason: allowed
        ? undefined
        : config.errorMessage || 'Rate limit exceeded',
      retryAfter: allowed
        ? undefined
        : Math.ceil((resetAt.getTime() - now) / 1000),
      metadata: {
        current: approximateCount,
        strategy: RateLimitStrategy.SLIDING_WINDOW,
        context: action.context,
      },
    };
  }

  /**
   * Token bucket strategy - allows bursts with refill rate
   */
  private async checkTokenBucket(
    action: RateLimitAction,
    config: RateLimitConfig,
  ): Promise<RateLimitResult> {
    const key = this.buildStorageKey(action, config);
    const current = (await this.storage.get(key)) || 0;
    const cost = config.cost || 1;
    const maxTokens = config.limit + (config.burstLimit || 0);

    const allowed = current + cost <= maxTokens;
    const remaining = Math.max(0, maxTokens - current - cost);
    const resetAt = new Date(Date.now() + config.windowSeconds * 1000);

    return {
      allowed: allowed || !config.blockOnExceed,
      remaining,
      resetAt,
      limit: maxTokens,
      reason: allowed
        ? undefined
        : config.errorMessage || 'Rate limit exceeded',
      retryAfter: allowed ? undefined : config.windowSeconds,
      metadata: {
        current,
        strategy: RateLimitStrategy.TOKEN_BUCKET,
        context: action.context,
      },
    };
  }

  /**
   * Fixed window strategy - atomic check-and-increment
   */
  private async enforceFixedWindow(
    action: RateLimitAction,
    config: RateLimitConfig,
  ): Promise<RateLimitResult> {
    const key = this.buildStorageKey(action, config);
    const cost = Math.max(1, Math.min(1000, config.cost || 1)); // Clamp cost to [1, 1000]

    // Atomically increment and get new value
    const newValue = await this.storage.incrementBy(
      key,
      cost,
      config.windowSeconds,
    );
    const resetAt = new Date(Date.now() + config.windowSeconds * 1000);

    const allowed = newValue <= config.limit;
    const remaining = Math.max(0, config.limit - newValue);

    return {
      allowed: allowed || !config.blockOnExceed,
      remaining,
      resetAt,
      limit: config.limit,
      reason: allowed
        ? undefined
        : config.errorMessage || 'Rate limit exceeded',
      retryAfter: allowed ? undefined : config.windowSeconds,
      metadata: {
        current: newValue,
        strategy: RateLimitStrategy.FIXED_WINDOW,
        context: action.context,
      },
    };
  }

  /**
   * Sliding window strategy - atomic check-and-increment
   * Uses approximation: (prev_window * overlap) + current_window
   */
  private async enforceSlidingWindow(
    action: RateLimitAction,
    config: RateLimitConfig,
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowMs = config.windowSeconds * 1000;
    const currentWindowStart = Math.floor(now / windowMs) * windowMs;
    const prevWindowStart = currentWindowStart - windowMs;
    const cost = Math.max(1, Math.min(1000, config.cost || 1)); // Clamp cost to [1, 1000]

    // Keys for current and previous windows (timestamped!)
    const baseKey = this.buildStorageKey(action, config);
    const currentKey = `${baseKey}:${currentWindowStart}`;
    const prevKey = `${baseKey}:${prevWindowStart}`;

    // Get previous window count (read-only)
    const prevCount = (await this.storage.get(prevKey)) || 0;

    // Atomically increment current window
    const currentCount = await this.storage.incrementBy(
      currentKey,
      cost,
      config.windowSeconds * 2, // TTL should be 2x window to keep prev window
    );

    // Calculate overlap with previous window
    const overlap = (windowMs - (now - currentWindowStart)) / windowMs;
    const approximateCount = Math.floor(prevCount * overlap + currentCount);

    const allowed = approximateCount <= config.limit;
    const remaining = Math.max(0, config.limit - approximateCount);
    const resetAt = new Date(currentWindowStart + windowMs);

    return {
      allowed: allowed || !config.blockOnExceed,
      remaining,
      resetAt,
      limit: config.limit,
      reason: allowed
        ? undefined
        : config.errorMessage || 'Rate limit exceeded',
      retryAfter: allowed
        ? undefined
        : Math.ceil((resetAt.getTime() - now) / 1000),
      metadata: {
        current: approximateCount,
        strategy: RateLimitStrategy.SLIDING_WINDOW,
        context: action.context,
      },
    };
  }

  /**
   * Token bucket strategy - atomic check-and-increment
   */
  private async enforceTokenBucket(
    action: RateLimitAction,
    config: RateLimitConfig,
  ): Promise<RateLimitResult> {
    const key = this.buildStorageKey(action, config);
    const cost = Math.max(1, Math.min(1000, config.cost || 1)); // Clamp cost to [1, 1000]
    const maxTokens = config.limit + (config.burstLimit || 0);

    // Atomically increment and get new value
    const newValue = await this.storage.incrementBy(
      key,
      cost,
      config.windowSeconds,
    );
    const resetAt = new Date(Date.now() + config.windowSeconds * 1000);

    const allowed = newValue <= maxTokens;
    const remaining = Math.max(0, maxTokens - newValue);

    return {
      allowed: allowed || !config.blockOnExceed,
      remaining,
      resetAt,
      limit: maxTokens,
      reason: allowed
        ? undefined
        : config.errorMessage || 'Rate limit exceeded',
      retryAfter: allowed ? undefined : config.windowSeconds,
      metadata: {
        current: newValue,
        strategy: RateLimitStrategy.TOKEN_BUCKET,
        context: action.context,
      },
    };
  }

  /**
   * Build a configuration key from an action
   */
  private buildKey(action: RateLimitAction): string {
    return `${action.context}:${action.action}`;
  }

  /**
   * Build a storage key from an action and config
   */
  private buildStorageKey(
    action: RateLimitAction,
    config: RateLimitConfig,
  ): string {
    return `ratelimit:${config.key}:${action.entityId}`;
  }

  /**
   * Emit a rate limit event
   */
  private emitEvent(event: RateLimitEvent): void {
    try {
      this.eventEmitter.emit('rate-limit.event', event);
    } catch (error) {
      this.logger.error('Error emitting rate limit event:', error);
    }
  }

  /**
   * Get storage info for monitoring
   */
  getStorageInfo(): {
    using: 'memory';
    available: boolean;
    memorySize: number;
  } {
    return {
      using: 'memory',
      available: true,
      memorySize: this.memoryStorage.getSize(),
    };
  }
}
