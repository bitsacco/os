import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';

interface RateLimitEntry {
  count: number;
  firstAttempt: number;
  lastAttempt: number;
}

/**
 * Service to implement rate limiting for authentication attempts
 * to prevent brute force attacks.
 */
@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly cache = new Map<string, RateLimitEntry>();

  // Configuration
  private readonly MAX_LOGIN_ATTEMPTS = 5; // Max failed attempts
  private readonly WINDOW_MS = 15 * 60 * 1000; // 15 minutes window
  private readonly CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour cleanup

  constructor() {
    // Schedule periodic cleanup of expired entries
    setInterval(() => this.cleanupExpiredEntries(), this.CLEANUP_INTERVAL_MS);
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

    const key = `auth:${identifier}`;
    const now = Date.now();

    // Get or create entry
    let entry = this.cache.get(key);
    if (!entry) {
      entry = { count: 0, firstAttempt: now, lastAttempt: now };
      this.cache.set(key, entry);
    }

    // Check if window has expired and reset if needed
    if (now - entry.firstAttempt > this.WINDOW_MS) {
      entry.count = 0;
      entry.firstAttempt = now;
    }

    // Update attempt count and timestamp
    entry.count += 1;
    entry.lastAttempt = now;

    // Check if rate limit exceeded
    if (entry.count > this.MAX_LOGIN_ATTEMPTS) {
      const minutesLeft = Math.ceil(
        (this.WINDOW_MS - (now - entry.firstAttempt)) / 60000,
      );
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
  resetRateLimit(identifier: string): void {
    if (!identifier) return;

    const key = `auth:${identifier}`;
    this.cache.delete(key);
  }

  /**
   * Clean up expired rate limit entries to prevent memory leaks
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let cleanupCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.lastAttempt > this.WINDOW_MS) {
        this.cache.delete(key);
        cleanupCount++;
      }
    }

    if (cleanupCount > 0) {
      this.logger.debug(
        `Cleaned up ${cleanupCount} expired rate limit entries`,
      );
    }
  }
}
