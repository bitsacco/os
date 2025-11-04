import { Test, TestingModule } from '@nestjs/testing';
import { DistributedLockService } from './distributed-lock.service';

describe('DistributedLockService', () => {
  let service: DistributedLockService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DistributedLockService],
    }).compile();

    service = module.get<DistributedLockService>(DistributedLockService);
  });

  describe('acquireLock', () => {
    it('should acquire a lock successfully', async () => {
      const lockKey = 'test-lock';
      const ttl = 30000;

      const result = await service.acquireLock(lockKey, ttl);

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should fail to acquire lock when already exists', async () => {
      const lockKey = 'test-lock';
      const ttl = 30000;

      // First acquisition should succeed
      const firstResult = await service.acquireLock(lockKey, ttl);
      expect(firstResult).toBeTruthy();

      // Second acquisition should fail
      const secondResult = await service.acquireLock(lockKey, ttl);
      expect(secondResult).toBeNull();
    });

    it('should allow acquiring expired lock', async () => {
      const lockKey = 'test-lock';
      const shortTtl = 1; // 1ms

      // Acquire lock with very short TTL
      const firstResult = await service.acquireLock(lockKey, shortTtl);
      expect(firstResult).toBeTruthy();

      // Wait for lock to expire
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should be able to acquire again
      const secondResult = await service.acquireLock(lockKey, 30000);
      expect(secondResult).toBeTruthy();
    });
  });

  describe('releaseLock', () => {
    it('should release a lock successfully', async () => {
      const lockKey = 'test-lock';
      const ttl = 30000;

      const lockToken = await service.acquireLock(lockKey, ttl);
      expect(lockToken).toBeTruthy();

      const released = await service.releaseLock(lockKey, lockToken!);
      expect(released).toBe(true);
    });

    it('should fail to release lock with wrong token', async () => {
      const lockKey = 'test-lock';
      const ttl = 30000;

      const lockToken = await service.acquireLock(lockKey, ttl);
      expect(lockToken).toBeTruthy();

      const released = await service.releaseLock(lockKey, 'wrong-token');
      expect(released).toBe(false);
    });

    it('should fail to release non-existent lock', async () => {
      const released = await service.releaseLock('non-existent', 'any-token');
      expect(released).toBe(false);
    });
  });

  describe('helper methods', () => {
    it('should generate correct user withdrawal lock key', () => {
      const userId = 'user123';
      const lockKey = service.getUserWithdrawalLockKey(userId);
      expect(lockKey).toBe('withdrawal:user:user123');
    });

    it('should generate correct wallet lock key', () => {
      const userId = 'user123';
      const walletId = 'wallet456';
      const lockKey = service.getWalletLockKey(userId, walletId);
      expect(lockKey).toBe('wallet:user123:wallet456');
    });
  });

  describe('isLocked', () => {
    it('should return true for active lock', async () => {
      const lockKey = 'test-lock';
      const lockToken = await service.acquireLock(lockKey, 30000);
      expect(lockToken).toBeTruthy();

      const isLocked = await service.isLocked(lockKey);
      expect(isLocked).toBe(true);
    });

    it('should return false for non-existent lock', async () => {
      const isLocked = await service.isLocked('non-existent');
      expect(isLocked).toBe(false);
    });
  });

  describe('withLock', () => {
    it('should execute function with lock protection', async () => {
      const lockKey = 'test-lock';
      let executed = false;

      const result = await service.withLock(lockKey, async () => {
        executed = true;
        return 'success';
      });

      expect(result).toBe('success');
      expect(executed).toBe(true);
    });

    it('should return null if lock cannot be acquired', async () => {
      const lockKey = 'test-lock';

      // Acquire lock first
      const firstToken = await service.acquireLock(lockKey, 30000);
      expect(firstToken).toBeTruthy();

      // Try to execute with lock - should fail
      const result = await service.withLock(
        lockKey,
        async () => 'should not execute',
        { maxRetries: 1, retryDelay: 10 },
      );

      expect(result).toBeNull();
    });
  });

  describe('cleanup', () => {
    it('should clean up without errors', async () => {
      // Acquire some locks
      await service.acquireLock('lock1', 30000);
      await service.acquireLock('lock2', 30000);

      // Cleanup should not throw
      await service.onModuleDestroy();

      // Verify cleanup worked - should be able to acquire the same locks
      const newToken = await service.acquireLock('lock1', 30000);
      expect(newToken).toBeTruthy();
    });
  });
});
