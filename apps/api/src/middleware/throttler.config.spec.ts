import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  InMemoryThrottlerStorage,
  RedisThrottlerStorage,
  ThrottlerConfigService,
} from './throttler.config';
import Redis from 'ioredis';
import { Logger } from '@nestjs/common';

// Mock Redis client
class MockRedis {
  private store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) || null;
  }

  async set(key: string, value: string): Promise<'OK'> {
    this.store.set(key, value);
    return 'OK';
  }

  async incr(key: string): Promise<number> {
    const val = parseInt(this.store.get(key) || '0', 10) + 1;
    this.store.set(key, val.toString());
    return val;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async pexpire(_key: string, _ttl: number): Promise<number> {
    return 1;
  }

  multi(): any {
    const commands: [string, any[]][] = [];
    return {
      incr: (key: string) => {
        commands.push(['incr', [key]]);
        return this;
      },
      pexpire: (key: string, ttl: number) => {
        commands.push(['pexpire', [key, ttl]]);
        return this;
      },
      exec: async () => {
        const results: [null, number | string][] = [];
        for (const [cmd, args] of commands) {
          if (cmd === 'incr') {
            results.push([null, await this.incr(args[0])]);
          } else if (cmd === 'pexpire') {
            results.push([null, await this.pexpire(args[0], args[1])]);
          }
        }
        return results;
      },
    };
  }
}

describe('ThrottlerConfig', () => {
  let configService: ConfigService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key, defaultValue) => defaultValue),
          },
        },
      ],
    }).compile();

    configService = module.get<ConfigService>(ConfigService);
  });

  describe('InMemoryThrottlerStorage', () => {
    let storage: InMemoryThrottlerStorage;

    beforeEach(() => {
      // Silence logger warnings
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
      jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});

      storage = new InMemoryThrottlerStorage();
    });

    it('should track request counts correctly', async () => {
      // First request
      const count1 = await storage.increment('test-key', 1000);
      expect(count1).toBe(1);

      // Verify count
      const storedCount = await storage.get('test-key');
      expect(storedCount).toBe(1);

      // Second request
      const count2 = await storage.increment('test-key', 1000);
      expect(count2).toBe(2);

      // Verify updated count
      const updatedCount = await storage.get('test-key');
      expect(updatedCount).toBe(2);
    });

    it('should return 0 for expired records', async () => {
      // Add a record with a very short TTL
      await storage.increment('test-expired', 1);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 5));

      // Verify count is 0 for expired record
      const count = await storage.get('test-expired');
      expect(count).toBe(0);
    });
  });

  describe('RedisThrottlerStorage', () => {
    let storage: RedisThrottlerStorage;
    let redisMock: MockRedis;

    beforeEach(() => {
      // Silence logger warnings
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

      redisMock = new MockRedis() as unknown as Redis;
      storage = new RedisThrottlerStorage(redisMock);
    });

    it('should increment and get counts correctly', async () => {
      // First request
      const count1 = await storage.increment('redis-key', 1000);
      expect(count1).toBe(1);

      // Verify count
      const storedCount = await storage.get('redis-key');
      expect(storedCount).toBe(1);

      // Second request
      const count2 = await storage.increment('redis-key', 1000);
      expect(count2).toBe(2);

      // Verify updated count
      const updatedCount = await storage.get('redis-key');
      expect(updatedCount).toBe(2);
    });

    it('should fall back to in-memory storage when Redis is not available', async () => {
      const fallbackStorage = new RedisThrottlerStorage(null);

      // Should work with in-memory fallback
      const count = await fallbackStorage.increment('fallback-key', 1000);
      expect(count).toBe(1);

      const storedCount = await fallbackStorage.get('fallback-key');
      expect(storedCount).toBe(1);
    });
  });

  describe('ThrottlerConfigService', () => {
    it('should create throttler options with Redis storage', () => {
      const redisMock = new MockRedis() as unknown as Redis;
      const service = new ThrottlerConfigService(redisMock, configService);

      const options = service.createThrottlerOptions();

      expect(options.ttl).toBe(60);
      expect(options.limit).toBe(120);
      expect(options.storage).toBeInstanceOf(RedisThrottlerStorage);
    });

    it('should create throttler options without Redis', () => {
      const service = new ThrottlerConfigService(null, configService);

      const options = service.createThrottlerOptions();

      expect(options.storage).toBeInstanceOf(RedisThrottlerStorage);
    });
  });
});
