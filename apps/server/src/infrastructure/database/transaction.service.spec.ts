import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import mongoose, { ClientSession } from 'mongoose';
import {
  TransactionService,
  TransactionOperation,
} from './transaction.service';
import { mock, describe, it, expect, beforeEach } from 'bun:test';

describe('TransactionService', () => {
  let service: TransactionService;
  let mockConnection: Partial<mongoose.Connection>;
  let mockSession: Partial<ClientSession>;

  beforeEach(async () => {
    mockSession = {
      withTransaction: mock(() => {}),
      endSession: mock(() => {}),
    };

    mockConnection = {
      startSession: mock(() => Promise.resolve(mockSession)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionService,
        {
          provide: getConnectionToken(),
          useValue: mockConnection,
        },
      ],
    }).compile();

    service = module.get<TransactionService>(TransactionService);
  });

  describe('executeInTransaction with function', () => {
    it('should execute function within transaction', async () => {
      const mockOperation = mock(() => Promise.resolve('test-result'));
      const mockWithTransaction = mock((fn) => fn());
      mockSession.withTransaction = mockWithTransaction;

      const result = await service.executeInTransaction(mockOperation);

      expect(mockConnection.startSession).toHaveBeenCalled();
      expect(mockSession.withTransaction).toHaveBeenCalled();
      expect(mockOperation).toHaveBeenCalledWith(mockSession);
      expect(mockSession.endSession).toHaveBeenCalled();
      expect(result).toBe('test-result');
    });

    it('should handle function errors properly', async () => {
      const error = new Error('Operation failed');
      const mockOperation = mock(() => Promise.reject(error));
      const mockWithTransaction = mock(async (fn) => {
        throw await fn();
      });
      mockSession.withTransaction = mockWithTransaction;

      await expect(service.executeInTransaction(mockOperation)).rejects.toThrow(
        'Operation failed',
      );
      expect(mockSession.endSession).toHaveBeenCalled();
    });
  });

  describe('executeInTransaction with operations array', () => {
    it('should execute all operations successfully', async () => {
      const mockOperations: TransactionOperation[] = [
        {
          execute: mock(() => Promise.resolve('result1')),
          getCompensation: mock(() => ({
            execute: mock(() => Promise.resolve('compensation1')),
          })),
        },
        {
          execute: mock(() => Promise.resolve('result2')),
          getCompensation: mock(() => ({
            execute: mock(() => Promise.resolve('compensation2')),
          })),
        },
      ];

      const mockWithTransaction = mock(async (fn) => {
        return await fn();
      });
      mockSession.withTransaction = mockWithTransaction;

      const result = await service.executeInTransaction(mockOperations);

      expect(mockOperations[0].execute).toHaveBeenCalledWith(mockSession);
      expect(mockOperations[1].execute).toHaveBeenCalledWith(mockSession);
      expect(result).toEqual(['result1', 'result2']);
      expect(mockSession.endSession).toHaveBeenCalled();
    });

    it('should execute compensations when operation fails', async () => {
      const compensation1 = {
        execute: mock(() => Promise.resolve('compensation1')),
      };
      const compensation2 = {
        execute: mock(() => Promise.resolve('compensation2')),
      };

      const mockOperations: TransactionOperation[] = [
        {
          execute: mock(() => Promise.resolve('result1')),
          compensate: compensation1.execute,
          getCompensation: mock(() => compensation1),
        },
        {
          execute: mock(() => Promise.reject(new Error('Operation 2 failed'))),
          compensate: compensation2.execute,
          getCompensation: mock(() => compensation2),
        },
      ];

      const mockWithTransaction = mock(async (fn) => {
        throw await fn();
      });
      mockSession.withTransaction = mockWithTransaction;

      await expect(
        service.executeInTransaction(mockOperations),
      ).rejects.toThrow('Operation 2 failed');

      expect(mockOperations[0].execute).toHaveBeenCalledWith(mockSession);
      expect(mockOperations[1].execute).toHaveBeenCalledWith(mockSession);
      expect(compensation1.execute).toHaveBeenCalledWith(mockSession);
      expect(mockSession.endSession).toHaveBeenCalled();
    });

    it('should handle compensation failures gracefully', async () => {
      const compensation1 = {
        execute: mock(() => Promise.reject(new Error('Compensation failed'))),
      };

      const mockOperations: TransactionOperation[] = [
        {
          execute: mock(() => Promise.resolve('result1')),
          compensate: compensation1.execute,
          getCompensation: mock(() => compensation1),
        },
        {
          execute: mock(() => Promise.reject(new Error('Operation failed'))),
        },
      ];

      const mockWithTransaction = mock(async (fn) => {
        throw await fn();
      });
      mockSession.withTransaction = mockWithTransaction;

      await expect(
        service.executeInTransaction(mockOperations),
      ).rejects.toThrow('Operation failed');
      expect(compensation1.execute).toHaveBeenCalledWith(mockSession);
    });
  });

  describe('executeWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const mockOperation = mock(() => Promise.resolve('success'));

      const result = await service.executeWithRetry(mockOperation, 3, 100);

      expect(mockOperation).toHaveBeenCalledTimes(1);
      expect(result).toBe('success');
    });

    it('should retry on failure and eventually succeed', async () => {
      let callCount = 0;
      const mockOperation = mock(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Attempt 1 failed'));
        } else if (callCount === 2) {
          return Promise.reject(new Error('Attempt 2 failed'));
        } else {
          return Promise.resolve('success');
        }
      });

      const result = await service.executeWithRetry(mockOperation, 3, 10);

      expect(mockOperation).toHaveBeenCalledTimes(3);
      expect(result).toBe('success');
    });

    it('should throw last error after all retries exhausted', async () => {
      const mockOperation = mock(() =>
        Promise.reject(new Error('Always fails')),
      );

      await expect(
        service.executeWithRetry(mockOperation, 2, 10),
      ).rejects.toThrow('Always fails');

      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    it('should implement exponential backoff', async () => {
      let callCount = 0;
      const mockOperation = mock(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Attempt 1 failed'));
        } else {
          return Promise.resolve('success');
        }
      });

      const startTime = Date.now();
      await service.executeWithRetry(mockOperation, 3, 50);
      const endTime = Date.now();

      // Should have waited at least 50ms (first retry delay)
      expect(endTime - startTime).toBeGreaterThan(40);
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });
  });

  describe('sleep', () => {
    it('should wait for specified duration', async () => {
      const startTime = Date.now();
      await (service as any).sleep(100);
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(90);
      expect(endTime - startTime).toBeLessThan(150);
    });
  });
});
