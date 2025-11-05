import { Injectable, Logger } from '@nestjs/common';
import { RateLimitStorage } from './types';

/**
 * In-memory storage implementation for rate limiting.
 * Fast and simple, but not suitable for distributed systems.
 * Data is lost on application restart.
 */
@Injectable()
export class MemoryRateLimitStorage implements RateLimitStorage {
  private readonly logger = new Logger(MemoryRateLimitStorage.name);
  private readonly storage = new Map<
    string,
    { value: number; expiresAt: Date }
  >();
  private cleanupInterval: any;

  constructor() {
    // Cleanup expired entries every 60 seconds
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  async get(key: string): Promise<number | null> {
    const entry = this.storage.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (entry.expiresAt <= new Date()) {
      this.storage.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Atomically increment counter for a key
   * This is synchronous to ensure atomicity in JavaScript's single-threaded execution
   */
  async increment(key: string, ttl: number): Promise<number> {
    // All operations are synchronous to ensure atomicity
    const entry = this.storage.get(key);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttl * 1000);

    if (!entry || entry.expiresAt <= now) {
      // Create new entry
      this.storage.set(key, { value: 1, expiresAt });
      return 1;
    }

    // Increment existing entry (mutation is atomic in single-threaded JS)
    entry.value++;
    return entry.value;
  }

  /**
   * Atomically increment counter by a specific amount
   * This avoids the need for loops in calling code
   */
  async incrementBy(key: string, amount: number, ttl: number): Promise<number> {
    // Validate amount to prevent DoS
    if (amount < 1 || amount > 1000) {
      throw new Error(
        `Invalid increment amount: ${amount}. Must be between 1 and 1000`,
      );
    }

    // All operations are synchronous to ensure atomicity
    const entry = this.storage.get(key);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttl * 1000);

    if (!entry || entry.expiresAt <= now) {
      // Create new entry
      this.storage.set(key, { value: amount, expiresAt });
      return amount;
    }

    // Increment existing entry by amount (mutation is atomic in single-threaded JS)
    entry.value += amount;
    return entry.value;
  }

  async set(key: string, value: number, ttl: number): Promise<void> {
    const expiresAt = new Date(Date.now() + ttl * 1000);
    this.storage.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async mget(keys: string[]): Promise<(number | null)[]> {
    return Promise.all(keys.map((key) => this.get(key)));
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = new Date();
    let cleaned = 0;

    for (const [key, entry] of this.storage.entries()) {
      if (entry.expiresAt <= now) {
        this.storage.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} expired rate limit entries`);
    }
  }

  /**
   * Get current storage size (for monitoring)
   */
  getSize(): number {
    return this.storage.size;
  }

  /**
   * Clear all entries (for testing)
   */
  clear(): void {
    this.storage.clear();
  }

  /**
   * Lifecycle hook - cleanup on destroy
   */
  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}
