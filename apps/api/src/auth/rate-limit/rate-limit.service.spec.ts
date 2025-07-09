import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';
import { DistributedRateLimitService } from '@bitsacco/common';
import { ConfigService } from '@nestjs/config';

describe('RateLimitService', () => {
  let service: RateLimitService;
  let distributedRateLimitService: DistributedRateLimitService;

  // Use object to track rate limit state in tests
  const attemptCounter = {};

  beforeEach(async () => {
    // Create mock for distributed rate limit service
    const distributedRateLimitServiceMock = {
      checkRateLimit: jest
        .fn()
        .mockImplementation(async (identifier, action, options) => {
          // For testing, we'll use a simple implementation that rate limits
          // after MAX_LOGIN_ATTEMPTS (5) requests
          const MAX_LOGIN_ATTEMPTS = 5;

          if (!identifier) {
            return {
              allowed: true,
              remaining: MAX_LOGIN_ATTEMPTS,
              resetAt: 0,
              retryAfterMs: 0,
            };
          }

          // Use our counter object
          const key = `${action}:${identifier}`;
          if (!attemptCounter[key]) {
            attemptCounter[key] = 0;
          }

          attemptCounter[key]++;

          const isAllowed = attemptCounter[key] <= MAX_LOGIN_ATTEMPTS;
          const remaining = Math.max(
            0,
            MAX_LOGIN_ATTEMPTS - attemptCounter[key],
          );

          return {
            allowed: isAllowed,
            remaining,
            resetAt: isAllowed ? 0 : Date.now() + 900000, // 15 minutes
            retryAfterMs: isAllowed ? 0 : 900000,
          };
        }),
      resetRateLimit: jest
        .fn()
        .mockImplementation(async (identifier, action) => {
          if (!identifier) return;

          // Reset the counter for this identifier
          const key = `${action}:${identifier}`;
          attemptCounter[key] = 0;
        }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitService,
        {
          provide: DistributedRateLimitService,
          useValue: distributedRateLimitServiceMock,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest
              .fn()
              .mockImplementation((key, defaultValue) => defaultValue),
          },
        },
      ],
    }).compile();

    service = module.get<RateLimitService>(RateLimitService);
    distributedRateLimitService = module.get<DistributedRateLimitService>(
      DistributedRateLimitService,
    );

    // Clear attempt counter before each test
    Object.keys(attemptCounter).forEach((key) => delete attemptCounter[key]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should allow requests under the limit', async () => {
    const identifier = 'test-user@example.com';

    // Should not throw for the first MAX_LOGIN_ATTEMPTS attempts
    for (let i = 0; i < 5; i++) {
      await expect(async () => {
        await service.checkRateLimit(identifier);
      }).not.toThrow();
    }

    // Verify distributed service was called
    expect(distributedRateLimitService.checkRateLimit).toHaveBeenCalledTimes(5);
  });

  it('should block requests over the limit', async () => {
    const identifier = 'rate-limited-user@example.com';

    // Make MAX_LOGIN_ATTEMPTS attempts
    for (let i = 0; i < 5; i++) {
      await service.checkRateLimit(identifier);
    }

    // The next attempt should throw
    await expect(service.checkRateLimit(identifier)).rejects.toThrow(
      UnauthorizedException,
    );

    // Verify distributed service was called
    expect(distributedRateLimitService.checkRateLimit).toHaveBeenCalledTimes(6);
  });

  it('should reset rate limit after successful auth', async () => {
    const identifier = 'reset-user@example.com';

    // Make some attempts
    for (let i = 0; i < 3; i++) {
      await service.checkRateLimit(identifier);
    }

    // Reset the rate limit
    await service.resetRateLimit(identifier);

    // Should be able to make MAX_LOGIN_ATTEMPTS more attempts
    for (let i = 0; i < 5; i++) {
      await expect(async () => {
        await service.checkRateLimit(identifier);
      }).not.toThrow();
    }

    // The next attempt should throw
    await expect(service.checkRateLimit(identifier)).rejects.toThrow(
      UnauthorizedException,
    );

    // Verify distributed service was called
    expect(distributedRateLimitService.checkRateLimit).toHaveBeenCalledTimes(9);
    expect(distributedRateLimitService.resetRateLimit).toHaveBeenCalledTimes(1);
  });

  it('should handle missing identifiers gracefully', async () => {
    // Empty or undefined identifiers should be skipped
    await expect(async () => {
      await service.checkRateLimit('');
    }).not.toThrow();

    await expect(async () => {
      // @ts-ignore - We're testing an edge case
      await service.checkRateLimit(undefined);
    }).not.toThrow();

    // Resetting should also not throw
    await expect(async () => {
      await service.resetRateLimit('');
    }).not.toThrow();

    await expect(async () => {
      // @ts-ignore - We're testing an edge case
      await service.resetRateLimit(undefined);
    }).not.toThrow();
  });
});
