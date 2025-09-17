import { Injectable, Logger } from '@nestjs/common';
import {
  ThrottlerModuleOptions,
  ThrottlerOptionsFactory,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';

// Define ThrottlerStorageRecord type to match the expected interface
interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

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
  async increment(
    key: string,
    ttl: number,
    limit: number = 60,
    blockDuration: number = 0,
  ): Promise<ThrottlerStorageRecord> {
    const record = this.storage.get(key);
    const now = Date.now();
    const count = (record?.count || 0) + 1;
    const isBlocked = count > limit;
    const expiresAt = now + ttl;

    this.storage.set(key, {
      ttl: expiresAt,
      count,
    });

    return {
      totalHits: count,
      timeToExpire: Math.ceil((expiresAt - now) / 1000), // ttl in seconds
      isBlocked,
      timeToBlockExpire: isBlocked ? Math.ceil(blockDuration / 1000) : 0,
    };
  }

  /**
   * Get the current count of requests in the time window
   * Note: This method is kept for backward compatibility with tests
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
 * Options factory for ThrottlerModule configuration
 */
@Injectable()
export class ThrottlerConfigService implements ThrottlerOptionsFactory {
  private readonly logger = new Logger(ThrottlerConfigService.name);

  constructor(private readonly configService: ConfigService) {
    this.logger.log('Using in-memory throttler storage');
  }

  /**
   * Create throttler options with in-memory storage and configurable TTL/limit
   */
  createThrottlerOptions(): ThrottlerModuleOptions {
    return {
      throttlers: [
        {
          ttl: this.configService.get<number>('THROTTLE_TTL', 60),
          limit: this.configService.get<number>('THROTTLE_LIMIT', 120),
        },
      ],
      storage: new InMemoryThrottlerStorage(),
    };
  }
}
