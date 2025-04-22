import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs/redis';
import { Redis } from 'ioredis';

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

/**
 * Reusable Redis-based rate limiting service that can be used
 * across all microservices to implement distributed rate limiting
 */
@Injectable()
export class DistributedRateLimitService implements OnModuleDestroy {
  private readonly logger = new Logger(DistributedRateLimitService.name);
  private readonly defaultOptions: RateLimitOptions;
  private readonly cleanupScript: string;
  private cleanupIntervalId: NodeJS.Timeout | null = null;
  
  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {
    // Default rate limit settings
    this.defaultOptions = {
      prefix: 'ratelimit',
      limit: 60,                  // 60 requests
      windowSeconds: 60,          // per minute
      burstLimit: 10,             // Allow 10 extra requests in bursts
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
    
    // Use Redis transaction to ensure atomic operations
    const multi = this.redis.multi();
    
    // Check if the key exists
    multi.exists(key);
    
    // Get the current count and expiration
    multi.hgetall(key);
    
    // Execute the transaction
    const [exists, data] = await multi.exec();
    
    if (!exists[1]) {
      // Key doesn't exist, initialize it
      const expires = now + windowSeconds;
      
      await this.redis
        .multi()
        .hset(
          key,
          'count', '1',
          'first', now.toString(),
          'expires', expires.toString()
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
    const hashData = data[1] as Record<string, string>;
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
          'count', '1',
          'first', now.toString(),
          'expires', newExpires.toString()
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
          `Limit: ${effectiveLimit}, Window: ${windowSeconds}s`
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
        `(${count + 1}/${limit}), using burst capacity`
      );
    }
    
    return {
      allowed: true,
      remaining: effectiveLimit - count - 1,
      resetAt: expires,
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
    await this.redis.del(key);
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
        const deletedCount = await this.redis.eval(
          this.cleanupScript,
          0,
          this.defaultOptions.prefix,
          now.toString()
        );
        
        if (deletedCount > 0) {
          this.logger.debug(`Cleaned up ${deletedCount} expired rate limits`);
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
  }
}