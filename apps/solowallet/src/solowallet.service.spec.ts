import { TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createTestingModuleWithValidation } from '@bitsacco/testing';
import {
  TransactionStatus,
  TransactionType,
  FedimintService,
  LnurlMetricsService,
  SWAP_SERVICE_NAME,
} from '@bitsacco/common';
import { SolowalletMetricsService } from './solowallet.metrics';
import { Logger } from '@nestjs/common';

import { SolowalletService } from './solowallet.service';
import { SolowalletDocument, SolowalletRepository } from './db';

describe('SolowalletService', () => {
  let app: TestingModule;
  let service: SolowalletService;
  let repository: SolowalletRepository;
  let fedimintService: FedimintService;
  let eventEmitter: EventEmitter2;

  // Mock model
  class MockModel {
    constructor(private data: any) {}
    static find = jest.fn().mockResolvedValue([]);
    static findOne = jest.fn();
    static findOneAndUpdate = jest.fn();
    static create = jest.fn();
    static aggregate = jest.fn().mockResolvedValue([{ totalMsats: 1000000 }]);
    save = jest.fn().mockResolvedValue(this.data);
  }

  // Set up mocks before running tests
  beforeAll(async () => {
    const mockFedimintService = {
      pay: jest
        .fn()
        .mockResolvedValue({ operationId: 'test-op-id', fee: 1000 }),
      decode: jest.fn().mockResolvedValue({
        amountMsats: '50000',
        description: 'Test invoice',
      }),
      invoice: jest.fn().mockResolvedValue({
        invoice: 'test-invoice',
        operationId: 'test-op-id',
      }),
      receive: jest.fn(),
      createLnUrlWithdrawPoint: jest.fn().mockResolvedValue({
        lnurl: 'lnurl1dp68gurn8ghj7ctsdyhxkmmvd9sxsctvdskcgty049x',
        k1: 'test-k1',
        callback: 'https://bitsacco.com/lnurl/callback',
        expiresAt: 1677777777,
      }),
    };

    const mockSwapService = {
      getService: jest.fn().mockReturnValue({
        getQuote: jest.fn().mockResolvedValue({
          amountMsats: 50000,
          quote: { id: 'quote-id', exchangeRate: 1.0 },
        }),
      }),
    };

    // Create testing module
    app = await createTestingModuleWithValidation({
      imports: [],
      providers: [
        SolowalletService,
        SolowalletRepository,
        {
          provide: getModelToken(SolowalletDocument.name),
          useValue: MockModel,
        },
        {
          provide: FedimintService,
          useValue: mockFedimintService,
        },
        {
          provide: EventEmitter2,
          useValue: {
            on: jest.fn(),
            emit: jest.fn(),
          },
        },
        {
          provide: SWAP_SERVICE_NAME,
          useValue: mockSwapService,
        },
        {
          provide: LnurlMetricsService,
          useValue: {
            recordWithdrawalMetric: jest.fn(),
            getMetrics: jest.fn(),
            resetMetrics: jest.fn(),
          },
        },
        {
          provide: SolowalletMetricsService,
          useValue: {
            recordDepositMetric: jest.fn(),
            recordWithdrawalMetric: jest.fn(),
            recordBalanceMetric: jest.fn(),
          },
        },
        Logger,
      ],
    });

    // Get service and mocks from the testing module
    service = app.get<SolowalletService>(SolowalletService);
    repository = app.get<SolowalletRepository>(SolowalletRepository);
    fedimintService = app.get<FedimintService>(FedimintService);
    eventEmitter = app.get<EventEmitter2>(EventEmitter2);

    // Mock internal service methods
    jest.spyOn(service as any, 'getPaginatedUserTxLedger').mockResolvedValue({
      transactions: [],
      page: 0,
      size: 10,
      pages: 1,
    });

    jest.spyOn(service as any, 'getWalletMeta').mockResolvedValue({
      totalDeposits: 1000000,
      totalWithdrawals: 51000,
      currentBalance: 949000,
    });

    // Setup repository mocks
    jest.spyOn(repository, 'create').mockImplementation((data: any) => {
      const isLnurl = JSON.stringify(data.lightning).includes('lnurl');
      return Promise.resolve({
        _id: isLnurl ? 'lnurl-withdrawal-id' : 'test-withdrawal-id',
        userId: data.userId,
        amountMsats: data.amountMsats,
        amountFiat: data.amountFiat,
        lightning: data.lightning,
        paymentTracker: data.paymentTracker,
        type: data.type,
        status: data.status,
        reference: data.reference,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as SolowalletDocument);
    });
  });

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(repository).toBeDefined();
    expect(fedimintService).toBeDefined();
  });

  describe('withdrawFunds', () => {
    it('should process lightning invoice withdrawal', async () => {
      const result = await service.withdrawFunds({
        userId: 'test-user',
        amountFiat: 100,
        reference: 'Test withdrawal',
        lightning: { invoice: 'lnbc500n1p3zg5k2pp5...' },
      });

      expect(result).toBeDefined();
      expect(result.txId).toBe('test-withdrawal-id');
      expect(fedimintService.pay).toHaveBeenCalledWith(
        'lnbc500n1p3zg5k2pp5...',
      );
      expect(fedimintService.decode).toHaveBeenCalledWith(
        'lnbc500n1p3zg5k2pp5...',
      );

      // Verify repository.create was called with correct params
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'test-user',
          amountMsats: 51000, // 50000 + 1000 fee
          amountFiat: 100,
          type: TransactionType.WITHDRAW,
          status: TransactionStatus.COMPLETE,
        }),
      );
    });

    it('should throw an error when lightning invoice amount exceeds balance', async () => {
      // Mock decode to return a large amount
      jest.spyOn(fedimintService, 'decode').mockResolvedValueOnce({
        amountMsats: '2000000', // Exceeds the 949000 balance
        description: 'Large invoice',
        paymentHash: '',
        timestamp: Date.now(),
      });

      await expect(
        service.withdrawFunds({
          userId: 'test-user',
          amountFiat: 200,
          reference: 'Too large withdrawal',
          lightning: { invoice: 'lnbc2000000n1p3zg5k2pp5...' },
        }),
      ).rejects.toThrow('Invoice amount exceeds available balance');

      // Verify that no withdrawal was created
      expect(repository.create).not.toHaveBeenCalled();
    });

    // Test for LNURL metrics implementation
    it('LNURL metrics are properly implemented', async () => {
      // Setup for LNURL metrics testing
      const mockLnurlMetricsService =
        app.get<LnurlMetricsService>(LnurlMetricsService);
      const mockWallet = app.get<SolowalletRepository>(SolowalletRepository);

      // Mock wallet.findOne to return a test document
      jest.spyOn(mockWallet, 'findOne').mockResolvedValueOnce({
        _id: 'lnurl-withdrawal-id',
        userId: 'test-user',
        amountMsats: 50000,
        amountFiat: 100,
        paymentTracker: 'test-k1',
        status: TransactionStatus.PENDING,
        type: TransactionType.WITHDRAW,
        lightning: JSON.stringify({
          lnurlWithdrawPoint: {
            k1: 'test-k1',
            callback: 'https://test.com/callback',
            expiresAt: Date.now() / 1000 + 3600, // 1 hour from now
          },
        }),
        reference: 'Test withdrawal',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as SolowalletDocument);

      // Mock the fedimintService.decode and pay methods
      jest.spyOn(fedimintService, 'decode').mockResolvedValueOnce({
        amountMsats: '40000',
        description: 'Test invoice',
        paymentHash: 'hash',
        timestamp: Date.now(),
      });

      jest.spyOn(fedimintService, 'pay').mockResolvedValueOnce({
        operationId: 'test-operation-id',
        fee: 1000,
      });

      // Mock wallet.findOneAndUpdate to return an updated document
      jest.spyOn(mockWallet, 'findOneAndUpdate').mockResolvedValueOnce({
        _id: 'lnurl-withdrawal-id',
        userId: 'test-user',
        amountMsats: 41000, // 40000 + 1000 fee
        amountFiat: 100,
        status: TransactionStatus.COMPLETE,
        type: TransactionType.WITHDRAW,
        reference: 'Test withdrawal',
      } as SolowalletDocument);

      // Call the method we're testing
      const result = await service.processLnUrlWithdrawCallback(
        'test-k1',
        'lnbc500n1p3zg5k2pp5...',
      );

      // Verify the result is correct
      expect(result.success).toBe(true);
      expect(result.txId).toBe('lnurl-withdrawal-id');

      // Verify that metrics were recorded
      expect(
        mockLnurlMetricsService.recordWithdrawalMetric,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          duration: expect.any(Number),
          amountMsats: 41000,
          amountFiat: 100,
        }),
      );
    });
  });
});
