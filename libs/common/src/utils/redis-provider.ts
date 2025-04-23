import Redis from 'ioredis';
import { redisStore } from 'cache-manager-redis-store';
import { Provider, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CustomStore } from './cache';

export const getRedisConfig = (configService: ConfigService) => {
  return {
    host: configService.getOrThrow<string>('REDIS_HOST'),
    port: configService.getOrThrow<number>('REDIS_PORT'),
    password: configService.getOrThrow<string>('REDIS_PASSWORD'),
    tls: configService.get<boolean>('REDIS_TLS', false) ? {} : undefined,
  };
};

/**
 * Standard Redis client provider for all microservices
 * This ensures consistent Redis connection handling across the application
 */
export const RedisProvider: Provider = {
  provide: 'REDIS_CLIENT',
  useFactory: async (configService: ConfigService) => {
    const logger = new Logger('RedisProvider');

    try {
      const { host, port, password, tls } = getRedisConfig(configService);

      logger.log(`Connecting to Redis at ${host}:${port} (TLS: ${!!tls})`);
      logger.log(
        `Using Redis password: ${password ? 'YES (length: ' + password.length + ')' : 'NO'}`,
      );

      // Create Redis client with password in URL format (redis://:password@host:port)
      // This is the most reliable way to ensure password is properly used
      const redisUrl = `redis://:${password}@${host}:${port}`;
      logger.log(
        `Redis connection string (with password masked): redis://:*****@${host}:${port}`,
      );

      const redisClient = new Redis(redisUrl, {
        tls,
        connectTimeout: 15000,
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          const delay = Math.min(times * 1000, 10000);
          logger.log(
            `Redis reconnection attempt ${times} with delay ${delay}ms`,
          );
          return delay;
        },
      });

      // Handle connection events
      redisClient.on('connect', () => {
        logger.log('Connected to Redis');
      });

      redisClient.on('ready', () => {
        logger.log('Redis connection is ready');
      });

      redisClient.on('error', (err) => {
        logger.error(`Redis error: ${err.message}`, err.stack);
      });

      redisClient.on('close', () => {
        logger.warn('Redis connection closed');
      });

      redisClient.on('reconnecting', () => {
        logger.log('Reconnecting to Redis');
      });

      return redisClient;
    } catch (error) {
      logger.error(
        `Failed to initialize Redis client: ${error.message}`,
        error.stack,
      );
      return null;
    }
  },
  inject: [ConfigService],
};

export const configRedisCacheStore = async (
  configService: ConfigService,
  ttl: number,
) => {
  const { host, port, password, tls } = getRedisConfig(configService);

  const store = await redisStore({
    socket: {
      host,
      port,
    },
    password,
    tls,
    ttl,
  });

  return {
    store: new CustomStore(store, undefined /* TODO: inject logger */),
    ttl,
  };
};
