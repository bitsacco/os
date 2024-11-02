import { Logger } from '@nestjs/common';
import { cacheGetOrThrow, cacheSetOrThrow, RedisStore } from './cache';

describe('Cache Utils', () => {
  let mockCache: jest.Mocked<RedisStore>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
    } as unknown as jest.Mocked<RedisStore>;

    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<Logger>;
  });

  describe('cacheGetOrThrow', () => {
    it('should return cached value when it exists', async () => {
      const key = 'testKey';
      const cachedValue = { data: 'testData' };
      mockCache.get.mockImplementation((_, __, callback) =>
        callback(null, cachedValue),
      );

      const result = await cacheGetOrThrow(key, mockCache, mockLogger);

      expect(result).toEqual(cachedValue);
      expect(mockCache.get).toHaveBeenCalledWith(key, {}, expect.any(Function));
      expect(mockLogger.log).toHaveBeenCalledWith(`cache get ${key}`);
      expect(mockLogger.log).toHaveBeenCalledWith(
        `cache get ${key} result ${cachedValue}`,
      );
    });

    it('should throw an error when cached value does not exist', async () => {
      const key = 'nonExistentKey';
      mockCache.get.mockImplementation((_, __, callback) =>
        callback(null, null),
      );

      await expect(cacheGetOrThrow(key, mockCache, mockLogger)).rejects.toThrow(
        'cache miss',
      );
      expect(mockLogger.log).toHaveBeenCalledWith(`cache get ${key}`);
      expect(mockLogger.log).toHaveBeenCalledWith(`cache miss ${key}`);
    });

    it('should throw an error when Redis encounters an error', async () => {
      const key = 'errorKey';
      const error = new Error('Redis error');
      mockCache.get.mockImplementation((_, __, callback) =>
        callback(error, null),
      );

      await expect(cacheGetOrThrow(key, mockCache, mockLogger)).rejects.toThrow(
        'Redis error',
      );
      expect(mockLogger.error).toHaveBeenCalledWith(error);
    });
  });

  describe('cacheSetOrThrow', () => {
    it('should set cache value successfully', async () => {
      const key = 'testKey';
      const value = { data: 'testData' };
      const ttl = 3600;
      mockCache.set.mockImplementation((_, __, ___, callback) =>
        callback(null),
      );

      await expect(
        cacheSetOrThrow(key, value, ttl, mockCache, mockLogger),
      ).resolves.toBeUndefined();
      expect(mockCache.set).toHaveBeenCalledWith(
        key,
        value,
        { ttl },
        expect.any(Function),
      );
      expect(mockLogger.log).toHaveBeenCalledWith(`cache set ${key}`);
    });

    it('should throw an error when Redis encounters an error during set', async () => {
      const key = 'errorKey';
      const value = { data: 'testData' };
      const ttl = 3600;
      const error = new Error('Redis set error');
      mockCache.set.mockImplementation((_, __, ___, callback) =>
        callback(error),
      );

      await expect(
        cacheSetOrThrow(key, value, ttl, mockCache, mockLogger),
      ).rejects.toThrow('Redis set error');
      expect(mockLogger.error).toHaveBeenCalledWith(error);
    });
  });
});
