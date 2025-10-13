import { Injectable, Scope, Logger } from '@nestjs/common';

export interface PermissionContext {
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, any>;
}

/**
 * Request-scoped in-memory cache for permission checks
 *
 * This service is scoped to REQUEST, meaning a new instance is created
 * for each incoming request. This allows us to cache permission checks
 * within a single request without using Redis or external caching.
 *
 * The cache is automatically cleared when the request ends.
 */
@Injectable({ scope: Scope.REQUEST })
export class PermissionCacheService {
  private readonly logger = new Logger(PermissionCacheService.name);
  private readonly cache = new Map<string, boolean>();

  /**
   * Get cached permission result
   */
  get(
    userId: string,
    permission: string,
    context?: PermissionContext,
  ): boolean | null {
    const key = this.buildKey(userId, permission, context);
    const cached = this.cache.get(key);

    if (cached !== undefined) {
      this.logger.debug(`Cache HIT for ${key}`);
      return cached;
    }

    this.logger.debug(`Cache MISS for ${key}`);
    return null;
  }

  /**
   * Set permission result in cache
   */
  set(
    userId: string,
    permission: string,
    result: boolean,
    context?: PermissionContext,
  ): void {
    const key = this.buildKey(userId, permission, context);
    this.cache.set(key, result);
    this.logger.debug(`Cached ${key} = ${result}`);
  }

  /**
   * Invalidate all permissions for a user
   * Note: In request-scoped cache, this is mainly for consistency
   * as the cache is cleared at request end anyway
   */
  invalidate(userId: string): void {
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (key.startsWith(`perm:${userId}:`)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.cache.delete(key));
    this.logger.debug(
      `Invalidated ${keysToDelete.length} permissions for user ${userId}`,
    );
  }

  /**
   * Invalidate a specific permission for a user
   */
  invalidatePermission(userId: string, permission: string): void {
    const pattern = `perm:${userId}:${permission}`;
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (key.startsWith(pattern)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.cache.delete(key));
    this.logger.debug(
      `Invalidated permission ${permission} for user ${userId}`,
    );
  }

  /**
   * Preload permissions into cache
   */
  preload(userId: string, permissions: string[]): void {
    permissions.forEach((permission) => {
      const key = this.buildKey(userId, permission);
      this.cache.set(key, true);
    });

    this.logger.debug(
      `Preloaded ${permissions.length} permissions for user ${userId}`,
    );
  }

  /**
   * Build cache key
   */
  private buildKey(
    userId: string,
    permission: string,
    context?: PermissionContext,
  ): string {
    let key = `perm:${userId}:${permission}`;

    if (context?.resourceId) {
      key += `:${context.resourceType}:${context.resourceId}`;
    }

    return key;
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Clear the entire cache
   */
  clear(): void {
    this.cache.clear();
    this.logger.debug('Cache cleared');
  }
}
