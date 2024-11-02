import type { Store } from 'cache-manager';
import type { RedisClientType } from 'redis';
import { CacheStore } from '@nestjs/cache-manager';
import { Logger } from '@nestjs/common';

export interface RedisStore extends Store {
  name: string;
  getClient: () => RedisClientType;
  isCacheableValue: any;
  set: (key: any, value: any, options: any, cb: any) => Promise<any>;
  get: (key: any, options: any, cb: any) => Promise<any>;
  del: (...args: any[]) => Promise<any>;
  mset: (...args: any[]) => Promise<any>;
  mget: (...args: any[]) => Promise<any>;
  mdel: (...args: any[]) => Promise<any>;
  reset: (cb: any) => Promise<any>;
  keys: (pattern: string, cb: any) => Promise<any>;
  ttl: (key: any, cb: any) => Promise<any>;
}

/**
 * Adapt `RedisStore` to `CacheStore` interface
 * Nest has a generic CacheStore interface to abstract cache implementations
 * This is a workaround to make it work with RedisStore
 * and cache-manager v4.1.0
 * @see https://docs.nestjs.com/techniques/caching
 * @see https://www.npmjs.com/package/cache-manager/v/4.1.0
 */
export class CustomStore implements CacheStore {
  constructor(
    private readonly cache: RedisStore,
    private readonly logger?: Logger,
  ) {}

  async get<T = any>(key: string): Promise<T> {
    return cacheGetOrThrow<T>(key, this.cache, this.logger);
  }

  async set<T = any>(key: string, value: T, ttl: number): Promise<void> {
    return cacheSetOrThrow<T>(key, value, ttl, this.cache, this.logger);
  }

  async del(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.cache.del(key, (err) => {
        if (err) {
          this.logger?.error(err);
          return reject(err);
        }
        return resolve();
      });
    });
  }
}

export async function cacheGetOrThrow<T>(
  key: string,
  cache: RedisStore,
  logger?: Logger,
): Promise<T> {
  logger?.log(`cache get ${key}`);
  const value = await new Promise((resolve, reject) => {
    cache.get(key, {}, (err, result) => {
      if (err) {
        logger?.error(err);
        return reject(err);
      }

      logger?.log(`cache get ${key} result ${result}`);
      return resolve(result);
    });
  });

  if (!value) {
    logger?.log(`cache miss ${key}`);
    throw new Error('cache miss');
  }
  return value as unknown as T;
}

export async function cacheSetOrThrow<T>(
  key: string,
  value: T,
  ttl: number,
  cache: RedisStore,
  logger?: Logger,
): Promise<void> {
  logger?.log(`cache set ${key}`);
  return new Promise((resolve, reject) => {
    cache.set(key, value, { ttl }, (err) => {
      if (err) {
        logger?.error(err);
        return reject(err);
      }
      return resolve();
    });
  });
}
