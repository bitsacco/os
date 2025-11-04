import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ChamaAtomicWithdrawalService } from './atomic-withdrawal.service';
import { ChamaWalletRepository } from '../db';
import { DistributedLockService } from '../../common/services';
import { ChamaTxStatus, TransactionType } from '../../common';

describe('ChamaAtomicWithdrawalService', () => {
  let service: ChamaAtomicWithdrawalService;
  let walletRepository: jest.Mocked<ChamaWalletRepository>;
  let lockService: jest.Mocked<DistributedLockService>;

  beforeEach(async () => {
    const mockWalletRepository = {
      create: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      find: jest.fn(),
      model: {
        aggregate: jest.fn(),
      },
    };

    const mockLockService = {
      acquireLock: jest.fn(),
      releaseLock: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChamaAtomicWithdrawalService,
        {
          provide: ChamaWalletRepository,
          useValue: mockWalletRepository,
        },
        {
          provide: DistributedLockService,
          useValue: mockLockService,
        },
      ],
    }).compile();

    service = module.get<ChamaAtomicWithdrawalService>(
      ChamaAtomicWithdrawalService,
    );
    walletRepository = module.get(
      ChamaWalletRepository,
    ) as jest.Mocked<ChamaWalletRepository>;
    lockService = module.get(
      DistributedLockService,
    ) as jest.Mocked<DistributedLockService>;
  });

  describe('createWithdrawalAtomic', () => {
    const defaultParams = {
      memberId: 'member123',
      chamaId: 'chama456',
      amountMsats: 10000,
      amountFiat: 100,
      reference: 'Test withdrawal',
      lightning: '{}',
      currentGroupBalance: 50000,
    };

    it('should create withdrawal successfully when balance is sufficient', async () => {
      const lockToken = 'lock-token-123';
      const mockWithdrawal = {
        _id: 'withdrawal123',
        ...defaultParams,
        status: ChamaTxStatus.PENDING,
      };

      lockService.acquireLock.mockResolvedValue(lockToken);
      walletRepository.create.mockResolvedValue(mockWithdrawal as any);

      const result = await service.createWithdrawalAtomic(defaultParams);

      expect(lockService.acquireLock).toHaveBeenCalledWith(
        'chama-withdrawal:chama456',
        10000,
      );
      expect(walletRepository.create).toHaveBeenCalled();
      expect(lockService.releaseLock).toHaveBeenCalledWith(
        'chama-withdrawal:chama456',
        lockToken,
      );
      expect(result).toEqual(mockWithdrawal);
    });

    it('should throw error when lock cannot be acquired', async () => {
      lockService.acquireLock.mockResolvedValue(null);

      await expect(
        service.createWithdrawalAtomic(defaultParams),
      ).rejects.toThrow(
        'Another withdrawal is already in progress for this chama',
      );

      expect(walletRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error when balance is insufficient', async () => {
      const lockToken = 'lock-token-123';
      lockService.acquireLock.mockResolvedValue(lockToken);

      const paramsWithInsufficientBalance = {
        ...defaultParams,
        currentGroupBalance: 5000, // Less than requested 10000
      };

      await expect(
        service.createWithdrawalAtomic(paramsWithInsufficientBalance),
      ).rejects.toThrow('Insufficient chama group balance for withdrawal');

      expect(lockService.releaseLock).toHaveBeenCalledWith(
        'chama-withdrawal:chama456',
        lockToken,
      );
      expect(walletRepository.create).not.toHaveBeenCalled();
    });

    it('should return existing withdrawal for duplicate idempotency key', async () => {
      const lockToken = 'lock-token-123';
      const existingWithdrawal = {
        _id: 'existing123',
        ...defaultParams,
        status: ChamaTxStatus.PENDING,
      };

      lockService.acquireLock.mockResolvedValue(lockToken);
      walletRepository.findOne.mockResolvedValue(existingWithdrawal as any);

      const paramsWithIdempotencyKey = {
        ...defaultParams,
        idempotencyKey: 'unique-key-123',
      };

      const result = await service.createWithdrawalAtomic(
        paramsWithIdempotencyKey,
      );

      expect(result).toEqual(existingWithdrawal);
      expect(walletRepository.create).not.toHaveBeenCalled();
      expect(lockService.releaseLock).toHaveBeenCalledWith(
        'chama-withdrawal:chama456',
        lockToken,
      );
    });

    it('should release lock even when error occurs', async () => {
      const lockToken = 'lock-token-123';
      lockService.acquireLock.mockResolvedValue(lockToken);
      walletRepository.create.mockRejectedValue(new Error('Database error'));

      await expect(
        service.createWithdrawalAtomic(defaultParams),
      ).rejects.toThrow('Database error');

      expect(lockService.releaseLock).toHaveBeenCalledWith(
        'chama-withdrawal:chama456',
        lockToken,
      );
    });
  });

  describe('updateWithdrawalStatus', () => {
    it('should update withdrawal status for valid transition', async () => {
      const withdrawalId = 'withdrawal123';
      const currentWithdrawal = {
        _id: withdrawalId,
        status: ChamaTxStatus.PENDING,
      };
      const updatedWithdrawal = {
        ...currentWithdrawal,
        status: ChamaTxStatus.APPROVED,
      };

      walletRepository.findOne.mockResolvedValue(currentWithdrawal as any);
      walletRepository.findOneAndUpdate.mockResolvedValue(
        updatedWithdrawal as any,
      );

      const result = await service.updateWithdrawalStatus(
        withdrawalId,
        ChamaTxStatus.APPROVED,
      );

      expect(result).toEqual(updatedWithdrawal);
      expect(walletRepository.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: withdrawalId,
          status: ChamaTxStatus.PENDING,
        }),
        expect.objectContaining({ status: ChamaTxStatus.APPROVED }),
      );
    });

    it('should throw error for invalid status transition', async () => {
      const withdrawalId = 'withdrawal123';
      const currentWithdrawal = {
        _id: withdrawalId,
        status: ChamaTxStatus.COMPLETE,
      };

      walletRepository.findOne.mockResolvedValue(currentWithdrawal as any);

      await expect(
        service.updateWithdrawalStatus(withdrawalId, ChamaTxStatus.PENDING),
      ).rejects.toThrow(/Cannot transition from/);
    });

    it('should throw error when withdrawal not found', async () => {
      walletRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateWithdrawalStatus('nonexistent', ChamaTxStatus.APPROVED),
      ).rejects.toThrow('Withdrawal not found');
    });
  });

  describe('processApprovedWithdrawal', () => {
    it('should process approved withdrawal successfully', async () => {
      const withdrawalId = 'withdrawal123';
      const chamaId = 'chama456';
      const lockToken = 'process-lock-123';
      const withdrawal = {
        _id: withdrawalId,
        status: ChamaTxStatus.APPROVED,
        amountMsats: 10000,
      };
      const updatedWithdrawal = {
        ...withdrawal,
        status: ChamaTxStatus.PROCESSING,
      };

      lockService.acquireLock.mockResolvedValue(lockToken);
      walletRepository.findOne.mockResolvedValue(withdrawal as any);
      walletRepository.findOneAndUpdate.mockResolvedValue(
        updatedWithdrawal as any,
      );

      const result = await service.processApprovedWithdrawal({
        withdrawalId,
        chamaId,
        currentGroupBalance: 50000,
      });

      expect(result).toBe(true);
      expect(lockService.acquireLock).toHaveBeenCalledWith(
        'chama-withdrawal-process:chama456',
        30000,
      );
      expect(lockService.releaseLock).toHaveBeenCalledWith(
        'chama-withdrawal-process:chama456',
        lockToken,
      );
    });

    it('should return false when lock cannot be acquired', async () => {
      lockService.acquireLock.mockResolvedValue(null);

      const result = await service.processApprovedWithdrawal({
        withdrawalId: 'withdrawal123',
        chamaId: 'chama456',
        currentGroupBalance: 50000,
      });

      expect(result).toBe(false);
      expect(walletRepository.findOne).not.toHaveBeenCalled();
    });

    it('should mark as failed when balance is insufficient', async () => {
      const withdrawalId = 'withdrawal123';
      const chamaId = 'chama456';
      const lockToken = 'process-lock-123';
      const withdrawal = {
        _id: withdrawalId,
        status: ChamaTxStatus.APPROVED,
        amountMsats: 10000,
      };

      lockService.acquireLock.mockResolvedValue(lockToken);
      walletRepository.findOne.mockResolvedValue(withdrawal as any);
      walletRepository.findOneAndUpdate.mockResolvedValue({
        ...withdrawal,
        status: ChamaTxStatus.FAILED,
      } as any);

      const result = await service.processApprovedWithdrawal({
        withdrawalId,
        chamaId,
        currentGroupBalance: 5000, // Less than withdrawal amount
      });

      expect(result).toBe(false);
      expect(walletRepository.findOneAndUpdate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          status: ChamaTxStatus.FAILED,
          notes: 'Insufficient group balance at processing time',
        }),
      );
    });
  });

  describe('hasActiveWithdrawals', () => {
    it('should return true when active withdrawals exist', async () => {
      walletRepository.findOne.mockResolvedValue({
        _id: 'withdrawal123',
      } as any);

      const result = await service.hasActiveWithdrawals('chama456');

      expect(result).toBe(true);
      expect(walletRepository.findOne).toHaveBeenCalledWith({
        chamaId: 'chama456',
        type: TransactionType.WITHDRAW,
        status: {
          $in: [
            ChamaTxStatus.PENDING,
            ChamaTxStatus.APPROVED,
            ChamaTxStatus.PROCESSING,
          ],
        },
      });
    });

    it('should return false when no active withdrawals', async () => {
      walletRepository.findOne.mockResolvedValue(null);

      const result = await service.hasActiveWithdrawals('chama456');

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      walletRepository.findOne.mockRejectedValue(new Error('Database error'));

      const result = await service.hasActiveWithdrawals('chama456');

      expect(result).toBe(false);
    });
  });

  describe('getProcessingWithdrawals', () => {
    it('should return array of processing withdrawal amounts', async () => {
      const withdrawals = [
        { _id: '1', amountMsats: 10000 },
        { _id: '2', amountMsats: 20000 },
        { _id: '3', amountMsats: 15000 },
      ];

      walletRepository.find.mockResolvedValue(withdrawals as any);

      const result = await service.getProcessingWithdrawals('chama456');

      expect(result).toEqual([10000, 20000, 15000]);
      expect(walletRepository.find).toHaveBeenCalledWith({
        chamaId: 'chama456',
        type: TransactionType.WITHDRAW,
        status: ChamaTxStatus.PROCESSING,
      });
    });

    it('should return empty array when no processing withdrawals', async () => {
      walletRepository.find.mockResolvedValue([]);

      const result = await service.getProcessingWithdrawals('chama456');

      expect(result).toEqual([]);
    });

    it('should handle errors and return empty array', async () => {
      walletRepository.find.mockRejectedValue(new Error('Database error'));

      const result = await service.getProcessingWithdrawals('chama456');

      expect(result).toEqual([]);
    });
  });

  describe('rollbackWithdrawal', () => {
    it('should rollback withdrawal with reason', async () => {
      const withdrawalId = 'withdrawal123';
      const reason = 'Insufficient funds';
      const withdrawal = {
        _id: withdrawalId,
        status: ChamaTxStatus.PROCESSING,
      };
      const failedWithdrawal = {
        ...withdrawal,
        status: ChamaTxStatus.FAILED,
        notes: reason,
      };

      walletRepository.findOne.mockResolvedValue(withdrawal as any);
      walletRepository.findOneAndUpdate.mockResolvedValue(
        failedWithdrawal as any,
      );

      await service.rollbackWithdrawal(withdrawalId, reason);

      expect(walletRepository.findOneAndUpdate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          status: ChamaTxStatus.FAILED,
          notes: reason,
        }),
      );
    });
  });
});
