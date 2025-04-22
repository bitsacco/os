import { Injectable, Inject, Optional, Logger } from '@nestjs/common';
import {
  ThrottlerModuleOptions,
  ThrottlerOptionsFactory,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';

/**
 * In-memory storage for ThrottlerModule (fallback for tests)
 */
export class InMemoryThrottlerStorage implements ThrottlerStorage {
  private readonly storage = new Map<string, { ttl: number; count: number }>();
  private readonly logger = new Logger(InMemoryThrottlerStorage.name);

  constructor() {
    this.logger.warn(
      'Using in-memory throttler storage - not suitable for production',
    );

    // Clean up expired entries every 5 minutes
    setInterval(
      () => {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, record] of this.storage.entries()) {
          if (record.ttl < now) {
            this.storage.delete(key);
            cleaned++;
          }
        }

        if (cleaned > 0) {
          this.logger.debug(`Cleaned up ${cleaned} expired throttle entries`);
        }
      },
      5 * 60 * 1000,
    );
  }

  /**
   * Increment the number of requests in the time window
   */
  async increment(key: string, ttl: number): Promise<number> {
    const record = this.storage.get(key);
    const count = (record?.count || 0) + 1;

    this.storage.set(key, {
      ttl: Date.now() + ttl,
      count,
    });

    return count;
  }

  /**
   * Get the current count of requests in the time window
   */
  async get(key: string): Promise<number> {
    const record = this.storage.get(key);

    if (!record || record.ttl < Date.now()) {
      this.storage.delete(key);
      return 0;
    }

    return record.count;
  }
}

/**
 * Redis-based storage for ThrottlerModule (uses Redis when available)
 * This enables distributed rate limiting across multiple API Gateway instances
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly inMemoryFallback = new InMemoryThrottlerStorage();

  constructor(private readonly redis: Redis | null) {
    if (!redis) {
      this.logger.warn(
        'Redis client not available for throttler, falling back to in-memory storage',
      );
    }
  }

  /**
   * Increment the number of requests in the time window
   */
  async increment(key: string, ttl: number): Promise<number> {
    if (!this.redis) {
      return this.inMemoryFallback.increment(key, ttl);
    }

    try {
      const multi = this.redis.multi();
      multi.incr(key);
      multi.pexpire(key, ttl);
      const results = await multi.exec();
      return results ? (results[0][1] as number) : 1;
    } catch (error) {
      this.logger.error(
        `Redis throttler error during increment: ${error.message}`,
      );
      return this.inMemoryFallback.increment(key, ttl);
    }
  }

  /**
   * Get the current count of requests in the time window
   */
  async get(key: string): Promise<number> {
    if (!this.redis) {
      return this.inMemoryFallback.get(key);
    }

    try {
      const value = await this.redis.get(key);
      return value ? parseInt(value, 10) : 0;
    } catch (error) {
      this.logger.error(`Redis throttler error during get: ${error.message}`);
      return this.inMemoryFallback.get(key);
    }
  }
}

/**
 * Options factory for ThrottlerModule configuration
 */
@Injectable()
export class ThrottlerConfigService implements ThrottlerOptionsFactory {
  private readonly logger = new Logger(ThrottlerConfigService.name);

  constructor(
    @Optional() @Inject('REDIS_CLIENT') private readonly redis: Redis | null,
    private readonly configService: ConfigService,
  ) {
    if (!redis) {
      this.logger.warn(
        'Redis client not available for throttler, using in-memory storage',
      );
    }
  }

  /**
   * Create throttler options with Redis storage and configurable TTL/limit
   */
  createThrottlerOptions(): ThrottlerModuleOptions {
    return {
      ttl: this.configService.get<number>('THROTTLE_TTL', 60),
      limit: this.configService.get<number>('THROTTLE_LIMIT', 120),
      storage: new RedisThrottlerStorage(this.redis),
    };
  }
}
