import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { DistributedRateLimitService } from '@bitsacco/common';

/**
 * Service to implement rate limiting for authentication attempts
 * to prevent brute force attacks, using Redis for distributed rate limiting.
 */
@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);

  // Configuration
  private readonly MAX_LOGIN_ATTEMPTS = 5; // Max failed attempts
  private readonly WINDOW_SECONDS = 15 * 60; // 15 minutes window

  constructor(
    private readonly distributedRateLimitService: DistributedRateLimitService,
  ) {}

  /**
   * Check if an identifier (phone, npub, IP) has exceeded the rate limit
   * @param identifier The unique identifier to rate limit (phone, npub, IP)
   * @throws UnauthorizedException if rate limit is exceeded
   */
  async checkRateLimit(identifier: string): Promise<void> {
    if (!identifier) {
      this.logger.warn('No identifier provided for rate limiting');
      return; // Skip rate limiting if no identifier
    }

    const result = await this.distributedRateLimitService.checkRateLimit(
      identifier,
      'auth',
      {
        limit: this.MAX_LOGIN_ATTEMPTS,
        windowSeconds: this.WINDOW_SECONDS,
        burstLimit: 0, // No burst capacity for auth - strict limit
      },
    );

    if (!result.allowed) {
      const minutesLeft = Math.ceil(result.retryAfterMs / 60000);

      this.logger.warn(
        `Rate limit exceeded for ${identifier}. Too many authentication attempts.`,
      );

      throw new UnauthorizedException(
        `Too many authentication attempts. Please try again in ${minutesLeft} minutes.`,
      );
    }
  }

  /**
   * Reset rate limit for an identifier after successful authentication
   * @param identifier The unique identifier (phone, npub, IP)
   */
  async resetRateLimit(identifier: string): Promise<void> {
    if (!identifier) return;

    await this.distributedRateLimitService.resetRateLimit(identifier, 'auth');
  }
}
