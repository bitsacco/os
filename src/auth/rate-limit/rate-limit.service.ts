import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Service to implement rate limiting for authentication attempts
 * to prevent brute force attacks, using in-memory rate limiting.
 */
@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly rateLimits = new Map<string, RateLimitEntry>();

  // Configuration
  private readonly MAX_LOGIN_ATTEMPTS = 5; // Max failed attempts
  private readonly WINDOW_SECONDS = 15 * 60; // 15 minutes window

  constructor() {
    // Clean up expired entries every 5 minutes
    setInterval(() => this.cleanupExpiredEntries(), 5 * 60 * 1000);
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

    const now = Date.now();
    const windowMs = this.WINDOW_SECONDS * 1000;

    let entry = this.rateLimits.get(identifier);

    // If no entry or window expired, create new entry
    if (!entry || now >= entry.resetAt) {
      entry = {
        count: 0,
        resetAt: now + windowMs,
      };
      this.rateLimits.set(identifier, entry);
    }

    // Check if limit exceeded
    if (entry.count >= this.MAX_LOGIN_ATTEMPTS) {
      const minutesLeft = Math.ceil((entry.resetAt - now) / 60000);

      this.logger.warn(
        `Rate limit exceeded for ${identifier}. Too many authentication attempts.`,
      );

      throw new UnauthorizedException(
        `Too many authentication attempts. Please try again in ${minutesLeft} minutes.`,
      );
    }

    // Increment attempt count
    entry.count++;
  }

  /**
   * Reset rate limit for an identifier after successful authentication
   * @param identifier The unique identifier (phone, npub, IP)
   */
  async resetRateLimit(identifier: string): Promise<void> {
    if (!identifier) return;

    this.rateLimits.delete(identifier);
  }

  /**
   * Clean up expired rate limit entries
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [identifier, entry] of this.rateLimits.entries()) {
      if (now >= entry.resetAt) {
        this.rateLimits.delete(identifier);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned ${cleaned} expired auth rate limit entries`);
    }
  }
}
