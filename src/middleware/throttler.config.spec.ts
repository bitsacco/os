import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  InMemoryThrottlerStorage,
  ThrottlerConfigService,
} from './throttler.config';
import { Logger } from '@nestjs/common';

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
      const result1 = await storage.increment('test-key', 1000, 10);
      expect(result1.totalHits).toBe(1);
      expect(result1.isBlocked).toBe(false);

      // Verify count
      const storedCount = await storage.get('test-key');
      expect(storedCount).toBe(1);

      // Second request
      const result2 = await storage.increment('test-key', 1000, 10);
      expect(result2.totalHits).toBe(2);
      expect(result2.isBlocked).toBe(false);

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

  describe('ThrottlerConfigService', () => {
    it('should create throttler options with in-memory storage', () => {
      const service = new ThrottlerConfigService(configService);

      const options = service.createThrottlerOptions();

      expect(options.throttlers[0].ttl).toBe(60);
      expect(options.throttlers[0].limit).toBe(10000);
      expect(options.storage).toBeInstanceOf(InMemoryThrottlerStorage);
    });
  });
});
