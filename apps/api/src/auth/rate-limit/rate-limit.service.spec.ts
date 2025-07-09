import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';

describe('RateLimitService', () => {
  let service: RateLimitService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RateLimitService],
    }).compile();

    service = module.get<RateLimitService>(RateLimitService);
  });

  afterEach(() => {
    // Clear rate limits after each test
    (service as any).rateLimits.clear();
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
  });

  it('should reset rate limit after successful auth', async () => {
    const identifier = 'reset-user@example.com';

    // Hit the rate limit
    for (let i = 0; i < 5; i++) {
      await service.checkRateLimit(identifier);
    }

    // Next attempt should fail
    await expect(service.checkRateLimit(identifier)).rejects.toThrow(
      UnauthorizedException,
    );

    // Reset the rate limit
    await service.resetRateLimit(identifier);

    // Should now be able to make requests again
    await expect(async () => {
      await service.checkRateLimit(identifier);
    }).not.toThrow();
  });

  it('should handle missing identifiers gracefully', async () => {
    // Should not throw with empty identifier
    await expect(async () => {
      await service.checkRateLimit('');
    }).not.toThrow();
    await expect(async () => {
      await service.checkRateLimit(null as any);
    }).not.toThrow();
    await expect(async () => {
      await service.checkRateLimit(undefined as any);
    }).not.toThrow();
  });
});
