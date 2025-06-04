import { TestingModule } from '@nestjs/testing';
import { createTestingModuleWithValidation } from '@bitsacco/testing';
import { SolowalletController } from './solowallet.controller';
import { SolowalletService } from './solowallet.service';
import { FedimintService, LnurlMetricsService } from '@bitsacco/common';
import { TransactionStatus } from '@bitsacco/common';
import { ConfigService } from '@nestjs/config';

// Mock implementations
const mockSolowalletService = {
  findPendingLnurlWithdrawal: jest.fn(),
  processLnUrlWithdrawCallback: jest.fn(),
  depositFunds: jest.fn(),
  withdrawFunds: jest.fn(),
  userTransactions: jest.fn(),
  updateTransaction: jest.fn(),
  continueTransaction: jest.fn(),
  findTransaction: jest.fn(),
};

const mockFedimintService = {
  createLnUrlWithdrawPoint: jest.fn(),
  pay: jest.fn(),
  receive: jest.fn(),
  invoice: jest.fn(),
};

const mockLnurlMetricsService = {
  recordWithdrawalMetric: jest.fn(),
  getMetrics: jest.fn(),
  resetMetrics: jest.fn(),
};
const callback = 'https://example.com/withdraw/callback';
const mockConfigService = {
  getOrThrow: jest.fn().mockImplementation((key, defaultValue) => {
    const config = {
      LNURL_CALLBACK: callback,
    };
    return config[key] || defaultValue;
  }),
};

