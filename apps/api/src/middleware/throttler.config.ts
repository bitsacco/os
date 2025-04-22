import { Injectable } from '@nestjs/common';
import { ThrottlerModuleOptions, ThrottlerOptionsFactory, ThrottlerStorage } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { InjectRedis } from '@nestjs/redis';

/**
 * Redis-based storage for ThrottlerModule
 * This enables distributed rate limiting across multiple API Gateway instances
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: Redis) {}

  /**
   * Increment the number of requests in the time window
   */
  async increment(key: string, ttl: number): Promise<number> {
    const multi = this.redis.multi();
    multi.incr(key);
    multi.pexpire(key, ttl);
    const results = await multi.exec();
    return results ? (results[0][1] as number) : 1;
  }

  /**
   * Get the current count of requests in the time window
   */
  async get(key: string): Promise<number> {
    const value = await this.redis.get(key);
    return value ? parseInt(value, 10) : 0;
  }
}

/**
 * Options factory for ThrottlerModule configuration
 */
@Injectable()
export class ThrottlerConfigService implements ThrottlerOptionsFactory {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {}

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