import { Logger } from '@nestjs/common';
import { RedisStore } from 'cache-manager-redis-store';

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
