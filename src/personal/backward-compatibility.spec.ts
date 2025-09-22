import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SolowalletService } from '../solowallet/solowallet.service';
import { SolowalletRepository } from '../solowallet/db/solowallet.repository';
import { SolowalletDocument } from '../solowallet/db/solowallet.schema';
import { SolowalletMetricsService } from '../solowallet/solowallet.metrics';
import { PersonalWalletService } from './services/personal-wallet.service';
import { FedimintService, TimeoutConfigService } from '../common';
import { SwapService } from '../swap/swap.service';
import {
  WalletType,
  TransactionType,
  TransactionStatus,
  DepositFundsRequestDto,
  WithdrawFundsRequestDto,
} from '../common';

describe('Backward Compatibility Tests', () => {
  let solowalletService: SolowalletService;
  let personalWalletService: PersonalWalletService;
  let solowalletRepository: jest.Mocked<SolowalletRepository>;

  const mockSolowalletDocument = {
    _id: 'tx123',
    userId: 'user123',
    amountMsats: 100000,
    amountFiat: 100,
    type: TransactionType.DEPOSIT,
    status: TransactionStatus.COMPLETE,
    lightning: '{}',
    paymentTracker: 'tracker123',
    reference: 'test deposit',
    walletType: WalletType.STANDARD,
    walletId: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockSolowalletRepository = {
      create: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
      findOneAndUpdate: jest.fn(),
      deleteMany: jest.fn(),
    };

    const mockFedimintService = {
      receive: jest.fn(),
      pay: jest.fn().mockResolvedValue({
        operationId: 'op456',
        amountMsats: 50000,
        feeMsats: 1000,
      }),
      getBalance: jest.fn(),
      invoice: jest.fn().mockResolvedValue({
        invoice: 'lnbc1...',
        operationId: 'op123',
      }),
      decode: jest.fn().mockResolvedValue({
        amountMsats: 50000,
        description: 'test',
      }),
    };

    const mockSwapService = {
      getQuote: jest.fn().mockResolvedValue({ rate: 1.0 }),
      createSwap: jest.fn(),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
      on: jest.fn(),
    };

    const mockMetricsService = {
      trackTransaction: jest.fn(),
      trackWalletCreation: jest.fn(),
      recordDepositMetric: jest.fn(),
      recordWithdrawalMetric: jest.fn(),
      recordBalanceMetric: jest.fn(),
    };

    const mockTimeoutConfigService = {
      getTimeoutConfig: jest.fn().mockReturnValue({
        timeoutAt: new Date(Date.now() + 900000), // 15 minutes
      }),
      calculateTimeoutDate: jest
        .fn()
        .mockReturnValue(new Date(Date.now() + 900000)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SolowalletService,
        PersonalWalletService,
        { provide: SolowalletRepository, useValue: mockSolowalletRepository },
        { provide: FedimintService, useValue: mockFedimintService },
        { provide: SwapService, useValue: mockSwapService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: SolowalletMetricsService, useValue: mockMetricsService },
        { provide: TimeoutConfigService, useValue: mockTimeoutConfigService },
        {
          provide: getModelToken(SolowalletDocument.name),
          useValue: {},
        },
      ],
    }).compile();

    solowalletService = module.get<SolowalletService>(SolowalletService);
    personalWalletService = module.get<PersonalWalletService>(
      PersonalWalletService,
    );
    solowalletRepository = module.get(SolowalletRepository);
  });

  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();

    // Set default successful responses for all aggregate calls
    solowalletRepository.aggregate.mockResolvedValue([{ totalMsats: 1000000 }]); // 1M msats default balance
    solowalletRepository.findOne.mockResolvedValue(null);
    solowalletRepository.find.mockResolvedValue([]);
  });

  describe('Existing SolowalletService functionality', () => {
    describe('depositFunds', () => {
      it('should default to WalletType.STANDARD when no wallet type is specified', async () => {
        const depositDto: DepositFundsRequestDto = {
          userId: 'user123',
          amountFiat: 100,
          reference: 'test deposit',
        };

        // Mock repository responses
        solowalletRepository.findOne.mockResolvedValue(null); // No existing idempotency transaction

        const createdDocument = {
          ...mockSolowalletDocument,
          walletType: WalletType.STANDARD,
        };

        solowalletRepository.create.mockResolvedValue(createdDocument as any);
        solowalletRepository.find.mockResolvedValue([createdDocument]); // Return the created document
        solowalletRepository.aggregate.mockResolvedValue([{ totalMsats: 0 }]);

        const result = await solowalletService.depositFunds(depositDto);

        // Verify that the created document uses WalletType.STANDARD
        expect(solowalletRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            walletType: WalletType.STANDARD,
            userId: 'user123',
            amountFiat: 100,
            type: TransactionType.DEPOSIT,
          }),
        );
      });

      it('should preserve backward compatibility for existing API calls', async () => {
        const depositDto: DepositFundsRequestDto = {
          userId: 'user123',
          amountMsats: 100000,
          reference: 'direct lightning deposit',
        };

        // Mock repository responses
        solowalletRepository.findOne.mockResolvedValue(null); // No existing idempotency transaction

        const createdDocument = {
          ...mockSolowalletDocument,
          walletType: WalletType.STANDARD,
          amountMsats: 100000,
        };

        solowalletRepository.create.mockResolvedValue(createdDocument as any);
        solowalletRepository.find.mockResolvedValue([createdDocument]); // Return the created document
        solowalletRepository.aggregate.mockResolvedValue([{ totalMsats: 0 }]);

        const result = await solowalletService.depositFunds(depositDto);

        // Verify the transaction is created with correct defaults
        expect(solowalletRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            walletType: WalletType.STANDARD,
            userId: 'user123',
            amountMsats: 100000,
            type: TransactionType.DEPOSIT,
            walletId: undefined, // Should be undefined for standard wallet
          }),
        );
      });
    });

    describe('withdrawFunds', () => {
      it('should default to WalletType.STANDARD for withdrawals', async () => {
        const withdrawDto: WithdrawFundsRequestDto = {
          userId: 'user123',
          amountMsats: 50000, // Use msats directly to avoid conversion issues
          reference: 'test withdrawal',
          lightning: {
            invoice: 'lnbc1...',
          },
        };

        const mockPayResult = {
          operationId: 'op456',
          amountMsats: 50000,
          feeMsats: 1000,
        };

        // Mock repository responses
        solowalletRepository.findOne.mockResolvedValue(null); // No existing idempotency transaction

        const createdDocument = {
          ...mockSolowalletDocument,
          walletType: WalletType.STANDARD,
          type: TransactionType.WITHDRAW,
          amountMsats: 50000,
        };

        solowalletRepository.create.mockResolvedValue(createdDocument as any);
        solowalletRepository.find.mockResolvedValue([createdDocument]); // Return the created document

        // Mock balance calculation calls
        // totalDeposits: 600k msats
        // totalWithdrawals: 0 msats
        // processingWithdrawals: 0 msats
        // currentBalance = 600k - 0 - 0 = 600k msats (sufficient for 50k withdrawal)
        solowalletRepository.aggregate
          .mockResolvedValueOnce([{ totalMsats: 600000 }]) // totalDeposits
          .mockResolvedValueOnce([{ totalMsats: 0 }]) // totalWithdrawals
          .mockResolvedValueOnce([{ totalMsats: 0 }]); // processingWithdrawals

        const result = await solowalletService.withdrawFunds(withdrawDto);

        // Verify withdrawal uses WalletType.STANDARD by default
        expect(solowalletRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            walletType: WalletType.STANDARD,
            userId: 'user123',
            type: TransactionType.WITHDRAW,
          }),
        );
      });
    });

    describe('userTransactions', () => {
      it('should return all transactions including those with WalletType.STANDARD', async () => {
        const userTxsDto = {
          userId: 'user123',
          pagination: { page: 0, size: 10 },
        };

        const mockTransactions = [
          { ...mockSolowalletDocument, walletType: WalletType.STANDARD },
          {
            ...mockSolowalletDocument,
            _id: 'tx124',
            walletType: WalletType.TARGET,
          },
          {
            ...mockSolowalletDocument,
            _id: 'tx125',
            walletType: WalletType.LOCKED,
          },
        ];

        solowalletRepository.find.mockResolvedValue(mockTransactions as any[]);

        const result = await solowalletService.userTransactions(userTxsDto);

        expect(result).toBeDefined();
        expect(result.ledger.transactions).toHaveLength(3);

        // Verify that STANDARD wallet transactions are included
        const standardTx = result.ledger.transactions.find(
          (tx) => tx.id === 'tx123',
        );
        expect(standardTx).toBeDefined();
      });
    });
  });

  describe('Data model backward compatibility', () => {
    it('should handle existing documents without wallet type fields', async () => {
      // Simulate existing documents that don't have the new fields
      const legacyDocument = {
        _id: 'legacy123',
        userId: 'user123',
        amountMsats: 100000,
        amountFiat: 100,
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.COMPLETE,
        lightning: '{}',
        paymentTracker: 'tracker123',
        reference: 'legacy deposit',
        createdAt: new Date(),
        updatedAt: new Date(),
        // No walletType, walletId, or other new fields
      };

      solowalletRepository.find.mockResolvedValue([legacyDocument] as any[]);

      const result = await solowalletService.userTransactions({
        userId: 'user123',
      });

      expect(result).toBeDefined();
      expect(result.ledger.transactions).toHaveLength(1);

      // The transaction should still be processed correctly
      const transaction = result.ledger.transactions[0];
      expect(transaction.userId).toBe('user123');
      expect(transaction.amountMsats).toBe(100000);
    });

    it('should work with mixed old and new transaction formats', async () => {
      const mixedTransactions = [
        // Legacy transaction without new fields
        {
          _id: 'legacy123',
          userId: 'user123',
          amountMsats: 100000,
          type: TransactionType.DEPOSIT,
          status: TransactionStatus.COMPLETE,
          lightning: '{}',
          paymentTracker: 'tracker123',
          reference: 'legacy deposit',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        // New transaction with wallet type
        {
          _id: 'new123',
          userId: 'user123',
          amountMsats: 50000,
          type: TransactionType.DEPOSIT,
          status: TransactionStatus.COMPLETE,
          lightning: '{}',
          paymentTracker: 'tracker124',
          reference: 'target deposit',
          walletType: WalletType.TARGET,
          walletId: 'target_wallet_123',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      solowalletRepository.find.mockResolvedValue(mixedTransactions as any[]);

      const result = await solowalletService.userTransactions({
        userId: 'user123',
      });

      expect(result.ledger.transactions).toHaveLength(2);

      // Both transactions should be processed correctly
      const legacyTx = result.ledger.transactions.find(
        (tx) => tx.id === 'legacy123',
      );
      const newTx = result.ledger.transactions.find((tx) => tx.id === 'new123');

      expect(legacyTx).toBeDefined();
      expect(newTx).toBeDefined();
    });
  });

  describe('API endpoint backward compatibility', () => {
    it('should maintain exact same response format for existing endpoints', async () => {
      const depositDto: DepositFundsRequestDto = {
        userId: 'user123',
        amountFiat: 100,
        reference: 'test deposit',
      };

      const mockLightning = {
        invoice: 'lnbc1...',
        operationId: 'op123',
      };

      const mockQuote = { rate: 1.0 };

      // Mock repository responses (same pattern as other tests)
      solowalletRepository.findOne.mockResolvedValue(null); // No existing idempotency transaction

      const createdDocument = {
        ...mockSolowalletDocument,
        walletType: WalletType.STANDARD,
      };

      solowalletRepository.create.mockResolvedValue(createdDocument as any);
      solowalletRepository.find.mockResolvedValue([createdDocument]); // Return the created document

      const result = await solowalletService.depositFunds(depositDto);

      // Verify response structure matches existing format
      expect(result).toHaveProperty('txId');
      expect(result).toHaveProperty('ledger');
      expect(result).toHaveProperty('meta');
      expect(result).toHaveProperty('userId');

      // The response should not expose internal wallet type fields
      // to maintain backward compatibility
      expect(result.ledger.transactions[0]).toHaveProperty('id');
      expect(result.ledger.transactions[0]).toHaveProperty('userId');
      expect(result.ledger.transactions[0]).toHaveProperty('amountMsats');
      expect(result.ledger.transactions[0]).toHaveProperty('status');
      expect(result.ledger.transactions[0]).toHaveProperty('type');
    });
  });
});
