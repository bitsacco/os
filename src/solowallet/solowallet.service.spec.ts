import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  TransactionStatus,
  TransactionType,
  FedimintService,
  TimeoutConfigService,
} from '../common';
import { SolowalletMetricsService } from './solowallet.metrics';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { SolowalletService } from './solowallet.service';
import { SolowalletDocument, SolowalletRepository } from './db';
import { SwapService } from '../swap/swap.service';

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
      initialize: jest.fn(),
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
      getQuote: jest.fn().mockResolvedValue({
        id: 'quote-id',
        amount: '50', // Amount in BTC (converted to sats then msats in service)
        rate: '1.0',
        from: 'KES',
        to: 'BTC',
        expiry: '1677777777',
      }),
      createOnrampSwap: jest.fn().mockResolvedValue({
        id: 'swap-id',
        status: TransactionStatus.PENDING,
      }),
      createOfframpSwap: jest.fn().mockResolvedValue({
        id: 'swap-id',
        status: TransactionStatus.PENDING,
        amountSats: '50000',
        lightning: 'test-invoice',
      }),
    };

    // Create testing module
    app = await Test.createTestingModule({
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
          provide: SwapService,
          useValue: mockSwapService,
        },
        {
          provide: SolowalletMetricsService,
          useValue: {
            recordDepositMetric: jest.fn(),
            recordWithdrawalMetric: jest.fn(),
            recordBalanceMetric: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              switch (key) {
                case 'SOLOWALLET_CLIENTD_BASE_URL':
                  return 'http://localhost:2121';
                case 'SOLOWALLET_CLIENTD_PASSWORD':
                  return 'password';
                case 'SOLOWALLET_FEDERATION_ID':
                  return 'federation123';
                case 'SOLOWALLET_GATEWAY_ID':
                  return 'gateway123';
                case 'SOLOWALLET_LNURL_CALLBACK':
                  return 'https://bitsacco.com/lnurl/callback';
                default:
                  return undefined;
              }
            }),
          },
        },
        {
          provide: TimeoutConfigService,
          useValue: {
            calculateTimeoutDate: jest.fn().mockReturnValue(new Date()),
            getConfig: jest.fn().mockReturnValue({
              pendingTimeoutMinutes: 15,
              processingTimeoutMinutes: 30,
              maxRetries: 3,
              depositTimeoutMinutes: 15,
              withdrawalTimeoutMinutes: 30,
              lnurlTimeoutMinutes: 30,
              offrampTimeoutMinutes: 15,
            }),
          },
        },
        Logger,
      ],
    }).compile();

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
  });
});
