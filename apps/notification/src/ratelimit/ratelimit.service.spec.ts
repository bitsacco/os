import { Test } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { RateLimitService } from './ratelimit.service';
import { NotificationChannel, NotificationImportance } from '@bitsacco/common';

describe('RateLimitService', () => {
  let service: RateLimitService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [RateLimitService],
    }).compile();

    service = module.get<RateLimitService>(RateLimitService);
  });

  describe('checkRateLimit', () => {
    it('should allow requests within the limit', () => {
      const userId = 'user123';
      const result = service.checkRateLimit(
        userId,
        NotificationChannel.IN_APP,
        NotificationImportance.MEDIUM,
      );

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThan(0);
      expect(result.retryAfterMs).toBe(0);
    });

    it('should track different channels separately', () => {
      const userId = 'user123';

      // Check first channel
      const result1 = service.checkRateLimit(
        userId,
        NotificationChannel.IN_APP,
        NotificationImportance.MEDIUM,
      );

      // Check second channel
      const result2 = service.checkRateLimit(
        userId,
        NotificationChannel.SMS,
        NotificationImportance.MEDIUM,
      );

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
      // SMS should have fewer remaining than IN_APP based on our config
      expect(result2.remaining).toBeLessThan(result1.remaining);
    });

    it('should use importance level when determining limits', () => {
      const userId = 'user123';

      // Check with LOW importance
      const result1 = service.checkRateLimit(
        userId,
        NotificationChannel.IN_APP,
        NotificationImportance.LOW,
      );

      // Check with HIGH importance
      const result2 = service.checkRateLimit(
        userId,
        NotificationChannel.IN_APP,
        NotificationImportance.HIGH,
      );

      // HIGH importance should have higher limits than LOW
      expect(result2.remaining).toBeGreaterThan(result1.remaining);
    });

    it('should eventually rate limit after exceeding limits', () => {
      const userId = 'user123';
      const channel = NotificationChannel.SMS;
      const importance = NotificationImportance.LOW;

      // Set a small limit for testing
      service.updateChannelConfig(channel, {
        limit: 3,
        windowMs: 3600000,
      });

      // Initially should be allowed
      const initialResult = service.checkRateLimit(userId, channel, importance);
      expect(initialResult.allowed).toBe(true);

      // Keep making requests until we hit the limit
      let lastResult;
      let requestCount = 1; // We already made one request

      // Make at most 10 requests to avoid infinite loop in case of bug
      while (requestCount < 10) {
        lastResult = service.checkRateLimit(userId, channel, importance);
        requestCount++;

        // If we've been rate limited, break out
        if (!lastResult.allowed) {
          break;
        }
      }

      // Eventually we should be rate limited
      expect(lastResult.allowed).toBe(false);
      expect(lastResult.remaining).toBe(0);
      expect(lastResult.retryAfterMs).toBeGreaterThan(0);
    });
  });

  describe('updateChannelConfig', () => {
    it('should update rate limit config for a channel', () => {
      const channel = NotificationChannel.SMS;

      // Get initial results
      const initialResult = service.checkRateLimit(
        'user123',
        channel,
        NotificationImportance.MEDIUM,
      );

      // Update the config
      service.updateChannelConfig(channel, {
        limit: 100,
        burstLimit: 20,
      });

      // Get new results
      const newResult = service.checkRateLimit(
        'user123',
        channel,
        NotificationImportance.MEDIUM,
      );

      // New limit should be higher
      expect(newResult.remaining).toBeGreaterThan(initialResult.remaining);
    });
  });

  describe('updateImportanceConfig', () => {
    it('should update rate limit config for an importance level', () => {
      const importance = NotificationImportance.LOW;

      // Get initial results
      const initialResult = service.checkRateLimit(
        'user123',
        NotificationChannel.IN_APP,
        importance,
      );

      // Update the config
      service.updateImportanceConfig(importance, {
        limit: 100,
        burstLimit: 20,
      });

      // Get new results
      const newResult = service.checkRateLimit(
        'user123',
        NotificationChannel.IN_APP,
        importance,
      );

      // New limit should be higher
      expect(newResult.remaining).toBeGreaterThan(initialResult.remaining);
    });
  });

  describe('resetUserLimits', () => {
    it('should reset rate limits for a user', () => {
      const userId = 'user123';
      const channel = NotificationChannel.SMS;
      const importance = NotificationImportance.LOW;

      // Override the rate limit config for testing
      service.updateChannelConfig(channel, {
        limit: 3,
        burstLimit: 0,
        windowMs: 3600000,
      });

      // Make some requests
      for (let i = 0; i < 2; i++) {
        service.checkRateLimit(userId, channel, importance);
      }

      // Check remaining before reset
      const beforeReset = service.checkRateLimit(userId, channel, importance);
      expect(beforeReset.remaining).toBe(0);

      // Reset limits
      service.resetUserLimits(userId);

      // Check remaining after reset
      const afterReset = service.checkRateLimit(userId, channel, importance);
      expect(afterReset.remaining).toBe(2); // 3 - 1 (for this check)
    });
  });

  describe('special cases', () => {
    it('should prioritize critical importance limits', () => {
      const userId = 'user123';
      const channel = NotificationChannel.SMS; // Has a stricter limit

      // Override the channel config to be very restrictive
      service.updateChannelConfig(channel, {
        limit: 2,
        burstLimit: 0,
      });

      // But critical importance should override this
      const result = service.checkRateLimit(
        userId,
        channel,
        NotificationImportance.CRITICAL,
      );

      // Should have higher limits than the channel config
      expect(result.remaining).toBeGreaterThan(2);
    });
  });

  describe('resource cleanup', () => {
    it('should clear interval on module destroy', () => {
      // Spy on clearInterval and logger
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      const loggerSpy = jest.spyOn(Logger.prototype, 'log');

      // Trigger onModuleDestroy
      service.onModuleDestroy();

      // Check if clearInterval was called
      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledWith(
        'Rate limit cleanup interval cleared',
      );

      // Restore original implementations
      clearIntervalSpy.mockRestore();
      loggerSpy.mockRestore();
    });
  });
});
