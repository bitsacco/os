import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DistributedRateLimitService } from './rate-limit';

describe('DistributedRateLimitService', () => {
  let service: DistributedRateLimitService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DistributedRateLimitService,
        {
          provide: 'REDIS_CLIENT',
          useValue: null, // Test will use in-memory fallback
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key, defaultValue) => {
              if (key === 'RATE_LIMIT_FALLBACK_ENABLED') return true;
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<DistributedRateLimitService>(
      DistributedRateLimitService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkRateLimit', () => {
    it('should allow requests within the limit', async () => {
      const userId = 'test-user-1';
      const action = 'login';

      const options = {
        limit: 3,
        windowSeconds: 10,
        burstLimit: 0, // No burst capacity
      };

      // First request
      const result1 = await service.checkRateLimit(userId, action, options);
      expect(result1.allowed).toBe(true);

      // Second request
      const result2 = await service.checkRateLimit(userId, action, options);
      expect(result2.allowed).toBe(true);

      // Third request - still allowed because we're at the limit
      const result3 = await service.checkRateLimit(userId, action, options);
      expect(result3.allowed).toBe(true);

      // Fourth request - should be blocked (over limit)
      const result4 = await service.checkRateLimit(userId, action, options);
      expect(result4.allowed).toBe(false);
    });

    it('should respect burst capacity', async () => {
      const userId = 'test-user-3';
      const action = 'notification';
      const options = {
        limit: 2, // Base limit of 2
        windowSeconds: 10,
        burstLimit: 2, // Additional 2 in bursts
      };

      // First request (within base limit)
      const result1 = await service.checkRateLimit(userId, action, options);
      expect(result1.allowed).toBe(true);

      // Second request (within base limit)
      const result2 = await service.checkRateLimit(userId, action, options);
      expect(result2.allowed).toBe(true);

      // Third request (using burst capacity)
      const result3 = await service.checkRateLimit(userId, action, options);
      expect(result3.allowed).toBe(true);

      // Fourth request (using burst capacity)
      const result4 = await service.checkRateLimit(userId, action, options);
      expect(result4.allowed).toBe(true);

      // Fifth request (exceeded total limit)
      const result5 = await service.checkRateLimit(userId, action, options);
      expect(result5.allowed).toBe(false);
    });

    it('should handle missing identifier', async () => {
      const result = await service.checkRateLimit('', 'test-action');
      expect(result.allowed).toBe(true);
    });
  });

  describe('resetRateLimit', () => {
    it('should reset the rate limit for a user', async () => {
      const userId = 'test-user-4';
      const action = 'login';
      const options = {
        limit: 1,
        windowSeconds: 10,
        burstLimit: 0, // No burst capacity
      };

      // First request (allowed)
      const firstResult = await service.checkRateLimit(userId, action, options);
      expect(firstResult.allowed).toBe(true);

      // Second request (blocked since we're over the limit of 1)
      const beforeResetResult = await service.checkRateLimit(
        userId,
        action,
        options,
      );
      expect(beforeResetResult.allowed).toBe(false);

      // Third request (blocked)
      const blockedResult = await service.checkRateLimit(
        userId,
        action,
        options,
      );
      expect(blockedResult.allowed).toBe(false);

      // Reset limit
      await service.resetRateLimit(userId, action);

      // Try again after reset (should be allowed)
      const afterResetResult = await service.checkRateLimit(
        userId,
        action,
        options,
      );
      expect(afterResetResult.allowed).toBe(true);
    });
  });
});