describe('SolowalletController', () => {
  let controller: SolowalletController;
  let service: SolowalletService;

  beforeEach(async () => {
    const app: TestingModule = await createTestingModuleWithValidation({
      controllers: [SolowalletController],
      providers: [
        {
          provide: SolowalletService,
          useValue: mockSolowalletService,
        },
        {
          provide: FedimintService,
          useValue: mockFedimintService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: LnurlMetricsService,
          useValue: mockLnurlMetricsService,
        },
      ],
    });

    controller = app.get<SolowalletController>(SolowalletController);
    service = app.get<SolowalletService>(SolowalletService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('processLnUrlWithdraw', () => {
    const k1 = '1234567890abcdef';
    const pr =
      'lnbc1m1pj9npjfpp5qtgahqghjqdd3qwdsk33zut0r8uhfazuuckfrlhpvp4d689swsdsdqqcqzpgxqyz5vqsp5yxr67trxm66s8yn7m7nclfzcyjrhswhvwvfv05fqlfg5xtytlf4q9qyyssq340zakmv7c9d34dx5lnsd4r0qkv88qspcgnetl4xf83yg8g67axfw7u8q3hlcmpvk93zdexyru6r3hs5wvdffux4l6nj08nfj7syjhspwusd9v';
    const maxWithdrawable = '100000';

    describe('First handshake step (tag=withdrawRequest)', () => {
      it('should handle first step of LNURL withdraw handshake', async () => {
        // Mock a pending transaction with amount matching maxWithdrawable
        const mockTx = {
          id: 'test-tx-1',
          status: TransactionStatus.PENDING,
          amountMsats: 100000,
        };
        mockSolowalletService.findPendingLnurlWithdrawal.mockResolvedValue(
          mockTx,
        );

        const defaultDescription = 'Withdraw from Bitsacco';
        const minWithdrawable = '1000';

        const result = await controller.processLnUrlWithdraw({
          k1,
          maxWithdrawable,
          tag: 'withdrawRequest',
          callback,
          defaultDescription,
          minWithdrawable,
        });

        expect(
          mockSolowalletService.findPendingLnurlWithdrawal,
        ).toHaveBeenCalledWith(k1);
        expect(
          mockSolowalletService.processLnUrlWithdrawCallback,
        ).not.toHaveBeenCalled();

        expect(result).toEqual({
          tag: 'withdrawRequest',
          callback,
          k1,
          defaultDescription,
          minWithdrawable,
          maxWithdrawable,
        });
      });

      it('should return error when maxWithdrawable exceeds expected amount', async () => {
        // Mock a pending transaction with amount LESS than maxWithdrawable
        const mockTx = {
          id: 'test-tx-1',
          status: TransactionStatus.PENDING,
          amountMsats: 50000, // Less than maxWithdrawable (100000)
        };
        mockSolowalletService.findPendingLnurlWithdrawal.mockResolvedValue(
          mockTx,
        );

        const result = await controller.processLnUrlWithdraw({
          k1,
          maxWithdrawable,
          tag: 'withdrawRequest',
        });

        expect(
          mockSolowalletService.findPendingLnurlWithdrawal,
        ).toHaveBeenCalledWith(k1);
        expect(
          mockSolowalletService.processLnUrlWithdrawCallback,
        ).not.toHaveBeenCalled();
        expect(result).toEqual({
          status: 'ERROR',
          reason: 'maxWithdrawable exceeds expected amount',
        });
      });
    });

    describe('Second handshake step (invoice processing)', () => {
      it('should process a valid LNURL withdrawal', async () => {
        // Mock a pending transaction
        const mockTx = {
          id: 'test-tx-1',
          status: TransactionStatus.PENDING,
        };
        mockSolowalletService.findPendingLnurlWithdrawal.mockResolvedValue(
          mockTx,
        );

        // Mock a successful callback processing
        mockSolowalletService.processLnUrlWithdrawCallback.mockResolvedValue({
          success: true,
        });

        const result = await controller.processLnUrlWithdraw({ k1, pr });

        expect(
          mockSolowalletService.findPendingLnurlWithdrawal,
        ).toHaveBeenCalledWith(k1);
        expect(
          mockSolowalletService.processLnUrlWithdrawCallback,
        ).toHaveBeenCalledWith(k1, pr);
        expect(result).toEqual({
          status: 'OK',
        });
      });

      it('should handle transaction not found', async () => {
        // Mock no transaction found
        mockSolowalletService.findPendingLnurlWithdrawal.mockResolvedValue(
          null,
        );

        // Reset mock before test
        mockSolowalletService.processLnUrlWithdrawCallback.mockReset();

        const result = await controller.processLnUrlWithdraw({ k1, pr });

        expect(
          mockSolowalletService.findPendingLnurlWithdrawal,
        ).toHaveBeenCalledWith(k1);
        expect(
          mockSolowalletService.processLnUrlWithdrawCallback,
        ).not.toHaveBeenCalled();
        expect(result).toEqual({
          status: 'ERROR',
          reason: 'Withdrawal request not found or expired',
        });
      });

      it('should handle non-pending transaction', async () => {
        // Mock a completed transaction
        const mockTx = {
          id: 'test-tx-1',
          status: TransactionStatus.COMPLETE,
        };
        mockSolowalletService.findPendingLnurlWithdrawal.mockResolvedValue(
          mockTx,
        );

        // Reset mock before test
        mockSolowalletService.processLnUrlWithdrawCallback.mockReset();

        const result = await controller.processLnUrlWithdraw({ k1, pr });

        expect(
          mockSolowalletService.findPendingLnurlWithdrawal,
        ).toHaveBeenCalledWith(k1);
        expect(
          mockSolowalletService.processLnUrlWithdrawCallback,
        ).not.toHaveBeenCalled();
        expect(result).toEqual({
          status: 'ERROR',
          reason: 'LNURL withdrawal is now invalid or expired',
        });
      });

      it('should handle processLnUrlWithdrawCallback failure', async () => {
        // Mock a pending transaction
        const mockTx = {
          id: 'test-tx-1',
          status: TransactionStatus.PENDING,
        };
        mockSolowalletService.findPendingLnurlWithdrawal.mockResolvedValue(
          mockTx,
        );

        // Mock a failed callback processing
        mockSolowalletService.processLnUrlWithdrawCallback.mockResolvedValue({
          success: false,
          message: 'Invoice payment failed',
        });

        const result = await controller.processLnUrlWithdraw({ k1, pr });

        expect(
          mockSolowalletService.findPendingLnurlWithdrawal,
        ).toHaveBeenCalledWith(k1);
        expect(
          mockSolowalletService.processLnUrlWithdrawCallback,
        ).toHaveBeenCalledWith(k1, pr);
        expect(result).toEqual({
          status: 'ERROR',
          reason: 'Invoice payment failed',
        });
      });
    });

    it('should handle unexpected errors', async () => {
      // Mock an error during processing
      mockSolowalletService.findPendingLnurlWithdrawal.mockRejectedValue(
        new Error('Database connection error'),
      );

      const result = await controller.processLnUrlWithdraw({ k1, pr });

      expect(
        mockSolowalletService.findPendingLnurlWithdrawal,
      ).toHaveBeenCalledWith(k1);
      expect(result).toEqual({
        status: 'ERROR',
        reason: 'Database connection error', // Controller returns actual error message
      });
    });
  });
});
