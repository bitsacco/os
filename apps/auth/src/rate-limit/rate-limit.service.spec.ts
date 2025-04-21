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

    // Make some attempts
    for (let i = 0; i < 3; i++) {
      await service.checkRateLimit(identifier);
    }

    // Reset the rate limit
    service.resetRateLimit(identifier);

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
  });

  it('should handle missing identifiers gracefully', async () => {
    // Empty or undefined identifiers should be skipped
    await expect(async () => {
      await service.checkRateLimit('');
    }).not.toThrow();

    await expect(async () => {
      await service.checkRateLimit(undefined);
    }).not.toThrow();

    // Resetting should also not throw
    expect(() => service.resetRateLimit('')).not.toThrow();
    expect(() => service.resetRateLimit(undefined)).not.toThrow();
  });
});
