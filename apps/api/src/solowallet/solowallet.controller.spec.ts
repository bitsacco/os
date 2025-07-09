import { TestingModule } from '@nestjs/testing';
import { SolowalletController } from './solowallet.controller';
import { SolowalletService } from './solowallet.service';
import {
  createTestingModuleWithValidation,
  provideJwtAuthStrategyMocks,
} from '@bitsacco/testing';
import { ConfigService } from '@nestjs/config';

describe('SolowalletController', () => {
  let controller: SolowalletController;
  let mockSolowalletService: Partial<SolowalletService>;

  beforeEach(async () => {
    // Create mock for SolowalletService
    mockSolowalletService = {
      findTransaction: jest.fn().mockResolvedValue({}),
      depositFunds: jest.fn().mockResolvedValue({}),
      withdrawFunds: jest.fn().mockResolvedValue({}),
      userTransactions: jest.fn().mockResolvedValue({}),
      continueDepositFunds: jest.fn().mockResolvedValue({}),
      continueWithdrawFunds: jest.fn().mockResolvedValue({}),
      updateTransaction: jest.fn().mockResolvedValue({}),
      processLnUrlWithdrawCallback: jest
        .fn()
        .mockResolvedValue({ success: true }),
      findPendingLnurlWithdrawal: jest.fn().mockResolvedValue({
        id: 'test-id',
        status: 'PENDING',
        amountMsats: 50000,
      }),
    };

    const mockConfigService = {
      getOrThrow: jest.fn().mockReturnValue('https://test.com/lnurl/callback'),
    };

    const jwtAuthMocks = provideJwtAuthStrategyMocks();

    const module: TestingModule = await createTestingModuleWithValidation({
      controllers: [SolowalletController],
      providers: [
        {
          provide: SolowalletService,
          useValue: mockSolowalletService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        ...jwtAuthMocks,
      ],
    });

    controller = module.get<SolowalletController>(SolowalletController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
