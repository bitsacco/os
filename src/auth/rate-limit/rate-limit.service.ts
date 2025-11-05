import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import {
  CommonRateLimitService,
  RateLimitContext,
  AUTH_RATE_LIMITS,
} from '../../common/rate-limiting';

/**
 * Auth Rate Limit Service (V2)
 *
 * Simplified wrapper around CommonRateLimitService for authentication operations.
 * Provides backward compatibility while leveraging the common rate limiting system.
 *
 * Features:
 * - Multiple rate limit checks (burst, sustained)
 * - Automatic cleanup via unified service
 * - Event emission for monitoring
 * - Backward compatible API
 */
@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);

  constructor(private readonly commonRateLimit: CommonRateLimitService) {
    // Register authentication rate limit configurations
    this.commonRateLimit.registerConfigs(AUTH_RATE_LIMITS.rules);
    this.logger.log(
      'Initialized authentication rate limiting with common service',
    );
  }

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

    try {
      // Check burst limits first (most restrictive)
      const burstCheck = await this.commonRateLimit.check({
        context: RateLimitContext.AUTH,
        action: 'login:burst',
        entityId: identifier,
        entityType: 'user',
      });

      if (!burstCheck.allowed) {
        this.logger.warn(
          `Burst limit exceeded for ${identifier}: ${burstCheck.reason}`,
        );
        throw new UnauthorizedException(burstCheck.reason);
      }

      // Check sustained limits (slower attacks)
      const sustainedCheck = await this.commonRateLimit.check({
        context: RateLimitContext.AUTH,
        action: 'login:sustained',
        entityId: identifier,
        entityType: 'user',
      });

      if (!sustainedCheck.allowed) {
        this.logger.warn(
          `Sustained limit exceeded for ${identifier}: ${sustainedCheck.reason}`,
        );
        throw new UnauthorizedException(sustainedCheck.reason);
      }

      // Rate limit recording happens atomically in check() method
    } catch (error) {
      // If it's already an UnauthorizedException, rethrow it
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      // Otherwise log and allow (conservative approach on errors)
      this.logger.error(`Error checking rate limit for ${identifier}:`, error);
    }
  }

  /**
   * Reset rate limit for an identifier after successful authentication
   * @param identifier The unique identifier (phone, npub, IP)
   */
  async resetRateLimit(identifier: string): Promise<void> {
    if (!identifier) return;

    try {
      // Reset both burst and sustained limits
      await this.commonRateLimit.reset({
        context: RateLimitContext.AUTH,
        action: 'login:burst',
        entityId: identifier,
      });

      await this.commonRateLimit.reset({
        context: RateLimitContext.AUTH,
        action: 'login:sustained',
        entityId: identifier,
      });

      this.logger.debug(`Reset rate limits for ${identifier}`);
    } catch (error) {
      this.logger.error(`Error resetting rate limit for ${identifier}:`, error);
    }
  }
}
