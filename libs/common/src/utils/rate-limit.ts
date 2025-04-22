import {
  Injectable,
  Logger,
  OnModuleDestroy,
  Inject,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';

/**
 * Options for configuring rate limits
 */
export interface RateLimitOptions {
  // The prefix for Redis keys
  prefix?: string;

  // The number of requests allowed in the time window
  limit: number;

  // The time window in seconds
  windowSeconds: number;

  // Optional burst capacity (extra requests allowed)
  burstLimit?: number;
}

/**
 * Result of a rate limit check
 */
export interface RateLimitResult {
  // Whether the request is allowed
  allowed: boolean;

  // The number of requests remaining in the current window
  remaining: number;

  // When the rate limit will reset (Unix timestamp in seconds)
  resetAt: number;

  // How many milliseconds until the rate limit resets
  retryAfterMs: number;
}

interface RateLimitEntry {
  count: number;
  firstAttempt: number;
  expiresAt: number;
}

/**
 * Reusable Redis-based rate limiting service that can be used
 * across all microservices to implement distributed rate limiting
 *
 * Falls back to in-memory storage when Redis is not available (for tests)
 */
@Injectable()
export class DistributedRateLimitService implements OnModuleDestroy {
  private readonly logger = new Logger(DistributedRateLimitService.name);
  private readonly defaultOptions: RateLimitOptions;
  private readonly cleanupScript: string;
  private cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

  // In-memory fallback for tests
  private readonly memoryStore = new Map<string, RateLimitEntry>();

  constructor(
    @Optional() @Inject('REDIS_CLIENT') private readonly redis: Redis | null,
    private readonly configService: ConfigService,
  ) {
    // Default rate limit settings
    this.defaultOptions = {
      prefix: 'ratelimit',
      limit: 60, // 60 requests
      windowSeconds: 60, // per minute
      burstLimit: 10, // Allow 10 extra requests in bursts
    };

    // Start periodic cleanup of expired rate limits
    this.startCleanupTask();

    // Lua script for atomic rate limit check and increment
    this.cleanupScript = `
      local keys = redis.call('keys', ARGV[1] .. ':*')
      local deleted = 0
      local now = tonumber(ARGV[2])
      
      for i, key in ipairs(keys) do
        local expires = tonumber(redis.call('hget', key, 'expires'))
        if expires and expires < now then
          redis.call('del', key)
          deleted = deleted + 1
        end
      end
      
      return deleted
    `;

    if (!this.redis) {
      this.logger.warn(
        'Redis client not available, using in-memory rate limiting (not suitable for production)',
      );
    }
  }

  /**
   * Check if a request should be rate limited
   *
   * @param identifier - A unique identifier for the rate limited entity (e.g., IP, user ID)
   * @param action - The action being rate limited (e.g., 'login', 'api-call')
   * @param options - Rate limit options (optional, uses defaults if not provided)
   * @returns Rate limit result with allowed status and remaining requests
   */
  async checkRateLimit(
    identifier: string,
    action: string,
    options?: Partial<RateLimitOptions>,
  ): Promise<RateLimitResult> {
    if (!identifier) {
      this.logger.warn('No identifier provided for rate limiting');
      return { allowed: true, remaining: 1, resetAt: 0, retryAfterMs: 0 };
    }

    // Merge provided options with defaults
    const opts = { ...this.defaultOptions, ...options };
    const { prefix, limit, windowSeconds, burstLimit } = opts;

    // Calculate effective limit (base limit + burst allowance)
    const effectiveLimit = limit + (burstLimit || 0);

    // Create a rate limit key that includes the action and identifier
    const key = `${prefix}:${action}:${identifier}`;
    const now = Math.floor(Date.now() / 1000);

    // Use Redis if available, otherwise fall back to in-memory
    if (this.redis) {
      return this.checkRateLimitRedis(
        key,
        now,
        effectiveLimit,
        limit,
        windowSeconds,
        burstLimit,
        action,
        identifier,
      );
    } else {
      return this.checkRateLimitMemory(
        key,
        now,
        effectiveLimit,
        limit,
        windowSeconds,
        burstLimit,
        action,
        identifier,
      );
    }
  }

  /**
   * Redis-based rate limit implementation
   */
  private async checkRateLimitRedis(
    key: string,
    now: number,
    effectiveLimit: number,
    limit: number,
    windowSeconds: number,
    burstLimit: number | undefined,
    action: string,
    identifier: string,
  ): Promise<RateLimitResult> {
    try {
      if (!this.redis) {
        throw new Error('Redis client not available');
      }

      // Use Redis transaction to ensure atomic operations
      const multi = this.redis.multi();

      // Check if the key exists
      multi.exists(key);

      // Get the current count and expiration
      multi.hgetall(key);

      // Execute the transaction
      const [exists, data] = await multi.exec();

      if (!exists || !exists[1]) {
        // Key doesn't exist, initialize it
        const expires = now + windowSeconds;

        await this.redis
          .multi()
          .hset(
            key,
            'count',
            '1',
            'first',
            now.toString(),
            'expires',
            expires.toString(),
          )
          .expire(key, windowSeconds)
          .exec();

        return {
          allowed: true,
          remaining: effectiveLimit - 1,
          resetAt: expires,
          retryAfterMs: 0,
        };
      }

      // Key exists, check and update rate limit
      const hashData =
        data && data[1] ? (data[1] as Record<string, string>) : {};
      const count = parseInt(hashData.count || '0', 10);
      const expires = parseInt(hashData.expires || '0', 10);

      // Check if we need to reset the window (it's expired but not yet cleaned up)
      if (now >= expires) {
        // Window expired, reset the counter
        const newExpires = now + windowSeconds;

        await this.redis
          .multi()
          .hset(
            key,
            'count',
            '1',
            'first',
            now.toString(),
            'expires',
            newExpires.toString(),
          )
          .expire(key, windowSeconds)
          .exec();

        return {
          allowed: true,
          remaining: effectiveLimit - 1,
          resetAt: newExpires,
          retryAfterMs: 0,
        };
      }

      // Window still active
      if (count >= effectiveLimit) {
        // Rate limit exceeded
        const retryAfterMs = (expires - now) * 1000;

        // Log excessive attempts
        if (count === effectiveLimit) {
          this.logger.warn(
            `Rate limit exceeded for ${action}:${identifier}. ` +
              `Limit: ${effectiveLimit}, Window: ${windowSeconds}s`,
          );
        }

        return {
          allowed: false,
          remaining: 0,
          resetAt: expires,
          retryAfterMs,
        };
      }

      // Increment the counter
      await this.redis.hincrby(key, 'count', 1);

      // Check if exceeded standard rate but still within burst capacity
      const exceededStandardRate = count >= limit;
      if (exceededStandardRate && burstLimit) {
        this.logger.debug(
          `User ${identifier} exceeded standard rate for ${action} ` +
            `(${count + 1}/${limit}), using burst capacity`,
        );
      }

      return {
        allowed: true,
        remaining: effectiveLimit - count - 1,
        resetAt: expires,
        retryAfterMs: 0,
      };
    } catch (error) {
      this.logger.error(`Error checking Redis rate limit: ${error.message}`);
      // Fallback to memory-based rate limiting on Redis errors
      return this.checkRateLimitMemory(
        key,
        now,
        effectiveLimit,
        limit,
        windowSeconds,
        burstLimit,
        action,
        identifier,
      );
    }
  }

  /**
   * In-memory rate limit implementation (for tests or fallback)
   */
  private checkRateLimitMemory(
    key: string,
    now: number,
    effectiveLimit: number,
    limit: number,
    windowSeconds: number,
    burstLimit: number | undefined,
    action: string,
    identifier: string,
  ): RateLimitResult {
    // Get or create entry
    let entry = this.memoryStore.get(key);
    if (!entry) {
      entry = {
        count: 0,
        firstAttempt: now,
        expiresAt: now + windowSeconds,
      };
      this.memoryStore.set(key, entry);
    }

    // Check if window has expired and reset if needed
    if (now >= entry.expiresAt) {
      entry.count = 0;
      entry.firstAttempt = now;
      entry.expiresAt = now + windowSeconds;
    }

    // Update attempt count
    entry.count += 1;

    // Check if rate limit exceeded
    if (entry.count > effectiveLimit) {
      const retryAfterMs = (entry.expiresAt - now) * 1000;

      // Log excessive attempts
      this.logger.warn(
        `[Memory] Rate limit exceeded for ${action}:${identifier}. ` +
          `Limit: ${effectiveLimit}, Window: ${windowSeconds}s`,
      );

      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.expiresAt,
        retryAfterMs,
      };
    }

    // Check if exceeded standard rate but still within burst capacity
    const exceededStandardRate = entry.count > limit;
    if (exceededStandardRate && burstLimit) {
      this.logger.debug(
        `[Memory] User ${identifier} exceeded standard rate for ${action} ` +
          `(${entry.count}/${limit}), using burst capacity`,
      );
    }

    return {
      allowed: true,
      remaining: effectiveLimit - entry.count,
      resetAt: entry.expiresAt,
      retryAfterMs: 0,
    };
  }

  /**
   * Reset rate limit for an identifier
   *
   * @param identifier - The identifier to reset
   * @param action - The action to reset
   */
  async resetRateLimit(identifier: string, action: string): Promise<void> {
    if (!identifier) return;

    const key = `${this.defaultOptions.prefix}:${action}:${identifier}`;

    if (this.redis) {
      try {
        await this.redis.del(key);
      } catch (error) {
        this.logger.error(`Error resetting Redis rate limit: ${error.message}`);
        // Fallback to memory reset
        this.memoryStore.delete(key);
      }
    } else {
      this.memoryStore.delete(key);
    }

    this.logger.debug(`Reset rate limit for ${action}:${identifier}`);
  }

  /**
   * Start the cleanup task to periodically remove expired rate limits
   */
  private startCleanupTask(): void {
    const cleanupIntervalMs = 10 * 60 * 1000; // 10 minutes

    this.cleanupIntervalId = setInterval(async () => {
      try {
        const now = Math.floor(Date.now() / 1000);

        if (this.redis) {
          try {
            const deletedCount = (await this.redis.eval(
              this.cleanupScript,
              0,
              this.defaultOptions.prefix,
              now.toString(),
            )) as number;

            if (deletedCount > 0) {
              this.logger.debug(
                `Cleaned up ${deletedCount} expired rate limits`,
              );
            }
          } catch (error) {
            this.logger.error(
              `Error during Redis rate limit cleanup: ${error.message}`,
            );
          }
        }

        // Also clean up memory store
        let memoryCleanupCount = 0;
        for (const [key, entry] of this.memoryStore.entries()) {
          if (now >= entry.expiresAt) {
            this.memoryStore.delete(key);
            memoryCleanupCount++;
          }
        }

        if (memoryCleanupCount > 0) {
          this.logger.debug(
            `Cleaned up ${memoryCleanupCount} expired in-memory rate limits`,
          );
        }
      } catch (error) {
        this.logger.error(`Error during rate limit cleanup: ${error.message}`);
      }
    }, cleanupIntervalMs);
  }

  /**
   * Clean up resources when module is destroyed
   */
  onModuleDestroy(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }

    this.memoryStore.clear();
  }
}
