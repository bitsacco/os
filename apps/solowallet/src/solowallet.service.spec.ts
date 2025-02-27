import { SolowalletService } from './solowallet.service';
import { TransactionStatus, TransactionType } from '@bitsacco/common';

describe('SolowalletService', () => {
  let service: SolowalletService;

  // Define mock implementations
  const mockRepository = {
    create: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    aggregate: jest.fn().mockResolvedValue([{ totalMsats: 1000000 }]),
  };

  const mockFedimintService = {
    pay: jest.fn().mockResolvedValue({ operationId: 'test-op-id', fee: 1000 }),
    decode: jest
      .fn()
      .mockResolvedValue({ amountMsats: '50000', description: 'Test invoice' }),
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

  const mockEventEmitter = {
    on: jest.fn(),
    emit: jest.fn(),
  };

  const mockSwapClient = {
    getQuote: jest.fn().mockResolvedValue({
      amountMsats: 50000,
      quote: { id: 'quote-id', exchangeRate: 1.0 },
    }),
  };

  const mockGrpcClient = {
    getService: jest.fn().mockReturnValue(mockSwapClient),
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create service instance with mocked dependencies
    service = new SolowalletService(
      mockRepository,
      mockFedimintService,
      mockEventEmitter as any,
      mockGrpcClient as any,
    );

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

    // Setup consistent repository response for withdrawals
    mockRepository.create.mockImplementation((data) => {
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
      });
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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
      expect(mockFedimintService.pay).toHaveBeenCalledWith(
        'lnbc500n1p3zg5k2pp5...',
      );
      expect(mockFedimintService.decode).toHaveBeenCalledWith(
        'lnbc500n1p3zg5k2pp5...',
      );

      // Verify wallet.create was called with correct params
      expect(mockRepository.create).toHaveBeenCalledWith(
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
      mockFedimintService.decode.mockResolvedValueOnce({
        amountMsats: '2000000', // Exceeds the 949000 balance
        description: 'Large invoice',
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
      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });
});
