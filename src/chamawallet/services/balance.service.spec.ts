import { Test, TestingModule } from '@nestjs/testing';
import { ChamaBalanceService } from './balance.service';
import { ChamaWalletRepository } from '../db';
import { ChamaTxStatus, TransactionType } from '../../common';

describe('ChamaBalanceService', () => {
  let service: ChamaBalanceService;
  let walletRepository: jest.Mocked<ChamaWalletRepository>;

  beforeEach(async () => {
    const mockWalletRepository = {
      find: jest.fn(),
      model: {
        aggregate: jest.fn(),
        countDocuments: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChamaBalanceService,
        {
          provide: ChamaWalletRepository,
          useValue: mockWalletRepository,
        },
      ],
    }).compile();

    service = module.get<ChamaBalanceService>(ChamaBalanceService);
    walletRepository = module.get(
      ChamaWalletRepository,
    ) as jest.Mocked<ChamaWalletRepository>;
  });

  describe('getGroupWalletMeta', () => {
    it('should calculate group balance correctly including processing withdrawals', async () => {
      const chamaId = 'chama123';

      // Mock aggregation results
      walletRepository.model.aggregate
        .mockResolvedValueOnce([{ _id: null, total: 100000 }]) // Deposits
        .mockResolvedValueOnce([{ _id: null, total: 30000 }]) // Withdrawals
        .mockResolvedValueOnce([{ _id: null, total: 10000 }]); // Processing withdrawals

      const result = await service.getGroupWalletMeta(chamaId);

      expect(result).toEqual({
        groupDeposits: 100000,
        groupWithdrawals: 30000,
        processingWithdrawals: 10000,
        groupBalance: 60000, // 100000 - 30000 - 10000
      });

      // Verify aggregation was called correctly
      expect(walletRepository.model.aggregate).toHaveBeenCalledTimes(3);

      // Check deposits aggregation
      expect(walletRepository.model.aggregate).toHaveBeenNthCalledWith(1, [
        {
          $match: {
            chamaId,
            type: TransactionType.DEPOSIT.toString(),
            status: { $in: [ChamaTxStatus.COMPLETE.toString()] },
          },
        },
        { $group: { _id: null, total: { $sum: '$amountMsats' } } },
      ]);

      // Check withdrawals aggregation
      expect(walletRepository.model.aggregate).toHaveBeenNthCalledWith(2, [
        {
          $match: {
            chamaId,
            type: TransactionType.WITHDRAW.toString(),
            status: { $in: [ChamaTxStatus.COMPLETE.toString()] },
          },
        },
        { $group: { _id: null, total: { $sum: '$amountMsats' } } },
      ]);

      // Check processing withdrawals aggregation
      expect(walletRepository.model.aggregate).toHaveBeenNthCalledWith(3, [
        {
          $match: {
            chamaId,
            type: TransactionType.WITHDRAW.toString(),
            status: { $in: [ChamaTxStatus.PROCESSING.toString()] },
          },
        },
        { $group: { _id: null, total: { $sum: '$amountMsats' } } },
      ]);
    });

    it('should handle empty aggregation results', async () => {
      const chamaId = 'chama123';

      walletRepository.model.aggregate.mockResolvedValue([]);

      const result = await service.getGroupWalletMeta(chamaId);

      expect(result).toEqual({
        groupDeposits: 0,
        groupWithdrawals: 0,
        processingWithdrawals: 0,
        groupBalance: 0,
      });
    });

    it('should handle errors gracefully', async () => {
      const chamaId = 'chama123';

      walletRepository.model.aggregate.mockRejectedValue(
        new Error('Database error'),
      );

      const result = await service.getGroupWalletMeta(chamaId);

      expect(result).toEqual({
        groupDeposits: 0,
        groupWithdrawals: 0,
        processingWithdrawals: 0,
        groupBalance: 0,
      });
    });
  });

  describe('getMemberWalletMeta', () => {
    it('should calculate member balance correctly including processing withdrawals', async () => {
      const chamaId = 'chama123';
      const memberId = 'member456';

      walletRepository.model.aggregate
        .mockResolvedValueOnce([{ _id: null, total: 50000 }]) // Member deposits
        .mockResolvedValueOnce([{ _id: null, total: 15000 }]) // Member withdrawals
        .mockResolvedValueOnce([{ _id: null, total: 5000 }]); // Member processing withdrawals

      const result = await service.getMemberWalletMeta(chamaId, memberId);

      expect(result).toEqual({
        memberDeposits: 50000,
        memberWithdrawals: 15000,
        processingWithdrawals: 5000,
        memberBalance: 30000, // 50000 - 15000 - 5000
      });

      // Verify member filter was applied
      expect(walletRepository.model.aggregate).toHaveBeenNthCalledWith(1, [
        {
          $match: {
            chamaId,
            memberId,
            type: TransactionType.DEPOSIT.toString(),
            status: { $in: [ChamaTxStatus.COMPLETE.toString()] },
          },
        },
        { $group: { _id: null, total: { $sum: '$amountMsats' } } },
      ]);
    });
  });

  describe('getWalletMeta', () => {
    it('should return combined group and member metadata', async () => {
      const chamaId = 'chama123';
      const memberId = 'member456';

      // Mock group aggregations
      walletRepository.model.aggregate
        .mockResolvedValueOnce([{ _id: null, total: 100000 }]) // Group deposits
        .mockResolvedValueOnce([{ _id: null, total: 30000 }]) // Group withdrawals
        .mockResolvedValueOnce([{ _id: null, total: 10000 }]) // Group processing
        // Mock member aggregations
        .mockResolvedValueOnce([{ _id: null, total: 50000 }]) // Member deposits
        .mockResolvedValueOnce([{ _id: null, total: 15000 }]) // Member withdrawals
        .mockResolvedValueOnce([{ _id: null, total: 5000 }]); // Member processing

      const result = await service.getWalletMeta(chamaId, memberId);

      expect(result).toEqual({
        groupMeta: {
          groupDeposits: 100000,
          groupWithdrawals: 30000,
          groupBalance: 60000,
        },
        memberMeta: {
          memberDeposits: 50000,
          memberWithdrawals: 15000,
          memberBalance: 30000,
        },
      });
    });

    it('should return only group metadata when memberId is not provided', async () => {
      const chamaId = 'chama123';

      walletRepository.model.aggregate
        .mockResolvedValueOnce([{ _id: null, total: 100000 }])
        .mockResolvedValueOnce([{ _id: null, total: 30000 }])
        .mockResolvedValueOnce([{ _id: null, total: 10000 }]);

      const result = await service.getWalletMeta(chamaId);

      expect(result).toEqual({
        groupMeta: {
          groupDeposits: 100000,
          groupWithdrawals: 30000,
          groupBalance: 60000,
        },
      });
      expect(result.memberMeta).toBeUndefined();
    });
  });

  describe('validateWithdrawalAmount', () => {
    it('should validate withdrawal when balance is sufficient', async () => {
      const chamaId = 'chama123';

      walletRepository.model.aggregate
        .mockResolvedValueOnce([{ _id: null, total: 100000 }])
        .mockResolvedValueOnce([{ _id: null, total: 30000 }])
        .mockResolvedValueOnce([{ _id: null, total: 10000 }]);

      const result = await service.validateWithdrawalAmount(chamaId, 50000);

      expect(result).toEqual({
        isValid: true,
        currentBalance: 60000,
      });
    });

    it('should reject withdrawal when balance is insufficient', async () => {
      const chamaId = 'chama123';

      walletRepository.model.aggregate
        .mockResolvedValueOnce([{ _id: null, total: 100000 }])
        .mockResolvedValueOnce([{ _id: null, total: 30000 }])
        .mockResolvedValueOnce([{ _id: null, total: 10000 }]);

      const result = await service.validateWithdrawalAmount(chamaId, 70000);

      expect(result).toEqual({
        isValid: false,
        currentBalance: 60000,
        reason:
          'Insufficient balance. Available: 60000 msats, Requested: 70000 msats',
      });
    });

    it('should consider processing withdrawals in validation', async () => {
      const chamaId = 'chama123';

      walletRepository.model.aggregate
        .mockResolvedValueOnce([{ _id: null, total: 100000 }])
        .mockResolvedValueOnce([{ _id: null, total: 30000 }])
        .mockResolvedValueOnce([{ _id: null, total: 40000 }]); // Large processing amount

      const result = await service.validateWithdrawalAmount(chamaId, 35000);

      expect(result).toEqual({
        isValid: false,
        currentBalance: 30000, // 100000 - 30000 - 40000
        reason:
          'Insufficient balance. Available: 30000 msats, Requested: 35000 msats',
      });
    });
  });

  describe('getPendingWithdrawals', () => {
    it('should return pending withdrawals', async () => {
      const chamaId = 'chama123';
      const pendingWithdrawals = [
        { _id: '1', status: ChamaTxStatus.PENDING },
        { _id: '2', status: ChamaTxStatus.PENDING },
      ];

      walletRepository.find.mockResolvedValue(pendingWithdrawals as any);

      const result = await service.getPendingWithdrawals(chamaId);

      expect(result).toEqual(pendingWithdrawals);
      expect(walletRepository.find).toHaveBeenCalledWith({
        chamaId,
        type: TransactionType.WITHDRAW,
        status: ChamaTxStatus.PENDING,
      });
    });

    it('should handle errors and return empty array', async () => {
      walletRepository.find.mockRejectedValue(new Error('Database error'));

      const result = await service.getPendingWithdrawals('chama123');

      expect(result).toEqual([]);
    });
  });

  describe('getLockedFunds', () => {
    it('should calculate total locked funds correctly', async () => {
      const chamaId = 'chama123';

      walletRepository.model.aggregate
        .mockResolvedValueOnce([{ _id: null, total: 25000 }]) // Pending + Approved
        .mockResolvedValueOnce([{ _id: null, total: 15000 }]); // Processing

      const result = await service.getLockedFunds(chamaId);

      expect(result).toBe(40000); // 25000 + 15000
    });

    it('should handle empty results', async () => {
      walletRepository.model.aggregate.mockResolvedValue([]);

      const result = await service.getLockedFunds('chama123');

      expect(result).toBe(0);
    });
  });

  describe('getTransactionStats', () => {
    it('should return comprehensive transaction statistics', async () => {
      const chamaId = 'chama123';

      walletRepository.model.countDocuments
        .mockResolvedValueOnce(50) // Deposit count
        .mockResolvedValueOnce(20); // Withdrawal count

      walletRepository.model.aggregate
        .mockResolvedValueOnce([{ _id: null, total: 500000 }]) // Deposit total
        .mockResolvedValueOnce([{ _id: null, total: 200000 }]) // Withdrawal total
        .mockResolvedValueOnce([{ _id: null, total: 50000 }]) // Pending withdrawals
        .mockResolvedValueOnce([{ _id: null, total: 30000 }]); // Processing withdrawals

      const result = await service.getTransactionStats(chamaId);

      expect(result).toEqual({
        totalTransactions: 70,
        deposits: {
          count: 50,
          total: 500000,
        },
        withdrawals: {
          count: 20,
          total: 200000,
          pending: 50000,
          processing: 30000,
        },
      });
    });

    it('should handle errors and return zero statistics', async () => {
      walletRepository.model.countDocuments.mockRejectedValue(
        new Error('Database error'),
      );

      const result = await service.getTransactionStats('chama123');

      expect(result).toEqual({
        totalTransactions: 0,
        deposits: { count: 0, total: 0 },
        withdrawals: { count: 0, total: 0, pending: 0, processing: 0 },
      });
    });
  });
});
